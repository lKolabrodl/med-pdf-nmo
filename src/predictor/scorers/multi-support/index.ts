import {
  coverage,
  extractNumbers,
  normalizeForSearch,
  stemToken,
  tokenize,
  uniqueTokens,
} from "../../../normalize.js";
import type {PdfPage} from "../../../pdf.js";
import {FOCUS_STOPWORDS} from "../../constants.js";
import type {AnswerScoringContext, QuestionIntent} from "../../contracts.js";
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
} from "../../text-utils.js";
import type {AnswerMode, AnswerOption, AnswerScore, EvidenceItem} from "../../types.js";
import {geneMutationQuestion, latinAnswerTokens} from "../biomedical-symbols/index.js";

type NormalizedTokenSegment = {
  text: string;
  normalized: string;
  tokens: string[];
};

type ParentheticalGroupContext = {
  beforeText: string;
  afterText: string;
  specificFocus: string[];
};

type ContinuationListHit = {
  phraseHit: boolean;
  answerCoverage: number;
  hit: boolean;
};

type SharedMultiSegmentHit = {
  phraseHit: boolean;
  tokenCoverage: number;
  tokens: string[];
  compactSpan: number;
};

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

/**
 * Извлекает или проверяет варианта ответа короткой формы медицинского алиаса алиасов в варианте ответа.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function answerShortMedicalAliases(answerText: string): string[] {
  const own = new Set(focusedAnswerSearchPhrases(answerText).map((phrase) => normalizeForSearch(phrase)));
  const answerNorm = normalizeForSearch(answerText);
  return [...SHARED_MULTI_SHORT_ALIAS_PHRASES].filter((alias) => own.has(alias) && !answerNorm.includes(alias));
}

/**
 * Ищет короткий медицинский алиас ответа в релевантном multi-сегменте.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param context.questionTokens Нормализованные токены вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestShortMedicalAliasSupport(
  {mode, pages, topQuestionPages, questionTokens, answer}: AnswerScoringContext,
): EvidenceItem | null {
  if (mode !== "multi") return null;
  const aliases = answerShortMedicalAliases(answer.text);
  if (!aliases.length) return null;
  let best: EvidenceItem | null = null;
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

/**
 * Выделяет специфичные токены для общего multi-сегмента multi-answer набора.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function sharedMultiTokens(answerText: string): string[] {
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

/**
 * Выделяет специфичные токены для группы в скобках группы фокуса вопроса.
 *
 * @param question Исходный текст вопроса.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function parentheticalGroupFocusTokens(question: string): string[] {
  return uniqueTokens(question).filter((token) => token.length >= 4 && !FOCUS_STOPWORDS.has(token) && !PARENTHETICAL_GROUP_GENERIC_FOCUS.has(token));
}

/**
 * Извлекает или проверяет варианта ответа `in` группы в скобках группы в варианте ответа.
 *
 * @param groupNormalized Значение `groupNormalized`, необходимое этому этапу scorer-а.
 * @param answer Проверяемый вариант ответа с идентификатором и текстом.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function answerInParentheticalGroup(groupNormalized: string, answer: AnswerOption): boolean {
  return answerSearchPhrases(answer.text)
    .map((phrase) => normalizeForSearch(phrase))
    .filter((phrase) => phrase.length >= 3)
    .some((phrase) => containsNormalizedPhrase(groupNormalized, phrase));
}

/**
 * Определяет локальные совпадения для группы в скобках группы варианта ответа.
 *
 * @param groupNormalized Значение `groupNormalized`, необходимое этому этапу scorer-а.
 * @param groupTokens Нормализованные токены соответствующего текста.
 * @param answer Проверяемый вариант ответа с идентификатором и текстом.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function parentheticalGroupAnswerHit(
  groupNormalized: string,
  groupTokens: string[],
  answer: AnswerOption,
): boolean {
  const answerTokens = uniqueTokens(answer.text);
  return answerInParentheticalGroup(groupNormalized, answer) || strictSoftCoverage(answerTokens, groupTokens) >= (answerTokens.length <= 1 ? 0.95 : 0.68);
}

/**
 * Проверяет, связана ли скобочная группа с одинаковым фокусом до и после неё.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.beforeText Исходный текст соответствующего объекта.
 * @param context.afterText Исходный текст соответствующего объекта.
 * @param context.specificFocus Значение `specificFocus`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function inlineParentheticalGroupContext(
  {beforeText, afterText, specificFocus}: ParentheticalGroupContext,
): boolean {
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
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answers Полный набор вариантов, необходимый для контрастного сравнения.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestParentheticalGroupSupport(
  {mode, pages, question, answer, answers, answerTokens}: AnswerScoringContext,
): EvidenceItem | null {
  if (mode !== "multi") return null;
  const normalizedQuestion = normalizeForSearch(question);
  const questionTokenSet = new Set(tokenize(question));
  if (questionTokenSet.has(stemToken(normalizeForSearch("\u0444\u0430\u043a\u0442\u043e\u0440"))) && questionTokenSet.has(stemToken(normalizeForSearch("\u0440\u0438\u0441\u043a")))) {
    return null;
  }
  const specificFocus = parentheticalGroupFocusTokens(question);
  if (specificFocus.length < 2) return null;
  let best: EvidenceItem | null = null;

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

/**
 * Выполняет внутренний этап `continuationListQuestion`, подготавливающий продолжения списка вопроса для основного scorer-а.
 *
 * @param question Исходный текст вопроса.
 * @param intent Определённый predictor-ом тип и полярность вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function continuationListQuestion(question: string, intent: QuestionIntent): boolean {
  if (intent?.exception) return false;
  const normalized = normalizeForSearch(question);
  if (containsNormalizedPhrase(normalized, "\u043d\u0435 \u0432\u043a\u043b\u044e\u0447")) return false;
  return CONTINUATION_LIST_QUESTION_CUES.some((cue) => normalized.includes(cue)) && containsNormalizedPhrase(normalized, "\u043d\u0430");
}

/**
 * Определяет локальные совпадения для варианта ответа продолжения списка.
 *
 * @param segment Значение `segment`, необходимое этому этапу scorer-а.
 * @param answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param answerTokens Нормализованные токены проверяемого варианта.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function answerContinuationListHit(
  segment: NormalizedTokenSegment,
  answer: AnswerOption,
  answerTokens: string[],
): ContinuationListHit {
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

/**
 * Строит ограниченные текстовые сегменты для продолжения строки.
 *
 * @param page Текущая страница PDF или её номер.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function continuationLineSegments(page: PdfPage): NormalizedTokenSegment[] {
  const lines = page.lines ?? [];
  const segments: NormalizedTokenSegment[] = [];
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
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @param context.questionTokens Нормализованные токены вопроса.
 * @param context.focusTokens Специфичные токены вопроса без общих служебных слов.
 * @param context.intent Определённый predictor-ом тип и полярность вопроса.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestQuestionContinuationListSupport(
  {mode, pages, topQuestionPages, question, answer, answerTokens, questionTokens, focusTokens, intent}: AnswerScoringContext,
): EvidenceItem | null {
  if (mode !== "multi" || !continuationListQuestion(question, intent)) return null;
  const usefulFocus = (focusTokens?.length ? focusTokens : questionTokens).filter((token) => token.length >= 4 && !FOCUS_STOPWORDS.has(token));
  let best: EvidenceItem | null = null;

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

/**
 * Выполняет внутренний этап `sharedMultiSectionCue`, подготавливающий общего multi-сегмента multi-answer набора секции маркера для основного scorer-а.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function sharedMultiSectionCue(question: string): string | null {
  const normalizedQuestion = normalizeForSearch(question);
  return SHARED_MULTI_SECTION_CUES.find((cue) => normalizedQuestion.includes(cue)) ?? null;
}

/**
 * Выполняет внутренний этап `sharedMultiFocusedNormalized`, подготавливающий общего multi-сегмента multi-answer набора сфокусированного `normalized` для основного scorer-а.
 *
 * @param segmentText Исходный текст соответствующего объекта.
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function sharedMultiFocusedNormalized(segmentText: string, question: string): string {
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

/**
 * Определяет явное несовпадение общего multi-сегмента multi-answer набора `required` маркера.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @param normalizedSegment Значение `normalizedSegment`, необходимое этому этапу scorer-а.
 * @returns `true`, если проверяемое условие выполнено; иначе `false`.
 * @internal
 */
function sharedMultiRequiredCueMismatch(answerText: string, normalizedSegment: string): boolean {
  const normalizedAnswer = normalizeForSearch(answerText);
  for (const group of SHARED_MULTI_REQUIRED_CUE_GROUPS) {
    if (group.answer.some((cue) => normalizedAnswer.includes(cue)) && !group.source.some((cue) => normalizedSegment.includes(cue))) {
      return true;
    }
  }
  return false;
}

/**
 * Выполняет внутренний этап `sharedMultiTokenPosition`, подготавливающий общего multi-сегмента multi-answer набора токена `position` для основного scorer-а.
 *
 * @param normalizedSegment Значение `normalizedSegment`, необходимое этому этапу scorer-а.
 * @param token Отдельный нормализуемый или сравниваемый токен.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function sharedMultiTokenPosition(normalizedSegment: string, token: string): number {
  const probes = [token, token.slice(0, 10), token.slice(0, 8), token.slice(0, 6)].filter((item) => item.length >= 4);
  for (const probe of probes) {
    const index = normalizedSegment.indexOf(probe);
    if (index >= 0) return index;
  }
  return -1;
}

/**
 * Выполняет внутренний этап `sharedMultiCompactSpan`, подготавливающий общего multi-сегмента multi-answer набора компактной записи `span` для основного scorer-а.
 *
 * @param normalizedSegment Значение `normalizedSegment`, необходимое этому этапу scorer-а.
 * @param tokens Набор токенов для локального сопоставления.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function sharedMultiCompactSpan(normalizedSegment: string, tokens: string[]): number {
  const positions = tokens
    .map((token) => sharedMultiTokenPosition(normalizedSegment, token))
    .filter((position) => position >= 0)
    .sort((a, b) => a - b);
  if (positions.length < Math.min(2, tokens.length)) return Infinity;
  return positions[positions.length - 1] - positions[0];
}

/**
 * Определяет явное несовпадение общего multi-сегмента multi-answer набора числового значения компаратора.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @param normalizedSegment Значение `normalizedSegment`, необходимое этому этапу scorer-а.
 * @returns `true`, если проверяемое условие выполнено; иначе `false`.
 * @internal
 */
function sharedMultiNumericComparatorMismatch(answerText: string, normalizedSegment: string): boolean {
  const answerNumbers = extractNumbers(answerText).filter((number) => /^\d+(?:[.,]\d+)?$/u.test(number));
  if (answerNumbers.length !== 1) return false;
  const answerNumber = String(Number(answerNumbers[0].replace(",", ".")));
  const comparatorHits = extractComparatorNumbers(normalizedSegment);
  if (!comparatorHits.length) return false;
  return !comparatorHits.includes(answerNumber);
}

/**
 * Определяет локальные совпадения для общего multi-сегмента multi-answer набора сегмента.
 *
 * @param segmentText Исходный текст соответствующего объекта.
 * @param answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function sharedMultiSegmentHit(
  segmentText: string,
  answer: AnswerOption,
  question: string,
): SharedMultiSegmentHit | null {
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

/**
 * Добавляет ограниченную общую поддержку ответам из одного multi-сегмента.
 *
 * @param answerScores Текущие score и evidence всех вариантов ответа.
 * @param intent Определённый predictor-ом тип и полярность вопроса.
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 */
export function addSharedMultiSegmentSupport(
  answerScores: AnswerScore[],
  intent: QuestionIntent,
  question: string,
): AnswerScore[] {
  if (intent.negative || intent.exception || answerScores.length < 3) return answerScores;
  const sorted = [...answerScores].sort((a, b) => b.raw - a.raw);
  const topRaw = sorted[0]?.raw ?? 0;
  if (topRaw < 5) return answerScores;

  const sourceMap = new Map<string, EvidenceItem>();
  for (const item of sorted.slice(0, Math.min(3, sorted.length))) {
    for (const evidenceItem of item.evidence.slice(0, 4)) {
      if (!SHARED_MULTI_SOURCE_KINDS.has(evidenceItem.kind)) continue;
      if (!evidenceItem.text || evidenceItem.text.length < 50) continue;
      if ((evidenceItem.score ?? 0) < 4.8) continue;
      const key = `${evidenceItem.page}:${evidenceItem.kind}:${evidenceItem.text.slice(0, 220)}`;
      const current = sourceMap.get(key);
      if (!current || current.score < evidenceItem.score) {
        sourceMap.set(key, evidenceItem);
      }
    }
  }
  const sources = [...sourceMap.values()].slice(0, 8);
  if (!sources.length) return answerScores;

  return answerScores.map((item) => {
    let best: EvidenceItem | null = null;
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

/**
 * Усиливает согласованный набор gene-ответов, найденных в одном предложении.
 *
 * @param answerScores Текущие score и evidence всех вариантов ответа.
 * @param mode Режим выбора ответа: `single` или `multi`.
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 */
export function applyGeneSentenceSetSupport(
  answerScores: AnswerScore[],
  mode: AnswerMode,
  question: string,
): AnswerScore[] {
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
