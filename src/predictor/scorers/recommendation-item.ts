import { normalizeForSearch, uniqueTokens } from "../../normalize.js";
import { FOCUS_STOPWORDS } from "../constants.js";
import { answerSearchPhrases, betterEvidence, containsNormalizedPhrase, strictSoftCoverage, tokenizeNormalized } from "../text-utils.js";

const RECOMMENDATION_QUESTION_GENERIC = new Set(
  [
    "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u0442\u0441\u044f",
    "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u043e\u0432\u0430\u043d\u043e",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442\u0430\u043c",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442\u043e\u0432",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442\u044b",
    "\u043f\u0440\u0438",
    "\u0434\u043b\u044f",
    "\u0441",
    "\u0438",
    "\u0443",
    "\u044f\u0432\u043b\u044f\u044e\u0442\u0441\u044f",
    "\u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442\u0430\u043c\u0438",
    "\u043f\u0435\u0440\u0432\u043e\u0439",
    "\u043b\u0438\u043d\u0438\u0438",
  ].flatMap((item) => uniqueTokens(item)),
);

function recommendationItemQuestion(question) {
  const normalized = normalizeForSearch(question);
  const firstLineTherapy = containsNormalizedPhrase(normalized, "\u043f\u0435\u0440\u0432\u043e\u0439 \u043b\u0438\u043d\u0438\u0438");
  const valveProsthesisChoice =
    containsNormalizedPhrase(normalized, "\u043f\u0440\u043e\u0442\u0435\u0437") &&
    containsNormalizedPhrase(normalized, "\u043a\u043b\u0430\u043f") &&
    (containsNormalizedPhrase(normalized, "\u0431\u0438\u043e\u043b\u043e\u0433") || containsNormalizedPhrase(normalized, "\u043c\u0435\u0445\u0430\u043d"));
  const universalInstrumental =
    containsNormalizedPhrase(normalized, "\u0432\u0441\u0435\u043c \u043f\u0430\u0446\u0438\u0435\u043d\u0442") &&
    ((containsNormalizedPhrase(normalized, "\u043f\u0435\u0440\u0432\u0438\u0447") && containsNormalizedPhrase(normalized, "\u0441\u0442\u0430\u0434")) ||
      (containsNormalizedPhrase(normalized, "\u0434\u0438\u043d\u0430\u043c\u0438\u0447") && containsNormalizedPhrase(normalized, "\u044d\u0444\u0444\u0435\u043a\u0442")));
  return firstLineTherapy || valveProsthesisChoice || universalInstrumental;
}

function recommendationQuestionTokens(question) {
  return uniqueTokens(question).filter((token) => token.length >= 4 && !FOCUS_STOPWORDS.has(token) && !RECOMMENDATION_QUESTION_GENERIC.has(token));
}

function isPageNumberOnly(line) {
  return /^\s*\d+\s*$/u.test(String(line ?? ""));
}

function startsBullet(line) {
  return /^\s*[•*\-]\s*/u.test(String(line ?? ""));
}

function recommendationLineStart(line) {
  if (isPageNumberOnly(line)) return false;
  const normalized = normalizeForSearch(line);
  return (
    startsBullet(line) ||
    containsNormalizedPhrase(normalized, "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434") ||
    containsNormalizedPhrase(normalized, "\u043f\u0435\u0440\u0432\u043e\u0439 \u043b\u0438\u043d\u0438\u0438")
  );
}

function recommendationBoundaryLine(line, isFirstLine) {
  if (isPageNumberOnly(line)) return true;
  if (!isFirstLine && startsBullet(line)) return true;
  const normalized = normalizeForSearch(line);
  return (
    /^e\s*o?k\b/iu.test(normalized) ||
    normalized.startsWith("eok") ||
    normalized.startsWith("ypobeh") ||
    containsNormalizedPhrase(normalized, "\u0443\u0443\u0440") ||
    containsNormalizedPhrase(normalized, "\u0443\u0434\u0434")
  );
}

function collectRecommendationSegment(pages, pageIndex, lineIndex) {
  const lines = [];
  for (let currentPageIndex = pageIndex; currentPageIndex < Math.min(pages.length, pageIndex + 2); currentPageIndex += 1) {
    const page = pages[currentPageIndex];
    const pageLines = page.lines ?? [];
    const startLine = currentPageIndex === pageIndex ? lineIndex : 0;
    for (let index = startLine; index < pageLines.length && lines.length < 12; index += 1) {
      const line = pageLines[index];
      if (recommendationBoundaryLine(line, currentPageIndex === pageIndex && index === lineIndex)) {
        if (!isPageNumberOnly(line)) return lines.join(" ");
        continue;
      }
      lines.push(line);
    }
    if (lines.length >= 12) break;
    const nextPage = pages[currentPageIndex + 1];
    if (!nextPage?.lines?.length || startsBullet(nextPage.lines[0])) break;
  }
  return lines.join(" ");
}

function recommendationSegments(pages) {
  const segments = [];
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const lines = page.lines ?? [];
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      if (!recommendationLineStart(lines[lineIndex])) continue;
      const text = collectRecommendationSegment(pages, pageIndex, lineIndex).replace(/\s+/gu, " ").trim();
      if (text.length < 24) continue;
      segments.push({
        page: page.page,
        text,
        normalized: normalizeForSearch(text),
      });
    }
  }
  return segments;
}

function recommendationSubjectCompatible(questionNorm, segmentNorm) {
  const questionBiological = containsNormalizedPhrase(questionNorm, "\u0431\u0438\u043e\u043b\u043e\u0433");
  const questionMechanical = containsNormalizedPhrase(questionNorm, "\u043c\u0435\u0445\u0430\u043d");
  const segmentBiological = containsNormalizedPhrase(segmentNorm, "\u0431\u0438\u043e\u043b\u043e\u0433");
  const segmentMechanical = containsNormalizedPhrase(segmentNorm, "\u043c\u0435\u0445\u0430\u043d");
  if (questionBiological && segmentMechanical && !segmentBiological) return false;
  if (questionMechanical && segmentBiological && !segmentMechanical) return false;
  if (questionBiological && !segmentBiological) return false;
  if (questionMechanical && !segmentMechanical) return false;
  if (containsNormalizedPhrase(questionNorm, "\u043f\u0435\u0440\u0432\u043e\u0439 \u043b\u0438\u043d\u0438\u0438") && !containsNormalizedPhrase(segmentNorm, "\u043f\u0435\u0440\u0432\u043e\u0439 \u043b\u0438\u043d\u0438\u0438")) {
    return false;
  }
  return true;
}

function recommendationQuestionCoverage(questionNorm, questionTokens, segmentNorm) {
  const segmentTokens = tokenizeNormalized(segmentNorm);
  let coverageScore = strictSoftCoverage(questionTokens, segmentTokens);
  const valveProsthesisQuestion =
    containsNormalizedPhrase(questionNorm, "\u043f\u0440\u043e\u0442\u0435\u0437") &&
    containsNormalizedPhrase(questionNorm, "\u0430\u043e\u0440\u0442") &&
    containsNormalizedPhrase(questionNorm, "\u043a\u043b\u0430\u043f");
  if (valveProsthesisQuestion && containsNormalizedPhrase(segmentNorm, "\u041f\u0410\u041a")) coverageScore = Math.max(coverageScore, 0.58);
  return coverageScore;
}

function recommendationAnswerWindow(questionNorm, segmentNorm) {
  if (containsNormalizedPhrase(questionNorm, "\u0434\u0438\u043b\u0430\u0442\u0430\u0446")) {
    const withoutDilation = segmentNorm.indexOf(normalizeForSearch("\u0431\u0435\u0437 \u0434\u0438\u043b\u0430\u0442\u0430\u0446"));
    if (withoutDilation > 80) return segmentNorm.slice(0, withoutDilation);
  }
  return segmentNorm;
}

function recommendationAliasSupport(answerText, segmentNorm) {
  const answerNorm = normalizeForSearch(answerText);
  let support = 0;
  if (
    containsNormalizedPhrase(answerNorm, "\u0438\u043d\u0433\u0438\u0431") &&
    containsNormalizedPhrase(answerNorm, "\u0430\u043f\u0444") &&
    containsNormalizedPhrase(segmentNorm, "\u0438\u0410\u041f\u0424")
  ) {
    support = Math.max(support, 0.98);
  }
  if (
    containsNormalizedPhrase(answerNorm, "\u0431\u0435\u0442\u0430") &&
    containsNormalizedPhrase(answerNorm, "\u0430\u0434\u0440\u0435\u043d\u043e") &&
    containsNormalizedPhrase(answerNorm, "\u0431\u043b\u043e\u043a") &&
    containsNormalizedPhrase(segmentNorm, "\u0431\u0435\u0442\u0430")
  ) {
    support = Math.max(support, 0.96);
  }
  return support;
}

function anticoagulationContraPolarity(normalized) {
  if (!containsNormalizedPhrase(normalized, "\u0430\u043d\u0442\u0438\u043a\u043e\u0430\u0433")) return null;
  const contra = normalizeForSearch("\u043f\u0440\u043e\u0442\u0438\u0432\u043e\u043f\u043e\u043a\u0430\u0437");
  let start = 0;
  while (start < normalized.length) {
    const index = normalized.indexOf(contra, start);
    if (index < 0) break;
    const before = normalized.slice(Math.max(0, index - 58), index);
    if (containsNormalizedPhrase(before, "\u043e\u0442\u0441\u0443\u0442")) return "absence";
    if (containsNormalizedPhrase(before, "\u043d\u0430\u043b\u0438\u0447")) return "presence";
    start = index + contra.length;
  }
  return null;
}

function recommendationPresenceMismatch(answerText, segmentNorm) {
  const answerNorm = normalizeForSearch(answerText);
  const answerContraPolarity = anticoagulationContraPolarity(answerNorm);
  const segmentContraPolarity = anticoagulationContraPolarity(segmentNorm);
  if (answerContraPolarity && segmentContraPolarity && answerContraPolarity !== segmentContraPolarity) return true;
  if (containsNormalizedPhrase(answerNorm, "\u043e\u043f\u0442\u0438\u043c") && !containsNormalizedPhrase(segmentNorm, "\u043e\u043f\u0442\u0438\u043c")) return true;
  if (
    (containsNormalizedPhrase(answerNorm, "\u043c\u0435\u043d\u044c\u0448") || containsNormalizedPhrase(answerNorm, "\u043d\u0438\u0436\u0435")) &&
    !containsNormalizedPhrase(segmentNorm, "\u043c\u0435\u043d\u044c\u0448") &&
    !containsNormalizedPhrase(segmentNorm, "\u043d\u0438\u0436\u0435")
  ) {
    return true;
  }
  const answerAbsence = containsNormalizedPhrase(answerNorm, "\u043e\u0442\u0441\u0443\u0442\u0441\u0442");
  const answerPresence = containsNormalizedPhrase(answerNorm, "\u043d\u0430\u043b\u0438\u0447");
  const segmentAbsence = containsNormalizedPhrase(segmentNorm, "\u043e\u0442\u0441\u0443\u0442\u0441\u0442");
  const segmentPresence = containsNormalizedPhrase(segmentNorm, "\u043d\u0430\u043b\u0438\u0447");
  const contra = containsNormalizedPhrase(answerNorm, "\u043f\u0440\u043e\u0442\u0438\u0432\u043e\u043f\u043e\u043a\u0430\u0437") || containsNormalizedPhrase(segmentNorm, "\u043f\u0440\u043e\u0442\u0438\u0432\u043e\u043f\u043e\u043a\u0430\u0437");
  if (contra && answerAbsence && segmentPresence && !segmentAbsence) return true;
  if (contra && answerPresence && segmentAbsence && !segmentPresence) return true;
  return false;
}

export function bestRecommendationItemSupport({ pages, question, answer, answerTokens }) {
  if (!recommendationItemQuestion(question)) return null;
  const questionNorm = normalizeForSearch(question);
  const qTokens = recommendationQuestionTokens(question);
  if (!qTokens.length) return null;
  let best = null;

  for (const segment of recommendationSegments(pages)) {
    const answerNorm = normalizeForSearch(answer.text);
    if (containsNormalizedPhrase(answerNorm, "\u043e\u043f\u0442\u0438\u043c") && !containsNormalizedPhrase(questionNorm, "\u043e\u043f\u0442\u0438\u043c")) continue;
    if (!recommendationSubjectCompatible(questionNorm, segment.normalized)) continue;
    const qCoverage = recommendationQuestionCoverage(questionNorm, qTokens, segment.normalized);
    if (qCoverage < 0.34) continue;
    const answerWindow = recommendationAnswerWindow(questionNorm, segment.normalized);
    if (recommendationPresenceMismatch(answer.text, answerWindow)) continue;
    const tokens = tokenizeNormalized(answerWindow);
    const phraseHit = answerSearchPhrases(answer.text).some((phrase) => containsNormalizedPhrase(answerWindow, phrase));
    const alias = recommendationAliasSupport(answer.text, answerWindow);
    const answerCoverage = Math.max(strictSoftCoverage(answerTokens, tokens), alias);
    if (!phraseHit && answerCoverage < 0.62) continue;
    const score = 15.8 + qCoverage * 4.0 + answerCoverage * 6.2 + (phraseHit ? 2.4 : 0) + alias * 2.0;
    best = betterEvidence(best, {
      answerId: answer.id,
      page: segment.page,
      text: segment.text,
      score,
      kind: "recommendation_item_segment",
    });
  }

  return best;
}
