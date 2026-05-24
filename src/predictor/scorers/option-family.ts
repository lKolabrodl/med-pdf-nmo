import { extractNumbers, normalizeForSearch, uniqueTokens } from "../../normalize.js";
import { containsNormalizedPhrase } from "../text-utils.js";

type ComparatorDirection = "less" | "greater";

type ComparatorSpec = {
  number: string;
  direction: ComparatorDirection;
};

const LESS_CUES = ["\u0434\u043e", "\u043c\u0435\u043d\u0435\u0435", "\u043c\u0435\u043d\u044c\u0448\u0435", "\u043d\u0438\u0436\u0435", "\u043c\u043e\u043b\u043e\u0436\u0435"].map((item) =>
  normalizeForSearch(item),
);

const GREATER_CUES = ["\u0431\u043e\u043b\u0435\u0435", "\u0431\u043e\u043b\u044c\u0448\u0435", "\u0432\u044b\u0448\u0435", "\u0441\u0432\u044b\u0448\u0435", "\u0441\u0442\u0430\u0440\u0448\u0435"].map((item) =>
  normalizeForSearch(item),
);

const COMBO_QUESTION_CUES = [
  "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434",
  "\u043d\u0430\u0437\u043d\u0430\u0447",
  "\u043f\u0440\u0438\u043c\u0435\u043d",
  "\u0442\u0435\u0440\u0430\u043f",
  "\u043b\u0435\u0447\u0435\u043d",
].map((item) => normalizeForSearch(item));

const COMBO_GENERIC_TOKENS = new Set(
  [
    "\u043c\u043e\u043d\u043e\u0442\u0435\u0440\u0430\u043f\u0438\u044f",
    "\u043c\u043e\u043d\u043e\u0442\u0435\u0440\u0430\u043f\u0438\u044e",
    "\u043a\u043e\u043c\u0431\u0438\u043d\u0430\u0446\u0438\u044f",
    "\u043a\u043e\u043c\u0431\u0438\u043d\u0430\u0446\u0438\u044e",
    "\u0438\u043b\u0438",
    "\u0433\u0440\u0443\u043f\u043f",
    "\u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442",
    "\u043d\u0430\u0437\u043d\u0430\u0447",
    "\u043f\u0440\u0438\u043c\u0435\u043d",
  ].flatMap((item) => uniqueTokens(item)),
);

const COMBO_UNIT_PARTS = new Set(["m\u0433", "m\u043b", "k\u0433", "me", "mm", "m\u0438h", "cyt", "\u0434h", "pa\u0437", "mg", "ml", "kg"]);

/**
 * \u0412\u044b\u0434\u0435\u043b\u044f\u0435\u0442 \u043d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0441\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u044f \u0432 \u043e\u0442\u0432\u0435\u0442\u0435: `<50`, `>50`, `\u043c\u0435\u043d\u0435\u0435 50`, `\u0431\u043e\u043b\u0435\u0435 50`.
 *
 * \u042d\u0442\u043e \u043d\u0435 \u0437\u043d\u0430\u043d\u0438\u0435 \u043e \u043a\u043e\u043d\u043a\u0440\u0435\u0442\u043d\u043e\u0439 \u0431\u043e\u043b\u0435\u0437\u043d\u0438: \u043c\u044b \u043b\u0438\u0448\u044c \u043f\u043e\u043d\u0438\u043c\u0430\u0435\u043c, \u0447\u0442\u043e \u0432\u0430\u0440\u0438\u0430\u043d\u0442\u044b \u043e\u0434\u043d\u043e\u0433\u043e
 * \u0447\u0438\u0441\u043b\u043e\u0432\u043e\u0433\u043e \u0441\u0435\u043c\u0435\u0439\u0441\u0442\u0432\u0430 \u043c\u043e\u0433\u0443\u0442 \u043e\u0442\u043b\u0438\u0447\u0430\u0442\u044c\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u0437\u043d\u0430\u043a\u043e\u043c \u0441\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u044f.
 */
function answerComparatorSpecs(answerText: string): ComparatorSpec[] {
  const normalized = normalizeForSearch(answerText);
  const numbers = extractNumbers(answerText).map((number) => number.replace(",", "."));
  const specs: ComparatorSpec[] = [];

  for (const number of numbers) {
    const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const lessPattern = new RegExp(`(?:<|\\b(?:${LESS_CUES.join("|")})\\b\\s*)${escaped}(?:\\b|\\s|%|$)`, "iu");
    const greaterPattern = new RegExp(`(?:>|\\b(?:${GREATER_CUES.join("|")})\\b\\s*)${escaped}(?:\\b|\\s|%|$)`, "iu");
    if (lessPattern.test(normalized)) specs.push({ number, direction: "less" });
    if (greaterPattern.test(normalized)) specs.push({ number, direction: "greater" });
  }

  return specs;
}

function opposite(direction: ComparatorDirection): ComparatorDirection {
  return direction === "less" ? "greater" : "less";
}

function answerFamilyHasOppositeComparator(answer: { id: string; text: string }, answers: Array<{ id: string; text: string }>, spec: ComparatorSpec) {
  return answers.some((candidate) => {
    if (candidate.id === answer.id) return false;
    return answerComparatorSpecs(candidate.text).some((candidateSpec) => candidateSpec.number === spec.number && candidateSpec.direction === opposite(spec.direction));
  });
}

function sourceDirectionsForNumber(text: string, number: string) {
  const normalized = normalizeForSearch(text).replace(/\u2264/gu, "<").replace(/\u2265/gu, ">");
  const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const directions = new Set<ComparatorDirection>();
  const pattern = new RegExp(escaped, "giu");

  for (const match of normalized.matchAll(pattern)) {
    const index = match.index ?? 0;
    const before = normalized.slice(Math.max(0, index - 26), index).trim();
    const after = normalized.slice(index + match[0].length, Math.min(normalized.length, index + match[0].length + 12));
    const local = `${before} ${match[0]} ${after}`;
    const previous = before.split(/\s+/u).filter(Boolean).slice(-3).join(" ");

    if (/[<]\s*$/u.test(before) || LESS_CUES.some((cue) => containsNormalizedPhrase(previous, cue))) directions.add("less");
    if (/[>]\s*$/u.test(before) || GREATER_CUES.some((cue) => containsNormalizedPhrase(previous, cue))) directions.add("greater");
    if (containsNormalizedPhrase(local, normalizeForSearch(`\u043d\u0435 \u043c\u0435\u043d\u0435\u0435 ${number}`))) directions.add("greater");
    if (containsNormalizedPhrase(local, normalizeForSearch(`\u043d\u0435 \u0431\u043e\u043b\u0435\u0435 ${number}`))) directions.add("less");
  }

  return directions;
}

/**
 * \u0428\u0442\u0440\u0430\u0444\u0443\u0435\u0442 \u0432\u0430\u0440\u0438\u0430\u043d\u0442, \u0435\u0441\u043b\u0438 \u043e\u043d \u043e\u0442\u043d\u043e\u0441\u0438\u0442\u0441\u044f \u043a \u043f\u043b\u043e\u0442\u043d\u043e\u043c\u0443 \u0447\u0438\u0441\u043b\u043e\u0432\u043e\u043c\u0443 \u0441\u0435\u043c\u0435\u0439\u0441\u0442\u0432\u0443 \u0438 \u0435\u0433\u043e
 * evidence \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u043f\u0440\u043e\u0442\u0438\u0432\u043e\u043f\u043e\u043b\u043e\u0436\u043d\u044b\u0439 \u0437\u043d\u0430\u043a \u0441\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u044f \u0434\u043b\u044f \u0442\u043e\u0433\u043e \u0436\u0435 \u0447\u0438\u0441\u043b\u0430.
 */
export function optionFamilyComparatorAdjustment({
  answer,
  answers,
  evidence,
}: {
  answer: { id: string; text: string };
  answers: Array<{ id: string; text: string }>;
  evidence: Array<{ answerId?: string; page: number; text: string; score: number; kind: string }>;
}) {
  const answerSpecs = answerComparatorSpecs(answer.text);
  if (answerSpecs.length !== 1) return { adjustment: 0, evidence: null };
  const specs = answerSpecs.filter((spec) => answerFamilyHasOppositeComparator(answer, answers, spec));
  if (!specs.length) return { adjustment: 0, evidence: null };

  for (const item of evidence) {
    if ((item.score ?? 0) < 5.5 || !item.text) continue;
    for (const spec of specs) {
      const sourceDirections = sourceDirectionsForNumber(item.text, spec.number);
      if (!sourceDirections.size || sourceDirections.has(spec.direction)) continue;
      if (!sourceDirections.has(opposite(spec.direction))) continue;
      return {
        adjustment: -4.2,
        evidence: {
          answerId: answer.id,
          page: item.page,
          text: item.text,
          score: Math.max(6.8, Math.min(12.5, item.score)),
          kind: "option_family_comparator_mismatch",
        },
      };
    }
  }

  return { adjustment: 0, evidence: null };
}

function compactComboPhrases(answerText: string) {
  const normalized = normalizeForSearch(answerText);
  const phrases = new Set<string>();
  for (const match of normalized.matchAll(/[a-z\u0430-\u044f0-9]{2,}(?:[+/][a-z\u0430-\u044f0-9]{2,})+/giu)) {
    if (validCompactComboPhrase(match[0])) phrases.add(match[0]);
  }
  return [...phrases].filter((phrase) => phrase.length >= 5);
}

function validCompactComboPhrase(phrase: string) {
  const parts = phrase.split(/[+/]/u).filter(Boolean);
  if (parts.length < 2) return false;
  return parts.every((part) => part.length >= 3 && part.length <= 10 && !COMBO_UNIT_PARTS.has(part) && !/^\d/u.test(part));
}

function comboQuestion(question: string) {
  const normalized = normalizeForSearch(question);
  return COMBO_QUESTION_CUES.some((cue) => normalized.includes(cue));
}

function alternativeComboTokens(answerText: string) {
  const normalized = normalizeForSearch(answerText);
  const alternative = containsNormalizedPhrase(normalized, "\u0438\u043b\u0438") || containsNormalizedPhrase(normalized, "\u043c\u043e\u043d\u043e\u0442\u0435\u0440\u0430\u043f");
  if (!alternative) return [];
  return uniqueTokens(answerText).filter((token) => token.length >= 3 && !/^\d/u.test(token) && !COMBO_GENERIC_TOKENS.has(token)).slice(0, 8);
}

function evidenceHasCompactTokenPair(text: string, tokens: string[]) {
  const normalized = normalizeForSearch(text);
  if (!/[+/]/u.test(normalized)) return false;
  for (let leftIndex = 0; leftIndex < tokens.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < tokens.length; rightIndex += 1) {
      const left = tokens[leftIndex];
      const right = tokens[rightIndex];
      const leftHit = normalized.indexOf(left);
      const rightHit = normalized.indexOf(right);
      if (leftHit < 0 || rightHit < 0) continue;
      const start = Math.min(leftHit, rightHit);
      const end = Math.max(leftHit + left.length, rightHit + right.length);
      if (end - start > 56) continue;
      const local = normalized.slice(start, end);
      if (/[+/]/u.test(local) && !containsNormalizedPhrase(local, "\u0438\u043b\u0438")) return true;
    }
  }
  return false;
}

/**
 * \u0423\u0442\u043e\u0447\u043d\u044f\u0435\u0442 \u043f\u043b\u043e\u0442\u043d\u044b\u0435 \u0432\u0430\u0440\u0438\u0430\u043d\u0442\u044b \u043b\u0435\u0447\u0435\u043d\u0438\u044f, \u0433\u0434\u0435 `A/B` \u0438 `A \u0438\u043b\u0438 B` \u0438\u043c\u0435\u044e\u0442 \u0440\u0430\u0437\u043d\u044b\u0439 \u0441\u043c\u044b\u0441\u043b.
 *
 * \u041f\u0440\u0430\u0432\u0438\u043b\u043e \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u0432 \u0432\u043e\u043f\u0440\u043e\u0441\u0430\u0445 \u043e \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0438/\u0442\u0435\u0440\u0430\u043f\u0438\u0438 \u0438 \u0438\u0449\u0435\u0442 \u0441\u0430\u043c\u0443 \u0444\u043e\u0440\u043c\u0443
 * \u0437\u0430\u043f\u0438\u0441\u0438, \u0430 \u043d\u0435 \u043c\u0435\u0434\u0438\u0446\u0438\u043d\u0441\u043a\u0438\u0439 \u0444\u0430\u043a\u0442.
 */
export function optionFamilyCompactComboAdjustment({
  question,
  answer,
  evidence,
}: {
  question: string;
  answer: { id: string; text: string };
  evidence: Array<{ answerId?: string; page: number; text: string; score: number; kind: string }>;
}) {
  if (!comboQuestion(question)) return { adjustment: 0, evidence: null };
  const comboPhrases = compactComboPhrases(answer.text);
  const alternativeTokens = alternativeComboTokens(answer.text);

  for (const item of evidence) {
    if ((item.score ?? 0) < 5.5 || !item.text) continue;
    const normalizedEvidence = normalizeForSearch(item.text);
    if (comboPhrases.some((phrase) => normalizedEvidence.includes(phrase))) {
      return {
        adjustment: 6.8,
        evidence: {
          answerId: answer.id,
          page: item.page,
          text: item.text,
          score: Math.max(9.2, Math.min(14.5, item.score + 1.1)),
          kind: "option_family_compact_combo_match",
        },
      };
    }
    if (alternativeTokens.length >= 2 && evidenceHasCompactTokenPair(item.text, alternativeTokens)) {
      return {
        adjustment: -6.4,
        evidence: {
          answerId: answer.id,
          page: item.page,
          text: item.text,
          score: Math.max(7.2, Math.min(13.0, item.score)),
          kind: "option_family_compact_combo_mismatch",
        },
      };
    }
  }

  return { adjustment: 0, evidence: null };
}
