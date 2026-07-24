import { extractNumbers, normalizeForSearch, normalizeText, uniqueTokens } from "../../normalize.js";
import type { PdfLinePage } from "../../pdf.js";
import { FOCUS_STOPWORDS } from "../constants.js";
import {
  answerSearchPhrases,
  containsNormalizedPhrase,
  numberCoverage,
  strictSoftCoverage,
  tokenizeNormalized,
  tokenHitCount,
} from "../text-utils.js";

type AnswerOption = { id: string; text: string };
type FlatLine = { page: number; line: number; flatIndex: number; text: string };
type SiblingBlock = {
  page: number;
  flatIndex: number;
  nextItemIndex: number;
  label: string;
  body: string;
  text: string;
  labelTokens: string[];
  bodyTokens: string[];
};

export type SiblingListResolution = Map<
  string,
  {
    adjustment: number;
    evidence: { answerId: string; page: number; text: string; score: number; kind: string } | null;
  }
>;

const BULLET_START = /^\s*[-\u2010-\u2015\u2022\u25aa\u25e6*]\s+/u;
const LABEL_SPLIT = /^(.{2,100}?)(?:[.:]|\s+[\u2013\u2014]\s+)\s*(.+)$/u;
const ORDINAL_VALUE = "(?:\\d{1,2}|[ivx]{1,8})";
const ORDINAL_KIND = "(?:тип\\S*|стади\\S*|степен\\S*|класс\\S*)";
const CATEGORY_GENERIC_TOKENS = new Set(
  uniqueTokens(
    [
      "форма формы форме тип виды вид класс группа группы категория категории",
      "относятся относится включают включает выделяют выделяется подразделяют",
      "является являются следующий следующие перечень классификация",
      "пациент пациенты заболевание состояние критерий признаки",
    ].join(" "),
  ),
);
const QUESTION_RELATION_TOKENS = new Set(
  uniqueTokens(
    [
      "относится относятся относят является являются включает включают выделяют",
      "предусматривает предусматривают подразделяют классификация форма формы",
      "следующий следующие к по из для при относится является",
    ].join(" "),
  ),
);

function isRunningHeader(text: string) {
  const normalized = normalizeForSearch(text);
  return (
    normalized.length < 180 &&
    containsNormalizedPhrase(normalized, "клинические рекомендации") &&
    /\b20\d{2}\b/u.test(String(text ?? ""))
  );
}

function isStrongBoundary(text: string) {
  const normalized = normalizeForSearch(text);
  return (
    /^\s*\d+(?:\.\d+)+\.?\s+/u.test(String(text ?? "")) ||
    /^\s*[ivx]{1,8}\.\s+\S/iu.test(String(text ?? "")) ||
    containsNormalizedPhrase(normalized, "уровень убедительности рекомендаций") ||
    /^(?:ууд|уур|комментари|примечани)(?:\s|[-\u2013\u2014:])/u.test(normalized)
  );
}

function recommendationLikeLabel(label: string) {
  const normalizedLabel = normalizeForSearch(label);
  return (
    containsNormalizedPhrase(normalizedLabel, "рекоменд") ||
    containsNormalizedPhrase(normalizedLabel, "не рекоменд") ||
    containsNormalizedPhrase(normalizedLabel, "пациентам") ||
    containsNormalizedPhrase(normalizedLabel, "следует")
  );
}

function validLabelBody(label: string, body: string) {
  const labelTokens = uniqueTokens(label);
  if (!body || label.length > 100 || labelTokens.length < 1 || labelTokens.length > 9) return null;
  if (recommendationLikeLabel(label)) return null;
  return { label, body };
}

function hasOrdinalSignature(label: string) {
  const clean = normalizeText(label);
  return (
    new RegExp(`(?:^|\\s)${ORDINAL_VALUE}(?:\\s+\\S{1,3})?\\s+${ORDINAL_KIND}(?:\\s|$)`, "iu").test(clean) ||
    new RegExp(`(?:^|\\s)${ORDINAL_KIND}\\s+${ORDINAL_VALUE}(?:\\s|$)`, "iu").test(clean)
  );
}

function parseStructuredLabel(text: string) {
  const raw = String(text ?? "");
  const bullet = BULLET_START.test(raw);
  const stripped = raw.replace(BULLET_START, "").replace(/\s+/gu, " ").trim();

  if (!bullet) {
    const leadingKind = new RegExp(
      `^(${ORDINAL_KIND}\\s+${ORDINAL_VALUE})\\s+(?:[-\\u2013\\u2014:]\\s*)?(.+)$`,
      "iu",
    ).exec(normalizeText(stripped));
    if (leadingKind) return validLabelBody(leadingKind[1].trim(), leadingKind[2].trim());
  }

  const split = LABEL_SPLIT.exec(stripped);
  if (split && (bullet || hasOrdinalSignature(split[1]))) {
    return validLabelBody(split[1].trim(), split[2].trim());
  }

  if (bullet) {
    const parenthetical = /^(.{2,80}?(?:степен\S*|тип\S*|форм\S*|класс\S*)(?:\s+\S+){0,2})\s*\((.+)$/iu.exec(
      stripped,
    );
    if (parenthetical) return validLabelBody(parenthetical[1].trim(), parenthetical[2].trim());
    return null;
  }
  return null;
}

function flattenLines(pages: PdfLinePage[]): FlatLine[] {
  const lines: FlatLine[] = [];
  let flatIndex = 0;
  for (const page of pages ?? []) {
    for (let line = 0; line < (page.lines ?? []).length; line += 1) {
      lines.push({ page: page.page, line, flatIndex, text: String(page.lines[line] ?? "") });
      flatIndex += 1;
    }
  }
  return lines;
}

/**
 * Reconstructs category-style bullet items such as `- Label. Description`.
 * A block ends at the next physical bullet, preserving sibling boundaries even
 * across a page break. Recommendation bullets are deliberately excluded.
 */
export function buildSiblingListBlocks(
  pages: PdfLinePage[],
): SiblingBlock[][] {
  const lines = flattenLines(pages);
  const blocks: SiblingBlock[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const parsed = parseStructuredLabel(lines[index].text);
    if (!parsed) continue;
    const startsWithBullet = BULLET_START.test(lines[index].text);
    let nextItemIndex = Number.POSITIVE_INFINITY;
    const bodyParts = [parsed.body];
    for (let cursor = index + 1; cursor < lines.length && cursor <= index + 22; cursor += 1) {
      const candidate = lines[cursor];
      if (parseStructuredLabel(candidate.text)) {
        nextItemIndex = candidate.flatIndex;
        break;
      }
      if (BULLET_START.test(candidate.text)) {
        break;
      }
      if (isStrongBoundary(candidate.text)) break;
      if (isRunningHeader(candidate.text)) continue;
      if (candidate.page > lines[index].page + 1) break;
      const clean = candidate.text.replace(/\s+/gu, " ").trim();
      if (clean) bodyParts.push(clean);
      if (bodyParts.join(" ").length >= 2200) break;
    }
    const body = bodyParts.join(" ").replace(/\s+/gu, " ").trim();
    if (body.length < 18) continue;
    // A very long non-bullet "row" is usually several visual table columns
    // flattened into one text line. Treating it as a labelled prose row mixes
    // neighboring cells and is less safe than abstaining.
    if (!startsWithBullet && body.length > 600) continue;
    blocks.push({
      page: lines[index].page,
      flatIndex: lines[index].flatIndex,
      nextItemIndex,
      label: parsed.label,
      body,
      text: `- ${parsed.label}. ${body}`,
      labelTokens: uniqueTokens(parsed.label),
      bodyTokens: uniqueTokens(body),
    });
  }

  const clusters: SiblingBlock[][] = [];
  for (const block of blocks) {
    const current = clusters[clusters.length - 1];
    const previous = current?.[current.length - 1];
    const directSibling =
      previous &&
      previous.nextItemIndex === block.flatIndex &&
      block.page <= previous.page + 1 &&
      block.flatIndex - previous.flatIndex <= 24;
    if (directSibling) current.push(block);
    else clusters.push([block]);
  }
  return clusters.filter((cluster) => cluster.length >= 2);
}

function informativeTokens(text: string, generic = CATEGORY_GENERIC_TOKENS) {
  return uniqueTokens(text).filter(
    (token) => token.length >= 3 && !FOCUS_STOPWORDS.has(token) && !generic.has(token) && !/^\d+$/u.test(token),
  );
}

function answerBodyMatch(answer: AnswerOption, block: SiblingBlock) {
  const normalized = normalizeForSearch(block.body);
  const answerTokens = informativeTokens(answer.text, new Set());
  const phraseHit = answerSearchPhrases(answer.text)
    .filter((phrase) => phrase.length >= 3)
    .some((phrase) => containsNormalizedPhrase(normalized, phrase));
  const coverage = answerTokens.length ? strictSoftCoverage(answerTokens, block.bodyTokens) : 0;
  const hits = tokenHitCount(answerTokens, block.bodyTokens);
  const numbers = extractNumbers(answer.text);
  const numeric = numbers.length ? numberCoverage(answer.text, normalized) : 1;
  const shortExact = answerTokens.length === 1 && phraseHit;
  const matched = numeric >= 0.72 && (shortExact || phraseHit || (answerTokens.length >= 2 && coverage >= 0.82 && hits >= 2));
  return { matched, quality: Math.max(phraseHit ? 1 : 0, coverage) * Math.min(1, numeric), phraseHit, coverage };
}

function labelSpecificTokens(text: string) {
  const tokens = informativeTokens(text);
  return tokens.length ? tokens : uniqueTokens(text).filter((token) => !FOCUS_STOPWORDS.has(token));
}

function ordinalNumber(value: string) {
  if (/^\d{1,2}$/u.test(value)) return Number(value);
  const roman = new Map([
    ["i", 1],
    ["ii", 2],
    ["iii", 3],
    ["iv", 4],
    ["v", 5],
    ["vi", 6],
    ["vii", 7],
    ["viii", 8],
    ["ix", 9],
    ["x", 10],
  ]);
  return roman.get(value.toLowerCase()) ?? null;
}

function ordinalLabelKey(text: string) {
  const clean = normalizeText(text);
  const kinds: Array<[string, RegExp]> = [
    ["type", /тип\S*/iu],
    ["stage", /стади\S*/iu],
    ["degree", /степен\S*/iu],
    ["class", /класс\S*/iu],
  ];
  for (const [kind, cue] of kinds) {
    const after = new RegExp(`${cue.source}\\s+(${ORDINAL_VALUE})`, "iu").exec(clean);
    const before = new RegExp(`(${ORDINAL_VALUE})(?:\\s+\\S{1,3})?\\s+${cue.source}`, "iu").exec(clean);
    const value = after?.[1] ?? before?.[1];
    const number = value ? ordinalNumber(value) : null;
    // Stage/type zero is a real label, not a missing ordinal. Treating zero as
    // falsy made it fall back to a generic label and match every sibling stage.
    if (number !== null) return `${kind}:${number}`;
  }

  if (/степен\S*/iu.test(clean)) {
    if (/(?:^|\s)легк\S*/iu.test(clean)) return "degree:light";
    if (/(?:^|\s)средн\S*/iu.test(clean)) return "degree:medium";
    if (/(?:^|\s)тяжел\S*/iu.test(clean)) return "degree:heavy";
  }
  return null;
}

function blockWithPlusInheritance(block: SiblingBlock, cluster: SiblingBlock[]) {
  if (!/\+/u.test(block.body.slice(0, 100))) return block;
  const referencedKey = ordinalLabelKey(block.body.slice(0, 100));
  if (!referencedKey || referencedKey === ordinalLabelKey(block.label)) return block;
  const referenced = cluster.find((candidate) => ordinalLabelKey(candidate.label) === referencedKey);
  if (!referenced) return block;
  const body = `${referenced.body} ${block.body}`.replace(/\s+/gu, " ").trim();
  return {
    ...block,
    body,
    bodyTokens: uniqueTokens(body),
    text: `${block.text} ${referenced.text}`,
  };
}

function questionLabelMatch(question: string, block: SiblingBlock) {
  const questionOrdinal = ordinalLabelKey(question);
  const blockOrdinal = ordinalLabelKey(block.label);
  if (questionOrdinal && blockOrdinal) return questionOrdinal === blockOrdinal ? 1 : 0;
  const questionTokens = uniqueTokens(question);
  const labelTokens = labelSpecificTokens(block.label);
  if (!labelTokens.length) return 0;
  const labelInQuestion = strictSoftCoverage(labelTokens, questionTokens);
  const hits = tokenHitCount(labelTokens, questionTokens);
  if (hits < 1) return 0;
  return labelInQuestion;
}

function answerLabelMatch(answer: AnswerOption, block: SiblingBlock) {
  const answerOrdinal = ordinalLabelKey(answer.text);
  const blockOrdinal = ordinalLabelKey(block.label);
  if (answerOrdinal && blockOrdinal) {
    const score = answerOrdinal === blockOrdinal ? 1 : 0;
    return { matched: score === 1, quality: score };
  }
  const answerNorm = normalizeForSearch(answer.text);
  const labelNorm = normalizeForSearch(block.label);
  const answerTokens = labelSpecificTokens(answer.text);
  const blockTokens = labelSpecificTokens(block.label);
  const phraseHit =
    containsNormalizedPhrase(labelNorm, answerNorm) ||
    containsNormalizedPhrase(answerNorm, labelNorm);
  const forward = answerTokens.length ? strictSoftCoverage(answerTokens, blockTokens) : 0;
  const reverse = blockTokens.length ? strictSoftCoverage(blockTokens, answerTokens) : 0;
  const score = Math.max(phraseHit ? 1 : 0, Math.min(forward, reverse));
  return { matched: score >= 0.72, quality: score };
}

function chooseUnique<T extends { strength: number }>(candidates: T[], margin: number) {
  const sorted = [...candidates].sort((left, right) => right.strength - left.strength);
  if (!sorted.length) return null;
  if (sorted[1] && sorted[0].strength - sorted[1].strength < margin) return null;
  return sorted[0];
}

function resolveMultiMembership(
  clusters: SiblingBlock[][],
  question: string,
  answers: AnswerOption[],
): SiblingListResolution | null {
  const normalizedQuestion = normalizeForSearch(question);
  if (/(?:^|\s)(?:не|кроме|исключая)\s+(?:относ|включ|явля)/u.test(normalizedQuestion)) return null;
  const candidates = [];

  for (const cluster of clusters) {
    for (const target of cluster) {
      const labelMatch = questionLabelMatch(question, target);
      if (labelMatch < 0.72) continue;
      const targetMatches = new Map<string, ReturnType<typeof answerBodyMatch>>();
      const siblingMatches = new Set<string>();
      for (const answer of answers) {
        const targetMatch = answerBodyMatch(answer, target);
        if (targetMatch.matched) targetMatches.set(answer.id, targetMatch);
        if (cluster.some((block) => block !== target && answerBodyMatch(answer, block).matched)) siblingMatches.add(answer.id);
      }
      const targetOnly = [...targetMatches.entries()].filter(([id]) => !siblingMatches.has(id));
      const siblingOnly = [...siblingMatches].filter((id) => !targetMatches.has(id));
      if (targetOnly.length < 2 || siblingOnly.length < 1 || targetOnly.length >= answers.length) continue;
      const averageQuality = targetOnly.reduce((sum, [, match]) => sum + match.quality, 0) / targetOnly.length;
      candidates.push({
        target,
        targetOnly,
        strength: labelMatch * 2 + averageQuality + Math.min(0.4, siblingOnly.length * 0.1),
      });
    }
  }

  const best = chooseUnique(candidates, 0.08);
  if (!best) return null;
  const resolution: SiblingListResolution = new Map();
  for (const [answerId, match] of best.targetOnly) {
    resolution.set(answerId, {
      adjustment: 0,
      evidence: {
        answerId,
        page: best.target.page,
        text: best.target.text,
        score: 18.2 + match.quality * 3.4,
        kind: "sibling_list_member",
      },
    });
  }
  return resolution;
}

function bodyQuestionMatch(questionTokens: string[], block: SiblingBlock, commonTokens: Set<string>) {
  const distinctive = questionTokens.filter((token) => !commonTokens.has(token));
  if (!distinctive.length) return { quality: 0, hits: 0 };
  const quality = strictSoftCoverage(distinctive, block.bodyTokens);
  const hits = tokenHitCount(distinctive, block.bodyTokens);
  return { quality, hits };
}

function resolveSingleInverse(
  clusters: SiblingBlock[][],
  question: string,
  answers: AnswerOption[],
  suppliedFocusTokens: string[],
): SiblingListResolution | null {
  const ordinalAnswerFamily = answers.filter((answer) => ordinalLabelKey(answer.text)).length >= 2;
  const filterQuestionTokens = (tokens: string[]) =>
    tokens.filter((token) => token.length >= 3 && !FOCUS_STOPWORDS.has(token) && !QUESTION_RELATION_TOKENS.has(token));
  const suppliedTokens = filterQuestionTokens(suppliedFocusTokens ?? []);
  const rawQuestionTokens = filterQuestionTokens(uniqueTokens(question));
  const questionTokenCandidates = ordinalAnswerFamily && suppliedTokens.length ? [suppliedTokens, rawQuestionTokens] : [suppliedTokens.length ? suppliedTokens : rawQuestionTokens];
  if (!questionTokenCandidates.some((tokens) => tokens.length)) return null;
  const candidates = [];

  for (const cluster of clusters) {
    const mappings = [];
    for (const answer of answers) {
      const matches = cluster
        .map((block) => ({ block, ...answerLabelMatch(answer, block) }))
        .filter((item) => item.matched)
        .sort((left, right) => right.quality - left.quality);
      if (matches.length === 1 || (matches[0] && matches[1] && matches[0].quality - matches[1].quality >= 0.18)) {
        if (matches[0]) mappings.push({ answer, block: matches[0].block, labelQuality: matches[0].quality });
      }
    }
    if (new Set(mappings.map((item) => item.block.flatIndex)).size < 2) continue;

    const commonTokens = new Set(cluster[0].bodyTokens);
    for (const block of cluster.slice(1)) {
      for (const token of [...commonTokens]) if (!block.bodyTokens.includes(token)) commonTokens.delete(token);
    }
    const baseQuestionTokens = [...questionTokenCandidates].sort((left, right) => {
      const strength = (tokens: string[]) =>
        Math.max(...cluster.map((block) => bodyQuestionMatch(tokens, blockWithPlusInheritance(block, cluster), commonTokens).hits), 0);
      return strength(right) - strength(left);
    })[0];
    const bodyMatches = cluster
      .map((block) => {
        const direct = bodyQuestionMatch(baseQuestionTokens, block, commonTokens);
        const matchBlock = blockWithPlusInheritance(block, cluster);
        const matched = matchBlock === block || direct.hits < 1 ? direct : bodyQuestionMatch(baseQuestionTokens, matchBlock, commonTokens);
        return { block, ...matched };
      })
      .filter((item) => item.hits >= 1 && item.quality >= 0.5)
      .sort((left, right) => right.quality - left.quality || right.hits - left.hits);
    if (!bodyMatches.length) continue;
    if (bodyMatches[1] && bodyMatches[0].quality - bodyMatches[1].quality < 0.18 && bodyMatches[0].hits <= bodyMatches[1].hits) continue;
    const targetBody = bodyMatches[0];
    const mapped = mappings.filter((item) => item.block === targetBody.block);
    if (mapped.length !== 1) continue;
    candidates.push({
      ...mapped[0],
      bodyQuality: targetBody.quality,
      bodyHits: targetBody.hits,
      strength: mapped[0].labelQuality + targetBody.quality + Math.min(0.5, targetBody.hits * 0.12),
    });
  }

  const best = chooseUnique(candidates, 0.1);
  if (!best) return null;
  return new Map([
    [
      best.answer.id,
      {
        adjustment: 0,
        evidence: {
          answerId: best.answer.id,
          page: best.block.page,
          text: best.block.text,
          score: 18.4 + best.bodyQuality * 3.2 + Math.min(1.2, best.bodyHits * 0.3),
          kind: "sibling_list_label",
        },
      },
    ],
  ]);
}

function resolveSingleForward(
  clusters: SiblingBlock[][],
  question: string,
  answers: AnswerOption[],
): SiblingListResolution | null {
  const candidates = [];
  for (const cluster of clusters) {
    for (const target of cluster) {
      const labelMatch = questionLabelMatch(question, target);
      if (labelMatch < 0.72) continue;
      const matchTarget = blockWithPlusInheritance(target, cluster);
      const targetMatches = new Map<string, ReturnType<typeof answerBodyMatch>>();
      const siblingMatches = new Map<string, number>();
      for (const answer of answers) {
        const targetMatch = answerBodyMatch(answer, matchTarget);
        if (targetMatch.matched) targetMatches.set(answer.id, targetMatch);
        const siblingQuality = Math.max(
          ...cluster
            .filter((block) => block !== target)
            .map((block) => answerBodyMatch(answer, block))
            .filter((match) => match.matched)
            .map((match) => match.quality),
          0,
        );
        if (siblingQuality > 0) siblingMatches.set(answer.id, siblingQuality);
      }
      const targetOnly = [...targetMatches.entries()].filter(
        ([id, match]) => !siblingMatches.has(id) || match.quality - (siblingMatches.get(id) ?? 0) >= 0.12,
      );
      const siblingOnly = [...siblingMatches.entries()]
        .filter(([id, siblingQuality]) => !targetMatches.has(id) || (targetMatches.get(id)?.quality ?? 0) - siblingQuality < 0.12)
        .map(([id]) => id);
      if (targetOnly.length !== 1 || siblingOnly.length < 1) continue;
      const [answerId, match] = targetOnly[0];
      candidates.push({
        target,
        answerId,
        match,
        strength: labelMatch * 2.2 + match.quality + Math.min(0.5, siblingOnly.length * 0.12),
      });
    }
  }

  const best = chooseUnique(candidates, 0.12);
  if (!best) return null;
  return new Map([
    [
      best.answerId,
      {
        adjustment: 0,
        evidence: {
          answerId: best.answerId,
          page: best.target.page,
          text: best.target.text,
          score: 19.8 + best.match.quality * 4.2,
          kind: "sibling_list_body",
        },
      },
    ],
  ]);
}

/**
 * Resolves only contrastive sibling lists. The function abstains unless a
 * target block and at least one competing sibling are both proven by the
 * current answer family; ordinary isolated bullets receive no score.
 */
export function resolveSiblingList({
  mode,
  pages,
  question,
  answers,
  focusTokens = [],
  enableMultiMembership = false,
  enableSingleInverse = false,
}: {
  mode: string;
  pages: PdfLinePage[];
  question: string;
  answers: AnswerOption[];
  focusTokens?: string[];
  enableMultiMembership?: boolean;
  enableSingleInverse?: boolean;
}): SiblingListResolution {
  const clusters = buildSiblingListBlocks(pages);
  if (!clusters.length) return new Map();
  if (mode === "multi" && enableMultiMembership) return resolveMultiMembership(clusters, question, answers) ?? new Map();
  if (mode === "single" && enableSingleInverse) {
    return resolveSingleForward(clusters, question, answers) ?? resolveSingleInverse(clusters, question, answers, focusTokens) ?? new Map();
  }
  return new Map();
}
