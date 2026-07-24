import { normalizeForSearch, uniqueTokens } from "../../normalize.js";
import { FOCUS_STOPWORDS } from "../constants.js";
import {
  betterEvidence,
  containsNormalizedPhrase,
  rawSoftCoverage,
  softCoverage,
  strictSoftCoverage,
  tokenHitCount,
  tokenizeNormalized,
} from "../text-utils.js";
import { sentenceSegments } from "./biomedical-symbols.js";

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

function clinicalFeatureQuestion({ mode, question, intent }) {
  if (mode !== "multi" || intent.negative || intent.exception) return false;
  const normalized = normalizeForSearch(question);
  return (
    containsNormalizedPhrase(normalized, "\u0438\u043c\u0435") &&
    containsNormalizedPhrase(normalized, "\u0441\u043b\u0435\u0434\u0443\u044e") &&
    containsNormalizedPhrase(normalized, "\u043a\u043b\u0438\u043d\u0438\u0447") &&
    containsNormalizedPhrase(normalized, "\u043f\u0440\u0438\u0437\u043d")
  );
}

function clinicalFeatureFocusTokens(question) {
  return uniqueTokens(question).filter((token) => token.length >= 4 && !CLINICAL_FEATURE_GENERIC_TOKENS.has(token) && !FOCUS_STOPWORDS.has(token));
}

function clinicalFeatureAnswerTokens(answerText) {
  return uniqueTokens(answerText).filter((token) => token.length >= 4 && !CLINICAL_FEATURE_ANSWER_GENERIC_TOKENS.has(token) && !FOCUS_STOPWORDS.has(token));
}

function answerHasNegativeClinicalCue(answerText) {
  const normalized = normalizeForSearch(answerText);
  return (
    containsNormalizedPhrase(normalized, "\u043d\u0435 ") ||
    containsNormalizedPhrase(normalized, "\u0431\u0435\u0437 ") ||
    containsNormalizedPhrase(normalized, "\u043e\u0442\u0441\u0443\u0442") ||
    containsNormalizedPhrase(normalized, "\u043d\u0435\u0442\u0438\u043f\u0438\u0447")
  );
}

function clinicalFeatureSentenceNegative(normalizedSentence) {
  return (
    containsNormalizedPhrase(normalizedSentence, "\u043d\u0435 \u0442\u0438\u043f\u0438\u0447") ||
    containsNormalizedPhrase(normalizedSentence, "\u043d\u0435\u0442\u0438\u043f\u0438\u0447") ||
    containsNormalizedPhrase(normalizedSentence, "\u043d\u0435 \u0445\u0430\u0440\u0430\u043a\u0442\u0435\u0440") ||
    containsNormalizedPhrase(normalizedSentence, "\u043d\u0435 \u044f\u0432\u043b\u044f") ||
    containsNormalizedPhrase(normalizedSentence, "\u043e\u0442\u0441\u0443\u0442") ||
    containsNormalizedPhrase(normalizedSentence, "\u0431\u0435\u0437 ")
  );
}

function clinicalFeatureCandidateSentences(pageText, focusTokens) {
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

export function clinicalFeatureAdjustment(context) {
  const { pages, topQuestionPages, mode, question, answer, intent } = context;
  if (!clinicalFeatureQuestion({ mode, question, intent })) return { support: null, adjustment: 0, evidence: null };
  const focusTokens = clinicalFeatureFocusTokens(question);
  if (!focusTokens.length) return { support: null, adjustment: 0, evidence: null };
  const answerTokens = clinicalFeatureAnswerTokens(answer.text);
  if (answerTokens.length < 2) return { support: null, adjustment: 0, evidence: null };
  const answerNegative = answerHasNegativeClinicalCue(answer.text);
  let bestSupport = null;
  let bestNegated = null;

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
    return { support: null, adjustment: -8.4, evidence: bestNegated };
  }
  return bestSupport ? { support: bestSupport, adjustment: 0, evidence: null } : { support: null, adjustment: 0, evidence: null };
}
