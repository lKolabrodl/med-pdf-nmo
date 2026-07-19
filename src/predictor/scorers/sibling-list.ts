import { extractNumbers, normalizeForSearch, uniqueTokens } from "../../normalize.js";
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
  nextBulletIndex: number;
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
    containsNormalizedPhrase(normalized, "уровень убедительности рекомендаций") ||
    /^(?:ууд|уур|комментари|примечани)(?:\s|[-\u2013\u2014:])/u.test(normalized)
  );
}

function parseBulletLabel(text: string) {
  if (!BULLET_START.test(String(text ?? ""))) return null;
  const stripped = String(text).replace(BULLET_START, "").replace(/\s+/gu, " ").trim();
  const match = LABEL_SPLIT.exec(stripped);
  if (!match) return null;
  const label = match[1].trim();
  const body = match[2].trim();
  const labelTokens = uniqueTokens(label);
  if (!body || label.length > 100 || labelTokens.length < 1 || labelTokens.length > 9) return null;
  const normalizedLabel = normalizeForSearch(label);
  if (
    containsNormalizedPhrase(normalizedLabel, "рекоменд") ||
    containsNormalizedPhrase(normalizedLabel, "не рекоменд") ||
    containsNormalizedPhrase(normalizedLabel, "пациентам") ||
    containsNormalizedPhrase(normalizedLabel, "следует")
  ) {
    return null;
  }
  return { label, body };
}

function flattenLines(pages: any[]): FlatLine[] {
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
export function buildSiblingListBlocks(pages: any[]): SiblingBlock[][] {
  const lines = flattenLines(pages);
  const blocks: SiblingBlock[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const parsed = parseBulletLabel(lines[index].text);
    if (!parsed) continue;
    let nextBulletIndex = Number.POSITIVE_INFINITY;
    const bodyParts = [parsed.body];
    for (let cursor = index + 1; cursor < lines.length && cursor <= index + 22; cursor += 1) {
      const candidate = lines[cursor];
      if (BULLET_START.test(candidate.text)) {
        nextBulletIndex = candidate.flatIndex;
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
    blocks.push({
      page: lines[index].page,
      flatIndex: lines[index].flatIndex,
      nextBulletIndex,
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
      previous.nextBulletIndex === block.flatIndex &&
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

function questionLabelMatch(question: string, block: SiblingBlock) {
  const questionTokens = uniqueTokens(question);
  const labelTokens = labelSpecificTokens(block.label);
  if (!labelTokens.length) return 0;
  const labelInQuestion = strictSoftCoverage(labelTokens, questionTokens);
  const hits = tokenHitCount(labelTokens, questionTokens);
  if (hits < 1) return 0;
  return labelInQuestion;
}

function answerLabelMatch(answer: AnswerOption, block: SiblingBlock) {
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
  const baseQuestionTokens = (suppliedFocusTokens?.length ? suppliedFocusTokens : uniqueTokens(question)).filter(
    (token) => token.length >= 3 && !FOCUS_STOPWORDS.has(token) && !QUESTION_RELATION_TOKENS.has(token),
  );
  if (!baseQuestionTokens.length) return null;
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
    const bodyMatches = cluster
      .map((block) => ({ block, ...bodyQuestionMatch(baseQuestionTokens, block, commonTokens) }))
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
  pages: any[];
  question: string;
  answers: AnswerOption[];
  focusTokens?: string[];
  enableMultiMembership?: boolean;
  enableSingleInverse?: boolean;
}): SiblingListResolution {
  const clusters = buildSiblingListBlocks(pages);
  if (!clusters.length) return new Map();
  if (mode === "multi" && enableMultiMembership) return resolveMultiMembership(clusters, question, answers) ?? new Map();
  if (mode === "single" && enableSingleInverse) return resolveSingleInverse(clusters, question, answers, focusTokens) ?? new Map();
  return new Map();
}
