import {
  coverage,
  extractNumbers,
  normalizeForSearch,
  uniqueTokens,
} from "../../../normalize.js";
import {
  answerSearchPhrases,
  betterEvidence,
  cachedLineWindowSegments,
  containsNormalizedPhrase,
  escapeRegExp,
  expandNumberToken,
  hasSearchBoundaries,
  numberCoverage,
  rawTokens,
  strictSoftCoverage,
  tokenHitCount,
  tokenSequenceIncludes,
  tokenizeNormalized,
} from "../../text-utils.js";
import type {AnswerScoringContext} from "../../contracts.js";
import type {AnswerOption, EvidenceItem} from "../../types.js";
import { answerOrdinalRowApplicable } from "../ordinal-row-gate/index.js";
import { ordinalValueToNumber, romanStageVariants } from "../ordinal-utils/index.js";

type AgeAnswerSupport = {
  phraseHit: boolean;
  tokenCoverage: number;
  numberHit: number;
};

type AnswerOrdinalKind = "stage" | "degree" | "type" | "class";

type AnswerOrdinalLabel = {
  kind: AnswerOrdinalKind;
  cue: string;
  number: number;
};

type OrdinalWindowSource = {
  normalized: string;
  text: string;
};

/**
 * Выделяет текстовые маркеры для вопроса возраста формы.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function questionAgeFormCues(question: string): string[] | null {
  const normalized = normalizeForSearch(question);
  if (!containsNormalizedPhrase(normalized, "\u0432\u043e\u0437\u0440\u0430\u0441\u0442") || !containsNormalizedPhrase(normalized, "\u0444\u043e\u0440\u043c")) return null;
  if (containsNormalizedPhrase(normalized, "\u043f\u043e\u0434\u0440\u043e\u0441\u0442") || containsNormalizedPhrase(normalized, "\u0432\u0437\u0440\u043e\u0441\u043b")) {
    return ["\u043f\u043e\u0434\u0440\u043e\u0441\u0442", "\u0432\u0437\u0440\u043e\u0441\u043b"].map((item) => normalizeForSearch(item));
  }
  if (containsNormalizedPhrase(normalized, "\u043f\u043e\u0437\u0434") && containsNormalizedPhrase(normalized, "\u043c\u043b\u0430\u0434\u0435\u043d")) {
    return ["\u043f\u043e\u0437\u0434", "\u043c\u043b\u0430\u0434\u0435\u043d"].map((item) => normalizeForSearch(item));
  }
  if (containsNormalizedPhrase(normalized, "\u0440\u0430\u043d") && containsNormalizedPhrase(normalized, "\u043c\u043b\u0430\u0434\u0435\u043d")) {
    return ["\u0440\u0430\u043d", "\u043c\u043b\u0430\u0434\u0435\u043d"].map((item) => normalizeForSearch(item));
  }
  if (containsNormalizedPhrase(normalized, "\u044e\u0432\u0435\u043d")) {
    return ["\u044e\u0432\u0435\u043d"].map((item) => normalizeForSearch(item));
  }
  return null;
}

/**
 * Находит позицию возраста формы метки в локальном тексте или структуре.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @param cues Значение `cues`, необходимое этому этапу scorer-а.
 * @returns Вычисленное числовое значение или специальное граничное значение при отсутствии совпадения.
 * @internal
 */
function ageFormLabelIndex(normalized: string, cues: string[]): number {
  if (cues.length === 1) return normalized.indexOf(cues[0]);
  let best = -1;
  const primary = cues[0];
  let start = 0;
  while (start < normalized.length) {
    const index = normalized.indexOf(primary, start);
    if (index < 0) break;
    const positions = [index];
    let ok = true;
    for (const cue of cues.slice(1)) {
      const before = normalized.lastIndexOf(cue, index + 42);
      const after = normalized.indexOf(cue, Math.max(0, index - 8));
      const candidate =
        before >= 0 && Math.abs(before - index) <= 42
          ? before
          : after >= 0 && Math.abs(after - index) <= 42
            ? after
            : -1;
      if (candidate < 0) {
        ok = false;
        break;
      }
      positions.push(candidate);
    }
    if (ok && Math.max(...positions) - Math.min(...positions) <= 48) {
      const labelStart = Math.min(...positions);
      best = best < 0 ? labelStart : Math.min(best, labelStart);
    }
    start = index + primary.length;
  }
  return best;
}

const AGE_FORM_BOUNDARY_CUES = [
  "\u043f\u0435\u0440\u0438\u043d\u0430\u0442",
  "\u0440\u0430\u043d",
  "\u043f\u043e\u0437\u0434",
  "\u044e\u0432\u0435\u043d",
  "\u043f\u043e\u0434\u0440\u043e\u0441\u0442",
  "\u0432\u0437\u0440\u043e\u0441\u043b",
].map((item) => normalizeForSearch(item));

/**
 * Находит структурную границу для следующей границы возраста формы.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @param labelIndex Позиция соответствующего элемента в локальной структуре.
 * @param cues Значение `cues`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function nextAgeFormBoundary(normalized: string, labelIndex: number, cues: string[]): number {
  let best = -1;
  for (const cue of AGE_FORM_BOUNDARY_CUES) {
    let index = normalized.indexOf(cue, labelIndex + 8);
    while (index >= 0) {
      const isCurrentLabelCue = cues.includes(cue) && Math.abs(index - labelIndex) <= 48;
      if (!isCurrentLabelCue) {
        best = best < 0 ? index : Math.min(best, index);
        break;
      }
      index = normalized.indexOf(cue, index + cue.length);
    }
  }
  return best;
}

/**
 * Определяет явное несовпадение варианта ответа компаратора.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @param window Значение `window`, необходимое этому этапу scorer-а.
 * @returns `true`, если проверяемое условие выполнено; иначе `false`.
 * @internal
 */
function answerComparatorMismatch(answerText: string, window: string): boolean {
  const numbers = extractNumbers(answerText);
  if (!numbers.length) return false;
  const firstNumber = expandNumberToken(numbers[0])[0] ?? numbers[0];
  const normalizedAnswer = normalizeForSearch(answerText);
  const startsWithDo = normalizedAnswer.startsWith(normalizeForSearch("\u0434\u043e "));
  const lessAnswer =
    answerText.includes("<") ||
    startsWithDo ||
    containsNormalizedPhrase(normalizedAnswer, "\u043c\u0435\u043d\u0435\u0435") ||
    containsNormalizedPhrase(normalizedAnswer, "\u043c\u0435\u043d\u044c\u0448\u0435") ||
    containsNormalizedPhrase(normalizedAnswer, "\u043c\u043e\u043b\u043e\u0436\u0435");
  if (lessAnswer) {
    return ![
      "\u0434\u043e",
      "\u043c\u0435\u043d\u0435\u0435",
      "\u043c\u0435\u043d\u044c\u0448\u0435",
      "\u043c\u043e\u043b\u043e\u0436\u0435",
      "\u043d\u0438\u0436\u0435",
    ].some((cue) => containsNormalizedPhrase(window, `${cue} ${firstNumber}`));
  }
  const greaterAnswer =
    answerText.includes(">") ||
    containsNormalizedPhrase(normalizedAnswer, "\u0441\u0442\u0430\u0440\u0448\u0435") ||
    containsNormalizedPhrase(normalizedAnswer, "\u0431\u043e\u043b\u0435\u0435") ||
    containsNormalizedPhrase(normalizedAnswer, "\u0432\u044b\u0448\u0435");
  if (greaterAnswer) {
    return ![
      "\u0441\u0442\u0430\u0440\u0448\u0435",
      "\u0431\u043e\u043b\u0435\u0435",
      "\u0432\u044b\u0448\u0435",
      "\u043f\u043e\u0441\u043b\u0435",
    ].some((cue) => containsNormalizedPhrase(window, `${cue} ${firstNumber}`));
  }
  return false;
}

/**
 * Выполняет внутренний этап `ageAnswerSupport`, подготавливающий возраста варианта ответа поддержки ответа для основного scorer-а.
 *
 * @param window Значение `window`, необходимое этому этапу scorer-а.
 * @param answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param answerTokens Нормализованные токены проверяемого варианта.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function ageAnswerSupport(window: string, answer: AnswerOption, answerTokens: string[]): AgeAnswerSupport | null {
  if (answerComparatorMismatch(answer.text, window)) return null;
  const phraseHit = answerSearchPhrases(answer.text)
    .map((phrase) => normalizeForSearch(phrase))
    .filter((phrase) => phrase.length >= 2)
    .some((phrase) => containsNormalizedPhrase(window, phrase));
  const tokens = answerTokens.filter((token) => token.length >= 2);
  const tokenCoverage = tokens.length ? strictSoftCoverage(tokens, tokenizeNormalized(window)) : 0;
  const numberHit = numberCoverage(answer.text, window);
  if (!phraseHit && tokenCoverage < 0.7 && numberHit < 0.9) return null;
  return { phraseHit, tokenCoverage, numberHit };
}

/**
 * Ищет локальное совпадение возрастной формы ответа с формой, названной в вопросе.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestAgeFormSupport(
  {mode, pages, question, answer, answerTokens}: AnswerScoringContext,
): EvidenceItem | null {
  if (mode !== "single") return null;
  const cues = questionAgeFormCues(question);
  if (!cues) return null;
  const normalizedAnswer = normalizeForSearch(answer.text);
  if (!extractNumbers(answer.text).length && !containsNormalizedPhrase(normalizedAnswer, "\u0441\u0442\u0430\u0440\u0448") && !containsNormalizedPhrase(normalizedAnswer, "\u043c\u043e\u043b\u043e\u0436")) return null;
  let best = null;

  for (const page of pages) {
    const lines = page.lines ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      const text = lines.slice(Math.max(0, index - 1), Math.min(lines.length, index + 2)).join(" ");
      const normalized = normalizeForSearch(text);
      const labelIndex = ageFormLabelIndex(normalized, cues);
      if (labelIndex < 0) continue;
      const boundary = nextAgeFormBoundary(normalized, labelIndex, cues);
      const windowEnd = boundary > labelIndex ? boundary : Math.min(normalized.length, labelIndex + 145);
      const window = normalized.slice(labelIndex, windowEnd);
      const support = ageAnswerSupport(window, answer, answerTokens);
      if (!support) continue;
      const score = 15.4 + support.numberHit * 3.8 + support.tokenCoverage * 2.4 + (support.phraseHit ? 2.0 : 0);
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text,
        score,
        kind: "age_form_segment",
      });
    }
  }

  return best;
}

/**
 * Извлекает из вопроса номер стадии, записанный римскими или арабскими цифрами.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function questionRomanStage(question: string): string | null {
  const tokens = rawTokens(question);
  const index = tokens.findIndex((token) => token.startsWith("\u0441\u0442\u0430\u0434\u0438"));
  const next = index >= 0 ? tokens[index + 1] : null;
  const previous = index > 0 ? tokens[index - 1] : null;
  if (next && /^(?:[ivx]+|\d+)$/iu.test(next)) return next.toLowerCase();
  if (previous && /^(?:[ivx]+|\d+)$/iu.test(previous)) return previous.toLowerCase();
  return null;
}


/**
 * Находит позицию следующей границы римского значения стадии строки в локальном тексте или структуре.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @param start Начальная позиция рассматриваемого диапазона.
 * @returns Вычисленное числовое значение или специальное граничное значение при отсутствии совпадения.
 * @internal
 */
function nextRomanStageRowIndex(normalized: string, start: number): number {
  const pattern = /(?:^|\s)(?:[ivx]{1,5}|\d{1,2})(?:\s|$)/giu;
  pattern.lastIndex = start;
  const match = pattern.exec(normalized);
  return match?.index ?? -1;
}

/**
 * Строит ограниченное локальное окно для римского значения стадии.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @param stage Значение `stage`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function romanStageWindow(normalized: string, stage: string): string | null {
  const stageCue = normalizeForSearch("\u0441\u0442\u0430\u0434\u0438\u044f");
  for (const variant of romanStageVariants(stage)) {
    const cues = [normalizeForSearch(`\u0441\u0442\u0430\u0434\u0438\u044f ${variant}`), normalizeForSearch(`${variant} \u0441\u0442\u0430\u0434\u0438\u044f`)];
    for (const cue of cues) {
      let index = -1;
      for (let start = 0; start < normalized.length; start += 1) {
        const found = normalized.indexOf(cue, start);
        if (found < 0) break;
        if (hasSearchBoundaries(normalized, found, cue.length)) {
          index = found;
          break;
        }
        start = found + cue.length;
      }
      if (index < 0) continue;
      let end = Math.min(normalized.length, index + 520);
      const nextStage = normalized.indexOf(stageCue, index + cue.length + 20);
      if (nextStage > 0) end = Math.min(end, nextStage);
      return normalized.slice(index, end);
    }
  }

  if (!normalized.includes(stageCue)) return null;
  for (const variant of romanStageVariants(stage)) {
    let start = 0;
    while (start < normalized.length) {
      const index = normalized.indexOf(variant, start);
      if (index < 0) break;
      if (!hasSearchBoundaries(normalized, index, variant.length)) {
        start = index + variant.length;
        continue;
      }
      const before = normalized.slice(Math.max(0, index - 220), index);
      if (!before.includes(stageCue)) {
        start = index + variant.length;
        continue;
      }
      const next = nextRomanStageRowIndex(normalized, index + variant.length + 1);
      const end = next > index ? Math.min(next, index + 420) : Math.min(normalized.length, index + 420);
      return normalized.slice(index, end);
    }
  }

  return null;
}

/**
 * Сопоставляет арабскую или римскую стадию ответа со строкой шкалы в PDF.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestRomanStageSupport(
  {mode, pages, question, answer, answerTokens}: AnswerScoringContext,
): EvidenceItem | null {
  if (mode !== "single") return null;
  const stage = questionRomanStage(question);
  if (!stage) return null;
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 16);
  let best = null;

  for (const page of pages) {
    for (const source of cachedLineWindowSegments(page)) {
      const window = romanStageWindow(source.normalized, stage);
      if (!window) continue;
      const tokens = tokenizeNormalized(window);
      const answerCoverage = strictSoftCoverage(answerTokens, tokens);
      const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(window, phrase));
      if (!phraseHit && answerCoverage < 0.58) continue;
      const score = 12.8 + (phraseHit ? 2.4 : 0) + answerCoverage * 4.0 + numberCoverage(answer.text, window) * 0.8;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text: source.text,
        score,
        kind: "roman_stage_segment",
      });
    }
  }

  return best;
}

/**
 * Извлекает или проверяет варианта ответа порядкового значения метки в варианте ответа.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function answerOrdinalLabel(answerText: string): AnswerOrdinalLabel | null {
  const normalized = normalizeForSearch(answerText);
  const tokens = normalized.split(/\s+/u).filter(Boolean);
  const kinds: Array<{kind: AnswerOrdinalKind; cue: string}> = [
    { kind: "stage", cue: normalizeForSearch("\u0441\u0442\u0430\u0434\u0438") },
    { kind: "degree", cue: normalizeForSearch("\u0441\u0442\u0435\u043f\u0435\u043d") },
    { kind: "type", cue: normalizeForSearch("\u0442\u0438\u043f") },
  ];
  const kind = kinds.find((item) => tokens.some((token) => token.startsWith(item.cue)));
  if (!kind) return null;

  const values = new Set<number>();
  for (const match of normalized.matchAll(/(?:^|\s)(\d{1,2}|[ivx]{1,7})(?:\s|$)/giu)) {
    const number = ordinalValueToNumber(match[1]);
    if (number && number > 0 && number <= 10) values.add(number);
  }
  if (values.size !== 1) return null;
  return { kind: kind.kind, cue: kind.cue, number: [...values][0] };
}

/**
 * Выполняет внутренний этап `ordinalKindCue`, подготавливающий порядкового значения типа маркера для основного scorer-а.
 *
 * @param kind Значение `kind`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function ordinalKindCue(kind: AnswerOrdinalKind): string {
  if (kind === "stage") return normalizeForSearch("\u0441\u0442\u0430\u0434\u0438");
  if (kind === "degree") return normalizeForSearch("\u0441\u0442\u0435\u043f\u0435\u043d");
  if (kind === "type") return normalizeForSearch("\u0442\u0438\u043f");
  return normalizeForSearch("\u043a\u043b\u0430\u0441\u0441");
}

/**
 * Проверяет наличие или совместимость порядкового значения типа маркера.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @param kind Значение `kind`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function hasOrdinalKindCue(normalized: string, kind: AnswerOrdinalKind): boolean {
  const cue = ordinalKindCue(kind);
  return new RegExp(`(?:^|\\s)${escapeRegExp(cue)}\\S*(?:\\s|$)`, "iu").test(normalized);
}

/**
 * Находит позицию следующей границы варианта ответа порядкового значения в локальном тексте или структуре.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @param start Начальная позиция рассматриваемого диапазона.
 * @param label Разобранная метка строки, стадии или типа.
 * @returns Вычисленное числовое значение или специальное граничное значение при отсутствии совпадения.
 * @internal
 */
function nextAnswerOrdinalIndex(normalized: string, start: number, label: AnswerOrdinalLabel): number {
  const cue = ordinalKindCue(label.kind);
  let best = -1;
  for (let number = 1; number <= 10; number += 1) {
    if (number === label.number) continue;
    for (const variant of romanStageVariants(String(number))) {
      const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(variant)}(?:\\s|-|$)`, "iu");
      const match = normalized.slice(start).match(pattern);
      if (!match?.index && match?.index !== 0) continue;
      const index = start + match.index;
      if (isRomanOneConjunctionMatch(normalized, index, variant)) continue;
      const before = normalized.slice(Math.max(0, index - 180), index);
      const after = normalized.slice(index, Math.min(normalized.length, index + 90));
      if (!hasOrdinalKindCue(before, label.kind) && !hasOrdinalKindCue(after, label.kind)) continue;
      if (best < 0 || index < best) best = index;
    }
  }
  return best;
}

/**
 * Находит ближайшее значение для ближайшего токена перед целевым фрагментом.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @param index Позиция текущего элемента или совпадения.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function nearestTokenBefore(normalized: string, index: number): string {
  const tokens = normalized.slice(0, index).trim().match(/\S+/gu) ?? [];
  return tokens[tokens.length - 1] ?? "";
}

/**
 * Находит ближайшее значение для ближайшего токена `after`.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @param index Позиция текущего элемента или совпадения.
 * @param length Длина проверяемого диапазона или токена.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function nearestTokenAfter(normalized: string, index: number, length: number): string {
  const tokens = normalized.slice(index + length).trim().match(/\S+/gu) ?? [];
  return tokens[0] ?? "";
}

/**
 * Проверяет совпадение римского значения `one` `conjunction`.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @param index Позиция текущего элемента или совпадения.
 * @param variant Значение `variant`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function isRomanOneConjunctionMatch(normalized: string, index: number, variant: string): boolean {
  if (variant !== "i") return false;
  const before = ordinalValueToNumber(nearestTokenBefore(normalized, index));
  const after = ordinalValueToNumber(nearestTokenAfter(normalized, index, variant.length));
  return Boolean(before && after);
}

/**
 * Строит ограниченные локальные окна для варианта ответа порядкового значения строки.
 *
 * @param source Ограниченный исходный фрагмент PDF.
 * @param label Разобранная метка строки, стадии или типа.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function answerOrdinalRowWindows(source: OrdinalWindowSource, label: AnswerOrdinalLabel): string[] {
  const normalized = source.normalized;
  const cue = ordinalKindCue(label.kind);
  const windows = [];
  for (const variant of romanStageVariants(String(label.number))) {
    if (hasOrdinalKindCue(normalized, label.kind)) {
      const directPatterns = [
        new RegExp(`(?:^|\\s)${escapeRegExp(variant)}(?:\\s|$)(?:-?\\s*\\S{0,3}\\s+)?${escapeRegExp(cue)}`, "giu"),
        new RegExp(`${escapeRegExp(cue)}\\s+(?:\\S+\\s+){0,2}${escapeRegExp(variant)}(?:\\s|$)`, "giu"),
      ];
      for (const pattern of directPatterns) {
        for (const match of normalized.matchAll(pattern)) {
          const index = match.index ?? 0;
          if (isRomanOneConjunctionMatch(normalized, index, variant)) continue;
          const afterStart = index + match[0].length;
          const next = nextAnswerOrdinalIndex(normalized, afterStart + 8, label);
          const end = next > 0 ? next : Math.min(normalized.length, afterStart + 520);
          windows.push(normalized.slice(index, end));
        }
      }

      let start = 0;
      while (start < normalized.length) {
        const index = normalized.indexOf(variant, start);
        if (index < 0) break;
        if (!hasSearchBoundaries(normalized, index, variant.length)) {
          start = index + Math.max(1, variant.length);
          continue;
        }
        if (isRomanOneConjunctionMatch(normalized, index, variant)) {
          start = index + Math.max(1, variant.length);
          continue;
        }
        const before = normalized.slice(Math.max(0, index - 220), index);
        const after = normalized.slice(index, Math.min(normalized.length, index + 100));
        if (!hasOrdinalKindCue(before, label.kind) && !hasOrdinalKindCue(after, label.kind)) {
          start = index + Math.max(1, variant.length);
          continue;
        }
        const next = nextAnswerOrdinalIndex(normalized, index + variant.length + 8, label);
        const end = next > 0 ? next : Math.min(normalized.length, index + 520);
        windows.push(normalized.slice(index, end));
        start = index + Math.max(1, variant.length);
      }
    } else {
      const barePattern = new RegExp(`^\\s*${escapeRegExp(variant)}(?:\\s|$)`, "iu");
      const match = normalized.match(barePattern);
      if (match?.[0]) {
        windows.push(normalized.slice(0, Math.min(normalized.length, 520)));
      }
    }
  }
  return windows;
}

/**
 * Выполняет внутренний этап `ordinalRangeIncludesValue`, подготавливающий порядкового значения диапазона `includes` значения для основного scorer-а.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @param label Разобранная метка строки, стадии или типа.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function ordinalRangeIncludesValue(normalized: string, label: AnswerOrdinalLabel): boolean {
  if (!hasOrdinalKindCue(normalized, label.kind)) return false;
  const number = label.number;
  const digitPatterns = [
    /(?:^|\s)(\d{1,2})\s*-\s*(\d{1,2})(?:\s|$)/giu,
    /(?:^|\s)(\d{1,2})\s*\/\s*(\d{1,2})(?:\s|$)/giu,
  ];
  for (const pattern of digitPatterns) {
    for (const match of normalized.matchAll(pattern)) {
      const left = Number(match[1]);
      const right = Number(match[2]);
      if (number >= Math.min(left, right) && number <= Math.max(left, right)) return true;
    }
  }
  const romanPattern = /(?:^|\s)(i|ii|iii|iv|v|vi|vii|viii|ix|x)\s*-\s*(i|ii|iii|iv|v|vi|vii|viii|ix|x)(?:\s|$)/giu;
  for (const match of normalized.matchAll(romanPattern)) {
    const left = ordinalValueToNumber(match[1]);
    const right = ordinalValueToNumber(match[2]);
    if (left && right && number >= Math.min(left, right) && number <= Math.max(left, right)) return true;
  }
  return false;
}

const ANSWER_ORDINAL_GENERIC_FOCUS = new Set(
  [
    "\u0441\u043e\u0433\u043b\u0430\u0441\u043d\u043e",
    "\u043a\u043b\u0430\u0441\u0441\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u044f",
    "\u043a\u043b\u0430\u0441\u0441\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u0438",
    "\u0445\u0430\u0440\u0430\u043a\u0442\u0435\u0440\u043d\u043e",
    "\u0445\u0430\u0440\u0430\u043a\u0442\u0435\u0440\u043d\u044b",
    "\u0441\u0442\u0430\u0434\u0438\u044f",
    "\u0441\u0442\u0430\u0434\u0438\u0438",
    "\u0441\u0442\u0435\u043f\u0435\u043d\u044c",
    "\u0441\u0442\u0435\u043f\u0435\u043d\u0438",
    "\u0442\u0438\u043f",
    "\u0442\u0438\u043f\u0430",
    "\u043a\u043b\u0430\u0441\u0441",
    "\u043a\u043b\u0430\u0441\u0441\u0430",
  ].flatMap((item) => uniqueTokens(item)),
);

/**
 * Выделяет специфичные токены для специфичных варианта ответа порядкового значения фокуса вопроса.
 *
 * @param focusTokens Специфичные токены вопроса без общих служебных слов.
 * @param answerTokens Нормализованные токены проверяемого варианта.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function specificAnswerOrdinalFocusTokens(focusTokens: string[], answerTokens: string[]): string[] {
  const answerSet = new Set(answerTokens ?? []);
  return (focusTokens ?? []).filter(
    (token) => token.length >= 4 && !/^\d/.test(token) && !answerSet.has(token) && !ANSWER_ORDINAL_GENERIC_FOCUS.has(token),
  );
}

/**
 * Определяет локальные совпадения для `ordered` фокуса вопроса пары условий.
 *
 * @param focusTokens Специфичные токены вопроса без общих служебных слов.
 * @param documentTokens Токены анализируемого документа или сегмента.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function orderedFocusPairHits(focusTokens: string[], documentTokens: string[]): number {
  if ((focusTokens?.length ?? 0) < 2 || !documentTokens?.length) return 0;
  const seen = new Set<string>();
  let hits = 0;
  for (let index = 0; index < focusTokens.length - 1; index += 1) {
    const left = focusTokens[index];
    const right = focusTokens[index + 1];
    if (!left || !right || left === right) continue;
    const key = `${left}\u0000${right}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (tokenSequenceIncludes(documentTokens, [left, right])) hits += 1;
  }
  return hits;
}

/**
 * Возвращает поддержку прямой порядковой метки ответа из строки классификации.
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
export function bestAnswerOrdinalRowSupport(
  {mode, pages, topQuestionPages, question, answer, answerTokens, focusTokens}: AnswerScoringContext,
): EvidenceItem | null {
  const label = answerOrdinalLabel(answer.text);
  if (!label) return null;
  if (!answerOrdinalRowApplicable({ question, answerText: answer.text, label })) return null;
  const specificTokens = specificAnswerOrdinalFocusTokens(focusTokens, answerTokens);
  if (specificTokens.length < 2) return null;
  let best = null;

  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    const sources = [...cachedLineWindowSegments(page), { normalized: page.normalized, text: page.text }];
    for (const source of sources) {
      const windows = answerOrdinalRowWindows(source, label);
      if (mode === "multi" && ordinalRangeIncludesValue(source.normalized, label)) {
        windows.push(source.normalized);
      }
      for (const window of windows) {
        const tokens = tokenizeNormalized(window);
        const focusHits = tokenHitCount(specificTokens, tokens);
        if (focusHits < 2) continue;
        const focusCoverage = coverage(specificTokens, tokens);
        const pairHits = orderedFocusPairHits(specificTokens, tokens);
        const answerCoverage = strictSoftCoverage(answerTokens, tokens);
        const score =
          13.4 +
          Math.min(5, focusHits) * 1.45 +
          Math.min(0.7, focusCoverage) * 5.4 +
          Math.min(4, pairHits) * 1.8 +
          answerCoverage * 2.2 +
          (ordinalRangeIncludesValue(window, label) ? 1.0 : 0);
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: source.text,
          score,
          kind: "answer_ordinal_row",
        });
      }
    }
  }

  return best;
}
