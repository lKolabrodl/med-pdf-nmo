import { normalizeForSearch, normalizeText, uniqueTokens } from "../../normalize.js";
import { FOCUS_STOPWORDS } from "../constants.js";
import { buildAtomicRecommendationSegments } from "./recommendation-item.js";
import { strictSoftCoverage, tokenizeNormalized } from "../text-utils.js";
import type { AnswerScore } from "../types.js";

type AnswerOption = { id: string; text: string };
type OrdinalFamilyMember = { answer: AnswerOption; value: number; suffix: string };

const ORDINAL_GENERIC_TOKENS = new Set(
  uniqueTokens(
    "пациент пациентам всем рекомендуется рекомендовано проведение выполнение лечение терапия стадия степень класс тип",
  ),
);

function romanValue(value: string) {
  const normalized = value.toLowerCase();
  const values: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
  return values[normalized] ?? null;
}

function ordinalValue(value: string) {
  return /^\d+$/u.test(value) ? Number(value) : romanValue(value);
}

function canonicalSuffix(value: string) {
  if (value.startsWith("стад")) return "stage";
  if (value.startsWith("степ")) return "degree";
  if (value.startsWith("класс")) return "class";
  if (value.startsWith("тип")) return "type";
  return "";
}

function parseOrdinalFamily(answers: AnswerOption[]): OrdinalFamilyMember[] | null {
  if (answers.length < 3) return null;
  const members = [];
  for (const answer of answers) {
    const clean = normalizeText(answer.text);
    const match = clean.match(/^\s*(\d+|i{1,3}|iv|v|vi{0,3}|ix|x)\s+(стади\S*|степен\S*|класс\S*|тип\S*)\s*[.,]?\s*$/iu);
    if (!match) return null;
    const value = ordinalValue(match[1]);
    const suffix = canonicalSuffix(match[2]);
    if (!value || !suffix) return null;
    members.push({ answer, value, suffix });
  }
  if (new Set(members.map((member) => member.value)).size !== members.length) return null;
  if (new Set(members.map((member) => member.suffix)).size !== 1) return null;
  return members;
}

function sourceSuffixPattern(suffix: string) {
  if (suffix === "stage") return "стади\\S*";
  if (suffix === "degree") return "степен\\S*";
  if (suffix === "class") return "класс\\S*";
  return "тип\\S*";
}

function encodedOrdinalSets(text: string, suffix: string) {
  const clean = normalizeText(text)
    .replace(/\[[^\]]*\]/gu, " ")
    .replace(/(?:уровень\s+(?:достоверности|убедительности|доказательности)|ууд|уур)[^.!?;]{0,140}/gu, " ")
    .replace(/(?:\d+|i{1,3}|iv|v|vi{0,3}|ix|x)\s*-\s*(?:\d+|i{1,3}|iv|v|vi{0,3}|ix|x)\s+степен\S*\s+(?:доказательности|достоверности|убедительности(?:\s+рекомендаций)?)/giu, " ")
    .replace(/(?:\d+|i{1,3}|iv|v|vi{0,3}|ix|x)(?:\s*(?:,|и)\s*(?:\d+|i{1,3}|iv|v|vi{0,3}|ix|x))+\s+степен\S*\s+(?:доказательности|достоверности|убедительности(?:\s+рекомендаций)?)/giu, " ");
  const suffixPattern = sourceSuffixPattern(suffix);
  const sets: number[][] = [];
  const rangePattern = new RegExp(`(^|[^\\d\\[])((?:\\d+|i{1,3}|iv|v|vi{0,3}|ix|x))\\s*-\\s*((?:\\d+|i{1,3}|iv|v|vi{0,3}|ix|x))\\s+${suffixPattern}`, "giu");
  for (const match of clean.matchAll(rangePattern)) {
    const left = ordinalValue(match[2]);
    const right = ordinalValue(match[3]);
    if (!left || !right || left >= right || right - left > 8) continue;
    sets.push(Array.from({ length: right - left + 1 }, (_, index) => left + index));
  }

  const listPattern = new RegExp(`(^|[^\\d\\[])((?:\\d+|i{1,3}|iv|v|vi{0,3}|ix|x)(?:\\s*(?:,|и)\\s*(?:\\d+|i{1,3}|iv|v|vi{0,3}|ix|x))+?)\\s+${suffixPattern}`, "giu");
  for (const match of clean.matchAll(listPattern)) {
    const values = [...match[2].matchAll(/\d+|i{1,3}|iv|v|vi{0,3}|ix|x/giu)]
      .map((item) => ordinalValue(item[0]))
      .filter((value): value is number => !!value);
    if (values.length >= 2) sets.push([...new Set(values)]);
  }
  return sets;
}

function questionFocusTokens(question: string) {
  return uniqueTokens(question).filter(
    (token) => token.length >= 4 && !/^\d/u.test(token) && !FOCUS_STOPWORDS.has(token) && !ORDINAL_GENERIC_TOKENS.has(token),
  );
}

function mandatoryConditionTokens(question: string) {
  const clean = normalizeText(question);
  const values = [];
  const patterns = [
    /(?:^|\s)(?:во\s+время|в\s+период|при\s+наличии|при\s+отсутствии|при|без|после|до)\s+(.{3,90}?)(?=\s+(?:рекоменду|показан|провод|назнач|всем\s+пациент|пациент)|[,.!?;]|$)/gu,
    /(?:^|\s)(?:у\s+)?пациент\S*\s+с\s+(.{3,80}?)(?=\s+(?:рекоменду|показан|провод|назнач)|[,.!?;]|$)/gu,
  ];
  for (const pattern of patterns) {
    for (const match of clean.matchAll(pattern)) values.push(...uniqueTokens(match[1]));
  }
  return [...new Set(values)].filter((token) => token.length >= 4 && !FOCUS_STOPWORDS.has(token) && !ORDINAL_GENERIC_TOKENS.has(token));
}

function recommendationPolarity(text: string) {
  const clean = normalizeText(text);
  if (
    /(?:^|\s)не\s+(?:рекоменду|рекомендова|показан|назнач)|(?:^|\s)нерекоменду/u.test(clean) ||
    /(?:^|\s)не\s+следует(?:\s+\S+){0,5}\s+(?:рекоменд|назнач|провод)/u.test(clean) ||
    /(?:^|\s)следует\s+не\s+(?:рекоменд|назнач|провод)/u.test(clean) ||
    /(?:рекоменд|назнач|провод)\S*(?:\s+\S+){0,6}\s+не\s+следует/u.test(clean) ||
    /(?:^|\s)не\s+(?:может|должн)\S*(?:\s+\S+){0,6}\s+(?:рекоменд|назнач|провод)/u.test(clean) ||
    /(?:нецелесообраз|противопоказ)/u.test(clean)
  ) {
    return "negative";
  }
  if (/(?:рекоменду|рекомендова|показан|назнач)/u.test(clean)) return "positive";
  return null;
}

function interventionTargetTokens(question: string) {
  const clean = normalizeText(question);
  const cue = clean.match(/(?:рекоменду\S*|рекомендова\S*|показан\S*|назнача\S*)/u);
  if (!cue || cue.index == null) return [];
  const before = clean.slice(0, cue.index).trim();
  const after = clean.slice(cue.index + cue[0].length).trim();
  const beforeIsContext = /^(?:(?:всем\s+)?(?:пациент|больн|дет|женщ|мужчин|лиц)|у\s+(?:пациент|больн|женщ|дет|мужчин|лиц)|для\s+|при\s+|после\s+|до\s+|без\s+|во\s+время\s+|в\s+период\s+)/u.test(before);
  const source = beforeIsContext || before.length < 4 ? after : before;
  const bounded = source.split(/\s+(?:всем\s+)?пациент\S*|\s+при\s+|\s+во\s+время\s+|\s+для\s+/u)[0];
  return uniqueTokens(bounded)
    .filter((token) => token.length >= 4 && !FOCUS_STOPWORDS.has(token) && !ORDINAL_GENERIC_TOKENS.has(token))
    .slice(0, 3);
}

function tokenHit(tokens: string[], sourceTokens: string[]) {
  const source = new Set(sourceTokens);
  return tokens.filter((token) => source.has(token)).length;
}

function sourceClauses(text: string) {
  const protectedText = String(text ?? "").replace(/(мм\s*рт)\.\s*(ст)\./giu, "$1§ $2§");
  return protectedText
    .split(/\s*;\s*|,\s*(?:а|но)\s+|(?<=[.!?])\s+/u)
    .map((item) => item.replace(/§/gu, ".").replace(/\s+/gu, " ").trim())
    .filter((item) => item.length >= 20);
}

export function resolveExplicitOrdinalRangeSet({
  mode,
  pages,
  topQuestionPages,
  question,
  answers,
}: {
  mode: string;
  pages: any[];
  topQuestionPages?: Set<unknown>;
  question: string;
  answers: AnswerOption[];
}) {
  if (mode !== "multi") return null;
  if (recommendationPolarity(question) !== "positive") return null;
  const family = parseOrdinalFamily(answers);
  if (!family) return null;
  const focus = questionFocusTokens(question);
  if (focus.length < 2) return null;
  const targetTokens = interventionTargetTokens(question);
  if (!targetTokens.length) return null;
  const conditions = mandatoryConditionTokens(question);
  const optionValues = new Set(family.map((member) => member.value));
  const suffix = family[0].suffix;
  const matches = [];

  for (const segment of buildAtomicRecommendationSegments(pages)) {
    const nearTop =
      !topQuestionPages?.size ||
      topQuestionPages.has(segment.page) ||
      topQuestionPages.has(segment.page - 1) ||
      topQuestionPages.has(segment.page + 1);
    if (!nearTop) continue;
    for (const clause of sourceClauses(segment.text)) {
      if (recommendationPolarity(clause) !== "positive") continue;
      const sourceTokens = tokenizeNormalized(normalizeForSearch(clause));
      const coverage = strictSoftCoverage(focus, sourceTokens);
      if (coverage < 0.62 || tokenHit(focus, sourceTokens) < 2) continue;
      if (strictSoftCoverage(targetTokens, sourceTokens) < 1) continue;
      if (conditions.length && strictSoftCoverage(conditions, sourceTokens) < 1) continue;
      for (const values of encodedOrdinalSets(clause, suffix)) {
        const unique = [...new Set(values)].sort((left, right) => left - right);
        if (unique.length < 2 || unique.length >= answers.length || unique.some((value) => !optionValues.has(value))) continue;
        const answerIds = family.filter((member) => unique.includes(member.value)).map((member) => member.answer.id);
        matches.push({ answerIds, page: segment.page, text: clause, key: answerIds.join("|") });
      }
    }
  }

  if (!matches.length || new Set(matches.map((match) => match.key)).size !== 1) return null;
  return matches[0];
}

export function applyExplicitOrdinalRangeSetScores(answerScores: AnswerScore[], resolved: { answerIds: string[]; page: number; text: string }) {
  const selected = new Set(resolved.answerIds);
  const trustedKinds = new Set(["coordinate_table_group", "coordinate_table_group_inverse", "coordinate_table_multicell_row", "coordinate_table_membership", "fibrosis_stage_row"]);
  const trustedConflict = answerScores.some(
    (item) => !selected.has(item.answer.id) && (item.evidence ?? []).some((evidence) => trustedKinds.has(evidence.kind) && (evidence.score ?? 0) >= 16),
  );
  if (trustedConflict) return answerScores;
  const maxRaw = Math.max(...answerScores.map((item) => item.raw));
  return answerScores.map((item) =>
    selected.has(item.answer.id)
      ? {
          ...item,
          raw: Math.max(item.raw, maxRaw),
          evidence: [
            ...(item.evidence ?? []),
            {
              answerId: item.answer.id,
              page: resolved.page,
              text: resolved.text,
              score: 20,
              kind: "explicit_ordinal_range_set",
            },
          ],
        }
      : { ...item, raw: Math.min(item.raw, maxRaw * 0.45) },
  );
}
