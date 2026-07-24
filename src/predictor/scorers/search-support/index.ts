/**
 * Общие lexical/search сигналы, которые используются агрегатором answer score.
 */
import {
  coverage,
  extractNumbers,
  jaccard,
  normalizeForSearch,
  normalizeText,
  phraseTokens,
  tokenize,
  uniqueTokens,
} from "../../../normalize.js";
import { DEFAULT_CONFIG } from "../../config.js";
import {
  answerSearchPhrases,
  betterEvidence,
  containsNormalizedPhrase,
  evidenceFromChunk,
  evidenceSnippet,
  findPhraseOccurrences,
  numberCoverage,
  proximityBonus,
  tokenBoundaryIncludes,
  tokenProximity,
  tokenizeNormalized,
} from "../../text-utils.js";
import { cachedLineTokenSegments } from "../focused/index.js";

function questionPrefixes(question) {
  const tokens = phraseTokens(question);
  const prefixes = new Set<string>();
  for (const length of [14, 11, 8, 6]) {
    if (tokens.length >= length) prefixes.add(tokens.slice(0, length).join(" "));
  }
  if (tokens.length > 12) {
    prefixes.add(tokens.slice(Math.max(0, tokens.length - 10)).join(" "));
  }
  return [...prefixes].filter((prefix) => prefix.length >= 18);
}

export function bestPrefixSupport({ pages, question, answer, answerTokens, intent }) {
  const prefixes = questionPrefixes(question);
  if (!prefixes.length) return null;
  const answerPhrases = answerSearchPhrases(answer.text);
  let best = null;
  for (const page of pages) {
    for (const prefix of prefixes) {
      const normalizedPrefix = normalizeForSearch(prefix);
      let start = 0;
      while (start < page.normalized.length) {
        const index = page.normalized.indexOf(normalizedPrefix, start);
        if (index < 0) break;
        const afterStart = index + normalizedPrefix.length;
        const after = page.normalized.slice(afterStart, afterStart + 850);
        for (const phrase of answerPhrases) {
          const normalizedPhrase = normalizeForSearch(phrase);
          if (!normalizedPhrase) continue;
          const answerIndex = after.indexOf(normalizedPhrase);
          if (answerIndex < 0) continue;
          const local = after.slice(Math.max(0, answerIndex - 120), answerIndex + normalizedPhrase.length + 180);
          const score =
            5.8 +
            proximityBonus(answerIndex, 850) * 3.0 +
            coverage(answerTokens, tokenize(local)) * 1.2 +
            numberCoverage(answer.text, local) * 0.6 +
            (intent.numeric ? 0.25 : 0);
          best = betterEvidence(best, {
            answerId: answer.id,
            page: page.page,
            text: evidenceSnippet(page.text, question, answer.text),
            score,
            kind: "question_prefix_continuation",
          });
        }
        start = index + normalizedPrefix.length;
      }
    }
  }
  return best;
}

export function bestChunkSupport({ index, chunks, question, answer, questionTokens, answerTokens }) {
  const qaTokens = tokenize(`${question} ${answer.text}`);
  const answerOnlyTokens = tokenize(answer.text);
  const qResults = index.search(questionTokens, { limit: DEFAULT_CONFIG.topQuestionChunks });
  const qaResults = index.search(qaTokens, { limit: 8 });
  const aResults = index.search(answerOnlyTokens, { limit: 8 });

  const topQScore = qResults[0]?.score || 0;
  const topQaScore = qaResults[0]?.score || 0;
  const topAScore = aResults[0]?.score || 0;
  let best = null;

  for (const result of qaResults) {
    const chunk = result.chunk;
    const answerCoverage = coverage(answerTokens, chunk.tokens);
    const questionCoverage = coverage(questionTokens, chunk.tokens);
    const exact = containsNormalizedPhrase(chunk.normalized, answer.text) ? 1 : 0;
    const score =
      normalizeBm25(result.score, topQaScore) * 2.4 +
      questionCoverage * 1.7 +
      answerCoverage * 1.4 +
      exact * 2.4 +
      numberCoverage(answer.text, chunk.normalized) * 0.9 +
      tokenProximity(questionTokens, answerTokens, chunk.tokens) * 1.1;
    best = betterEvidence(best, evidenceFromChunk(answer.id, chunk, score, "bm25_question_answer"));
  }

  for (const result of qResults) {
    const chunk = result.chunk;
    const answerCoverage = coverage(answerTokens, chunk.tokens);
    if (answerCoverage <= 0 && !containsNormalizedPhrase(chunk.normalized, answer.text)) continue;
    const exact = containsNormalizedPhrase(chunk.normalized, answer.text) ? 1 : 0;
    const lineBoost =
      chunk.kind === "line" || chunk.kind === "line_pair" || chunk.kind === "layout_line" || chunk.kind === "layout_line_pair"
        ? 0.55
        : chunk.kind === "list"
          ? 0.35
          : chunk.kind === "heading"
            ? 0.2
            : 0;
    const score =
      normalizeBm25(result.score, topQScore) * 1.6 +
      answerCoverage * 3.2 +
      exact * 3.4 +
      lineBoost +
      jaccard(answerTokens, chunk.tokens) * 0.8 +
      numberCoverage(answer.text, chunk.normalized) * 1.2 +
      tokenProximity(questionTokens, answerTokens, chunk.tokens) * 1.4;
    best = betterEvidence(best, evidenceFromChunk(answer.id, chunk, score, "question_chunk_answer"));
  }

  for (const result of aResults) {
    const chunk = result.chunk;
    const questionCoverage = coverage(questionTokens, chunk.tokens);
    if (questionCoverage <= 0.06) continue;
    const score =
      normalizeBm25(result.score, topAScore) * 0.8 +
      questionCoverage * 2.2 +
      numberCoverage(answer.text, chunk.normalized) * 0.7 +
      tokenProximity(questionTokens, answerTokens, chunk.tokens) * 0.8;
    best = betterEvidence(best, evidenceFromChunk(answer.id, chunk, score, "answer_chunk_question"));
  }

  if (!best && chunks.length) {
    const fallback = qResults[0]?.chunk ?? chunks[0];
    best = evidenceFromChunk(answer.id, fallback, 0, "fallback");
  }

  return best;
}

function normalizeBm25(score, topScore) {
  if (!score || !topScore) return 0;
  return Math.min(1, score / topScore);
}

export function numberSpecificity(answer) {
  const count = extractNumbers(answer).length;
  return Math.min(1, count / 3);
}

export function lineTokenApplicable({ mode, question, answer, intent }) {
  if (mode !== "single") return false;
  if (intent.numeric || extractNumbers(answer.text).length) return false;
  const raw = normalizeText(question);
  return (
    /является\s+заболеванием/u.test(raw) ||
    /переда[а-яa-z0-9-]*\s+пут/u.test(raw) ||
    /рекоменду[а-яa-z0-9-]*\s+(?:применение|назначение|применять|назначать)/u.test(raw) ||
    /конкурентно\s+ингибирует/u.test(raw) ||
    /фермент/u.test(raw)
  );
}

function questionRiskCondition(question) {
  const raw = normalizeText(question);
  if (/(?:не\s+имеющ|без|отсутств)[а-яa-z0-9-\s]{0,80}фактор[а-яa-z0-9-\s]{0,40}риска/u.test(raw)) return "risk_absent";
  if (/(?:имеющ|налич)[а-яa-z0-9-\s]{0,80}фактор[а-яa-z0-9-\s]{0,40}риска/u.test(raw)) return "risk_present";
  return null;
}

function windowRiskCondition(normalizedWindow) {
  if (containsNormalizedPhrase(normalizedWindow, "не имеющих факторов риска") || containsNormalizedPhrase(normalizedWindow, "без факторов риска")) {
    return "risk_absent";
  }
  if (containsNormalizedPhrase(normalizedWindow, "при наличии") && containsNormalizedPhrase(normalizedWindow, "фактор")) {
    return "risk_present";
  }
  if (containsNormalizedPhrase(normalizedWindow, "имеющих") && containsNormalizedPhrase(normalizedWindow, "факторов риска")) {
    return "risk_present";
  }
  return null;
}

function primaryNumberPhrase(answerText) {
  const first = extractNumbers(answerText)[0];
  if (!first) return null;
  return String(first).replace(",", ".");
}

export function riskConditionAdjustment({ pages, topQuestionPages, question, answer }) {
  const target = questionRiskCondition(question);
  const value = primaryNumberPhrase(answer.text);
  if (!target || !value) return { adjustment: 0, evidence: null };
  let bestMatch = null;
  let bestMismatch = null;

  for (const page of pages) {
    if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
    const hits = findPhraseOccurrences(page.normalized, value, { textIsNormalized: true });
    for (const hit of hits) {
      const beforeNumber = page.normalized.slice(Math.max(0, hit - 50), hit);
      if (!containsNormalizedPhrase(beforeNumber, "уровн")) continue;
      const levelIndex = beforeNumber.lastIndexOf(normalizeForSearch("уровн"));
      if (levelIndex >= 0 && extractNumbers(beforeNumber.slice(levelIndex)).length) continue;
      const window = page.normalized.slice(Math.max(0, hit - 70), hit + value.length + 240);
      if (!containsNormalizedPhrase(window, "фактор") || !containsNormalizedPhrase(window, "риск")) continue;
      const after = page.normalized.slice(hit, hit + value.length + 240);
      const actual = windowRiskCondition(after) ?? windowRiskCondition(window);
      if (!actual) continue;
      const evidence = {
        answerId: answer.id,
        page: page.page,
        text: evidenceSnippet(page.text, value, question),
        score: actual === target ? 8.4 : 2.2,
        kind: actual === target ? "risk_condition_match" : "risk_condition_mismatch",
      };
      if (actual === target) bestMatch = betterEvidence(bestMatch, evidence);
      else bestMismatch = betterEvidence(bestMismatch, evidence);
    }
  }

  if (bestMatch) return { adjustment: 4.2, evidence: bestMatch };
  if (bestMismatch) return { adjustment: -2.1, evidence: bestMismatch };
  return { adjustment: 0, evidence: null };
}

function genericPopulationAnswer(answerText) {
  const raw = normalizeText(answerText);
  return /^(?:всем|все)\s+(?:пациент|больн|пострадав)/u.test(raw);
}

function genericPopulationConditionAdjustment({ mode, pages, topQuestionPages, question, answer, focusTokens }) {
  if (mode !== "single" || !genericPopulationAnswer(answer.text)) return { adjustment: 0, evidence: null };
  if (/^(?:всем|все)\s+(?:пациент|больн|пострадав)/u.test(normalizeText(question))) return { adjustment: 0, evidence: null };
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 8);
  let best = null;

  for (const page of pages) {
    if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
    for (const phrase of answerPhrases) {
      const phraseNorm = normalizeForSearch(phrase);
      if (!phraseNorm || phraseNorm.length < 5) continue;
      const hits = findPhraseOccurrences(page.normalized, phrase, { textIsNormalized: true });
      for (const hit of hits) {
        const after = page.normalized.slice(hit + phraseNorm.length, hit + phraseNorm.length + 520);
        const hasCondition =
          containsNormalizedPhrase(after, "при") ||
          containsNormalizedPhrase(after, "с целью") ||
          containsNormalizedPhrase(after, "при наличии") ||
          containsNormalizedPhrase(after, "при развитии");
        if (!hasCondition) continue;
        const focusCoverage = coverage(focusTokens, tokenizeNormalized(after));
        if (focusCoverage < 0.12) continue;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: evidenceSnippet(page.text, answer.text, question),
          score: 3.0 + focusCoverage * 4.0,
          kind: "generic_population_condition_penalty",
        });
      }
    }
  }

  return best ? { adjustment: -10.4, evidence: best } : { adjustment: 0, evidence: null };
}

export function genericPopulationConditionAdjustmentForMode(context) {
  const { mode, pages, topQuestionPages, question, answer, answers, focusTokens } = context;
  if (mode !== "multi") return genericPopulationConditionAdjustment(context);
  if (!genericPopulationAnswer(answer.text)) return { adjustment: 0, evidence: null };
  if (genericPopulationAnswer(question)) return { adjustment: 0, evidence: null };
  if (!containsNormalizedPhrase(normalizeForSearch(question), "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434")) return { adjustment: 0, evidence: null };
  if (!hasSpecificPopulationAlternative(answers, answer)) return { adjustment: 0, evidence: null };
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 8);
  let best = null;

  for (const page of pages) {
    if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
    for (const phrase of answerPhrases) {
      const phraseNorm = normalizeForSearch(phrase);
      if (!phraseNorm || phraseNorm.length < 5) continue;
      const hits = findPhraseOccurrences(page.normalized, phrase, { textIsNormalized: true });
      for (const hit of hits) {
        const after = page.normalized.slice(hit + phraseNorm.length, hit + phraseNorm.length + 520);
        const hasCondition =
          containsNormalizedPhrase(after, "\u043f\u0440\u0438") ||
          containsNormalizedPhrase(after, "\u0441 \u0446\u0435\u043b\u044c\u044e") ||
          containsNormalizedPhrase(after, "\u0434\u043b\u044f") ||
          containsNormalizedPhrase(after, "\u0441\u0442\u0435\u043f\u0435\u043d") ||
          containsNormalizedPhrase(after, "\u0442\u044f\u0436\u0435\u043b");
        if (!hasCondition) continue;
        const focusCoverage = coverage(focusTokens, tokenizeNormalized(after));
        if (focusCoverage < 0.12) continue;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: evidenceSnippet(page.text, answer.text, question),
          score: 3.0 + focusCoverage * 4.0,
          kind: "generic_population_condition_penalty",
        });
      }
    }
  }

  return best ? { adjustment: -5.2, evidence: best } : { adjustment: 0, evidence: null };
}

function populationStem(answerText) {
  const tokens = uniqueTokens(answerText);
  const stems = ["\u043f\u0430\u0446\u0438\u0435\u043d\u0442", "\u043f\u043e\u0441\u0442\u0440\u0430\u0434", "\u0431\u043e\u043b\u044c\u043d"].map((item) => normalizeForSearch(item));
  return tokens.find((token) => stems.some((stem) => token.startsWith(stem.slice(0, Math.min(8, stem.length))))) ?? null;
}

function hasSpecificPopulationAlternative(answers, genericAnswer) {
  const stem = populationStem(genericAnswer.text);
  if (!stem) return false;
  return (answers ?? []).some((candidate) => {
    if (candidate.id === genericAnswer.id) return false;
    const normalized = normalizeForSearch(candidate.text);
    const candidateTokens = uniqueTokens(candidate.text);
    if (!candidateTokens.some((token) => token.startsWith(stem.slice(0, Math.min(8, stem.length))))) return false;
    return (
      containsNormalizedPhrase(normalized, "\u0441\u0440\u0435\u0434\u043d") ||
      containsNormalizedPhrase(normalized, "\u0442\u044f\u0436\u0435\u043b") ||
      containsNormalizedPhrase(normalized, "\u0441\u0442\u0435\u043f\u0435\u043d") ||
      containsNormalizedPhrase(normalized, "\u043f\u0440\u0438 \u043d\u0430\u043b\u0438\u0447") ||
      containsNormalizedPhrase(normalized, "\u0441 \u043d\u0430\u043b\u0438\u0447")
    );
  });
}

function questionClassSubject(question) {
  const raw = normalizeText(question);
  const match = raw.match(/^(.+?)\s+относят\s+к\s+классу/u);
  if (!match?.[1]) return null;
  const subject = match[1].trim();
  return subject.length >= 4 ? subject : null;
}

function romanClassVariants(answerText) {
  const raw = normalizeText(answerText).replace(/\s+/g, "");
  const variants = new Set();
  const romanMap = new Map([
    ["i", "1"],
    ["ii", "2"],
    ["iii", "3"],
    ["iv", "4"],
    ["v", "5"],
  ]);
  if (romanMap.has(raw)) {
    variants.add(raw);
    variants.add(romanMap.get(raw));
  }
  const numeric = extractNumbers(answerText)[0];
  if (numeric) {
    variants.add(numeric);
    for (const [roman, value] of romanMap.entries()) if (value === numeric) variants.add(roman);
  }
  return [...variants].map((item) => normalizeForSearch(item)).filter(Boolean);
}

export function bestClassSubjectSupport({ pages, question, answer }) {
  const subject = questionClassSubject(question);
  const variants = romanClassVariants(answer.text);
  if (!subject || !variants.length) return null;
  const subjectTokens = uniqueTokens(subject);
  let best = null;

  for (const page of pages) {
    for (const segment of cachedLineTokenSegments(page)) {
      if (!containsNormalizedPhrase(segment.normalized, "класс")) continue;
      const subjectCoverage = coverage(subjectTokens, segment.tokens);
      if (subjectCoverage < 0.65) continue;
      const hasAnswerClass = variants.some((variant) => tokenBoundaryIncludes(segment.normalized, variant));
      if (!hasAnswerClass) continue;
      const score = 10.8 + subjectCoverage * 4.0;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text: segment.text,
        score,
        kind: "subject_class_line",
      });
    }
  }

  return best;
}
