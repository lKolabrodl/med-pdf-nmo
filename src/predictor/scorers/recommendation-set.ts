import { normalizeForSearch, uniqueTokens } from "../../normalize.js";
import { FOCUS_STOPWORDS } from "../constants.js";
import { buildAtomicRecommendationSegments } from "./recommendation-item.js";
import { containsNormalizedPhrase, strictSoftCoverage, tokenizeNormalized, tokenHitCount } from "../text-utils.js";

type AnswerOption = { id: string; text: string };

export type RepeatedRecommendationSetResolution = Map<
  string,
  {
    adjustment: number;
    evidence: { answerId: string; page: number; text: string; score: number; kind: string };
  }
>;

const QUESTION_GENERIC = new Set(
  uniqueTokens(
    [
      "рекомендовано рекомендуется рекомендовать",
      "проведение проводить выполнение выполнять регистрация",
      "пациент пациентам пациентов",
      "этап подготовка подготовки",
      "лекарственный препарат препараты",
      "всем все",
    ].join(" "),
  ),
);

const TARGET_GENERIC = new Set(
  uniqueTokens(
    [
      "рекомендовано рекомендуется рекомендовать",
      "проведение проводить выполнение выполнять",
      "регистрация исследование обследование",
      "описание расшифровка интерпретация данные",
    ].join(" "),
  ),
);

function repeatedRecommendationQuestion(mode: string, question: string) {
  if (mode !== "multi") return false;
  const clean = rawRussianText(question);
  return (
    /рекоменд/u.test(clean) &&
    /(?:всем|все)\s+пациент/u.test(clean) &&
    /(?:проведение|выполнение|регистрация|исследование)\s*[?.!:;]*$/u.test(clean)
  );
}

function rawRussianText(text: string) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/ё/gu, "е")
    .replace(/\s+/gu, " ")
    .trim();
}

function recommendationContextTokens(question: string) {
  return uniqueTokens(question).filter(
    (token) => token.length >= 4 && !FOCUS_STOPWORDS.has(token) && !QUESTION_GENERIC.has(token) && !/^\d+$/u.test(token),
  );
}

function recommendationTargetText(text: string) {
  const clean = rawRussianText(text);
  const cue = clean.match(/(?:не\s+)?рекоменд(?:овано|уется|ованы|ован|овать)?\s+/u);
  const start = cue?.index == null ? 0 : cue.index + cue[0].length;
  const tail = clean.slice(start);
  const audience = tail.search(/\b(?:всем|все[хм]?|пациент(?:ам|ов|ы|у|а)?)\b/u);
  return (audience >= 12 ? tail.slice(0, audience) : tail.slice(0, 260)).trim();
}

function commonPrefixLength(left: string, right: string) {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) index += 1;
  return index;
}

/**
 * Названия диагностического метода и его результата часто отличаются только
 * продуктивным окончанием: "…графия" / "…грамма". Для длинных терминов
 * безопаснее сравнить общий уникальный префикс, чем заводить словарь фактов.
 */
function longMedicalTokenMatch(answerToken: string, targetToken: string) {
  if (answerToken.length < 12 || targetToken.length < 12) return false;
  const prefix = commonPrefixLength(answerToken, targetToken);
  return prefix >= 11 && prefix / Math.min(answerToken.length, targetToken.length) >= 0.72;
}

function answerTargetSupport(answer: AnswerOption, targetText: string) {
  const answerNorm = normalizeForSearch(answer.text);
  const targetNorm = normalizeForSearch(targetText);
  const answerTokens = uniqueTokens(answer.text).filter((token) => token.length >= 4 && !TARGET_GENERIC.has(token));
  const targetTokens = tokenizeNormalized(targetNorm);
  if (!answerTokens.length || !targetTokens.length) return { matched: false, coverage: 0 };

  const phraseHit =
    answerNorm.length >= 7 &&
    (containsNormalizedPhrase(targetNorm, answerNorm) || containsNormalizedPhrase(answerNorm, targetNorm));
  const lexicalCoverage = strictSoftCoverage(answerTokens, targetTokens);
  const tokenMatches = answerTokens.filter((answerToken) =>
    targetTokens.some((targetToken) => answerToken === targetToken || longMedicalTokenMatch(answerToken, targetToken)),
  ).length;
  const derivationalCoverage = tokenMatches / answerTokens.length;
  const coverage = Math.max(lexicalCoverage, derivationalCoverage);
  return {
    matched: phraseHit || coverage >= (answerTokens.length === 1 ? 0.82 : 0.68),
    coverage,
  };
}

/**
 * Декодирует несколько независимых рекомендаций с одинаковой популяцией:
 * каждый вариант должен совпасть с целевой частью собственного атомарного
 * пункта, а не с общим широким окном страницы.
 */
export function resolveRepeatedRecommendationSet({
  mode,
  pages,
  question,
  answers,
}: {
  mode: string;
  pages: any[];
  question: string;
  answers: AnswerOption[];
}): RepeatedRecommendationSetResolution {
  if (!repeatedRecommendationQuestion(mode, question)) return new Map();
  const contextTokens = recommendationContextTokens(question);
  if (contextTokens.length < 3) return new Map();

  const matchedByAnswer = new Map<
    string,
    { answer: AnswerOption; page: number; text: string; coverage: number; contextCoverage: number }
  >();
  const matchingSegments = new Set<string>();

  for (const segment of buildAtomicRecommendationSegments(pages)) {
    const clean = rawRussianText(segment.text);
    if (!/рекоменд/u.test(clean) || /не\s+рекоменд/u.test(clean)) continue;
    const segmentTokens = uniqueTokens(segment.text);
    const contextHits = tokenHitCount(contextTokens, segmentTokens);
    const contextCoverage = strictSoftCoverage(contextTokens, segmentTokens);
    // Аббревиатура заболевания в рекомендации часто заменяет несколько
    // полных токенов вопроса, поэтому двух редких контекстных совпадений
    // достаточно при одновременном наличии повторных атомарных пунктов.
    if (contextHits < 2 || contextCoverage < 0.3) continue;

    const targetText = recommendationTargetText(segment.text);
    if (targetText.length < 6) continue;
    for (const answer of answers) {
      const support = answerTargetSupport(answer, targetText);
      if (!support.matched) continue;
      const previous = matchedByAnswer.get(answer.id);
      if (!previous || support.coverage + contextCoverage > previous.coverage + previous.contextCoverage) {
        matchedByAnswer.set(answer.id, {
          answer,
          page: segment.page,
          text: segment.text,
          coverage: support.coverage,
          contextCoverage,
        });
      }
      matchingSegments.add(`${segment.page}|${normalizeForSearch(segment.text)}`);
    }
  }

  if (matchedByAnswer.size < 2 || matchedByAnswer.size >= answers.length || matchingSegments.size < 2) return new Map();
  return new Map(
    [...matchedByAnswer.values()].map((item) => [
      item.answer.id,
      {
        adjustment: 0,
        evidence: {
          answerId: item.answer.id,
          page: item.page,
          text: item.text,
          score: 25.4 + Math.min(2.2, item.coverage * 1.3 + item.contextCoverage),
          kind: "repeated_recommendation_target",
        },
      },
    ]),
  );
}
