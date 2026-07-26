import {normalizeForSearch, uniqueTokens} from "../../../normalize.js";
import {FOCUS_STOPWORDS} from "../../constants.js";
import type {AnswerScoringContext} from "../../contracts.js";
import {
  betterEvidence,
  containsNormalizedPhrase,
  rawSoftCoverage,
  softCoverage,
  strictSoftCoverage,
  tokenHitCount,
  tokenizeNormalized,
} from "../../text-utils.js";
import type {EvidenceItem} from "../../types.js";
import {sentenceSegments} from "../biomedical-symbols/index.js";

type ClinicalFeatureQuestionContext = Pick<AnswerScoringContext, "mode" | "question" | "intent">;

type ClinicalFeatureSentence = {
  sentence: string;
  normalized: string;
  tokens: string[];
  focusHits: number;
  distance: number;
};

type ClinicalFeatureAdjustment = {
  support: EvidenceItem | null;
  adjustment: number;
  evidence: EvidenceItem | null;
};

const CLINICAL_FEATURE_GENERIC_TOKENS = new Set(
  [
    "\u0438\u043c\u0435\u0435\u0442",
    "\u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0435",
    "\u043a\u043b\u0438\u043d\u0438\u0447\u0435\u0441\u043a\u0438\u0435",
    "\u043a\u043b\u0438\u043d\u0438\u0447\u0435\u0441\u043a\u0438",
    "\u043f\u0440\u0438\u0437\u043d\u0430\u043a\u0438",
    "\u043f\u0440\u0438\u0437\u043d\u0430\u043a",
    "\u0441\u0438\u043c\u043f\u0442\u043e\u043c\u044b",
    "\u0441\u0438\u043c\u043f\u0442\u043e\u043c",
    "\u043f\u0440\u043e\u044f\u0432\u043b\u0435\u043d\u0438\u044f",
    "\u043f\u0440\u043e\u044f\u0432\u043b\u0435\u043d\u0438\u0435",
    "\u0444\u043e\u0440\u043c\u0430",
    "\u0444\u043e\u0440\u043c\u044b",
  ].flatMap((item) => uniqueTokens(item)),
);

const CLINICAL_FEATURE_ANSWER_GENERIC_TOKENS = new Set(
  ["\u043e\u0431\u044b\u0447\u043d\u043e", "\u0442\u0438\u043f\u0438\u0447\u043d\u043e", "\u0446\u0432\u0435\u0442\u0430", "\u0446\u0432\u0435\u0442"].flatMap((item) => uniqueTokens(item)),
);

/**
 * Проверяет, относится ли вопрос к перечислению клинических признаков.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.question Исходный текст вопроса.
 * @param context.intent Определённый predictor-ом тип и полярность вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function clinicalFeatureQuestion({mode, question, intent}: ClinicalFeatureQuestionContext): boolean {
  if (mode !== "multi" || intent.negative || intent.exception) return false;
  const normalized = normalizeForSearch(question);
  return (
    containsNormalizedPhrase(normalized, "\u0438\u043c\u0435") &&
    containsNormalizedPhrase(normalized, "\u0441\u043b\u0435\u0434\u0443\u044e") &&
    containsNormalizedPhrase(normalized, "\u043a\u043b\u0438\u043d\u0438\u0447") &&
    containsNormalizedPhrase(normalized, "\u043f\u0440\u0438\u0437\u043d")
  );
}

/**
 * Выделяет специфичные токены заболевания и клинического контекста из вопроса.
 *
 * @param question Исходный текст вопроса.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function clinicalFeatureFocusTokens(question: string): string[] {
  return uniqueTokens(question).filter((token) => token.length >= 4 && !CLINICAL_FEATURE_GENERIC_TOKENS.has(token) && !FOCUS_STOPWORDS.has(token));
}

/**
 * Выделяет содержательные токены клинического признака из варианта ответа.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function clinicalFeatureAnswerTokens(answerText: string): string[] {
  return uniqueTokens(answerText).filter((token) => token.length >= 4 && !CLINICAL_FEATURE_ANSWER_GENERIC_TOKENS.has(token) && !FOCUS_STOPWORDS.has(token));
}

/**
 * Извлекает или проверяет варианта ответа отрицания клинического признака маркера в варианте ответа.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function answerHasNegativeClinicalCue(answerText: string): boolean {
  const normalized = normalizeForSearch(answerText);
  return (
    containsNormalizedPhrase(normalized, "\u043d\u0435 ") ||
    containsNormalizedPhrase(normalized, "\u0431\u0435\u0437 ") ||
    containsNormalizedPhrase(normalized, "\u043e\u0442\u0441\u0443\u0442") ||
    containsNormalizedPhrase(normalized, "\u043d\u0435\u0442\u0438\u043f\u0438\u0447")
  );
}

/**
 * Определяет, отрицает ли локальное предложение наличие клинического признака.
 *
 * @param normalizedSentence Значение `normalizedSentence`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function clinicalFeatureSentenceNegative(normalizedSentence: string): boolean {
  return (
    containsNormalizedPhrase(normalizedSentence, "\u043d\u0435 \u0442\u0438\u043f\u0438\u0447") ||
    containsNormalizedPhrase(normalizedSentence, "\u043d\u0435\u0442\u0438\u043f\u0438\u0447") ||
    containsNormalizedPhrase(normalizedSentence, "\u043d\u0435 \u0445\u0430\u0440\u0430\u043a\u0442\u0435\u0440") ||
    containsNormalizedPhrase(normalizedSentence, "\u043d\u0435 \u044f\u0432\u043b\u044f") ||
    containsNormalizedPhrase(normalizedSentence, "\u043e\u0442\u0441\u0443\u0442") ||
    containsNormalizedPhrase(normalizedSentence, "\u0431\u0435\u0437 ")
  );
}

/**
 * Отбирает предложения-кандидаты рядом с фокусом вопроса о клинических признаках.
 *
 * @param pageText Исходный текст соответствующего объекта.
 * @param focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function clinicalFeatureCandidateSentences(pageText: string, focusTokens: string[]): ClinicalFeatureSentence[] {
  const sentences = sentenceSegments(pageText).map((sentence) => {
    const normalized = normalizeForSearch(sentence);
    const tokens = tokenizeNormalized(normalized);
    return { sentence, normalized, tokens, focusHits: tokenHitCount(focusTokens, tokens) };
  });
  const anchors = sentences.map((item, index) => (item.focusHits > 0 ? index : -1)).filter((index) => index >= 0);
  if (!anchors.length) return [];

  return sentences
    .map((item, index) => {
      const distance = Math.min(...anchors.map((anchor) => (index >= anchor ? index - anchor : Infinity)));
      return { ...item, distance };
    })
    .filter((item) => item.focusHits > 0 || item.distance <= 4);
}

/**
 * Возвращает поддержку клинического признака либо штраф за его явное отрицание.
 *
 * @param context Полный контекст скоринга текущего варианта.
 * @returns Поправка score и, при наличии, объясняющее evidence.
 */
export function clinicalFeatureAdjustment(context: AnswerScoringContext): ClinicalFeatureAdjustment {
  const {pages, mode, question, answer, intent} = context;
  if (!clinicalFeatureQuestion({mode, question, intent})) return {support: null, adjustment: 0, evidence: null};
  const focusTokens = clinicalFeatureFocusTokens(question);
  if (!focusTokens.length) return { support: null, adjustment: 0, evidence: null };
  const answerTokens = clinicalFeatureAnswerTokens(answer.text);
  if (answerTokens.length < 2) return { support: null, adjustment: 0, evidence: null };
  const answerNegative = answerHasNegativeClinicalCue(answer.text);
  let bestSupport: EvidenceItem | null = null;
  let bestNegated: EvidenceItem | null = null;

  for (const page of pages) {
    for (const item of clinicalFeatureCandidateSentences(page.text, focusTokens)) {
      const answerCoverage = Math.max(strictSoftCoverage(answerTokens, item.tokens), softCoverage(answerTokens, item.tokens), rawSoftCoverage(answerTokens, item.tokens));
      if (answerCoverage < 0.5) continue;
      const negated = clinicalFeatureSentenceNegative(item.normalized);
      const focusBonus = Math.min(2, item.focusHits) * 1.1;
      const distanceBonus = Math.max(0, 4 - item.distance) * 0.35;
      const score = 12.4 + answerCoverage * 5.2 + focusBonus + distanceBonus;
      const evidence = {
        answerId: answer.id,
        page: page.page,
        text: item.sentence,
        score,
        kind: negated && !answerNegative ? "clinical_feature_negated" : "clinical_feature_segment",
      };
      if (negated && !answerNegative) bestNegated = betterEvidence(bestNegated, evidence);
      else bestSupport = betterEvidence(bestSupport, evidence);
    }
  }

  if (bestNegated && (!bestSupport || bestNegated.score >= bestSupport.score - 0.8)) {
    return {support: null, adjustment: -8.4, evidence: bestNegated};
  }
  return bestSupport ? {support: bestSupport, adjustment: 0, evidence: null} : {support: null, adjustment: 0, evidence: null};
}
