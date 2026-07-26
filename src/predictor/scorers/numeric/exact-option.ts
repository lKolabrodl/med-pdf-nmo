import {FOCUS_STOPWORDS} from "../../constants.js";
import {
  betterEvidence,
  cachedLineWindowSegments,
  containsNormalizedPhrase,
  coverage,
  extractNumbers,
  findPhraseOccurrences,
  hasSearchBoundaries,
  normalizeForSearch,
  normalizeText,
  numberCoverage,
  strictSoftCoverage,
  tokenize,
  tokenHitCount,
  uniqueTokens,
} from "./dependencies.js";
import type {AnswerMode, AnswerOption} from "../../types.js";
import type {ExactNumericOptionInput, NumericEvidence} from "./types.js";

const NUMERIC_OPTION_UNIT_TOKENS = new Set(
  [
    "\u043c\u0433",
    "\u043c\u043a\u0433",
    "\u043c\u043b",
    "\u043c\u0435",
    "\u043a\u0433",
    "\u0434\u0435\u043d\u044c",
    "\u0434\u043d\u044f",
    "\u0434\u043d\u0435\u0439",
    "\u0441\u0443\u0442\u043a\u0438",
    "\u0441\u0443\u0442\u043e\u043a",
    "\u043d\u0435\u0434\u0435\u043b\u044e",
    "\u043d\u0435\u0434\u0435\u043b\u0438",
    "\u043c\u0435\u0441\u044f\u0446",
    "\u043c\u0435\u0441\u044f\u0446\u0430",
    "\u043c\u0435\u0441\u044f\u0446\u0435\u0432",
    "\u0433\u043e\u0434",
    "\u0433\u043e\u0434\u0430",
    "\u043b\u0435\u0442",
    "\u0440\u0430\u0437",
    "\u0447\u0430\u0441",
    "\u0447",
  ].flatMap((item) => uniqueTokens(item)),
);

/**
 * Выполняет внутренний этап `numericOptionAnswer`, подготавливающий числового значения варианта ответа варианта ответа для основного scorer-а.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function numericOptionAnswer(answerText: string): boolean {
  if (!extractNumbers(answerText).length) return false;
  const normalized = normalizeForSearch(answerText);
  return normalized.includes("%") || tokenHitCount([...NUMERIC_OPTION_UNIT_TOKENS], tokenize(answerText)) > 0;
}

/**
 * Выполняет внутренний этап `denseNumericSingleQuestion`, подготавливающий `dense` числового значения single-answer разрешения вопроса для основного scorer-а.
 *
 * @param mode Режим выбора ответа: `single` или `multi`.
 * @param answers Полный набор вариантов, необходимый для контрастного сравнения.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function denseNumericSingleQuestion(mode: AnswerMode, answers: AnswerOption[]): boolean {
  return mode === "single" && answers.filter((answer) => numericOptionAnswer(answer.text)).length >= 2;
}

/**
 * Выполняет внутренний этап `exactNumericOptionQuestion`, подготавливающий точного совпадения числового значения варианта ответа вопроса для основного scorer-а.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function exactNumericOptionQuestion(question: string): boolean {
  const normalized = normalizeForSearch(question);
  return (
    containsNormalizedPhrase(normalized, "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434") ||
    containsNormalizedPhrase(normalized, "\u043d\u0430\u0437\u043d\u0430\u0447") ||
    containsNormalizedPhrase(normalized, "\u0434\u043e\u0437") ||
    containsNormalizedPhrase(normalized, "\u0432 \u0442\u0435\u0447\u0435\u043d") ||
    containsNormalizedPhrase(normalized, "\u0440\u0430\u0437 \u0432") ||
    containsNormalizedPhrase(normalized, "\u043a\u0430\u0436\u0434") ||
    containsNormalizedPhrase(normalized, "\u043f\u0440\u043e\u0432\u043e\u0434")
  );
}

/**
 * Строит набор поисковых фраз для числового значения точного совпадения.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function numericExactPhrases(answerText: string): string[] {
  const normalized = normalizeForSearch(answerText);
  const withoutParentheses = normalizeForSearch(normalized.replace(/\([^)]*\)/g, " "));
  const hyphenSplit = normalizeForSearch(String(answerText ?? "").replace(/\s*[-\u2010-\u2015]\s*/g, " "));
  const phrases = new Set([normalized, withoutParentheses, hyphenSplit]);
  return [...phrases].filter((phrase) => phrase.length >= 5 && extractNumbers(phrase).length);
}

/**
 * Строит набор поисковых фраз для часовой формы алиаса.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function hourAliasPhrases(answerText: string): string[] {
  const raw = normalizeText(answerText);
  const numbers = extractNumbers(answerText);
  if (!numbers.length || !/(?:^|\s)(?:\u0447|\u0447\.|\u0447\u0430\u0441|\u0447\u0430\u0441\u0430|\u0447\u0430\u0441\u043e\u0432)(?:\s|$)/u.test(raw)) return [];
  const phrases = new Set<string>();
  for (const number of numbers) {
    phrases.add(`${number} \u0447`);
    phrases.add(`${number} \u0447.`);
  }
  const answerNorm = normalizeForSearch(answerText);
  return [...phrases].filter((phrase) => normalizeForSearch(phrase) !== answerNorm);
}

/**
 * Выполняет внутренний этап `segmentContainsBoundedPhrase`, подготавливающий сегмента ограниченного фразы для основного scorer-а.
 *
 * @param normalizedSegment Значение `normalizedSegment`, необходимое этому этапу scorer-а.
 * @param phrase Значение `phrase`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function segmentContainsBoundedPhrase(normalizedSegment: string, phrase: string): boolean {
  const normalizedPhrase = normalizeForSearch(phrase);
  if (!normalizedPhrase) return false;
  return findPhraseOccurrences(normalizedSegment, normalizedPhrase, {textIsNormalized: true}).some((index) =>
    hasSearchBoundaries(normalizedSegment, index, normalizedPhrase.length),
  );
}

/**
 * Поддерживает single-вопросы с плотной числовой семьей вариантов.
 *
 * Если несколько вариантов отличаются дозой, сроком, частотой или процентом,
 * полный числовой режим в релевантной строке должен весить сильнее, чем общий
 * chunk, где рядом могут встречаться несколько альтернативных значений.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answers Полный набор вариантов, необходимый для контрастного сравнения.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @param context.questionTokens Нормализованные токены вопроса.
 * @param context.focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestExactNumericOptionSupport({mode,pages,topQuestionPages,question,answer,answers,answerTokens,questionTokens,focusTokens}: ExactNumericOptionInput): NumericEvidence {
  if (!denseNumericSingleQuestion(mode, answers) || !numericOptionAnswer(answer.text)) return null;
  if (!exactNumericOptionQuestion(question)) return null;
  const phrases = numericExactPhrases(answer.text).slice(0, 12);
  if (!phrases.length) return null;
  const usefulFocus = (focusTokens?.length ? focusTokens : questionTokens).filter((token) => token.length >= 4 && !FOCUS_STOPWORDS.has(token));
  let best: NumericEvidence = null;

  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    for (const segment of cachedLineWindowSegments(page)) {
      const phraseHit = phrases.some((phrase) => containsNormalizedPhrase(segment.normalized, phrase));
      if (!phraseHit) continue;
      const numericCoverage = numberCoverage(answer.text, segment.normalized);
      const focusHits = tokenHitCount(usefulFocus, segment.tokens);
      const questionCoverage = coverage(questionTokens, segment.tokens);
      if (questionCoverage < 0.14 && focusHits < Math.min(2, usefulFocus.length)) continue;
      const answerCoverage = strictSoftCoverage(answerTokens, segment.tokens);
      const score =
        12.8 +
        4.2 +
        numericCoverage * 3.0 +
        answerCoverage * 2.8 +
        Math.min(0.52, questionCoverage) * 5.6 +
        Math.min(2, focusHits) * 0.8;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text: segment.text,
        score,
        kind: "exact_numeric_option_segment",
      });
    }
  }

  return best;
}

/**
 * Узко поддерживает варианты времени, где PDF использует сокращение (`6 ч`),
 * а вариант ответа дан полностью (`6 часов`). Это отдельный слой, чтобы не
 * расширять общий numeric scorer и не усиливать соседние дозировки/сроки.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answers Полный набор вариантов, необходимый для контрастного сравнения.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @param context.questionTokens Нормализованные токены вопроса.
 * @param context.focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestExactHourAliasOptionSupport({mode,pages,topQuestionPages,question,answer,answers,answerTokens,questionTokens,focusTokens}: ExactNumericOptionInput): NumericEvidence {
  if (mode !== "single" || answers.filter((candidate) => extractNumbers(candidate.text).length > 0).length < 2) return null;
  if (!exactNumericOptionQuestion(question)) return null;
  const phrases = hourAliasPhrases(answer.text);
  if (!phrases.length) return null;

  const answerNumbers = new Set(extractNumbers(answer.text));
  const questionConditionNumbers = extractNumbers(question).filter((number) => !answerNumbers.has(number));
  const usefulFocus = (focusTokens?.length ? focusTokens : questionTokens).filter((token) => token.length >= 4 && !FOCUS_STOPWORDS.has(token));
  let best: NumericEvidence = null;

  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    for (const segment of cachedLineWindowSegments(page)) {
      const phraseHit = phrases.some((phrase) => segmentContainsBoundedPhrase(segment.normalized, phrase));
      if (!phraseHit) continue;
      if (questionConditionNumbers.length && !questionConditionNumbers.some((number) => containsNormalizedPhrase(segment.normalized, number))) continue;
      const focusHits = tokenHitCount(usefulFocus, segment.tokens);
      const questionCoverage = coverage(questionTokens, segment.tokens);
      if (questionCoverage < 0.14 && focusHits < Math.min(2, usefulFocus.length)) continue;
      const answerCoverage = strictSoftCoverage(answerTokens, segment.tokens);
      const numericCoverage = numberCoverage(answer.text, segment.normalized);
      const score =
        15.2 +
        numericCoverage * 3.2 +
        answerCoverage * 2.2 +
        Math.min(0.52, questionCoverage) * 5.2 +
        Math.min(2, focusHits) * 0.9;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text: segment.text,
        score,
        kind: "exact_hour_alias_segment",
      });
    }
  }

  return best;
}
