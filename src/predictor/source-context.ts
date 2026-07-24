import { normalizeForSearch, normalizeText, uniqueTokens } from "../normalize.js";
import { BROAD_EVIDENCE_KINDS, CONFIDENCE_STRUCTURAL_EVIDENCE_KINDS } from "./scorer-registry.js";
import type {
  AnswerOption,
  AnswerScore,
  EvidenceItem,
  PredictionSources,
  SourceExcerpt,
  SourceHighlight,
} from "./types.js";

type PageBlock = {
  text: string;
  lineStart: number;
  lineEnd: number;
};

type SourcePageInput = {
  page: number;
  text: string;
  lines?: string[];
  blocks?: PageBlock[];
};

type PreparedWindow = {
  start: number;
  end: number;
  width: number;
  text: string;
  normalized: string;
  tokens: string[];
};

type PreparedPage = {
  page: SourcePageInput;
  blocks: PageBlock[];
  windows: PreparedWindow[];
};

type QuestionAnchor = {
  chunk?: {
    page?: number;
    text?: string;
  };
  score?: number;
};

type SourceContextOptions = {
  maxChars?: number;
  excerptsPerAnswer?: number;
};

type LocatedSpan = {
  start: number;
  end: number;
  localizationMatch: SourceExcerpt["localizationMatch"];
  strength: number;
};

const DEFAULT_MAX_CHARS = 1400;
const DEFAULT_EXCERPTS_PER_ANSWER = 1;
const preparedPageCache = new WeakMap<object, PreparedPage>();
const DISPLAY_GENERIC_TOKENS = new Set(
  uniqueTokens(
    "какой какие какова каковы выбрать укажите ответ вариант правильный верный следующий утверждение составляет является относится",
  ),
);

function clampInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(numeric)));
}

function round4(value: unknown) {
  const numeric = Number(value);
  return Math.round((Number.isFinite(numeric) ? numeric : 0) * 10000) / 10000;
}

function blocksForPage(page: SourcePageInput): PageBlock[] {
  if (Array.isArray(page?.blocks) && page.blocks.length) {
    return page.blocks
      .map((block) => ({
        text: String(block?.text ?? "").trim(),
        lineStart: Number(block?.lineStart ?? 0),
        lineEnd: Number(block?.lineEnd ?? block?.lineStart ?? 0),
      }))
      .filter((block: PageBlock) => block.text);
  }

  const textBlocks = String(page?.text ?? "")
    .split(/\n+/u)
    .map((text) => text.trim())
    .filter(Boolean);
  return textBlocks.map((text, index) => ({ text, lineStart: index, lineEnd: index }));
}

function preparePage(page: SourcePageInput): PreparedPage {
  if (page && typeof page === "object" && preparedPageCache.has(page)) return preparedPageCache.get(page)!;
  const blocks = blocksForPage(page);
  const windows: PreparedWindow[] = [];
  const maximumWindow = Math.min(4, blocks.length);
  for (let start = 0; start < blocks.length; start += 1) {
    for (let width = 1; width <= maximumWindow && start + width <= blocks.length; width += 1) {
      const end = start + width - 1;
      const text = blocks.slice(start, end + 1).map((block) => block.text).join(" ");
      windows.push({ start, end, width, text, normalized: normalizeForSearch(text), tokens: uniqueTokens(text) });
    }
  }
  const prepared = { page, blocks, windows };
  if (page && typeof page === "object") preparedPageCache.set(page, prepared);
  return prepared;
}

function tokenOverlap(left: string[], right: string[]) {
  if (!left.length || !right.length) return { hits: 0, recall: 0, precision: 0 };
  const rightSet = new Set(right);
  const leftSet = new Set(left);
  let hits = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) hits += 1;
  }
  return {
    hits,
    recall: hits / leftSet.size,
    precision: hits / Math.max(1, rightSet.size),
  };
}

function locateSpan(preparedPage: PreparedPage, needle: string, contextQuery = ""): LocatedSpan | null {
  const { blocks, windows } = preparedPage;
  const needleNormalized = normalizeForSearch(needle);
  const needleTokens = uniqueTokens(needle);
  const contextTokens = uniqueTokens(contextQuery);
  if (!needleNormalized || !needleTokens.length || !blocks.length) return null;

  let best: (LocatedSpan & { score: number; width: number }) | null = null;
  for (const window of windows) {
    const { start, end, width, text: candidateText, normalized: candidateNormalized, tokens: candidateTokens } = window;
    if (!candidateNormalized) continue;
    const exact = candidateText.replace(/\s+/gu, " ").trim().toLowerCase().includes(needle.replace(/\s+/gu, " ").trim().toLowerCase());
    const normalized = candidateNormalized.includes(needleNormalized);
    const reverseNormalized = needleNormalized.includes(candidateNormalized) && candidateNormalized.length >= 32;
    const overlap = tokenOverlap(needleTokens, candidateTokens);
    const contextOverlap = tokenOverlap(contextTokens, candidateTokens);
    if (!exact && !normalized && !reverseNormalized && overlap.hits < Math.min(2, needleTokens.length)) continue;
    if (reverseNormalized && !normalized && contextTokens.length && contextOverlap.hits === 0) continue;

    const score =
      (exact ? 8 : 0) +
      (normalized ? 6 : 0) +
      (reverseNormalized ? 2.5 : 0) +
      overlap.recall * 3.5 +
      overlap.precision * 1.5 +
      Math.min(0.8, overlap.hits * 0.08) +
      contextOverlap.recall * 4 +
      Math.min(1, contextOverlap.hits * 0.12);
    const localizationMatch: SourceExcerpt["localizationMatch"] = exact ? "exact" : normalized || reverseNormalized ? "normalized" : "approximate";
    if (!best || score > best.score + 0.0001 || (Math.abs(score - best.score) <= 0.0001 && width < best.width)) {
      best = { start, end, localizationMatch, strength: overlap.recall, score, width };
    }
  }

  if (!best) return null;
  if (best.localizationMatch === "approximate" && best.strength < 0.18) return null;
  return { start: best.start, end: best.end, localizationMatch: best.localizationMatch, strength: best.strength };
}

function startsListItem(text: string) {
  return /^\s*(?:[•*▪◦-]|\d+(?:\.\d+)*[.)]|[a-zа-я][.)])\s+/iu.test(text);
}

function structuralBoundary(text: string) {
  const clean = normalizeText(text);
  return (
    startsListItem(text) ||
    /^\d+(?:\.\d+){1,5}\.?\s+/u.test(clean) ||
    /^(?:уровень\s+(?:убедительности|достоверности)|ууд|уур|комментарий)\b/u.test(clean) ||
    /^(?:не\s+)?(?:рекомендуется|рекомендовано)\b/u.test(clean)
  );
}

function headingLike(text: string) {
  const clean = text.trim();
  return clean.length >= 4 && clean.length <= 120 && !/[.!?;]$/u.test(clean) && !startsListItem(clean);
}

function blockKind(evidenceKind: string, text: string): SourceExcerpt["blockKind"] {
  if (/^(?:coordinate_|visual_table_)|(?:table|row)/u.test(evidenceKind)) return "table_row";
  if (/recommendation|frequency_/u.test(evidenceKind) || /рекоменд|назнач|показан/u.test(normalizeText(text))) return "recommendation";
  if (startsListItem(text)) return "list_item";
  return "paragraph";
}

function joinedLength(blocks: PageBlock[], start: number, end: number) {
  return blocks.slice(start, end + 1).reduce((sum, block) => sum + block.text.length, 0) + Math.max(0, end - start);
}

function expandedRange(blocks: PageBlock[], located: LocatedSpan, kind: SourceExcerpt["blockKind"], softMax: number) {
  let start = located.start;
  let end = located.end;

  if (kind === "table_row") {
    if (start > 0 && headingLike(blocks[start - 1].text) && joinedLength(blocks, start - 1, end) <= softMax) start -= 1;
    return { start, end };
  }

  if (start > 0 && headingLike(blocks[start - 1].text) && !structuralBoundary(blocks[start - 1].text)) {
    if (joinedLength(blocks, start - 1, end) <= softMax) start -= 1;
  }

  if (kind === "recommendation" || kind === "list_item") return { start, end };

  return { start, end };
}

function searchFormWithMap(text: string) {
  let normalized = "";
  const map: number[] = [];
  let previousWasSpace = false;
  for (let index = 0; index < text.length; index += 1) {
    const folded = text[index].normalize("NFKC").toLowerCase().replace(/ё/gu, "е");
    for (const char of folded) {
      const previous = text[index - 1] ?? "";
      const next = text[index + 1] ?? "";
      let useful = " ";
      if (/[a-zа-я0-9%]/iu.test(char)) useful = char;
      else if (char === "≤") useful = "<=";
      else if (char === "≥") useful = ">=";
      else if (/[<>/=+]/u.test(char)) useful = char;
      else if (/[‐‑‒–—−-]/u.test(char)) useful = "-";
      else if (/[.,]/u.test(char) && /\d/u.test(previous) && /\d/u.test(next)) useful = ".";
      if (useful === " ") {
        if (!previousWasSpace && normalized.length) {
          normalized += " ";
          map.push(index);
          previousWasSpace = true;
        }
      } else {
        for (const emitted of useful) {
          normalized += emitted;
          map.push(index);
        }
        previousWasSpace = false;
      }
    }
  }
  if (normalized.endsWith(" ")) {
    normalized = normalized.slice(0, -1);
    map.pop();
  }
  return { normalized, map };
}

function strictNumericTokens(text: string) {
  return [
    ...new Set(
      searchFormWithMap(text).normalized.match(/(?:<=|>=|<|>)?\d+(?:\.\d+)?(?:[-/]\d+(?:\.\d+)?)?%?/gu) ?? [],
    ),
  ];
}

function containsBoundedToken(text: string, token: string) {
  return boundedSearchIndex(searchFormWithMap(text).normalized, token) >= 0;
}

function displayQuestionTokens(question: string) {
  return uniqueTokens(question).filter((token) => token.length >= 3 && !DISPLAY_GENERIC_TOKENS.has(token));
}

function boundedSearchIndex(haystack: string, needle: string) {
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) return -1;
    const before = haystack[index - 1] ?? " ";
    const after = haystack[index + needle.length] ?? " ";
    if (!/[a-zа-я0-9%]/iu.test(before) && !/[a-zа-я0-9%]/iu.test(after)) return index;
    from = index + 1;
  }
  return -1;
}

function exactHighlight(text: string, query: string, role: SourceHighlight["role"]): SourceHighlight | null {
  const haystack = searchFormWithMap(text);
  const needle = searchFormWithMap(query).normalized;
  if (!needle || !haystack.normalized) return null;
  const index = boundedSearchIndex(haystack.normalized, needle);
  if (index < 0) return null;
  const start = haystack.map[index];
  const last = haystack.map[index + needle.length - 1];
  if (start == null || last == null) return null;
  return { start, end: Math.min(text.length, last + 1), role };
}

function tokenHighlights(text: string, query: string, role: SourceHighlight["role"]): SourceHighlight[] {
  const exact = exactHighlight(text, query, role);
  if (exact) return [exact];
  const haystack = searchFormWithMap(text);
  const tokens = [...new Set(searchFormWithMap(query).normalized.split(/\s+/u))]
    .filter((token) => token.length >= 5 || /^\d{2,}/u.test(token))
    .sort((left, right) => right.length - left.length)
    .slice(0, 10);
  const highlights: SourceHighlight[] = [];
  for (const token of tokens) {
    const index = boundedSearchIndex(haystack.normalized, token);
    if (index < 0) continue;
    const start = haystack.map[index];
    const last = haystack.map[index + token.length - 1];
    if (start == null || last == null) continue;
    const next = { start, end: Math.min(text.length, last + 1), role };
    if (!highlights.some((item) => next.start < item.end && item.start < next.end)) highlights.push(next);
    if (highlights.length >= 6) break;
  }
  const numericTokens = tokens.filter((token) => /^\d/u.test(token));
  if (numericTokens.length && numericTokens.some((token) => boundedSearchIndex(haystack.normalized, token) < 0)) return [];
  if (tokens.length >= 3 && highlights.length / tokens.length < 0.34) return [];
  return highlights.sort((left, right) => left.start - right.start);
}

function paragraphRangeAt(text: string, start: number, end: number) {
  const paragraphStart = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextBreak = text.indexOf("\n", Math.max(start, end));
  return {
    start: paragraphStart,
    end: nextBreak < 0 ? text.length : nextBreak,
  };
}

function sentenceStartAt(text: string, offset: number, floor: number) {
  const prefix = text.slice(floor, offset);
  const boundary = /[.!?…](?:["»”')\]]*)\s+/gu;
  let start = floor;
  for (const match of prefix.matchAll(boundary)) start = floor + (match.index ?? 0) + match[0].length;
  return start;
}

function sentenceEndAt(text: string, offset: number, ceiling: number) {
  const suffix = text.slice(offset, ceiling);
  const match = /[.!?…](?:["»”')\]]*)(?=\s|$)/u.exec(suffix);
  return match ? offset + (match.index ?? 0) + match[0].length : ceiling;
}

function trimRange(text: string, start: number, end: number) {
  let cleanStart = start;
  let cleanEnd = end;
  while (cleanStart < cleanEnd && /\s/u.test(text[cleanStart])) cleanStart += 1;
  while (cleanEnd > cleanStart && /\s/u.test(text[cleanEnd - 1])) cleanEnd -= 1;
  return { start: cleanStart, end: cleanEnd };
}

function renderClippedRange(text: string, start: number, end: number, hardMax: number) {
  const clean = trimRange(text, start, end);
  const prefix = clean.start > 0 ? "…" : "";
  const suffix = clean.end < text.length ? "…" : "";
  const available = Math.max(1, hardMax - prefix.length - suffix.length);
  if (clean.end - clean.start > available) return null;
  return {
    text: `${prefix}${text.slice(clean.start, clean.end)}${suffix}`,
    truncated: clean.start > 0 || clean.end < text.length,
  };
}

function clipAroundHighlight(text: string, query: string, fallbackQuery: string, hardMax: number) {
  if (text.length <= hardMax) return { text, truncated: false };
  const highlight = exactHighlight(text, query, "answer") ?? exactHighlight(text, fallbackQuery, "answer");
  if (highlight) {
    const paragraph = paragraphRangeAt(text, highlight.start, highlight.end);
    const sentence = trimRange(
      text,
      sentenceStartAt(text, highlight.start, paragraph.start),
      sentenceEndAt(text, highlight.end, paragraph.end),
    );
    const nearbyChars = Math.max(80, Math.min(180, Math.round(hardMax * 0.16)));
    const expanded = {
      start: sentence.start - paragraph.start <= nearbyChars ? paragraph.start : sentence.start,
      end: paragraph.end - sentence.end <= nearbyChars ? paragraph.end : sentence.end,
    };
    const natural = renderClippedRange(text, expanded.start, expanded.end, hardMax)
      ?? renderClippedRange(text, sentence.start, sentence.end, hardMax);
    if (natural) return natural;
  }

  const center = highlight ? Math.floor((highlight.start + highlight.end) / 2) : Math.floor(text.length / 2);
  let start = Math.max(0, Math.min(text.length - hardMax, center - Math.floor(hardMax / 2)));
  let end = Math.min(text.length, start + hardMax);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  const available = Math.max(1, hardMax - prefix.length - suffix.length);
  if (end - start > available) {
    start = Math.max(0, Math.min(text.length - available, center - Math.floor(available / 2)));
    end = Math.min(text.length, start + available);
  }
  return { text: `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`, truncated: true };
}

function buildExcerpt({
  preparedPage,
  needle,
  highlightQuery,
  contextQuery,
  highlightRole,
  evidenceKind,
  origin,
  stance,
  score,
  maxChars,
}: {
  preparedPage: PreparedPage;
  needle: string;
  highlightQuery: string;
  contextQuery: string;
  highlightRole: SourceHighlight["role"];
  evidenceKind: string;
  origin: SourceExcerpt["origin"];
  stance: SourceExcerpt["stance"];
  score: number;
  maxChars: number;
}): SourceExcerpt | null {
  const { page, blocks } = preparedPage;
  const located = locateSpan(preparedPage, needle, contextQuery);
  if (!located) return null;
  const kind = blockKind(evidenceKind, blocks.slice(located.start, located.end + 1).map((block) => block.text).join(" "));
  const range = expandedRange(blocks, located, kind, maxChars);
  const selectedBlocks = blocks.slice(range.start, range.end + 1);
  const rawText = selectedBlocks.map((block) => block.text).join("\n");
  const clipped = clipAroundHighlight(rawText, highlightQuery || needle, needle, maxChars);
  const exactContent = exactHighlight(clipped.text, highlightQuery, highlightRole);
  const highlights = exactContent ? [exactContent] : tokenHighlights(clipped.text, highlightQuery, highlightRole);
  return {
    page: Number(page.page),
    text: clipped.text,
    lineStart: selectedBlocks[0].lineStart,
    lineEnd: selectedBlocks[selectedBlocks.length - 1].lineEnd,
    blockKind: kind,
    stance,
    highlights,
    origin,
    localizationMatch: located.localizationMatch,
    contentMatch: exactContent ? "exact" : highlights.length ? "partial" : "none",
    evidenceKinds: evidenceKind ? [evidenceKind] : [],
    score: round4(score),
    truncated: clipped.truncated,
  };
}

function evidenceStance(evidence: EvidenceItem): SourceExcerpt["stance"] {
  if (Number(evidence.score) < 0 || /(?:mismatch|negated|contradiction|contraindication|penalty)/u.test(String(evidence.kind))) return "contradiction";
  if (BROAD_EVIDENCE_KINDS.has(evidence.kind)) return "context";
  return "support";
}

function evidencePriority(evidence: EvidenceItem) {
  const stance = evidenceStance(evidence);
  const structural = CONFIDENCE_STRUCTURAL_EVIDENCE_KINDS.has(evidence.kind);
  return (stance === "support" ? 40 : 0) + (structural ? 25 : 0) + Math.max(-20, Math.min(20, Number(evidence.score) || 0));
}

function dedupeExcerpts(excerpts: SourceExcerpt[]) {
  const byRange = new Map<string, SourceExcerpt>();
  for (const excerpt of excerpts) {
    const key = `${excerpt.page}:${excerpt.lineStart}:${excerpt.lineEnd}:${normalizeForSearch(excerpt.text)}`;
    const current = byRange.get(key);
    if (!current) {
      byRange.set(key, excerpt);
      continue;
    }
    current.evidenceKinds = [...new Set([...current.evidenceKinds, ...excerpt.evidenceKinds])];
    current.score = Math.max(current.score, excerpt.score);
    current.highlights = [...current.highlights, ...excerpt.highlights].filter(
      (item, index, all) => all.findIndex((candidate) => candidate.start === item.start && candidate.end === item.end && candidate.role === item.role) === index,
    );
    const contentRank = { none: 0, partial: 1, exact: 2 } as const;
    if (contentRank[excerpt.contentMatch] > contentRank[current.contentMatch]) current.contentMatch = excerpt.contentMatch;
    const locationRank = { approximate: 0, normalized: 1, exact: 2 } as const;
    if (locationRank[excerpt.localizationMatch] > locationRank[current.localizationMatch]) {
      current.localizationMatch = excerpt.localizationMatch;
    }
    current.truncated = current.truncated || excerpt.truncated;
    if (
      (current.stance === "support" && excerpt.stance === "contradiction") ||
      (current.stance === "contradiction" && excerpt.stance === "support") ||
      current.stance === "mixed" ||
      excerpt.stance === "mixed"
    ) {
      current.stance = "mixed";
    } else if (current.stance === "context" && excerpt.stance !== "context") {
      current.stance = excerpt.stance;
    }
  }
  return [...byRange.values()];
}

export function emptyPredictionSources(answers: AnswerOption[], selected: string[]): PredictionSources {
  const selectedIds = new Set(selected);
  return {
    question: null,
    answers: answers.map((answer) => ({
      id: answer.id,
      variant: answer.text,
      selected: selectedIds.has(answer.id),
      excerpts: [],
    })),
    pages: [],
  };
}

/** Builds display-only PDF context after answer selection has finished. */
export function buildPredictionSources({
  pages,
  question,
  answers,
  selected,
  answerScores,
  questionAnchors = [],
  options = {},
}: {
  pages: SourcePageInput[];
  question: string;
  answers: AnswerOption[];
  selected: string[];
  answerScores: AnswerScore[];
  questionAnchors?: QuestionAnchor[];
  options?: SourceContextOptions;
}): PredictionSources {
  const maxChars = clampInteger(options.maxChars, DEFAULT_MAX_CHARS, 400, 4000);
  const excerptsPerAnswer = clampInteger(options.excerptsPerAnswer, DEFAULT_EXCERPTS_PER_ANSWER, 1, 3);
  const pageByNumber = new Map((pages ?? []).map((page) => [Number(page.page), page]));
  const preparedByNumber = new Map<number, PreparedPage>();
  const preparedFor = (pageNumber: number) => {
    const cached = preparedByNumber.get(pageNumber);
    if (cached) return cached;
    const page = pageByNumber.get(pageNumber);
    if (!page) return null;
    const prepared = preparePage(page);
    preparedByNumber.set(pageNumber, prepared);
    return prepared;
  };
  const selectedIds = new Set(selected);
  const questionFocus = displayQuestionTokens(question);
  const numericFamily = answers.length >= 3 && answers.every((answer) => strictNumericTokens(answer.text).length > 0);

  const scoreById = new Map(answerScores.map((item) => [item.answer.id, item]));
  const answerSources = answers.map((answer) => {
    const score = scoreById.get(answer.id);
    const candidates = [...(score?.evidence ?? [])]
      .filter((evidence) => Number(evidence.page) > 0 && String(evidence.text ?? "").trim())
      .sort((left, right) => evidencePriority(right) - evidencePriority(left))
      .slice(0, 8);
    const answerTokens = uniqueTokens(answer.text);
    const answerNumbers = strictNumericTokens(answer.text);
    const rankedExcerpts: Array<{ excerpt: SourceExcerpt; rank: number }> = [];
    for (const evidence of candidates) {
      const preparedPage = preparedFor(Number(evidence.page));
      if (!preparedPage) continue;
      const excerpt = buildExcerpt({
        preparedPage,
        needle: evidence.text,
        highlightQuery: answer.text,
        contextQuery: `${question} ${answer.text}`,
        highlightRole: "answer",
        evidenceKind: evidence.kind,
        origin: "scoring_evidence",
        stance: evidenceStance(evidence),
        score: evidence.score,
        maxChars,
      });
      if (!excerpt || excerpt.contentMatch === "none") continue;
      if (answerNumbers.some((number) => !containsBoundedToken(excerpt.text, number))) continue;
      const questionOverlap = tokenOverlap(questionFocus, uniqueTokens(excerpt.text));
      const answerOverlap = tokenOverlap(answerTokens, uniqueTokens(excerpt.text));
      if (questionFocus.length >= 2 && questionOverlap.hits === 0) continue;
      if (excerpt.contentMatch === "partial" && answerTokens.length >= 3 && answerOverlap.recall < 0.25) continue;
      const structural = CONFIDENCE_STRUCTURAL_EVIDENCE_KINDS.has(evidence.kind);
      if (numericFamily && !selectedIds.has(answer.id) && !structural) continue;
      rankedExcerpts.push({
        excerpt,
        rank:
          evidencePriority(evidence) +
          questionOverlap.recall * 50 +
          answerOverlap.recall * 30 +
          (excerpt.contentMatch === "exact" ? 30 : 10),
      });
    }
    const excerpts = dedupeExcerpts(
      rankedExcerpts.sort((left, right) => right.rank - left.rank).map((item) => item.excerpt),
    ).slice(0, excerptsPerAnswer);
    return {
      id: answer.id,
      variant: answer.text,
      selected: selectedIds.has(answer.id),
      excerpts,
    };
  });

  const questionTokens = uniqueTokens(question);
  const selectedExcerpts = answerSources
    .filter((item) => item.selected)
    .flatMap((item) => item.excerpts)
    .filter((excerpt) => excerpt.stance !== "contradiction")
    .map((excerpt) => ({
      excerpt,
      rank:
        tokenOverlap(questionTokens, uniqueTokens(excerpt.text)).recall * 100 +
        (excerpt.stance === "support" ? 20 : 0) +
        Math.max(0, Math.min(20, excerpt.score)),
    }))
    .sort((left, right) => right.rank - left.rank);

  let questionExcerpt: SourceExcerpt | null = null;
  if (selectedExcerpts.length) {
    const primary = selectedExcerpts[0].excerpt;
    const exactQuestion = exactHighlight(primary.text, question, "question");
    const questionHighlights = exactQuestion ? [exactQuestion] : tokenHighlights(primary.text, question, "question");
    const combinedHighlights = [...questionHighlights, ...primary.highlights].filter(
      (item, index, all) => all.findIndex((candidate) => candidate.start === item.start && candidate.end === item.end && candidate.role === item.role) === index,
    );
    questionExcerpt = {
      ...primary,
      stance: "context",
      highlights: combinedHighlights.sort((left, right) => left.start - right.start),
      origin: exactQuestion ? "question_match" : "selected_answer_context",
      contentMatch: exactQuestion ? "exact" : questionHighlights.length ? "partial" : "none",
    };
  } else {
    const anchorExcerpts = questionAnchors
      .map((anchor) => {
        const preparedPage = preparedFor(Number(anchor?.chunk?.page));
        const needle = String(anchor?.chunk?.text ?? "").trim();
        if (!preparedPage || !needle) return null;
        const excerpt = buildExcerpt({
          preparedPage,
          needle,
          highlightQuery: question,
          contextQuery: question,
          highlightRole: "question",
          evidenceKind: "question_search",
          origin: normalizeForSearch(question) && normalizeForSearch(needle).includes(normalizeForSearch(question)) ? "question_match" : "search_fallback",
          stance: "context",
          score: Number(anchor?.score ?? 0),
          maxChars,
        });
        if (!excerpt) return null;
        return {
          excerpt,
          rank: tokenOverlap(questionTokens, uniqueTokens(excerpt.text)).recall * 100 + Math.max(0, Math.min(20, Number(anchor?.score ?? 0))),
        };
      })
      .filter((item): item is { excerpt: SourceExcerpt; rank: number } => Boolean(item))
      .sort((left, right) => right.rank - left.rank);
    questionExcerpt = anchorExcerpts[0]?.excerpt ?? null;
  }

  const referencedPages = new Set<number>();
  if (questionExcerpt) referencedPages.add(questionExcerpt.page);
  for (const answerSource of answerSources) {
    for (const excerpt of answerSource.excerpts) referencedPages.add(excerpt.page);
  }
  const sourcePages = [...referencedPages]
    .sort((left, right) => left - right)
    .map((pageNumber) => {
      const page = pageByNumber.get(pageNumber);
      const text = Array.isArray(page?.lines)
        ? page.lines.map((line: unknown) => String(line ?? "")).join("\n")
        : String(page?.text ?? "");
      return { page: pageNumber, text };
    });

  return { question: questionExcerpt, answers: answerSources, pages: sourcePages };
}

/**
 * Управляющий facade presentation-слоя. Он вызывается только после selection и
 * не участвует в raw score или выборе ответа.
 */
export class SourceContextBuilder {
  empty(answers: AnswerOption[], selected: string[]): PredictionSources {
    return emptyPredictionSources(answers, selected);
  }

  build(input: Parameters<typeof buildPredictionSources>[0]): PredictionSources {
    return buildPredictionSources(input);
  }
}
