import {FOCUS_STOPWORDS} from "../../constants.js";
import {
  betterEvidence,
  containsNormalizedPhrase,
  evidenceSnippet,
  expandNumberToken,
  extractNumbers,
  normalizeForSearch,
  numberCoverage,
  phraseTokens,
  strictSoftCoverage,
  tokenizeNormalized,
  uniqueTokens,
} from "./dependencies.js";
import type {CountRelationInput, NumericEvidence} from "./types.js";

const COUNT_NUMBER_WORDS = new Map(
  Object.entries({
    "1": ["\u043e\u0434\u0438\u043d", "\u043e\u0434\u043d"],
    "2": ["\u0434\u0432\u0430", "\u0434\u0432\u0435", "\u0434\u0432\u0443"],
    "3": ["\u0442\u0440\u0438", "\u0442\u0440\u0435"],
    "4": ["\u0447\u0435\u0442\u044b\u0440"],
    "5": ["\u043f\u044f\u0442"],
    "6": ["\u0448\u0435\u0441\u0442"],
    "7": ["\u0441\u0435\u043c"],
    "8": ["\u0432\u043e\u0441\u0435\u043c"],
    "9": ["\u0434\u0435\u0432\u044f\u0442"],
    "10": ["\u0434\u0435\u0441\u044f\u0442"],
    "11": ["\u043e\u0434\u0438\u043d\u043d\u0430\u0434\u0446\u0430\u0442"],
    "12": ["\u0434\u0432\u0435\u043d\u0430\u0434\u0446\u0430\u0442"],
  }).map(([number, words]) => [number, words.map((word) => normalizeForSearch(word))]),
);

const COUNT_QUESTION_CUES = ["\u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432", "\u0447\u0438\u0441\u043b\u043e", "\u0441\u043a\u043e\u043b\u044c\u043a"].map((item) => normalizeForSearch(item));
const COUNT_LOCAL_CUES = [
  "\u0441\u043e\u0441\u0442\u0430\u0432\u043b",
  "\u0432\u044b\u0434\u0435\u043b\u044f",
  "\u0432\u044b\u0437\u0432\u0430\u043d",
  "\u043a\u043e\u0434\u0438\u0440",
  "\u0432\u043a\u043b\u044e\u0447",
  "\u0431\u043e\u043b\u044c\u0448\u0438\u043d\u0441\u0442\u0432",
  "\u0441\u0440\u0435\u0434\u0438 \u043a\u043e\u0442\u043e\u0440",
  "\u0440\u0430\u0437\u043b\u0438\u0447\u043d",
  "\u0440\u0430\u0437\u043b\u0438\u0447\u0430",
  "\u043f\u043e\u0434\u0440\u0430\u0437\u0434\u0435\u043b",
].map((item) => normalizeForSearch(item));

const COUNT_GENERIC_TOKENS = new Set(
  [
    "\u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e",
    "\u0441\u043e\u0441\u0442\u0430\u0432\u043b\u044f\u0435\u0442",
    "\u0447\u0438\u0441\u043b\u043e",
    "\u0441\u043a\u043e\u043b\u044c\u043a\u043e",
    "\u0432\u044b\u0434\u0435\u043b\u044f\u044e\u0442",
    "\u043d\u0430\u0441\u0442\u043e\u044f\u0449\u0435\u0435",
    "\u0432\u0440\u0435\u043c\u044f",
  ].flatMap((item) => uniqueTokens(item)),
);

function countQuestion(question: string): boolean {
  const normalized = normalizeForSearch(question);
  return COUNT_QUESTION_CUES.some((cue) => normalized.includes(cue));
}

function countFocusTokens(question: string): string[] {
  return uniqueTokens(question).filter((token) => token.length >= 3 && !FOCUS_STOPWORDS.has(token) && !COUNT_GENERIC_TOKENS.has(token) && !/^\d/.test(token));
}

function countNumberSearchPhrases(answerText: string): string[] {
  const phrases = new Set<string>();
  for (const number of extractNumbers(answerText)) {
    for (const expanded of expandNumberToken(number)) {
      const clean = String(expanded).replace("%", "");
      if (!clean || !/^\d+$/.test(clean)) continue;
      phrases.add(clean);
      for (const word of COUNT_NUMBER_WORDS.get(clean) ?? []) phrases.add(word);
    }
  }
  return [...phrases].filter(Boolean);
}

function countRelationAnswerOption(answerText: string): boolean {
  const normalized = normalizeForSearch(answerText);
  const tokens = phraseTokens(answerText).filter((token) => token.length > 0);
  const numbers = extractNumbers(answerText);
  if (!numbers.length || tokens.length > 4 || normalized.length > 36) return false;
  const numberLike = new Set(numbers.flatMap(expandNumberToken).map((item) => String(item).replace("%", "")));
  for (const [number, words] of COUNT_NUMBER_WORDS.entries()) {
    if (numberLike.has(number)) {
      for (const word of words) numberLike.add(word);
    }
  }
  const nonNumericTokens = tokens.filter((token) => {
    const clean = token.replace(/[%.,+-]/g, "");
    if (!clean) return false;
    if (/^\d+$/u.test(clean)) return false;
    return !numberLike.has(clean);
  });
  return nonNumericTokens.length <= 1;
}

function countCueHit(local: string): boolean {
  return COUNT_LOCAL_CUES.some((cue) => local.includes(cue));
}

function positiveStructuralHit(local: string): boolean {
  const cue = normalizeForSearch("\u0441\u0442\u0440\u0443\u043a\u0442\u0443\u0440");
  for (let index = local.indexOf(cue); index >= 0; index = local.indexOf(cue, index + cue.length)) {
    const before = local.slice(Math.max(0, index - 4), index);
    if (!before.includes(normalizeForSearch("\u043d\u0435"))) return true;
  }
  return false;
}

function countTargetNear(normalizedPage: string, hit: number, phraseLength: number, question: string): boolean {
  const questionNorm = normalizeForSearch(question);
  const local = normalizedPage.slice(Math.max(0, hit - 25), Math.min(normalizedPage.length, hit + phraseLength + 55));
  const after = normalizedPage.slice(hit + phraseLength, Math.min(normalizedPage.length, hit + phraseLength + 58));
  if (containsNormalizedPhrase(questionNorm, "\u0433\u0435\u043d\u043e\u0442\u0438\u043f")) {
    return containsNormalizedPhrase(after, "\u0433\u0435\u043d\u043e\u0442\u0438\u043f");
  }
  if (containsNormalizedPhrase(questionNorm, "\u043d\u0435\u0441\u0442\u0440\u0443\u043a\u0442\u0443\u0440")) {
    return containsNormalizedPhrase(after, "\u043d\u0435\u0441\u0442\u0440\u0443\u043a\u0442\u0443\u0440");
  }
  if (containsNormalizedPhrase(questionNorm, "\u0441\u0442\u0440\u0443\u043a\u0442\u0443\u0440") && containsNormalizedPhrase(questionNorm, "\u0431\u0435\u043b\u043a")) {
    return positiveStructuralHit(after);
  }
  if (containsNormalizedPhrase(questionNorm, "\u0441\u0435\u0440\u043e\u0433\u0440\u0443\u043f")) {
    return containsNormalizedPhrase(after, "\u0441\u0435\u0440\u043e\u0433\u0440\u0443\u043f");
  }
  if (containsNormalizedPhrase(questionNorm, "\u0441\u0435\u0440\u043e\u0442\u0438\u043f")) {
    return containsNormalizedPhrase(after, "\u0441\u0435\u0440\u043e\u0442\u0438\u043f");
  }
  return true;
}

export function bestCountRelationSupport({mode,pages,topQuestionPages,question,answer,answerTokens}: CountRelationInput): NumericEvidence {
  if (mode !== "single" || !countQuestion(question)) return null;
  if (!extractNumbers(answer.text).length) return null;
  if (!countRelationAnswerOption(answer.text)) return null;
  const phrases = countNumberSearchPhrases(answer.text);
  if (!phrases.length) return null;
  const focusTokens = countFocusTokens(question);
  if (focusTokens.length < 2) return null;
  let best: NumericEvidence = null;

  for (const page of pages) {
    if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
    for (const phrase of phrases) {
      let start = 0;
      while (start < page.normalized.length) {
        const hit = page.normalized.indexOf(phrase, start);
        if (hit < 0) break;
        if (/^\d+$/.test(phrase)) {
          const before = hit > 0 ? page.normalized[hit - 1] : "";
          const after = page.normalized[hit + phrase.length] ?? "";
          if (/[0-9]/.test(before) || /[0-9]/.test(after)) {
            start = hit + Math.max(1, phrase.length);
            continue;
          }
          const nearBefore = page.normalized.slice(Math.max(0, hit - 3), hit);
          const nearAfter = page.normalized.slice(hit + phrase.length, hit + phrase.length + 3);
          if (nearBefore.includes("[") || nearAfter.includes("]")) {
            start = hit + Math.max(1, phrase.length);
            continue;
          }
        }
        if (!countTargetNear(page.normalized, hit, phrase.length, question)) {
          start = hit + Math.max(1, phrase.length);
          continue;
        }
        const local = page.normalized.slice(Math.max(0, hit - 210), Math.min(page.normalized.length, hit + phrase.length + 230));
        const localTokens = tokenizeNormalized(local);
        const focusCoverage = strictSoftCoverage(focusTokens, localTokens);
        if (focusCoverage < 0.34 || !countCueHit(local)) {
          start = hit + Math.max(1, phrase.length);
          continue;
        }
        const score =
          14.2 +
          focusCoverage * 6.2 +
          strictSoftCoverage(answerTokens, localTokens) * 1.2 +
          numberCoverage(answer.text, local) * 2.6;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: evidenceSnippet(page.text, phrase, question),
          score,
          kind: "count_relation_segment",
        });
        start = hit + Math.max(1, phrase.length);
      }
    }
  }

  return best;
}
