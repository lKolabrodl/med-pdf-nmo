import {FOCUS_STOPWORDS} from "../../constants.js";
import {
  answerSearchPhrases,
  betterEvidence,
  cachedLineWindowSegments,
  containsNormalizedPhrase,
  coverage,
  expandNumberToken,
  extractNumbers,
  findPhraseOccurrences,
  normalizeForSearch,
  numberCoverage,
  proximityBonus,
  strictSoftCoverage,
  tokenizeNormalized,
  tokenHitCount,
  uniqueTokens,
} from "./dependencies.js";
import type {ClozeGapInput, NumericEvidence} from "./types.js";

type ClozeQuestionParts = {
  left: string;
  right: string;
};

type ClozePhraseEntry = {
  phrase: string;
  alias: boolean;
  bareNumber: boolean;
};

const CLOZE_GENERIC_FOCUS = new Set(
  uniqueTokens(
    [
      "пациент пациенты пациентам больной больных дети детей ребенок ребенка",
      "рекомендуется проводится применяется назначается принимается используют",
      "составляет относятся следующие критерии показатель значение терапия лечение",
      "клинический рекомендации заболевание диагноз подтвержденный форма",
      "обычно необходимо следует возможно после перед при для",
    ].join(" "),
  ),
);

const CLOZE_COUNT_RIGHT_TOKENS = new Set(uniqueTokens("раз сутки прием приём день"));

const CLOZE_CONTRAST_PHRASES = [
  "при менее",
  "менее выраж",
  "далее",
  "после",
  "либо",
  "или",
  "для декрет",
  "декретирован",
  "старше",
  "от 1 года",
  "через",
].map((phrase) => normalizeForSearch(phrase));

const SMALL_NUMBER_ALIASES = new Map(
  Object.entries({
    "1": ["один", "одна", "одно", "однократно", "однократное", "однократный", "однократная", "1 раз", "1 р"],
    "2": ["два", "две", "дважды", "двукратно", "двукратное", "двукратный", "двукратная", "2 раза", "2 р"],
    "3": ["три", "трижды", "трехкратно", "трёхкратно", "3 раза", "3 р"],
    "4": ["четыре", "четырехкратно", "четырёхкратно", "4 раза", "4 р"],
    "5": ["пять", "5 раз", "5 р"],
    "6": ["шесть", "6 раз", "6 р"],
  }),
);

/**
 * Выполняет внутренний этап `clozeQuestionParts`, подготавливающий числового пропуска вопроса `parts` для основного scorer-а.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function clozeQuestionParts(question: string): ClozeQuestionParts {
  const raw = String(question ?? "");
  const blank = raw.match(/_{2,}|…+/u);
  if (!blank?.index) return { left: raw, right: "" };
  return {
    left: raw.slice(0, blank.index),
    right: raw.slice(blank.index + blank[0].length),
  };
}

/**
 * Проверяет, применим ли scorer для числового пропуска.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.question Исходный текст вопроса.
 * @returns `true`, если проверяемое условие выполнено; иначе `false`.
 * @internal
 */
function clozeApplicable({mode,question}: Pick<ClozeGapInput, "mode" | "question" | "answer">): boolean {
  if (mode !== "single") return false;
  const hasBlank = /_{2,}|…+/u.test(String(question ?? ""));
  if (hasBlank) return true;
  return false;
}

/**
 * Выделяет специфичные токены для числового пропуска фокуса вопроса.
 *
 * @param question Исходный текст вопроса.
 * @param focusTokens Специфичные токены вопроса без общих служебных слов.
 * @param answerTokens Нормализованные токены проверяемого варианта.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function clozeFocusTokens(question: string, focusTokens: string[], answerTokens: string[]): string[] {
  const answerSet = new Set(answerTokens ?? []);
  const out: string[] = [];
  for (const token of [...(focusTokens ?? []), ...uniqueTokens(question)]) {
    if (!token || token.length < 3) continue;
    if (answerSet.has(token)) continue;
    if (FOCUS_STOPWORDS.has(token) || CLOZE_GENERIC_FOCUS.has(token)) continue;
    if (!out.includes(token)) out.push(token);
  }
  return out.slice(0, 18);
}

/**
 * Выделяет специфичные токены для числового пропуска ядра.
 *
 * @param question Исходный текст вопроса.
 * @param answerTokens Нормализованные токены проверяемого варианта.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function clozeCoreTokens(question: string, answerTokens: string[]): string[] {
  const parts = clozeQuestionParts(question);
  const left = parts.left
    .split(
      /\s+(?:у|для|при|с|со|в)\s+пациент|\s+пациентам|\s+пациентов|\s+больным|\s+детям|\s+младше|\s+старше|\s+кажд|\s+принима|\s+провод|\s+составля|\s+равн|\s+в\s+дозе/iu,
    )[0];
  const tokens = uniqueTokens(left).filter((token) => token.length >= 4 && !FOCUS_STOPWORDS.has(token) && !CLOZE_GENERIC_FOCUS.has(token));
  const answerSet = new Set(answerTokens ?? []);
  return tokens.filter((token) => !answerSet.has(token)).slice(0, 6);
}

/**
 * Выполняет внутренний этап `clozeAnswerPhraseEntries`, подготавливающий числового пропуска варианта ответа фразы `entries` для основного scorer-а.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function clozeAnswerPhraseEntries(answerText: string): ClozePhraseEntry[] {
  const entries: ClozePhraseEntry[] = [];
  const seen = new Set<string>();
  const add = (value: unknown, alias = false): void => {
    const normalizedPhrase = normalizeForSearch(value);
    if (!normalizedPhrase || normalizedPhrase.length < 1 || seen.has(normalizedPhrase)) return;
    seen.add(normalizedPhrase);
    entries.push({
      phrase: String(value),
      alias,
      bareNumber: /^\d+(?:[.,]\d+)?$/u.test(normalizedPhrase),
    });
  };
  for (const phrase of answerSearchPhrases(answerText).slice(0, 18)) add(phrase, false);
  const numbers = extractNumbers(answerText);
  for (const number of numbers) {
    for (const expanded of expandNumberToken(number)) add(expanded, true);
  }
  if (numbers.length === 1) {
    const normalizedNumber = numbers[0].replace(/[.,]0+$/u, "");
    for (const alias of SMALL_NUMBER_ALIASES.get(normalizedNumber) ?? []) add(alias, true);
  }
  const answerNorm = normalizeForSearch(answerText);
  if (containsNormalizedPhrase(answerNorm, normalizeForSearch("месяц")) || containsNormalizedPhrase(answerNorm, normalizeForSearch("месяцев"))) {
    add("мес", true);
  }
  if (containsNormalizedPhrase(answerNorm, normalizeForSearch("неделя")) || containsNormalizedPhrase(answerNorm, normalizeForSearch("недели"))) {
    add("нед", true);
  }
  return entries;
}

/**
 * Выполняет внутренний этап `clozeHasUnitCue`, подготавливающий числового пропуска единицы измерения маркера для основного scorer-а.
 *
 * @param local Значение `local`, необходимое этому этапу scorer-а.
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function clozeHasUnitCue(local: string, question: string): boolean {
  const text = normalizeForSearch(`${local} ${question}`);
  return /(?:мг|мес|месяц|сут|дн|раз|р |%|°|мм|г\/л|лет|год)/u.test(text);
}

/**
 * Выполняет внутренний этап `lastTokenDistance`, подготавливающий `last` токена `distance` для основного scorer-а.
 *
 * @param before Значение `before`, необходимое этому этапу scorer-а.
 * @param focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Вычисленное числовое значение или специальное граничное значение при отсутствии совпадения.
 * @internal
 */
function lastTokenDistance(before: string, focusTokens: string[]): number {
  let best = -1;
  for (const token of focusTokens) {
    if (!token) continue;
    const index = before.lastIndexOf(token);
    if (index > best) best = index;
  }
  if (best < 0) return Number.POSITIVE_INFINITY;
  return before.length - best;
}

/**
 * Выполняет внутренний этап `clozeContrastPenalty`, подготавливающий числового пропуска контраста `penalty` для основного scorer-а.
 *
 * @param tail Значение `tail`, необходимое этому этапу scorer-а.
 * @param questionNumbers Значение `questionNumbers`, необходимое этому этапу scorer-а.
 * @returns Вычисленное числовое значение или специальное граничное значение при отсутствии совпадения.
 * @internal
 */
function clozeContrastPenalty(tail: string, questionNumbers: string[]): number {
  let penalty = 0;
  for (const phrase of CLOZE_CONTRAST_PHRASES) {
    if (phrase && containsNormalizedPhrase(tail, phrase)) penalty += 1;
  }
  const localNumbers = extractNumbers(tail);
  if (questionNumbers.length && localNumbers.some((number) => !questionNumbers.includes(number))) {
    penalty += 1;
  }
  return Math.min(3, penalty);
}

/**
 * Выполняет внутренний этап `relevantClozeQuestionNumbers`, подготавливающий `relevant` числового пропуска вопроса чисел для основного scorer-а.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function relevantClozeQuestionNumbers(question: string): string[] {
  const raw = String(question ?? "");
  const out: string[] = [];
  const pattern = /(?<![\p{L}])([<>]?\d+(?:[.,]\d+)?)(?![\p{L}])/giu;
  for (const match of raw.matchAll(pattern)) {
    const index = match.index ?? 0;
    const around = raw.slice(Math.max(0, index - 24), index + match[0].length + 24).toLowerCase();
    if (!/[<>]|мг|мм|мес|меся|лет|год|сут|дн|%|°|температур|доз|кажд|раз/u.test(around)) continue;
    const cleaned = match[1].replace(/^[<>]/u, "");
    for (const expanded of expandNumberToken(cleaned)) {
      if (!out.includes(expanded)) out.push(expanded);
    }
  }
  return out;
}

/**
 * Выполняет внутренний этап `clozeLocalHasRelevantQuestionNumber`, подготавливающий числового пропуска локального контекста `relevant` вопроса числа для основного scorer-а.
 *
 * @param local Значение `local`, необходимое этому этапу scorer-а.
 * @param relevantNumbers Значение `relevantNumbers`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function clozeLocalHasRelevantQuestionNumber(local: string, relevantNumbers: string[]): boolean {
  if (!relevantNumbers.length) return true;
  const localNumbers = new Set(extractNumbers(local).flatMap(expandNumberToken));
  return relevantNumbers.some((number) => localNumbers.has(number));
}

/**
 * Выполняет внутренний этап `clozeTailHasConflictingNumber`, подготавливающий числового пропуска хвоста фразы `conflicting` числа для основного scorer-а.
 *
 * @param tail Значение `tail`, необходимое этому этапу scorer-а.
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function clozeTailHasConflictingNumber(tail: string, answerText: string): boolean {
  const answerNumbers = new Set(extractNumbers(answerText).flatMap(expandNumberToken));
  if (!answerNumbers.size) return false;
  return extractNumbers(tail)
    .flatMap(expandNumberToken)
    .some((number) => !answerNumbers.has(number));
}

/**
 * Выполняет внутренний этап `clozeTailHasTimingCue`, подготавливающий числового пропуска хвоста фразы временного условия маркера для основного scorer-а.
 *
 * @param tail Значение `tail`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function clozeTailHasTimingCue(tail: string): boolean {
  return containsNormalizedPhrase(tail, "через") || containsNormalizedPhrase(tail, "после");
}

/**
 * Ищет числовой вариант в локальном месте пропуска или незавершённой фразы.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @param context.focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestClozeGapSupport({mode,pages,topQuestionPages,question,answer,answerTokens,focusTokens}: ClozeGapInput): NumericEvidence {
  if (!clozeApplicable({mode,question,answer})) return null;
  const specificFocus = clozeFocusTokens(question, focusTokens, answerTokens);
  if (specificFocus.length < 2) return null;
  const answerEntries = clozeAnswerPhraseEntries(answer.text);
  if (!answerEntries.length) return null;
  const parts = clozeQuestionParts(question);
  const rightTokens = clozeFocusTokens(parts.right, uniqueTokens(parts.right), answerTokens);
  if (!rightTokens.some((token) => CLOZE_COUNT_RIGHT_TOKENS.has(token))) return null;
  const hasBlank = /_{2,}|…+/u.test(String(question ?? ""));
  const coreTokens = clozeCoreTokens(question, answerTokens);
  const questionNumbers = extractNumbers(question);
  const relevantQuestionNumbers = relevantClozeQuestionNumbers(question);
  let best: NumericEvidence = null;

  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    const sources = cachedLineWindowSegments(page).filter((segment) => segment.normalized.length <= 760);
    for (const source of sources) {
      const tokens = tokenizeNormalized(source.normalized);
      const focusHits = tokenHitCount(specificFocus, tokens);
      const focusCoverage = coverage(specificFocus, tokens);
      if (focusHits < 2 && focusCoverage < 0.24) continue;

      for (const entry of answerEntries) {
        const hits = findPhraseOccurrences(source.normalized, entry.phrase, {textIsNormalized: true});
        for (const hit of hits) {
          const local = source.normalized.slice(Math.max(0, hit - 80), hit + entry.phrase.length + 90);
          if (entry.bareNumber && !clozeHasUnitCue(local, question)) continue;
          const relevantLocal = source.normalized.slice(Math.max(0, hit - 220), hit + entry.phrase.length + 140);
          if (!clozeLocalHasRelevantQuestionNumber(relevantLocal, relevantQuestionNumbers)) continue;
          const before = source.normalized.slice(Math.max(0, hit - 300), hit);
          const after = source.normalized.slice(hit + entry.phrase.length, hit + entry.phrase.length + 180);
          const beforeTokens = tokenizeNormalized(before);
          if (hasBlank && coreTokens.length >= 2) {
            const recentCoreCoverage = coverage(coreTokens, tokenizeNormalized(before.slice(-180)));
            const overallCoreCoverage = coverage(coreTokens, beforeTokens);
            if (recentCoreCoverage < 0.45 && overallCoreCoverage < 0.75) continue;
            if (lastTokenDistance(before, coreTokens) > 110) continue;
          }
          const beforeFocusHits = tokenHitCount(specificFocus, beforeTokens);
          const beforeCoverage = coverage(specificFocus, beforeTokens);
          if (beforeFocusHits < 2 && beforeCoverage < 0.18) continue;
          const distance = lastTokenDistance(before, specificFocus);
          if (!Number.isFinite(distance) || distance > 220) continue;
          const tail = before.slice(Math.max(0, before.length - Math.min(140, distance + 28)));
          const contrastPenalty = clozeContrastPenalty(tail, questionNumbers);
          if (!hasBlank && entry.bareNumber && clozeTailHasTimingCue(tail)) continue;
          if (!hasBlank && clozeTailHasConflictingNumber(tail, answer.text)) continue;
          if (contrastPenalty >= 2 && !rightTokens.length) continue;
          const rightCoverage = rightTokens.length ? coverage(rightTokens, tokenizeNormalized(after)) : 0;
          const numeric = numberCoverage(answer.text, local);
          const score =
            12.1 +
            Math.min(6, focusHits) * 0.65 +
            Math.min(6, beforeFocusHits) * 0.85 +
            Math.min(0.7, beforeCoverage) * 4.0 +
            proximityBonus(distance, 180) * 6.0 +
            Math.min(0.75, rightCoverage) * 4.0 +
            (entry.alias ? 1.4 : 0) +
            numeric * 1.1 -
            contrastPenalty * 5.2;
          if (score < 10.8) continue;
          best = betterEvidence(best, {
            answerId: answer.id,
            page: page.page,
            text: source.text,
            score,
            kind: "cloze_gap_local",
          });
        }
      }
    }
  }

  return best;
}
