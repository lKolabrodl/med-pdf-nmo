import {
  coverage,
  extractNumbers,
  normalizeForSearch,
  stemToken,
  tokenize,
  uniqueTokens,
} from "../../normalize.js";
import { FOCUS_STOPWORDS } from "../constants.js";
import {
  answerSearchPhrases,
  betterEvidence,
  cachedLineWindowSegments,
  containsNormalizedPhrase,
  extractComparatorNumbers,
  focusedAnswerSearchPhrases,
  numberCoverage,
  strictSoftCoverage,
  tokenHitCount,
  tokenizeNormalized,
} from "../text-utils.js";
import { geneMutationQuestion, latinAnswerTokens } from "./biomedical-symbols.js";

const SHARED_MULTI_SOURCE_KINDS = new Set([
  "question_anchor_segment",
  "question_chunk_answer",
  "bm25_question_answer",
  "section_list_segment",
  "bounded_list_segment",
  "ordinal_list_segment",
  "latin_fuzzy_ocr",
]);

const SHARED_MULTI_GENERIC_TOKENS = new Set(
  [
    "\u0434\u0430\u043d\u043d\u044b\u0435",
    "\u0434\u0430\u043d\u043d\u044b\u0445",
    "\u0446\u0435\u043b\u044c",
    "\u0446\u0435\u043b\u044c\u044e",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442\u0430",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442\u0430\u043c",
    "\u043f\u0440\u043e\u0432\u0435\u0434\u0435\u043d",
    "\u043f\u0440\u043e\u0432\u043e\u0434",
    "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434",
    "\u043e\u0442\u043d\u043e\u0441",
    "\u044f\u0432\u043b\u044f",
    "\u0432\u044b\u043f\u043e\u043b\u043d",
    "\u043b\u0435\u0447\u0435\u043d",
    "\u0442\u0435\u0440\u0430\u043f",
  ].flatMap((item) => uniqueTokens(item)),
);

const SHARED_MULTI_SECTION_CUES = [
  "\u043f\u043e \u043b\u043e\u043a\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u0438",
  "\u043f\u043e \u044d\u0442\u0438\u043e\u043b\u043e\u0433\u0438\u0438",
  "\u043f\u043e \u0441\u0442\u0435\u043f\u0435\u043d\u0438",
  "\u043f\u043e \u043e\u0441\u043e\u0431\u0435\u043d\u043d\u043e\u0441\u0442\u044f\u043c \u0442\u0435\u0447\u0435\u043d\u0438\u044f",
  "\u043f\u043e \u043a\u043b\u0430\u0441\u0441\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u0438",
].map((item) => normalizeForSearch(item));

const SHARED_MULTI_REQUIRED_CUE_GROUPS = [
  {
    answer: ["\u043c\u0435\u043d\u0435\u0435", "\u043d\u0438\u0436\u0435", "\u0441\u043d\u0438\u0436", "\u043d\u0438\u0437\u043a", "\u043c\u043e\u043b\u043e\u0436\u0435", "\u043f\u043e\u043d\u0438\u0436"],
    source: ["\u043c\u0435\u043d\u0435\u0435", "\u043d\u0438\u0436\u0435", "\u0441\u043d\u0438\u0436", "\u043d\u0438\u0437\u043a", "\u043c\u043e\u043b\u043e\u0436\u0435", "\u043f\u043e\u043d\u0438\u0436"],
  },
  {
    answer: ["\u0431\u043e\u043b\u0435\u0435", "\u0432\u044b\u0448\u0435", "\u043f\u043e\u0432\u044b\u0448", "\u0432\u044b\u0441\u043e\u043a", "\u0441\u0442\u0430\u0440\u0448\u0435"],
    source: ["\u0431\u043e\u043b\u0435\u0435", "\u0432\u044b\u0448\u0435", "\u043f\u043e\u0432\u044b\u0448", "\u0432\u044b\u0441\u043e\u043a", "\u0441\u0442\u0430\u0440\u0448\u0435"],
  },
].map((group) => ({
  answer: group.answer.map((item) => normalizeForSearch(item)),
  source: group.source.map((item) => normalizeForSearch(item)),
}));

const SHARED_MULTI_SHORT_ALIAS_PHRASES = new Set(["\u0441\u043f\u044f", "\u0440\u044d"].map((item) => normalizeForSearch(item)));

function answerShortMedicalAliases(answerText) {
  const own = new Set(focusedAnswerSearchPhrases(answerText).map((phrase) => normalizeForSearch(phrase)));
  const answerNorm = normalizeForSearch(answerText);
  return [...SHARED_MULTI_SHORT_ALIAS_PHRASES].filter((alias) => own.has(alias) && !answerNorm.includes(alias));
}

export function bestShortMedicalAliasSupport({ mode, pages, topQuestionPages, questionTokens, answer }) {
  if (mode !== "multi") return null;
  const aliases = answerShortMedicalAliases(answer.text);
  if (!aliases.length) return null;
  let best = null;
  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    for (const segment of cachedLineWindowSegments(page)) {
      if (!aliases.some((alias) => segment.normalized.includes(alias))) continue;
      const questionCoverage = coverage(questionTokens, segment.tokens);
      if (questionCoverage < 0.18) continue;
      const score = 10.8 + Math.min(0.65, questionCoverage) * 5.4;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text: segment.text,
        score,
        kind: "short_medical_alias_segment",
      });
    }
  }
  return best;
}

function sharedMultiTokens(answerText) {
  return uniqueTokens(answerText).filter((token) => token.length >= 3 && !FOCUS_STOPWORDS.has(token) && !SHARED_MULTI_GENERIC_TOKENS.has(token));
}

const PARENTHETICAL_GROUP_GENERIC_FOCUS = new Set(
  [
    "\u0430\u043c\u043a",
    "\u0430\u043d\u043e\u043c\u0430\u043b\u044c\u043d",
    "\u043c\u0430\u0442\u043e\u0447",
    "\u043a\u0440\u043e\u0432\u043e\u0442\u0435\u0447",
    "\u043a\u0430\u0442\u0435\u0433\u043e\u0440",
    "\u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438",
    "\u043e\u0442\u043d\u043e\u0441",
    "\u044f\u0432\u043b\u044f",
    "\u044f\u0432\u043b\u044f\u044e\u0442",
  ].flatMap((item) => uniqueTokens(item)),
);

function parentheticalGroupFocusTokens(question) {
  return uniqueTokens(question).filter((token) => token.length >= 4 && !FOCUS_STOPWORDS.has(token) && !PARENTHETICAL_GROUP_GENERIC_FOCUS.has(token));
}

function answerInParentheticalGroup(groupNormalized, answer) {
  return answerSearchPhrases(answer.text)
    .map((phrase) => normalizeForSearch(phrase))
    .filter((phrase) => phrase.length >= 3)
    .some((phrase) => containsNormalizedPhrase(groupNormalized, phrase));
}

function parentheticalGroupAnswerHit(groupNormalized, groupTokens, answer) {
  const answerTokens = uniqueTokens(answer.text);
  return answerInParentheticalGroup(groupNormalized, answer) || strictSoftCoverage(answerTokens, groupTokens) >= (answerTokens.length <= 1 ? 0.95 : 0.68);
}

function inlineParentheticalGroupContext({ beforeText, afterText, specificFocus }) {
  const beforeTokens = tokenize(beforeText);
  const afterTokens = tokenize(afterText);
  const headHits = tokenHitCount(specificFocus, beforeTokens);
  const tailHits = tokenHitCount(specificFocus, afterTokens);
  const hasListCue = beforeTokens.includes(stemToken(normalizeForSearch("\u0440\u044f\u0434"))) || beforeTokens.includes(stemToken(normalizeForSearch("\u0433\u0440\u0443\u043f\u043f")));
  return hasListCue && headHits >= 1 && tailHits >= 1;
}

/**
 * Связывает варианты ответа с ближайшей скобочной группой после релевантного
 * заголовка: `органические причины (...)`, `факторы риска (...)` и похожие
 * конструкции. Это помогает не смешивать соседние группы в одной строке.
 */
export function bestParentheticalGroupSupport({ mode, pages, question, answer, answers, answerTokens }) {
  if (mode !== "multi") return null;
  const normalizedQuestion = normalizeForSearch(question);
  const questionTokenSet = new Set(tokenize(question));
  if (questionTokenSet.has(stemToken(normalizeForSearch("\u0444\u0430\u043a\u0442\u043e\u0440"))) && questionTokenSet.has(stemToken(normalizeForSearch("\u0440\u0438\u0441\u043a")))) {
    return null;
  }
  const specificFocus = parentheticalGroupFocusTokens(question);
  if (specificFocus.length < 2) return null;
  let best = null;

  for (const page of pages) {
    const text = String(page.text ?? "");
    const matches = text.matchAll(/\(([^()]{6,260})\)/gu);
    for (const match of matches) {
      const groupText = match[1] ?? "";
      const groupStart = match.index ?? 0;
      let beforeText = text.slice(Math.max(0, groupStart - 180), groupStart);
      const previousGroupEnd = beforeText.lastIndexOf(")");
      if (previousGroupEnd >= 0) beforeText = beforeText.slice(previousGroupEnd + 1);
      const afterText = text.slice(groupStart + match[0].length, groupStart + match[0].length + 180);
      const beforeTokens = tokenize(beforeText);
      const categoryContext = beforeTokens.includes(stemToken(normalizeForSearch("\u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438")));
      const inlineContext = inlineParentheticalGroupContext({ beforeText, afterText, specificFocus });
      if (!categoryContext && !inlineContext) continue;
      const specificHits = tokenHitCount(specificFocus, beforeTokens);
      const specificCoverage = coverage(specificFocus, beforeTokens);
      if (categoryContext && specificHits < 2 && specificCoverage < 0.34) continue;

      const groupNormalized = normalizeForSearch(groupText);
      const groupTokens = tokenize(groupText);
      const groupAnswerHits = (answers ?? []).filter((candidate) => parentheticalGroupAnswerHit(groupNormalized, groupTokens, candidate)).length;
      if (inlineContext && groupAnswerHits < 2) continue;
      const answerCoverage = strictSoftCoverage(answerTokens, groupTokens);
      if (!answerInParentheticalGroup(groupNormalized, answer) && answerCoverage < (answerTokens.length <= 1 ? 0.95 : 0.68)) continue;
      const score =
        (inlineContext ? 14.6 : 13.8) +
        Math.min(4, specificHits) * 1.15 +
        Math.min(0.75, specificCoverage) * 5.2 +
        answerCoverage * 2.2 +
        Math.min(3, groupAnswerHits) * 0.8;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text: `${beforeText}(${groupText})`.replace(/\s+/g, " ").trim(),
        score,
        kind: "parenthetical_group_segment",
      });
    }
  }

  return best;
}

const CONTINUATION_LIST_QUESTION_CUES = [
  "\u043e\u0441\u043d\u043e\u0432\u0430\u043d",
].map((item) => normalizeForSearch(item));

const CONTINUATION_LIST_SEGMENT_CUES = [
  "\u043e\u0441\u043d\u043e\u0432\u0430\u043d",
  "\u0434\u0430\u043d\u043d",
].map((item) => normalizeForSearch(item));

function continuationListQuestion(question, intent) {
  if (intent?.exception) return false;
  const normalized = normalizeForSearch(question);
  if (containsNormalizedPhrase(normalized, "\u043d\u0435 \u0432\u043a\u043b\u044e\u0447")) return false;
  return CONTINUATION_LIST_QUESTION_CUES.some((cue) => normalized.includes(cue)) && containsNormalizedPhrase(normalized, "\u043d\u0430");
}

function answerContinuationListHit(segment, answer, answerTokens) {
  const normalized = segment.normalized;
  const phraseHit = answerSearchPhrases(answer.text)
    .map((phrase) => normalizeForSearch(phrase))
    .filter((phrase) => phrase.length >= 5)
    .some((phrase) => containsNormalizedPhrase(normalized, phrase));
  const answerCoverage = strictSoftCoverage(answerTokens, segment.tokens);
  const numbers = extractNumbers(answer.text);
  if (numbers.length && numberCoverage(answer.text, normalized) < 1) return { phraseHit: false, answerCoverage, hit: false };
  const hit = phraseHit || answerCoverage >= (answerTokens.length <= 2 ? 0.86 : 0.68);
  return { phraseHit, answerCoverage, hit };
}

function continuationLineSegments(page) {
  const lines = page.lines ?? [];
  const segments = [];
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines.slice(index, Math.min(lines.length, index + 7)).join(" ").replace(/\s+/g, " ").trim();
    if (text.length >= 40 && text.length <= 1500) {
      segments.push({
        text,
        normalized: normalizeForSearch(text),
        tokens: tokenize(text),
      });
    }
  }
  return segments;
}

/**
 * Ищет варианты в строке-продолжении вопроса вида `критерии основаны на...`.
 *
 * В отличие от общего BM25 этот scorer требует, чтобы сама строка содержала
 * формулировку вопроса и структурный list-cue, поэтому соседние обсуждения
 * вариантов не получают такой же вес.
 */
export function bestQuestionContinuationListSupport({ mode, pages, topQuestionPages, question, answer, answerTokens, questionTokens, focusTokens, intent }) {
  if (mode !== "multi" || !continuationListQuestion(question, intent)) return null;
  const usefulFocus = (focusTokens?.length ? focusTokens : questionTokens).filter((token) => token.length >= 4 && !FOCUS_STOPWORDS.has(token));
  let best = null;

  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    for (const segment of continuationLineSegments(page)) {
      if (!CONTINUATION_LIST_SEGMENT_CUES.some((cue) => segment.normalized.includes(cue))) continue;
      const questionCoverage = coverage(questionTokens, segment.tokens);
      const focusHits = tokenHitCount(usefulFocus, segment.tokens);
      if (questionCoverage < 0.5) continue;
      if (usefulFocus.length >= 2 && focusHits < 2) continue;
      const answerHit = answerContinuationListHit(segment, answer, answerTokens);
      if (!answerHit.hit) continue;
      const score =
        11.6 +
        Math.min(0.72, questionCoverage) * 5.4 +
        Math.min(3, focusHits) * 0.8 +
        answerHit.answerCoverage * 2.6 +
        (answerHit.phraseHit ? 1.6 : 0);
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text: segment.text,
        score,
        kind: "question_continuation_list",
      });
    }
  }

  return best;
}

function sharedMultiSectionCue(question) {
  const normalizedQuestion = normalizeForSearch(question);
  return SHARED_MULTI_SECTION_CUES.find((cue) => normalizedQuestion.includes(cue)) ?? null;
}

function sharedMultiFocusedNormalized(segmentText, question) {
  const normalized = normalizeForSearch(segmentText);
  const cue = sharedMultiSectionCue(question);
  if (!cue) return normalized;
  const start = normalized.indexOf(cue);
  if (start < 0) return normalized;
  let end = normalized.length;
  for (const nextCue of SHARED_MULTI_SECTION_CUES) {
    if (nextCue === cue) continue;
    const index = normalized.indexOf(nextCue, start + cue.length + 20);
    if (index > start) end = Math.min(end, index);
  }
  return normalized.slice(start, end);
}

function sharedMultiRequiredCueMismatch(answerText, normalizedSegment) {
  const normalizedAnswer = normalizeForSearch(answerText);
  for (const group of SHARED_MULTI_REQUIRED_CUE_GROUPS) {
    if (group.answer.some((cue) => normalizedAnswer.includes(cue)) && !group.source.some((cue) => normalizedSegment.includes(cue))) {
      return true;
    }
  }
  return false;
}

function sharedMultiTokenPosition(normalizedSegment, token) {
  const probes = [token, token.slice(0, 10), token.slice(0, 8), token.slice(0, 6)].filter((item) => item.length >= 4);
  for (const probe of probes) {
    const index = normalizedSegment.indexOf(probe);
    if (index >= 0) return index;
  }
  return -1;
}

function sharedMultiCompactSpan(normalizedSegment, tokens) {
  const positions = tokens
    .map((token) => sharedMultiTokenPosition(normalizedSegment, token))
    .filter((position) => position >= 0)
    .sort((a, b) => a - b);
  if (positions.length < Math.min(2, tokens.length)) return Infinity;
  return positions[positions.length - 1] - positions[0];
}

function sharedMultiNumericComparatorMismatch(answerText, normalizedSegment) {
  const answerNumbers = extractNumbers(answerText).filter((number) => /^\d+(?:[.,]\d+)?$/u.test(number));
  if (answerNumbers.length !== 1) return false;
  const answerNumber = String(Number(answerNumbers[0].replace(",", ".")));
  const comparatorHits = extractComparatorNumbers(normalizedSegment);
  if (!comparatorHits.length) return false;
  return !comparatorHits.includes(answerNumber);
}

function sharedMultiSegmentHit(segmentText, answer, question) {
  const normalized = sharedMultiFocusedNormalized(segmentText, question);
  if (!normalized || normalized.length < 30) return null;
  if (sharedMultiRequiredCueMismatch(answer.text, normalized)) return null;
  if (sharedMultiNumericComparatorMismatch(answer.text, normalized)) return null;

  const tokens = sharedMultiTokens(answer.text);
  const phraseHit = focusedAnswerSearchPhrases(answer.text)
    .map((phrase) => normalizeForSearch(phrase))
    .filter((phrase) => phrase.length >= 9 || SHARED_MULTI_SHORT_ALIAS_PHRASES.has(phrase) || (tokens.length === 1 && phrase.length >= 5))
    .some((phrase) => (SHARED_MULTI_SHORT_ALIAS_PHRASES.has(phrase) ? normalized.includes(phrase) : containsNormalizedPhrase(normalized, phrase)));
  const tokenCoverage = tokens.length ? strictSoftCoverage(tokens, tokenizeNormalized(normalized)) : 0;
  const compactSpan = sharedMultiCompactSpan(normalized, tokens);
  const spanLimit = Math.min(520, 150 + tokens.length * 45);
  const strongTokenHit = tokens.length >= 2 && tokenCoverage >= 0.78 && compactSpan <= spanLimit;

  if (!phraseHit && !strongTokenHit) return null;
  return { phraseHit, tokenCoverage, tokens, compactSpan };
}

export function addSharedMultiSegmentSupport(answerScores, intent, question) {
  if (intent.negative || intent.exception || answerScores.length < 3) return answerScores;
  const sorted = [...answerScores].sort((a, b) => b.raw - a.raw);
  const topRaw = sorted[0]?.raw ?? 0;
  if (topRaw < 5) return answerScores;

  const sourceMap = new Map();
  for (const item of sorted.slice(0, Math.min(3, sorted.length))) {
    for (const evidenceItem of item.evidence.slice(0, 4)) {
      if (!SHARED_MULTI_SOURCE_KINDS.has(evidenceItem.kind)) continue;
      if (!evidenceItem.text || evidenceItem.text.length < 50) continue;
      if ((evidenceItem.score ?? 0) < 4.8) continue;
      const key = `${evidenceItem.page}:${evidenceItem.kind}:${evidenceItem.text.slice(0, 220)}`;
      if (!sourceMap.has(key) || sourceMap.get(key).score < evidenceItem.score) {
        sourceMap.set(key, evidenceItem);
      }
    }
  }
  const sources = [...sourceMap.values()].slice(0, 8);
  if (!sources.length) return answerScores;

  return answerScores.map((item) => {
    let best = null;
    for (const source of sources) {
      const hit = sharedMultiSegmentHit(source.text, item.answer, question);
      if (!hit) continue;
      const evidenceScore =
        9.2 +
        Math.min(3.2, source.score * 0.18) +
        hit.tokenCoverage * 2.6 +
        (hit.phraseHit ? 1.4 : 0);
      best = betterEvidence(best, {
        answerId: item.answer.id,
        page: source.page,
        text: source.text,
        score: evidenceScore,
        kind: "shared_multi_segment",
      });
    }
    if (!best) return item;
    const minPriorRatio = topRaw < 10 ? 0.48 : 0.38;
    if (item.raw < topRaw * minPriorRatio) return item;
    const hasAbbreviationAlias = item.evidence.some((evidenceItem) => evidenceItem.kind === "abbreviation_alias_window");
    const supportRatio = hasAbbreviationAlias ? 0.455 : topRaw < 13 ? 0.96 : best.score >= 12 ? 0.82 : 0.76;
    const boostedRaw = Math.max(item.raw, topRaw * supportRatio);
    if (boostedRaw <= item.raw + 0.05) return item;
    return { ...item, raw: boostedRaw, evidence: [...item.evidence, best] };
  });
}

export function applyGeneSentenceSetSupport(answerScores, mode, question) {
  if (mode !== "multi" || !geneMutationQuestion(question)) return answerScores;
  const supported = answerScores.filter((item) => item.evidence.some((evidenceItem) => evidenceItem.kind === "gene_sentence_segment"));
  if (supported.length < 2) return answerScores;
  const topRaw = Math.max(...answerScores.map((item) => item.raw), 0);
  return answerScores.map((item) => {
    const hasGeneSupport = item.evidence.some((evidenceItem) => evidenceItem.kind === "gene_sentence_segment");
    if (hasGeneSupport) return { ...item, raw: Math.max(item.raw, topRaw * 0.93) };
    if (latinAnswerTokens(item.answer.text).length) return { ...item, raw: item.raw * 0.56 };
    return item;
  });
}
