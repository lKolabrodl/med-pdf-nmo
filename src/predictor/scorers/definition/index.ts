import { normalizeForSearch, tokenize, uniqueTokens } from "../../../normalize.js";
import { FOCUS_STOPWORDS } from "../../constants.js";
import {
  answerSearchPhrases,
  betterEvidence,
  cachedLineWindowSegments,
  containsNormalizedPhrase,
  evidenceSnippet,
  findPhraseOccurrences,
  numberCoverage,
  pageWindow,
  rawTokens,
  strictSoftCoverage,
  tokenHitCount,
  tokenizeNormalized,
} from "../../text-utils.js";
import type {PdfPage} from "../../../pdf.js";
import type {AnswerScoringContext, QuestionIntent} from "../../contracts.js";
import type {AnswerOption, EvidenceItem} from "../../types.js";

type EvidenceAdjustment = {
  adjustment: number;
  evidence: EvidenceItem | null;
};

type SupportAdjustment = EvidenceAdjustment & {
  support: EvidenceItem | null;
};

type LineWindowSegment = {
  text: string;
  normalized: string;
  tokens: string[];
};

type FrequencyPolarity = "low" | "high";
type RecommendationPolarity = "positive" | "negative";

type FrequencyListItem = {
  text: string;
  page: number;
};

type FrequencyListSupportContext = {
  pages: PdfPage[];
  pageIndex: number;
  lineIndex: number;
  answer: AnswerOption;
  answerPhrases: string[];
  answerTokens: string[];
  specificTokens: string[];
  target: FrequencyPolarity;
};

type LabelDefinitionWindow = {
  answerWindow: string;
  contextWindow: string;
};

type RecommendationAnswerHit = {
  phraseHit: boolean;
  answerCoverage: number;
  hit: boolean;
};

/**
 * Извлекает из вопроса термин, для которого требуется определение.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function questionDefinitionTerm(question: string): string | null {
  const tokens = rawTokens(question);
  const podIndex = tokens.findIndex((token) => token === "\u043f\u043e\u0434");
  const ponimIndex = tokens.findIndex((token) => token.startsWith("\u043f\u043e\u043d\u0438\u043c"));
  if (podIndex >= 0 && ponimIndex > podIndex + 1) {
    return tokens.slice(podIndex + 1, ponimIndex).join(" ");
  }
  const calledIndex = tokens.findIndex((token) => token.startsWith("\u043d\u0430\u0437\u044b\u0432"));
  if (calledIndex > 0) return tokens.slice(0, calledIndex).join(" ");
  return null;
}

/**
 * Находит позицию определения термина в локальном тексте или структуре.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @param term Значение `term`, необходимое этому этапу scorer-а.
 * @returns Вычисленное числовое значение или специальное граничное значение при отсутствии совпадения.
 * @internal
 */
function definitionTermIndex(normalized: string, term: string): number {
  const labelNorm = normalizeForSearch(term);
  const exact = normalized.indexOf(labelNorm);
  if (exact >= 0) return exact;
  const prefixes = uniqueTokens(term)
    .filter((token) => token.length >= 5)
    .map((token) => token.slice(0, Math.min(6, token.length)));
  return prefixes.length ? normalized.indexOf(prefixes[0]) : -1;
}

/**
 * Строит ограниченное локальное окно для определения термина.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @param term Значение `term`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function definitionTermWindow(normalized: string, term: string): string | null {
  const exact = normalizeForSearch(term);
  const prefixes = [
    exact,
    ...uniqueTokens(term)
      .filter((token) => token.length >= 5)
      .map((token) => token.slice(0, Math.min(6, token.length))),
  ].filter(Boolean);
  for (const prefix of prefixes.length ? prefixes : [normalizeForSearch(term)]) {
    let start = 0;
    while (start < normalized.length) {
      const labelIndex = normalized.indexOf(prefix, start);
      if (labelIndex < 0) break;
      const around = normalized.slice(labelIndex, Math.min(normalized.length, labelIndex + 56));
      if (
        containsNormalizedPhrase(around, "\u044d\u0442\u043e") ||
        containsNormalizedPhrase(around, "\u043f\u043e\u043d\u0438\u043c") ||
        around.includes("-")
      ) {
        let end = Math.min(normalized.length, labelIndex + 300);
        const nextDefinition = normalized.indexOf(normalizeForSearch("\u044d\u0442\u043e"), labelIndex + 64);
        if (nextDefinition > labelIndex) end = Math.min(end, Math.max(labelIndex + 80, nextDefinition - 24));
        return normalized.slice(labelIndex, end);
      }
      start = labelIndex + Math.max(1, prefix.length);
    }
  }
  const fallback = definitionTermIndex(normalized, term);
  return fallback >= 0 ? normalized.slice(fallback, Math.min(normalized.length, fallback + 260)) : null;
}

/**
 * Извлекает или проверяет варианта ответа сокращений в варианте ответа.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function answerAbbreviations(answerText: string): string[] {
  return (String(answerText ?? "").match(/[A-ZА-ЯЁ]{2,}(?:-[A-ZА-ЯЁ]{2,})?/gu) ?? [])
    .map((item) => normalizeForSearch(item))
    .filter((item) => item.length >= 2);
}

/**
 * Ищет ответ в локальной связке между термином вопроса и его определением.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestTermDefinitionSupport(
  {pages, question, answer, answerTokens}: AnswerScoringContext,
): EvidenceItem | null {
  const term = questionDefinitionTerm(question);
  if (!term) return null;
  if (normalizeForSearch(term).length < 4) return null;
  const abbreviations = answerAbbreviations(answer.text);
  let best = null;

  for (const page of pages) {
    const sources = [...cachedLineWindowSegments(page), { normalized: page.normalized, text: page.text }];
    for (const source of sources) {
      const window = definitionTermWindow(source.normalized, term);
      if (!window) continue;
      if (abbreviations.length && !abbreviations.some((abbr) => window.includes(abbr))) continue;
      const tokens = tokenizeNormalized(window);
      const answerCoverage = strictSoftCoverage(answerTokens, tokens);
      if (answerCoverage < 0.52) continue;
      const score = 14.2 + answerCoverage * 6.2 + numberCoverage(answer.text, window) * 0.8;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text: source.text,
        score,
        kind: "term_definition_segment",
      });
    }
  }

  return best;
}

/**
 * Выполняет внутренний этап `definitionQuestionLike`, подготавливающий определения вопроса `like` для основного scorer-а.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function definitionQuestionLike(question: string): boolean {
  const normalized = normalizeForSearch(question);
  return (
    Boolean(questionDefinitionTerm(question)) ||
    containsNormalizedPhrase(normalized, "\u044d\u0442\u043e") ||
    containsNormalizedPhrase(normalized, "\u043f\u043e\u043d\u0438\u043c\u0430") ||
    containsNormalizedPhrase(normalized, "\u043d\u0430\u0437\u044b\u0432\u0430")
  );
}

/**
 * Строит ограниченное локальное окно для определения маркера.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function definitionCueWindow(normalized: string): boolean {
  return (
    containsNormalizedPhrase(normalized, "\u044d\u0442\u043e") ||
    containsNormalizedPhrase(normalized, "\u043f\u043e\u043d\u0438\u043c\u0430") ||
    containsNormalizedPhrase(normalized, "\u043d\u0430\u0437\u044b\u0432\u0430") ||
    /(?:^|\s)[a-z\u0430-\u044f]{4,}\s+[-\u2013\u2014]\s+/iu.test(normalized)
  );
}

/**
 * Выполняет внутренний этап `definitionExactFragments`, подготавливающий определения точного совпадения фрагментов для основного scorer-а.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function definitionExactFragments(text: string): string[] {
  const fragments = String(text ?? "")
    .split(/(?<=[.!?;])\s+/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 20);
  return fragments.length ? fragments : [String(text ?? "")];
}

const DEFINITION_TERM_GENERIC_TOKENS = new Set(
  [
    "\u043f\u043e\u0434",
    "\u043f\u043e\u043d\u0438\u043c\u0430\u044e\u0442",
    "\u043f\u043e\u043d\u0438\u043c\u0430\u0435\u0442\u0441\u044f",
    "\u044d\u0442\u043e",
    "\u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044f",
    "\u043f\u0440\u0438\u0437\u043d\u0430\u043a",
  ].flatMap((item) => uniqueTokens(item)),
);

/**
 * Выполняет внутренний этап `primaryDefinitionTermToken`, подготавливающий основного определения термина токена для основного scorer-а.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function primaryDefinitionTermToken(question: string): string {
  const term = questionDefinitionTerm(question);
  const tokens = uniqueTokens(term ?? question).filter((token) => token.length >= 4 && !DEFINITION_TERM_GENERIC_TOKENS.has(token));
  return tokens[0] ?? "";
}

/**
 * Выполняет внутренний этап `editDistanceAtMostOne`, подготавливающий `edit` `distance` `at` `most` `one` для основного scorer-а.
 *
 * @param left Левое сравниваемое значение.
 * @param right Правое сравниваемое значение.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function editDistanceAtMostOne(left: string, right: string): boolean {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1) return false;
  let edits = 0;
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) i += 1;
    else if (right.length > left.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (left.length - i) + (right.length - j) <= 1;
}

/**
 * Выполняет внутренний этап `definitionFragmentMatchesQuestionTerm`, подготавливающий определения `fragment` вопроса термина для основного scorer-а.
 *
 * @param fragmentTokens Нормализованные токены соответствующего текста.
 * @param primaryTerm Значение `primaryTerm`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function definitionFragmentMatchesQuestionTerm(fragmentTokens: string[], primaryTerm: string): boolean {
  if (!primaryTerm) return true;
  const cueIndex = fragmentTokens.findIndex((token) => token === normalizeForSearch("\u044d\u0442\u043e"));
  const labelTokens = fragmentTokens.slice(0, cueIndex >= 0 ? cueIndex : Math.min(3, fragmentTokens.length));
  return labelTokens.some((token) => token.length >= 4 && editDistanceAtMostOne(token, primaryTerm));
}

/**
 * Поддерживает definition-вопросы, когда полный вариант ответа найден рядом с
 * `это`/`понимают`/тире-определением. Это помогает пережить OCR-ошибку в самом
 * термине, но не читает медицинский факт из датасета.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestDefinitionExactAnswerSupport(
  {mode, pages, topQuestionPages, question, answer, answerTokens}: AnswerScoringContext,
): EvidenceItem | null {
  if (mode !== "single" || !definitionQuestionLike(question)) return null;
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 12);
  const primaryTerm = primaryDefinitionTermToken(question);
  let best = null;

  for (const page of pages) {
    if (
      topQuestionPages?.size &&
      !topQuestionPages.has(page.page) &&
      !topQuestionPages.has(page.page - 1) &&
      !topQuestionPages.has(page.page + 1)
    ) {
      continue;
    }
    for (const source of cachedLineWindowSegments(page)) {
      for (const fragment of definitionExactFragments(source.text)) {
        const normalized = normalizeForSearch(fragment);
        if (!definitionCueWindow(normalized)) continue;
        const fragmentTokens = tokenizeNormalized(normalized);
        if (!definitionFragmentMatchesQuestionTerm(fragmentTokens, primaryTerm)) continue;
        const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(normalized, phrase));
        const answerCoverage = strictSoftCoverage(answerTokens, fragmentTokens);
        if (!phraseHit || answerCoverage < 0.72) continue;
        const score = 15.2 + answerCoverage * 6.0 + numberCoverage(answer.text, normalized) * 0.8;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: fragment,
          score,
          kind: "definition_exact_answer_segment",
        });
      }
    }
  }

  return best;
}

const DEFINITION_COMPLETION_EVIDENCE = new Set(["definition_exact_answer_segment", "term_definition_segment", "label_definition_segment"]);

/**
 * Уточняет score варианта, завершающего определение с нужной специфичностью.
 *
 * @param params1 Контекстные параметры текущего scorer-этапа.
 * @param params1.mode Режим выбора ответа: `single` или `multi`.
 * @param params1.question Исходный текст вопроса.
 * @param params1.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param params1.answers Полный набор вариантов, необходимый для контрастного сравнения.
 * @param params1.answerTokens Нормализованные токены проверяемого варианта.
 * @param evidence Evidence, уже найденные для варианта ответа.
 * @returns Поправка score и, при наличии, объясняющее evidence.
 */
export function definitionCompletionAdjustment(
  {mode, question, answer, answers, answerTokens}: AnswerScoringContext,
  evidence: EvidenceItem[],
): EvidenceAdjustment {
  if (mode !== "single" || !definitionQuestionLike(question)) return { adjustment: 0, evidence: null };
  const definitionEvidence = evidence.find((item) => DEFINITION_COMPLETION_EVIDENCE.has(item.kind) && (item.score ?? 0) >= 18);
  if (!definitionEvidence) return { adjustment: 0, evidence: null };
  const answerNorm = normalizeForSearch(answer.text);
  if (answerTokens.length < 5 || answerNorm.length < 32) return { adjustment: 0, evidence: null };

  let contained = 0;
  for (const candidate of answers) {
    if (candidate.id === answer.id) continue;
    const candidateNorm = normalizeForSearch(candidate.text);
    if (candidateNorm.length < 18 || candidateNorm === answerNorm) continue;
    const candidateTokens = uniqueTokens(candidate.text);
    if (candidateTokens.length < 3 || candidateTokens.length >= answerTokens.length) continue;
    if (answerNorm.includes(candidateNorm)) contained += 1;
  }
  if (!contained) return { adjustment: 0, evidence: null };

  const adjustment = Math.min(5.0, contained * 2.4);
  return {
    adjustment,
    evidence: {
      answerId: answer.id,
      page: definitionEvidence.page,
      text: definitionEvidence.text,
      score: Math.max(8.5, Math.min(14.5, definitionEvidence.score)),
      kind: "definition_completion_specificity",
    },
  };
}

const FREQUENCY_POLARITY_HIGH_CUES = [
  "\u043d\u0430\u0438\u0431\u043e\u043b\u0435\u0435 \u0447\u0430\u0441\u0442",
  "\u0441\u0430\u043c\u043e\u0439 \u0447\u0430\u0441\u0442",
  "\u0441\u0430\u043c\u044b\u043c \u0447\u0430\u0441\u0442",
  "\u0447\u0430\u0441\u0442\u043e \u0432\u0441\u0442\u0440\u0435\u0447",
  "\u0447\u0430\u0449\u0435",
  "\u0432\u0435\u0434\u0443\u0449",
];

const FREQUENCY_POLARITY_LOW_CUES = [
  "\u0440\u0435\u0434\u043a",
  "\u0440\u0435\u0436\u0435",
];

const FREQUENCY_POLARITY_GENERIC_FOCUS = new Set(
  [
    "\u043d\u0430\u0438\u0431\u043e\u043b\u0435\u0435",
    "\u0447\u0430\u0441\u0442\u044b\u0439",
    "\u0447\u0430\u0441\u0442\u0430\u044f",
    "\u0447\u0430\u0441\u0442\u043e\u0439",
    "\u0447\u0430\u0441\u0442\u043e\u0435",
    "\u0440\u0435\u0434\u043a\u0438\u0439",
    "\u0440\u0435\u0434\u043a\u0430\u044f",
    "\u0440\u0435\u0434\u043a\u043e\u0439",
    "\u0444\u043e\u0440\u043c\u0430",
    "\u0444\u043e\u0440\u043c\u043e\u0439",
    "\u0432\u0430\u0440\u0438\u0430\u043d\u0442",
    "\u0432\u0430\u0440\u0438\u0430\u043d\u0442\u043e\u043c",
    "\u0440\u043e\u043b\u044c",
    "\u043e\u0442\u0432\u043e\u0434\u0438\u0442\u0441\u044f",
    "\u0432\u0441\u0442\u0440\u0435\u0447\u0430\u0435\u0442\u0441\u044f",
  ].flatMap((item) => uniqueTokens(item)),
);

/**
 * Определяет, спрашивает ли фрагмент о частом/редком/ведущем варианте.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 */
export function frequencyPolarity(normalized: string): FrequencyPolarity | null {
  if (FREQUENCY_POLARITY_LOW_CUES.some((cue) => containsNormalizedPhrase(normalized, cue))) return "low";
  if (FREQUENCY_POLARITY_HIGH_CUES.some((cue) => containsNormalizedPhrase(normalized, cue))) return "high";
  return null;
}

/**
 * Выделяет специфичные токены для частоты полярности фокуса вопроса.
 *
 * @param focusTokens Специфичные токены вопроса без общих служебных слов.
 * @param answerTokens Нормализованные токены проверяемого варианта.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function frequencyPolarityFocusTokens(focusTokens: string[], answerTokens: string[]): string[] {
  const answerSet = new Set(answerTokens ?? []);
  return (focusTokens ?? []).filter((token) => token.length >= 4 && !answerSet.has(token) && !FREQUENCY_POLARITY_GENERIC_FOCUS.has(token));
}

/**
 * Проверяет точное фразовое совпадение вне скобочных примеров.
 *
 * Для частотных вопросов это важно: `(менингит + менингококкемия)` рядом с
 * "наиболее часто" обычно поясняет форму, но не обязательно является ответом.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @param phrases Значение `phrases`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function containsPhraseOutsideParentheses(text: string, phrases: string[]): boolean {
  const normalized = normalizeForSearch(String(text ?? "").replace(/\([^)]*\)/gu, " "));
  for (const phrase of phrases) {
    const normalizedPhrase = normalizeForSearch(phrase);
    if (!normalizedPhrase) continue;
    if (normalized.includes(normalizedPhrase)) return true;
  }
  return false;
}

/**
 * Делит line-window на небольшие предложение-подобные фрагменты для локального связывания cue и ответа.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function frequencyPolarityFragments(text: string): string[] {
  const fragments = String(text ?? "")
    .split(/(?<=[.!?;])\s+/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 20);
  return fragments.length ? fragments : [String(text ?? "")];
}

/**
 * Выполняет внутренний этап `frequencyListItemLine`, подготавливающий частоты списка пункта рекомендации строки для основного scorer-а.
 *
 * @param line Значение `line`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function frequencyListItemLine(line: string): boolean {
  return /^\s*(?:[•*\-]|\d+[.)]|[IVX]+[.)])\s+/iu.test(String(line ?? ""));
}

/**
 * Выполняет внутренний этап `frequencyPolarityListItems`, подготавливающий частоты полярности списка элементов для основного scorer-а.
 *
 * @param pages Извлечённые страницы PDF, доступные scorer-у.
 * @param pageIndex Позиция соответствующего элемента в локальной структуре.
 * @param lineIndex Позиция соответствующего элемента в локальной структуре.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function frequencyPolarityListItems(pages: PdfPage[], pageIndex: number, lineIndex: number): FrequencyListItem[] {
  const items: FrequencyListItem[] = [];
  for (let offset = 0; offset <= 1; offset += 1) {
    const page = pages[pageIndex + offset];
    if (!page) continue;
    const start = offset === 0 ? lineIndex + 1 : 0;
    for (let index = start; index < (page.lines?.length ?? 0); index += 1) {
      const line = page.lines[index];
      if (!frequencyListItemLine(line)) {
        if (items.length) return items;
        continue;
      }
      items.push({ text: line, page: page.page });
      if (items.length >= 10) return items;
    }
  }
  return items;
}

/**
 * Выполняет внутренний этап `betterFrequencyListSupport`, подготавливающий `better` частоты списка поддержки ответа для основного scorer-а.
 *
 * @param best Значение `best`, необходимое этому этапу scorer-а.
 * @param params2 Контекстные параметры текущего scorer-этапа.
 * @param params2.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param params2.pageIndex Позиция соответствующего элемента в локальной структуре.
 * @param params2.lineIndex Позиция соответствующего элемента в локальной структуре.
 * @param params2.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param params2.answerPhrases Коллекция значений, используемая текущим этапом сопоставления.
 * @param params2.answerTokens Нормализованные токены проверяемого варианта.
 * @param params2.specificTokens Нормализованные токены соответствующего текста.
 * @param params2.target Значение `target`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function betterFrequencyListSupport(
  best: EvidenceItem | null,
  {pages, pageIndex, lineIndex, answer, answerPhrases, answerTokens, specificTokens, target}: FrequencyListSupportContext,
): EvidenceItem | null {
  const page = pages[pageIndex];
  const heading = page.lines?.[lineIndex] ?? "";
  const headingNorm = normalizeForSearch(heading);
  if (frequencyPolarity(headingNorm) !== target) return best;
  const headingTokens = tokenizeNormalized(headingNorm);
  const headingFocusHits = tokenHitCount(specificTokens, headingTokens);
  if (specificTokens.length >= 2 && headingFocusHits <= 0) return best;

  for (const item of frequencyPolarityListItems(pages, pageIndex, lineIndex)) {
    if (!containsPhraseOutsideParentheses(item.text, answerPhrases)) continue;
    const itemTokens = tokenize(item.text);
    const answerCoverage = strictSoftCoverage(answerTokens, itemTokens);
    const score = 15.8 + answerCoverage * 4.4 + Math.min(2, headingFocusHits) * 1.2;
    best = betterEvidence(best, {
      answerId: answer.id,
      page: item.page,
      text: `${heading} ${item.text}`,
      score,
      kind: "frequency_polarity_list_item",
    });
  }

  return best;
}

/**
 * Ищет evidence для вопросов вида "наиболее частый/редкий/ведущий".
 *
 * Слой не знает медицинских фактов: он связывает вариант ответа с тем же
 * предложением, где находится частотный маркер, и отбрасывает скобочные примеры.
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
export function bestFrequencyPolaritySupport(
  {mode, pages, topQuestionPages, question, answer, answerTokens, focusTokens}: AnswerScoringContext,
): EvidenceItem | null {
  if (mode !== "single") return null;
  const target = frequencyPolarity(normalizeForSearch(question));
  if (!target) return null;
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 16);
  const specificTokens = frequencyPolarityFocusTokens(focusTokens, answerTokens);
  let best = null;

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    if (
      topQuestionPages?.size &&
      !topQuestionPages.has(page.page) &&
      !topQuestionPages.has(page.page - 1) &&
      !topQuestionPages.has(page.page + 1)
    ) {
      continue;
    }
    for (let lineIndex = 0; lineIndex < (page.lines?.length ?? 0); lineIndex += 1) {
      best = betterFrequencyListSupport(best, { pages, pageIndex, lineIndex, answer, answerPhrases, answerTokens, specificTokens, target });
    }
    for (const segment of cachedLineWindowSegments(page)) {
      for (const fragment of frequencyPolarityFragments(segment.text)) {
        const normalized = normalizeForSearch(fragment);
        if (frequencyPolarity(normalized) !== target) continue;
        const phraseHit = containsPhraseOutsideParentheses(fragment, answerPhrases);
        if (!phraseHit) continue;
        const fragmentTokens = tokenizeNormalized(normalized);
        const answerCoverage = strictSoftCoverage(answerTokens, fragmentTokens);
        const focusHits = tokenHitCount(specificTokens, fragmentTokens);
        if (specificTokens.length >= 2 && focusHits <= 0) continue;
        const score = 12.2 + (phraseHit ? 2.8 : 0) + answerCoverage * 4.2 + Math.min(2, focusHits) * 1.1;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: fragment,
          score,
          kind: "frequency_polarity_segment",
        });
      }
    }
  }

  return best;
}

/**
 * Штрафует отрицательный префикс ответа, не подтверждённый локальным источником.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @returns Поправка score и, при наличии, объясняющее evidence.
 */
export function negatedAnswerPrefixAdjustment(
  {mode, pages, question, answer, answerTokens}: AnswerScoringContext,
): EvidenceAdjustment {
  if (mode !== "single" || answerTokens.length < 2) return { adjustment: 0, evidence: null };
  const questionNorm = normalizeForSearch(question);
  if (!containsNormalizedPhrase(questionNorm, "\u043e\u0431\u0440\u0430\u0437\u043e\u0432") && !containsNormalizedPhrase(questionNorm, "\u0445\u0430\u0440\u0430\u043a\u0442\u0435\u0440")) {
    return { adjustment: 0, evidence: null };
  }
  const first = answerTokens[0];
  if (first.startsWith("he") || first.startsWith("\u043d\u0435")) return { adjustment: 0, evidence: null };
  const negatedPrefix = `he${first.slice(0, Math.min(first.length, 4))}`;
  for (const page of pages) {
    if (page.normalized.includes(negatedPrefix) && answerTokens.slice(1).some((token) => page.normalized.includes(token.slice(0, Math.min(token.length, 8))))) {
      return {
        adjustment: -3.8,
        evidence: {
          answerId: answer.id,
          page: page.page,
          text: evidenceSnippet(page.text, first, question),
          score: 3.8,
          kind: "negated_answer_prefix_mismatch",
        },
      };
    }
  }
  return { adjustment: 0, evidence: null };
}

/**
 * Ограничивает абсолютную формулировку невозможности без явной поддержки PDF.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @returns Поправка score и, при наличии, объясняющее evidence.
 */
export function impossibilityOnlyAdjustment(
  {mode, pages, question, answer}: AnswerScoringContext,
): EvidenceAdjustment {
  if (mode !== "single") return { adjustment: 0, evidence: null };
  const questionNorm = normalizeForSearch(question);
  if (
    !containsNormalizedPhrase(questionNorm, "\u0434\u0438\u043d\u0430\u043c\u0438\u0447") &&
    !containsNormalizedPhrase(questionNorm, "\u044d\u0444\u0444\u0435\u043a\u0442\u0438\u0432")
  ) {
    return { adjustment: 0, evidence: null };
  }
  const answerTokens = uniqueTokens(answer.text).filter((token) => token.length >= 5 && !FOCUS_STOPWORDS.has(token));
  const phrases = answerSearchPhrases(answer.text).slice(0, 12);
  for (const page of pages) {
    for (const phrase of phrases) {
      const hits = findPhraseOccurrences(page.normalized, phrase, { textIsNormalized: true });
      for (const hit of hits) {
        const local = pageWindow(page, hit, 230);
        if (
          containsNormalizedPhrase(local, "\u0442\u043e\u043b\u044c\u043a\u043e \u0432 \u0441\u043b\u0443\u0447\u0430\u044f\u0445 \u043d\u0435\u0432\u043e\u0437\u043c\u043e\u0436") ||
          containsNormalizedPhrase(local, "\u043d\u0435\u0432\u043e\u0437\u043c\u043e\u0436\u043d\u043e\u0441\u0442\u0438 \u043f\u0440\u043e\u0432\u0435\u0434\u0435\u043d")
        ) {
          return {
            adjustment: -3.6,
            evidence: {
              answerId: answer.id,
              page: page.page,
              text: evidenceSnippet(page.text, phrase, question),
              score: 3.6,
              kind: "impossibility_only_penalty",
            },
          };
        }
      }
    }
    if (answerTokens.length) {
      for (const source of cachedLineWindowSegments(page)) {
        const local = source.normalized;
        const tokens = tokenizeNormalized(local);
        const answerCoverage = strictSoftCoverage(answerTokens, tokens);
        if (answerCoverage < 0.45) continue;
        if (
          containsNormalizedPhrase(local, "\u0442\u043e\u043b\u044c\u043a\u043e \u0432 \u0441\u043b\u0443\u0447\u0430\u044f\u0445 \u043d\u0435\u0432\u043e\u0437\u043c\u043e\u0436") ||
          containsNormalizedPhrase(local, "\u043d\u0435\u0432\u043e\u0437\u043c\u043e\u0436\u043d\u043e\u0441\u0442\u0438 \u043f\u0440\u043e\u0432\u0435\u0434\u0435\u043d")
        ) {
          return {
            adjustment: -3.6,
            evidence: {
              answerId: answer.id,
              page: page.page,
              text: source.text,
              score: 3.6,
              kind: "impossibility_only_penalty",
            },
          };
        }
      }
    }
  }
  return { adjustment: 0, evidence: null };
}

/**
 * Штрафует подмену активного лечения формулировкой об отсутствии терапии.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @returns Поправка score и, при наличии, объясняющее evidence.
 */
export function activeTherapyIndicationAdjustment({question, answer}: AnswerScoringContext): EvidenceAdjustment {
  const questionNorm = normalizeForSearch(question);
  if (
    !containsNormalizedPhrase(questionNorm, "\u043d\u0430\u0447\u0430\u043b") ||
    !containsNormalizedPhrase(questionNorm, "\u0430\u043a\u0442\u0438\u0432") ||
    !containsNormalizedPhrase(questionNorm, "\u0442\u0435\u0440\u0430\u043f")
  ) {
    return { adjustment: 0, evidence: null };
  }
  const answerNorm = normalizeForSearch(answer.text);
  const supportive =
    containsNormalizedPhrase(answerNorm, "\u0443\u0433\u0440\u043e\u0437") ||
    containsNormalizedPhrase(answerNorm, "\u043d\u0435\u0434\u043e\u0441\u0442\u0430\u0442") ||
    containsNormalizedPhrase(answerNorm, "\u043f\u043e\u0442\u0435\u0440") ||
    containsNormalizedPhrase(answerNorm, "\u043a\u0430\u0447\u0435\u0441\u0442") ||
    containsNormalizedPhrase(answerNorm, "\u0436\u0438\u0437\u043d");
  if (supportive) return { adjustment: 0, evidence: null };
  return {
    adjustment: -4.2,
    evidence: {
      answerId: answer.id,
      page: 0,
      text: answer.text,
      score: 4.2,
      kind: "active_therapy_indication_mismatch",
    },
  };
}

/**
 * Извлекает короткую метку, определение которой запрашивается в вопросе.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 */
export function questionDefinitionLabel(question: string): string | null {
  const tokens = rawTokens(question);
  const index = tokens.findIndex((token) => token.startsWith("\u0441\u0447\u0438\u0442\u0430"));
  if (index < 0) return null;
  const label = [];
  for (let offset = index + 1; offset < Math.min(tokens.length, index + 5); offset += 1) {
    if (tokens[offset] === "\u043f\u0440\u0438") break;
    label.push(tokens[offset]);
  }
  return label.length ? label.join(" ") : null;
}

/**
 * Строит ограниченные локальные окна для метки определения.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @param labelNorm Значение `labelNorm`, необходимое этому этапу scorer-а.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function labelDefinitionWindows(normalized: string, labelNorm: string): LabelDefinitionWindow[] {
  const labelBoundaries = [
    "\u043e\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043b",
    "\u0441\u043e\u043c\u043d\u0438\u0442\u0435\u043b",
    "\u043f\u043e\u043b\u043e\u0436\u0438\u0442\u0435\u043b",
  ].map((item) => normalizeForSearch(item));
  const windows: LabelDefinitionWindow[] = [];
  let start = 0;
  while (start < normalized.length) {
    const labelIndex = normalized.indexOf(labelNorm, start);
    if (labelIndex < 0) break;
    const afterLabel = labelIndex + labelNorm.length;
    let end = Math.min(normalized.length, afterLabel + 220);
    for (const boundary of labelBoundaries) {
      if (labelNorm.includes(boundary)) continue;
      const index = normalized.indexOf(boundary, afterLabel + 18);
      if (index > 0) end = Math.min(end, index);
    }
    windows.push({
      answerWindow: normalized.slice(labelIndex, end),
      contextWindow: normalized.slice(Math.max(0, labelIndex - 240), Math.min(normalized.length, end + 80)),
    });
    start = afterLabel;
  }
  return windows;
}

const LABEL_DEFINITION_GENERIC_FOCUS = new Set(
  [
    "\u043f\u0440\u043e\u0431\u0430",
    "\u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044f",
    "\u043f\u0440\u0438",
    "\u043f\u043e\u043b\u043e\u0436\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0439",
    "\u0441\u043e\u043c\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0439",
    "\u043e\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043b\u044c\u043d\u043e\u0439",
  ].flatMap((item) => uniqueTokens(item)),
);

/**
 * Выделяет специфичные токены для метки определения фокуса вопроса.
 *
 * @param focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function labelDefinitionFocusTokens(focusTokens: string[]): string[] {
  return (focusTokens ?? []).filter((token) => token.length >= 3 && !LABEL_DEFINITION_GENERIC_FOCUS.has(token));
}

/**
 * Сопоставляет ответ с определением короткой метки вопроса.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @param context.focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestLabelDefinitionSupport(
  {mode, pages, question, answer, answerTokens, focusTokens}: AnswerScoringContext,
): EvidenceItem | null {
  if (mode !== "single") return null;
  const label = questionDefinitionLabel(question);
  if (!label) return null;
  const labelNorm = normalizeForSearch(label);
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 16);
  const specificTokens = labelDefinitionFocusTokens(focusTokens);
  let best = null;

  for (const page of pages) {
    for (const source of cachedLineWindowSegments(page)) {
      if (!containsNormalizedPhrase(source.normalized, label)) continue;
      for (const { answerWindow, contextWindow } of labelDefinitionWindows(source.normalized, labelNorm)) {
        if (specificTokens.length && tokenHitCount(specificTokens, tokenizeNormalized(contextWindow)) <= 0) continue;
        const tokens = tokenizeNormalized(answerWindow);
        const answerCoverage = strictSoftCoverage(answerTokens, tokens);
        const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(answerWindow, phrase));
        if (!phraseHit && answerCoverage < 0.55) continue;
        const score = 13.0 + (phraseHit ? 2.8 : 0) + answerCoverage * 4.2 + numberCoverage(answer.text, answerWindow) * 1.2;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: source.text,
          score,
          kind: "label_definition_segment",
        });
      }
    }
  }

  return best;
}

const RECOMMENDATION_GENERIC_FOCUS = new Set(
  [
    "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u0442\u0441\u044f",
    "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u043e\u0432\u0430\u043d",
    "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u043e\u0432\u0430\u043d\u043d\u044b\u043c",
    "\u043b\u0435\u0447\u0435\u043d\u0438\u0435",
    "\u043b\u0435\u0447\u0435\u043d\u0438\u044e",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442\u0430\u043c",
    "\u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442",
    "\u043f\u0440\u043e\u0432\u043e\u0434\u0438\u0442\u044c",
    "\u043f\u0440\u043e\u0432\u0435\u0434\u0435\u043d\u0438\u0435",
  ].flatMap((item) => uniqueTokens(item)),
);

/**
 * Выделяет специфичные токены для специфичных рекомендации фокуса вопроса.
 *
 * @param focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function specificRecommendationFocusTokens(focusTokens: string[]): string[] {
  return (focusTokens ?? []).filter((token) => token.length >= 4 && !RECOMMENDATION_GENERIC_FOCUS.has(token));
}

/**
 * Выполняет внутренний этап `recommendationQuestion`, подготавливающий рекомендации вопроса для основного scorer-а.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function recommendationQuestion(question: string): boolean {
  return containsNormalizedPhrase(normalizeForSearch(question), "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434");
}

/**
 * Выполняет внутренний этап `segmentRecommendationPolarity`, подготавливающий сегмента рекомендации полярности для основного scorer-а.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function segmentRecommendationPolarity(normalized: string): RecommendationPolarity | null {
  if (
    containsNormalizedPhrase(normalized, "\u043d\u0435 \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434") ||
    containsNormalizedPhrase(normalized, "\u043d\u0435\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434")
  ) {
    return "negative";
  }
  if (containsNormalizedPhrase(normalized, "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434")) return "positive";
  return null;
}

/**
 * Выполняет внутренний этап `recommendationQuestionPolarity`, подготавливающий рекомендации вопроса полярности для основного scorer-а.
 *
 * @param question Исходный текст вопроса.
 * @param intent Определённый predictor-ом тип и полярность вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function recommendationQuestionPolarity(question: string, intent: QuestionIntent): RecommendationPolarity {
  const normalized = normalizeForSearch(question);
  if (intent.negative || containsNormalizedPhrase(normalized, "\u043d\u0435 \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434") || containsNormalizedPhrase(normalized, "\u043d\u0435\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434")) {
    return "negative";
  }
  return "positive";
}

/**
 * Определяет локальные совпадения для рекомендации варианта ответа.
 *
 * @param segment Значение `segment`, необходимое этому этапу scorer-а.
 * @param answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param answerTokens Нормализованные токены проверяемого варианта.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function recommendationAnswerHit(
  segment: LineWindowSegment,
  answer: AnswerOption,
  answerTokens: string[],
): RecommendationAnswerHit {
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 16);
  const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(segment.normalized, phrase));
  const answerCoverage = strictSoftCoverage(answerTokens, segment.tokens);
  return { phraseHit, answerCoverage, hit: phraseHit || answerCoverage >= 0.6 };
}

/**
 * Проверяет совпадение положительной или отрицательной полярности рекомендации.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @param context.focusTokens Специфичные токены вопроса без общих служебных слов.
 * @param context.intent Определённый predictor-ом тип и полярность вопроса.
 * @returns Поправка score и, при наличии, объясняющее evidence.
 */
export function recommendationPolarityAdjustment(
  {mode, pages, question, answer, answerTokens, focusTokens, intent}: AnswerScoringContext,
): SupportAdjustment {
  if (mode !== "single" || !recommendationQuestion(question)) return { support: null, adjustment: 0, evidence: null };
  const target = recommendationQuestionPolarity(question, intent);
  if (target !== "negative") return { support: null, adjustment: 0, evidence: null };
  const specificTokens = specificRecommendationFocusTokens(focusTokens);
  let bestMatch = null;
  let bestMismatch = null;

  for (const page of pages) {
    for (const segment of cachedLineWindowSegments(page)) {
      const polarity = segmentRecommendationPolarity(segment.normalized);
      if (!polarity) continue;
      const focusHits = tokenHitCount(specificTokens, segment.tokens);
      if (specificTokens.length >= 2 && focusHits <= 0) continue;
      const answerHit = recommendationAnswerHit(segment, answer, answerTokens);
      if (!answerHit.hit) continue;
      const evidence = {
        answerId: answer.id,
        page: page.page,
        text: segment.text,
        score: 11.8 + (answerHit.phraseHit ? 2.5 : 0) + answerHit.answerCoverage * 3.2 + Math.min(2, focusHits) * 1.0,
        kind: polarity === target ? "recommendation_polarity_match" : "recommendation_polarity_mismatch",
      };
      if (polarity === target) bestMatch = betterEvidence(bestMatch, evidence);
      else bestMismatch = betterEvidence(bestMismatch, evidence);
    }
  }

  if (bestMatch) return { support: bestMatch, adjustment: 0, evidence: null };
  return bestMismatch ? { support: null, adjustment: -7.5, evidence: bestMismatch } : { support: null, adjustment: 0, evidence: null };
}
