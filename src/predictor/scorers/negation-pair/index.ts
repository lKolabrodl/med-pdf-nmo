import { normalizeForSearch, normalizeText, RUSSIAN_STOPWORDS, stemToken, uniqueTokens } from "../../../normalize.js";
import type { PdfLinePage } from "../../../pdf.js";
import { FOCUS_STOPWORDS } from "../../constants.js";
import { rawTokens, strictSoftCoverage, tokenizeNormalized } from "../../text-utils.js";
import type { AnswerScore } from "../../types.js";
import { buildRelationTupleFragments } from "../relation-tuple/index.js";

type AnswerOption = { id: string; text: string };
type PairMember = { answer: AnswerOption; polarity: "positive" | "negative" };
type NegationPair = { positive: PairMember; negative: PairMember; skeleton: string[] };
type PolarityProof = { answerId: string; page: number; text: string; polarity: "positive" | "negative" };

const NEGATIVE_WORDS = new Set(["\u043d\u0435", "\u0431\u0435\u0437", "\u043d\u0435\u043b\u044c\u0437\u044f"]);
const NEGATIVE_PREFIXES = ["\u043e\u0442\u0441\u0443\u0442\u0441\u0442\u0432", "\u043d\u0435\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434", "\u043d\u0435\u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b"];
const QUESTION_GENERIC = new Set(
  [
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442\u0430\u043c",
    "\u044f\u0432\u043b\u044f\u0435\u0442\u0441\u044f",
    "\u043e\u0442\u043d\u043e\u0441\u0438\u0442\u0441\u044f",
  ].flatMap((item) => uniqueTokens(item)),
);

function explicitNegativeWord(word: string) {
  return NEGATIVE_WORDS.has(word) || NEGATIVE_PREFIXES.some((prefix) => word.startsWith(prefix));
}

function hasExplicitNegation(text: string) {
  return rawTokens(text).some(explicitNegativeWord);
}

function optionSkeleton(text: string) {
  return rawTokens(text)
    .filter((word) => !explicitNegativeWord(word) && !RUSSIAN_STOPWORDS.has(word))
    .map(stemToken)
    .filter((word) => word.length >= 3)
    .sort();
}

function buildNegationPair(answers: AnswerOption[]): NegationPair | null {
  if (answers.length < 2) return null;
  const members = answers.map((answer) => ({
    answer,
    polarity: hasExplicitNegation(answer.text) ? ("negative" as const) : ("positive" as const),
    skeleton: optionSkeleton(answer.text),
  }));
  const pairs: NegationPair[] = [];
  for (let left = 0; left < members.length; left += 1) {
    for (let right = left + 1; right < members.length; right += 1) {
      const a = members[left];
      const b = members[right];
      if (a.polarity === b.polarity || !a.skeleton.length || a.skeleton.join("|") !== b.skeleton.join("|")) continue;
      const positive = a.polarity === "positive" ? a : b;
      const negative = a.polarity === "negative" ? a : b;
      pairs.push({ positive, negative, skeleton: a.skeleton });
    }
  }
  return pairs.length === 1 ? pairs[0] : null;
}

function tokenCompatible(target: string, source: string) {
  if (target === source) return true;
  if (Math.min(target.length, source.length) < 5) return false;
  return target.startsWith(source.slice(0, Math.min(6, source.length))) || source.startsWith(target.slice(0, Math.min(6, target.length)));
}

function rawCoverage(target: string[], source: string[]) {
  if (!target.length) return 0;
  return target.filter((token) => source.some((candidate) => tokenCompatible(token, candidate))).length / target.length;
}

function atomicPolarityClauses(text: string) {
  return String(text ?? "")
    .split(/(?<=[.!?;])\s+|\s+(?:\u043d\u043e|\u043e\u0434\u043d\u0430\u043a\u043e|\u0437\u0430\u0442\u043e)\s+/giu)
    .map((item) => item.trim())
    .filter((item) => item.length >= 6);
}

function clausePairPolarity(clause: string, skeleton: string[]) {
  const words = rawTokens(clause);
  const stems = words.map(stemToken);
  const skeletonPositions = stems
    .map((token, index) => (skeleton.some((target) => tokenCompatible(target, token)) ? index : -1))
    .filter((index) => index >= 0);
  if (!skeletonPositions.length) return null;

  let associatedNegation = false;
  for (let index = 0; index < words.length; index += 1) {
    if (!explicitNegativeWord(words[index])) continue;
    if (words[index] === "\u043d\u0435" && words[index + 1] === "\u0442\u043e\u043b\u044c\u043a\u043e") return null;
    const distance = Math.min(...skeletonPositions.map((position) => Math.abs(position - index)));
    if (distance <= (words[index] === "\u0431\u0435\u0437" ? 3 : 2)) associatedNegation = true;
  }
  return associatedNegation ? ("negative" as const) : ("positive" as const);
}

function questionFocusTokens(question: string, supplied?: string[]) {
  const tokens = supplied?.length ? supplied : uniqueTokens(question);
  return tokens.filter((token) => token.length >= 4 && !FOCUS_STOPWORDS.has(token) && !QUESTION_GENERIC.has(token));
}

function focusCompatible(text: string, focus: string[]) {
  if (!focus.length) return false;
  const source = tokenizeNormalized(normalizeForSearch(text));
  const hits = focus.filter((token) => source.some((candidate) => tokenCompatible(token, candidate))).length;
  const coverage = strictSoftCoverage(focus, source);
  return focus.length <= 2 ? hits === focus.length : hits >= 2 && coverage >= 0.3;
}

export function resolveNegationPairClause({
  mode,
  question,
  answers,
  fragments,
  focusTokens,
}: {
  mode: string;
  question: string;
  answers: AnswerOption[];
  fragments: Array<{ page: number; text: string }>;
  focusTokens?: string[];
}): PolarityProof | null {
  if (mode !== "single") return null;
  const pair = buildNegationPair(answers);
  if (!pair) return null;
  const focus = questionFocusTokens(question, focusTokens);
  if (!focus.length) return null;
  const proofs: PolarityProof[] = [];

  for (const fragment of fragments) {
    if (!focusCompatible(fragment.text, focus)) continue;
    for (const clause of atomicPolarityClauses(fragment.text)) {
      const sourceSkeleton = rawTokens(clause).filter((word) => !explicitNegativeWord(word) && !RUSSIAN_STOPWORDS.has(word)).map(stemToken);
      const minimumSkeletonCoverage = pair.skeleton.length <= 2 ? 1 : 0.62;
      if (rawCoverage(pair.skeleton, sourceSkeleton) < minimumSkeletonCoverage) continue;
      const polarity = clausePairPolarity(clause, pair.skeleton);
      if (!polarity) continue;
      const member = polarity === "negative" ? pair.negative : pair.positive;
      proofs.push({ answerId: member.answer.id, page: fragment.page, text: clause, polarity });
    }
  }

  const ids = new Set(proofs.map((proof) => proof.answerId));
  if (ids.size !== 1) return null;
  return proofs.find((proof) => proof.answerId === [...ids][0]) ?? null;
}

export function applyNegationPairClauseResolver(
  answerScores: AnswerScore[],
  context: {
    mode: string;
    pages: PdfLinePage[];
    topQuestionPages?: Set<number>;
    question: string;
    answers: AnswerOption[];
    focusTokens?: string[];
  },
) {
  if (context.mode !== "single") return answerScores;
  const proof = resolveNegationPairClause({
    ...context,
    fragments: buildRelationTupleFragments(context.pages, context.topQuestionPages),
  });
  if (!proof) return answerScores;
  const target = answerScores.find((item) => item.answer.id === proof.answerId);
  if (!target) return answerScores;
  const maxRaw = Math.max(...answerScores.map((item) => item.raw));
  const top = [...answerScores].sort((left, right) => right.raw - left.raw)[0];
  const trustedKinds = new Set([
    "coordinate_table_row",
    "coordinate_table_group",
    "coordinate_table_group_inverse",
    "fibrosis_stage_row",
    "drug_dose_segment",
    "relation_tuple_segment",
    "interval_relation_tuple_segment",
    "clause_count_tuple_segment",
  ]);
  const trustedTop =
    top?.answer.id !== target.answer.id &&
    (top?.evidence ?? []).some((item) => trustedKinds.has(item.kind) && (item.score ?? 0) >= 12);
  const rawGap = maxRaw - target.raw;
  const rawRatio = target.raw / Math.max(0.001, maxRaw);
  if (target.raw < maxRaw && (trustedTop || rawGap > 12 || rawRatio < 0.55)) return answerScores;
  return answerScores.map((item) =>
    item.answer.id !== proof.answerId
      ? item
      : {
          ...item,
          raw: item.raw >= maxRaw ? item.raw : maxRaw + 0.1,
          evidence: [
            ...(item.evidence ?? []),
            {
              answerId: item.answer.id,
              page: proof.page,
              text: proof.text,
              score: 18.5,
              kind: "negation_pair_clause",
            },
          ],
        },
  );
}
