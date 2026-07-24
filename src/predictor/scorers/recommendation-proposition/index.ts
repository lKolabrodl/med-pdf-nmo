import { normalizeForSearch, normalizeText, uniqueTokens } from "../../../normalize.js";
import type { PdfLinePage } from "../../../pdf.js";
import { FOCUS_STOPWORDS } from "../../constants.js";
import {
  buildAtomicRecommendationSegments,
  type RecommendationSegment,
} from "../recommendation-item/index.js";
import { strictSoftCoverage, tokenHitCount } from "../../text-utils.js";

type AnswerOption = { id: string; text: string };

export type RecommendationPropositionResolution = Map<
  string,
  {
    adjustment: number;
    evidence: { answerId: string; page: number; text: string; score: number; kind: string } | null;
  }
>;

const QUESTION_GENERIC = new Set(
  uniqueTokens(
    [
      "рекомендовано рекомендуется рекомендовать",
      "является является ли считать",
      "пациент пациентам пациентов",
      "операция операции лечение лечения",
      "проводить выполнять осуществлять",
      "время ходе поводу наличие",
      "какой каким когда ли",
    ].join(" "),
  ),
);

function propositionQuestion(question: string) {
  const clean = normalizeText(question);
  return /рекоменд|следует|является\s+ли|противопоказ/u.test(clean);
}

export function recommendationTargetTokens(question: string) {
  return uniqueTokens(question).filter(
    (token) => token.length >= 4 && !FOCUS_STOPWORDS.has(token) && !QUESTION_GENERIC.has(token) && !/^\d+$/u.test(token),
  );
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

type Proposition = {
  polarity: "positive" | "negative" | null;
  universal: boolean;
  restricted: boolean;
  irrelevant: boolean;
};

export function recommendationPropositionFeatures(text: string, contraindicationQuestion: boolean, isAnswer = false): Proposition {
  const clean = normalizeText(text);
  const irrelevant = /не\s+имеет\s+значения|по\s+усмотрению|на\s+выбор/u.test(clean);
  let polarity: Proposition["polarity"] = null;
  if (contraindicationQuestion) {
    if (/не\s+(?:является|считать|считается)|нет\b|не\s+противопоказ/u.test(clean)) polarity = "negative";
    else if (/является|считать\s+противопоказ|противопоказ/u.test(clean)) polarity = "positive";
  } else {
    if (/не\s+рекоменд|не\s+следует|нет\b|никогда\s+не/u.test(clean)) polarity = "negative";
    else if (/рекоменд|следует|необходимо|обязательн/u.test(clean)) polarity = "positive";
    else if (isAnswer && !irrelevant) polarity = "positive";
  }

  const universal = hasAny(clean, [
    /(?:^|\s)всем(?:\s|$)|(?:^|\s)все[хм]?\s+случа/u,
    /люб(?:ой|ым|ого|ом)\s+тип/u,
    /независим/u,
    /обязательн/u,
    /как\s+при\s.{0,100}так\s+и/u,
  ]);
  const restricted = hasAny(clean, [
    /(?:^|\s)только(?:\s|$)|(?:^|\s)лишь(?:\s|$)/u,
    /(?:^|\s)если(?:\s|$)|(?:^|\s)в\s+случае(?:\s|$)/u,
    /(?:^|\s)при\s+налич/u,
    /(?:^|\s)всем\s+.{0,180}\s+при\s+/u,
  ]);
  return { polarity, universal, restricted, irrelevant };
}

function featureKey(feature: Proposition) {
  return `${feature.polarity ?? "unknown"}:${feature.universal ? "all" : feature.restricted ? "restricted" : feature.irrelevant ? "irrelevant" : "plain"}`;
}

function optionCompatibility(source: Proposition, answer: Proposition) {
  let score = 0;
  if (source.polarity && answer.polarity) score += source.polarity === answer.polarity ? 2.4 : -3.4;
  else if (source.polarity && !answer.polarity) score -= 0.8;
  if (source.irrelevant || answer.irrelevant) score += source.irrelevant === answer.irrelevant ? 1.8 : -2.2;
  // A universal determiner can still introduce a restricted population:
  // "all participants with condition X" is not the same as "all participants".
  if (source.universal && !source.restricted) {
    if (answer.universal) score += 2.3;
    if (answer.restricted) score -= 2.6;
  } else if (!source.restricted && source.polarity === "positive") {
    if (answer.restricted) score -= 1.7;
    if (answer.universal) score += 0.8;
  }
  if (source.restricted) {
    if (answer.restricted) score += 1.9;
    if (answer.universal && !answer.restricted) score -= 2.6;
  }
  return score;
}

function physicalRecommendationBlockSegments(
  pages: PdfLinePage[],
): RecommendationSegment[] {
  const segments: RecommendationSegment[] = [];
  for (const page of pages ?? []) {
    for (const block of page.blocks ?? []) {
      const text = String(block?.text ?? "").replace(/\s+/gu, " ").trim();
      if (text.length < 24 || !/^\s*[•\uF0B7\u25AA\u25E6*\-]\s+/u.test(text)) continue;
      if (!/рекоменд/iu.test(normalizeText(text))) continue;
      segments.push({ page: page.page, text, normalized: normalizeForSearch(text) });
    }
  }
  return segments;
}

/**
 * Resolves a single yes/no/quantifier option family from one atomic source
 * recommendation. Target lookup and proposition comparison are separate so
 * a condition from a neighboring recommendation cannot become the answer.
 */
export function resolveRecommendationProposition({
  mode,
  pages,
  question,
  answers,
}: {
  mode: string;
  pages: PdfLinePage[];
  question: string;
  answers: AnswerOption[];
}): RecommendationPropositionResolution {
  if (mode !== "single" || !propositionQuestion(question)) return new Map();
  const qTokens = recommendationTargetTokens(question);
  if (qTokens.length < 2) return new Map();
  const contraindicationQuestion = /противопоказ/u.test(normalizeText(question));
  const answerFeatures = answers.map((answer) => ({ answer, feature: recommendationPropositionFeatures(answer.text, contraindicationQuestion, true) }));
  if (new Set(answerFeatures.map((item) => featureKey(item.feature))).size < 2) return new Map();

  const segments = [
    ...new Map(
      [...buildAtomicRecommendationSegments(pages), ...physicalRecommendationBlockSegments(pages)].map((segment) => [
        `${segment.page}|${segment.normalized}`,
        segment,
      ]),
    ).values(),
  ];
  const documentFrequency = new Map<string, number>();
  for (const segment of segments) {
    for (const token of new Set(uniqueTokens(segment.text))) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const positiveQuestionFrequencies = qTokens.map((token) => documentFrequency.get(token) ?? 0).filter((value) => value > 0);
  const minimumQuestionFrequency = positiveQuestionFrequencies.length ? Math.min(...positiveQuestionFrequencies) : 1;
  const rareLimit = Math.max(2, Math.min(Math.ceil(segments.length * 0.18), minimumQuestionFrequency + 1));
  const rareQuestionTokens = qTokens.filter((token) => {
    const frequency = documentFrequency.get(token) ?? 0;
    return frequency > 0 && frequency <= rareLimit;
  });
  const discriminativeTokens = rareQuestionTokens.length ? rareQuestionTokens : qTokens;

  const segmentCandidates = segments
    .map((segment) => {
      const tokens = uniqueTokens(segment.text);
      const hits = tokenHitCount(qTokens, tokens);
      const coverage = strictSoftCoverage(qTokens, tokens);
      const distinctiveHits = tokenHitCount(discriminativeTokens, tokens);
      const distinctiveCoverage = strictSoftCoverage(discriminativeTokens, tokens);
      return {
        segment,
        hits,
        coverage,
        distinctiveHits,
        distinctiveCoverage,
        strength: distinctiveCoverage * 1.25 + coverage * 0.45 + Math.min(0.55, distinctiveHits * 0.12),
      };
    })
    // Russian inflection often changes the exact token ending between the
    // question and a recommendation. Keep rarity as a soft anchor instead of
    // requiring one byte-identical rare token.
    .filter((item) => item.hits >= 2 && item.coverage >= 0.28 && item.distinctiveCoverage >= 0.34)
    .sort((left, right) => right.strength - left.strength);
  if (!segmentCandidates.length) return new Map();

  const bestSegment = segmentCandidates[0];
  const distinctCompetitor = segmentCandidates.find(
    (item) =>
      item.segment.page !== bestSegment.segment.page &&
      !item.segment.normalized.includes(bestSegment.segment.normalized) &&
      !bestSegment.segment.normalized.includes(item.segment.normalized),
  );
  if (distinctCompetitor && bestSegment.strength - distinctCompetitor.strength < 0.1) return new Map();

  const sourceFeature = recommendationPropositionFeatures(bestSegment.segment.text, contraindicationQuestion);
  if (!sourceFeature.polarity && !sourceFeature.universal && !sourceFeature.restricted && !sourceFeature.irrelevant) return new Map();
  // Quantifier-only comparison cannot identify which restriction is intended
  // ("only for X" versus "only for Y"). Defer restricted propositions to the
  // lexical scorers, which compare the conditions themselves.
  if (sourceFeature.restricted) return new Map();
  const ranked = answerFeatures
    .map((item) => ({ ...item, score: optionCompatibility(sourceFeature, item.feature) }))
    .sort((left, right) => right.score - left.score);
  if (!ranked[0] || ranked[0].score < 1.8 || (ranked[1] && ranked[0].score - ranked[1].score < 1.15)) return new Map();

  const winner = ranked[0];
  return new Map([
    [
      winner.answer.id,
      {
        adjustment: 0,
        evidence: {
          answerId: winner.answer.id,
          page: bestSegment.segment.page,
          text: bestSegment.segment.text,
          score: 27 + Math.min(2.4, bestSegment.strength),
          kind: "recommendation_proposition",
        },
      },
    ],
  ]);
}
