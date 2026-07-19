import { normalizeForSearch, normalizeText, uniqueTokens } from "../../normalize.js";
import { FOCUS_STOPWORDS } from "../constants.js";
import { strictSoftCoverage, tokenizeNormalized } from "../text-utils.js";
import type { AnswerScore } from "../types.js";

type AnswerOption = { id: string; text: string };
type RelationFragment = { page: number; text: string };
type RelationScope = { valueText: string; contextText: string; conditionText: string };

type RelationRole =
  | "maximum_dose"
  | "maintenance_dose"
  | "population_children"
  | "population_adults"
  | "diastolic_metric"
  | "systolic_metric"
  | "metric_threshold"
  | "rank"
  | "age"
  | "interval"
  | "percent_cases"
  | "ordinal_stage";

type NumericFamilyMember = {
  answer: AnswerOption;
  allNumbers: string[];
  variableNumbers: string[];
  variableTuples: Array<{ number: string; unit: string }>;
  valueKey: string;
  unitClass: string;
  intervalKey?: string;
  intervalUnit?: string;
};

type NumericFamily = {
  members: NumericFamilyMember[];
  allFamilyNumbers: Set<string>;
};

const RELATION_GENERIC_TOKENS = new Set(
  uniqueTokens(
    [
      "пациент пациентам рекомендуется рекомендованный составляет составляют характеризуется",
      "доза дозировка максимальный поддерживающий суточный значение показатель уровень",
      "дети ребенок взрослый возраст лет год месяц случай процент место стадия степень",
      "менее более ниже выше старше младше при для лечение терапия применение препарат",
    ].join(" "),
  ),
);

const UNIT_PATTERNS: Array<[string, RegExp]> = [
  ["percent", /%|процент/u],
  ["mcg", /(?:^|\s)мкг(?=\s|[\/.,;:]|$)/u],
  ["mg", /(?:^|\s)мг(?=\s|[\/.,;:]|$)/u],
  ["gram", /(?:^|\s)г(?=\s|[\/.,;:]|$)/u],
  ["ml", /(?:^|\s)мл(?=\s|[\/.,;:]|$)/u],
  ["iu", /(?:^|\s)ме(?=\s|[\/.,;:]|$)/u],
  ["pressure", /мм\s*рт/u],
  ["stage", /стади|степен|мест/u],
  ["kg", /(?:^|\s)кг(?=\s|[\/.,;:]|$)/u],
  ["hours", /час(?:а|ов)?/u],
  ["days", /дн(?:я|ей|и)?|день|сут(?:ки|ок)?/u],
  ["weeks", /недел(?:я|и|ь)?/u],
  ["months", /месяц(?:а|ев)?/u],
  ["years", /лет|год(?:а|ов)?/u],
];

const SKELETON_IGNORES = new Set(
  uniqueTokens("мкг мг грамм миллилитр ме процент стадия степень место менее более ниже выше от до ровно").filter(Boolean),
);

type CanonicalInterval = {
  key: string;
  endpoints: string[];
  unit: string;
  start: number;
  end: number;
};

const NUMBER_ATOM_SOURCE = String.raw`\d+(?:\.\d+)?`;

function canonicalNumber(value: string) {
  const normalized = value.replace(/^0+(?=\d)/u, "").replace(/\.0+$/u, "").replace(/(\.\d*?)0+$/u, "$1");
  return normalized || "0";
}

/**
 * Canonicalizes an interval as one value. In particular, endpoint numbers that
 * merely coexist in a clause do not satisfy an interval option.
 */
export function canonicalIntervalTuples(text: string): CanonicalInterval[] {
  const clean = normalizeText(text);
  const intervals: CanonicalInterval[] = [];
  const fromTo = new RegExp(
    `(?:^|\\s)\u043e\u0442\\s+(${NUMBER_ATOM_SOURCE})\\s*(%?)\\s*(?:-\\s*(${NUMBER_ATOM_SOURCE})\\s*(%?)\\s*)?\u0434\u043e\\s+(${NUMBER_ATOM_SOURCE})\\s*(%?)`,
    "gu",
  );

  for (const match of clean.matchAll(fromTo)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const endpoints = [match[1], match[3], match[5]].filter(Boolean).map(canonicalNumber);
    const unit = [match[2], match[4], match[6]].some((marker) => marker === "%")
      ? "percent"
      : canonicalUnitAfter(clean, end, endpoints.at(-1) ?? "");
    intervals.push({ key: endpoints.join(".."), endpoints, unit, start, end });
  }

  const direct = new RegExp(`(${NUMBER_ATOM_SOURCE})\\s*(%?)\\s*-\\s*(${NUMBER_ATOM_SOURCE})\\s*(%?)`, "gu");
  for (const match of clean.matchAll(direct)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (intervals.some((interval) => start >= interval.start && end <= interval.end)) continue;
    const endpoints = [match[1], match[3]].map(canonicalNumber);
    const unit = match[2] === "%" || match[4] === "%" ? "percent" : canonicalUnitAfter(clean, end, endpoints[1]);
    intervals.push({ key: endpoints.join(".."), endpoints, unit, start, end });
  }

  return intervals
    .sort((left, right) => left.start - right.start)
    .filter(
      (interval, index, all) =>
        all.findIndex((candidate) => candidate.key === interval.key && candidate.unit === interval.unit) === index,
    );
}

function strictNumbers(text: string) {
  return (normalizeText(text).match(/\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?%?/gu) ?? []).map((value) => value.replace(/^0+(?=\d)/u, ""));
}

function canonicalUnitAfter(clean: string, end: number, number: string) {
  const after = clean.slice(end, Math.min(clean.length, end + 28));
  if (number.endsWith("%") || /^\s*%/u.test(after)) return "percent";
  const probes: Array<[string, RegExp]> = [
    ["mcg", /^\s*мкг(?=\s|[\/.,;:]|$)/u],
    ["mg", /^\s*мг(?=\s|[\/.,;:]|$)/u],
    ["gram", /^\s*г(?=\s|[\/.,;:]|$)/u],
    ["ml", /^\s*мл(?=\s|[\/.,;:]|$)/u],
    ["iu", /^\s*ме(?=\s|[\/.,;:]|$)/u],
    ["pressure", /^\s*мм\s*рт/u],
    ["kg", /^\s*кг/u],
    ["stage", /^\s*(?:стади|степен|мест)/u],
    ["hours", /^\s*час(?:а|ов)?/u],
    ["days", /^\s*(?:дн(?:я|ей|и)?|день|сут(?:ки|ок)?)/u],
    ["weeks", /^\s*недел(?:я|и|ь)?/u],
    ["months", /^\s*месяц(?:а|ев)?/u],
    ["years", /^\s*(?:лет|год(?:а|ов)?)/u],
  ];
  return probes.find(([, pattern]) => pattern.test(after))?.[0] ?? "scalar";
}

function numericTuples(text: string) {
  const clean = normalizeText(text);
  const tuples: Array<{ number: string; unit: string }> = [];
  for (const match of clean.matchAll(/\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?%?/gu)) {
    const number = match[0].replace(/^0+(?=\d)/u, "");
    const end = (match.index ?? 0) + match[0].length;
    tuples.push({ number, unit: canonicalUnitAfter(clean, end, number) });
  }
  return tuples;
}

function familySkeleton(text: string) {
  return uniqueTokens(text)
    .filter((token) => !/^\d/u.test(token) && !SKELETON_IGNORES.has(token))
    .sort()
    .join("|");
}

function unitClass(text: string) {
  const clean = normalizeText(text);
  return UNIT_PATTERNS.find(([, pattern]) => pattern.test(clean))?.[0] ?? "scalar";
}

function buildIntervalFamily(answers: AnswerOption[]): NumericFamily | null {
  if (answers.length < 3) return null;
  const parsed = answers.map((answer) => canonicalIntervalTuples(answer.text));
  if (parsed.some((intervals) => intervals.length !== 1)) return null;
  if (new Set(answers.map((answer) => familySkeleton(answer.text))).size > 1) return null;
  const intervalUnits = new Set(parsed.map((intervals) => intervals[0].unit));
  if (intervalUnits.size > 1) return null;
  const intervalKeys = parsed.map((intervals) => intervals[0].key);
  if (new Set(intervalKeys).size !== answers.length) return null;

  const members = answers.map((answer, index) => {
    const interval = parsed[index][0];
    return {
      answer,
      allNumbers: interval.endpoints,
      variableNumbers: [interval.key],
      variableTuples: [{ number: interval.key, unit: interval.unit }],
      valueKey: interval.key,
      unitClass: interval.unit,
      intervalKey: interval.key,
      intervalUnit: interval.unit,
    };
  });
  return { members, allFamilyNumbers: new Set(members.flatMap((member) => member.allNumbers)) };
}

function buildNumericFamily(answers: AnswerOption[], enableIntervalFamilies = false): NumericFamily | null {
  if (enableIntervalFamilies) {
    const intervalFamily = buildIntervalFamily(answers);
    if (intervalFamily) return intervalFamily;
  }
  if (answers.length < 3) return null;
  const seenText = new Set<string>();
  const numberSets = answers.map((answer) => {
    const normalized = normalizeForSearch(answer.text);
    if (!normalized || seenText.has(normalized)) return null;
    seenText.add(normalized);
    const numbers = [...new Set(strictNumbers(answer.text))];
    return numbers.length ? numbers : null;
  });
  if (numberSets.some((numbers) => !numbers)) return null;

  const common = new Set(
    numberSets[0]!.filter((number) => numberSets.every((numbers) => numbers!.includes(number))),
  );
  const members: NumericFamilyMember[] = answers.map((answer, index) => {
    const allNumbers = numberSets[index]!;
    const variableNumbers = allNumbers.filter((number) => !common.has(number));
    const tuples = numericTuples(answer.text);
    const variableTuples = variableNumbers.map((number) => tuples.find((tuple) => tuple.number === number) ?? { number, unit: "scalar" });
    return {
      answer,
      allNumbers,
      variableNumbers,
      variableTuples,
      valueKey: variableNumbers.join("|"),
      unitClass: unitClass(answer.text),
    };
  });

  if (members.some((member) => member.variableNumbers.length < 1 || member.variableNumbers.length > 2)) return null;
  if (new Set(members.map((member) => member.valueKey)).size !== members.length) return null;
  const unitSignatures = new Set(members.map((member) => member.variableTuples.map((tuple) => tuple.unit).join("|")));
  if (unitSignatures.size > 1) return null;
  if (new Set(answers.map((answer) => familySkeleton(answer.text))).size > 1) return null;
  return {
    members,
    allFamilyNumbers: new Set(members.flatMap((member) => member.allNumbers)),
  };
}

function negativeOrAmbiguousQuestion(question: string) {
  const clean = normalizeText(question);
  return /(?:^|\s)(?:кроме|исключая)(?:\s|$)/u.test(clean) || /(?:^|\s)не\s+(?:явля|относ|характер|рекоменд|включ)/u.test(clean);
}

function detectRelationRole(question: string): RelationRole | null {
  const clean = normalizeText(question);
  if (/максимальн/u.test(clean) && /доз/u.test(clean)) return "maximum_dose";
  if (/поддерживающ/u.test(clean) && /доз/u.test(clean)) return "maintenance_dose";
  if (/дет(?:ей|и)|ребен/u.test(clean) && /распростран|частот|составля|населен/u.test(clean)) return "population_children";
  if (/взросл/u.test(clean) && /распростран|частот|составля|населен/u.test(clean)) return "population_adults";
  if (/диастол/u.test(clean)) return "diastolic_metric";
  if (/систол/u.test(clean)) return "systolic_metric";
  if (/(?:spo\s*2|сатурац|pao\s*2|fio\s*2|индекс\s+оксигенац)/u.test(clean)) return "metric_threshold";
  if (/занима/u.test(clean) && /мест/u.test(clean)) return "rank";
  if (/интервал/u.test(clean)) return "interval";
  if (/(?:%|процент)/u.test(clean) && /случа/u.test(clean)) return "percent_cases";
  if (/возраст/u.test(clean) && /(?:развив|дебют|возник|тенденц)/u.test(clean)) return "age";
  if (/(?:стади|степен)/u.test(clean) && /(?:характер|соответств|относ|явля)/u.test(clean)) return "ordinal_stage";
  return null;
}

function questionComparator(question: string) {
  const clean = normalizeText(question);
  if (/(?:^|\s)(?:не\s+менее|не\s+ниже)(?:\s|$)/u.test(clean)) return "greater";
  if (/(?:^|\s)(?:не\s+более|не\s+выше)(?:\s|$)/u.test(clean)) return "less";
  if (/(?:^|\s)(?:менее|меньше|ниже)(?:\s|$)|</u.test(clean)) return "less";
  if (/(?:^|\s)(?:более|больше|выше)(?:\s|$)|>/u.test(clean)) return "greater";
  return null;
}

function focusTokens(question: string) {
  return uniqueTokens(question).filter(
    (token) => token.length >= 4 && !/^\d/u.test(token) && !FOCUS_STOPWORDS.has(token) && !RELATION_GENERIC_TOKENS.has(token),
  );
}

function conditionSpecs(question: string, _family: NumericFamily) {
  const clean = normalizeText(question);
  const values: Array<{ number: string; unit: string; direction: string | null }> = [];
  for (const tuple of numericTuples(question)) {
    if (!["kg", "years", "months"].includes(tuple.unit) || Number(tuple.number) >= 1000) continue;
    const index = clean.indexOf(tuple.number);
    const around = clean.slice(Math.max(0, index - 24), Math.min(clean.length, index + tuple.number.length + 28));
    const direction = /(?:не\s+менее|более|больше|выше|старше)|(?:\d\s*(?:кг|лет|года|год|месяц)[^,.]{0,12}\bболее)/u.test(around)
      ? "greater"
      : /(?:менее|меньше|ниже|младше)/u.test(around)
        ? "less"
        : null;
    values.push({ number: tuple.number, unit: tuple.unit, direction });
  }
  return values.filter(
    (item, index) =>
      values.findIndex((candidate) => candidate.number === item.number && candidate.unit === item.unit && candidate.direction === item.direction) === index,
  );
}

function isBoundaryLine(line: string) {
  const clean = normalizeText(line);
  return /^\s*[•*]/u.test(line) || /^\d+(?:\.\d+)+\.?\s/u.test(clean) || /^(?:уровень убедительности|ууд|уур|комментари)/u.test(clean);
}

function splitBoundedText(text: string) {
  const protectedText = String(text ?? "").replace(/(мм\s*рт)\.\s*(ст)\./giu, "$1§ $2§");
  const pieces = protectedText
    .split(/(?<=[.!?])\s+|\s*;\s*/u)
    .map((piece) => piece.replace(/§/gu, ".").replace(/\s+/gu, " ").trim())
    .filter((piece) => piece.length >= 10);
  return pieces.length ? pieces : [String(text ?? "").replace(/\s+/gu, " ").trim()].filter(Boolean);
}

/** Builds fresh sentence/clause and at-most-two-line proof fragments. */
export function buildRelationTupleFragments(pages: any[], topQuestionPages?: Set<unknown>) {
  const fragments: RelationFragment[] = [];
  const seen = new Set<string>();
  for (const page of pages ?? []) {
    const nearTop =
      !topQuestionPages?.size ||
      topQuestionPages.has(page.page) ||
      topQuestionPages.has(page.page - 1) ||
      topQuestionPages.has(page.page + 1);
    if (!nearTop) continue;
    const lines: string[] = page.lines ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      const containers = [lines[index]];
      const next = lines[index + 1];
      if (next && !isBoundaryLine(next)) containers.push(`${lines[index]} ${next}`);
      for (const container of containers) {
        for (const text of [container, ...splitBoundedText(container)]) {
          const normalized = normalizeForSearch(text);
          if (normalized.length < 8) continue;
          const key = `${page.page}:${normalized}`;
          if (seen.has(key)) continue;
          seen.add(key);
          fragments.push({ page: page.page, text });
        }
      }
    }
  }
  return fragments;
}

function sliceTargetScope(text: string, target: RegExp, siblings: RegExp[]) {
  const clean = normalizeText(text);
  const targetMatch = target.exec(clean);
  target.lastIndex = 0;
  if (!targetMatch || targetMatch.index == null) return null;
  const targetIndex = targetMatch.index;
  let end = clean.length;
  for (const sibling of siblings) {
    const flags = sibling.flags.includes("g") ? sibling.flags : `${sibling.flags}g`;
    for (const match of clean.matchAll(new RegExp(sibling.source, flags))) {
      const index = match.index ?? -1;
      if (index > targetIndex) end = Math.min(end, index);
    }
  }
  return clean.slice(targetIndex, end).trim();
}

function roleCueMatches(text: string, role: RelationRole) {
  if (role === "rank") return /мест/u.test(text);
  if (role === "interval") return /интервал/u.test(text);
  if (role === "percent_cases") return /(?:%|процент)/u.test(text) && /случа/u.test(text);
  if (role === "age") return /возраст|лет/u.test(text);
  if (role === "ordinal_stage") return /стади|степен/u.test(text);
  if (role === "metric_threshold") return /spo\s*2|сатурац|pao\s*2|fio\s*2|индекс\s+оксигенац/u.test(text);
  return true;
}

function scopesForRole(fragment: RelationFragment, role: RelationRole): RelationScope[] {
  const clauses = splitBoundedText(fragment.text).map((text) => normalizeText(text));
  const scopes: RelationScope[] = [];
  for (const clause of clauses) {
    let valueText: string | null = clause;
    if (role === "maximum_dose") valueText = sliceTargetScope(clause, /максимальн[^.!?;]{0,40}доз/u, []);
    else if (role === "maintenance_dose") {
      if (!/поддерживающ[^.!?;]{0,30}доз|(?:^|\s)далее(?:\s|$)/u.test(clause)) valueText = null;
    } else if (role === "population_children") {
      valueText = sliceTargetScope(clause, /(?:у\s+)?дет(?:ей|и)|ребен/u, [/(?:у\s+)?взросл/gu]);
    } else if (role === "population_adults") {
      valueText = sliceTargetScope(clause, /(?:у\s+)?взросл/u, [/(?:у\s+)?дет(?:ей|и)|ребен/gu]);
    } else if (role === "diastolic_metric") {
      valueText = sliceTargetScope(clause, /диастол/u, [/систол/gu]);
    } else if (role === "systolic_metric") {
      valueText = sliceTargetScope(clause, /систол/u, [/диастол/gu]);
    } else if (!roleCueMatches(clause, role)) {
      valueText = null;
    }
    if (valueText) scopes.push({ valueText, contextText: clause, conditionText: clause });
  }
  return scopes;
}

function numberPresent(scope: string, number: string) {
  return strictNumbers(scope).includes(number);
}

function comparatorNearValue(scope: string, value: string) {
  const clean = normalizeText(scope);
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = new RegExp(`(?:^|\\s)${escaped.replace(/-/gu, "\\s*-\\s*")}(?:%|\\s|$)`, "u").exec(clean);
  if (!match || match.index == null) return null;
  const before = clean.slice(Math.max(0, match.index - 35), match.index);
  const after = clean.slice(match.index + match[0].length, Math.min(clean.length, match.index + match[0].length + 24));
  if (/(?:не\s+менее|не\s+ниже)\s*$/u.test(before) || /^\s*(?:и\s+)?(?:выше|более)/u.test(after)) return "greater";
  if (/(?:не\s+более|не\s+выше)\s*$/u.test(before) || /^\s*(?:и\s+)?(?:ниже|менее)/u.test(after)) return "less";
  if (/(?:<|менее(?:\s+чем)?\s*|меньше\s*|ниже\s*)$/u.test(before)) return "less";
  if (/(?:>|более(?:\s+чем)?\s*|больше\s*|выше\s*)$/u.test(before)) return "greater";
  return null;
}

function requiredUnitClass(question: string, family: NumericFamily) {
  const answerClass = family.members[0]?.unitClass ?? "scalar";
  return answerClass === "scalar" ? unitClass(question) : answerClass;
}

function focusCompatible(scope: string, questionTokens: string[]) {
  if (!questionTokens.length) return false;
  const coverage = strictSoftCoverage(questionTokens, tokenizeNormalized(normalizeForSearch(scope)));
  return coverage >= (questionTokens.length <= 2 ? 0.75 : 0.45);
}

function memberMatchesScope(
  member: NumericFamilyMember,
  scope: string,
  role: RelationRole,
  comparator: string | null,
  requiredUnit: string,
) {
  if (member.intervalKey) {
    const unit = member.intervalUnit === "scalar" ? requiredUnit : member.intervalUnit;
    return canonicalIntervalTuples(scope).some(
      (candidate) => candidate.key === member.intervalKey && (unit === "scalar" || candidate.unit === unit),
    );
  }
  const sourceTuples = numericTuples(scope);
  if (
    !member.variableTuples.every((tuple) => {
      const unit = tuple.unit === "scalar" ? requiredUnit : tuple.unit;
      return sourceTuples.some((candidate) => candidate.number === tuple.number && (unit === "scalar" || candidate.unit === unit));
    })
  ) {
    return false;
  }
  if (comparator && ["diastolic_metric", "systolic_metric", "metric_threshold"].includes(role)) {
    const localComparator = comparatorNearValue(scope, member.variableNumbers[0]);
    if (localComparator !== comparator) return false;
  }
  return true;
}

function localConditionDirection(text: string, number: string) {
  const clean = normalizeText(text);
  const index = clean.indexOf(number);
  if (index < 0) return null;
  const around = clean.slice(Math.max(0, index - 24), Math.min(clean.length, index + number.length + 24));
  if (/(?:не\s+менее|более|больше|выше|старше)|(?:\d\s*(?:кг|лет|года|год|месяц)[^,.]{0,12}\bболее)/u.test(around)) return "greater";
  if (/(?:менее|меньше|ниже|младше)/u.test(around)) return "less";
  return null;
}

function conditionsCompatible(text: string, conditions: Array<{ number: string; unit: string; direction: string | null }>) {
  const tuples = numericTuples(text);
  return conditions.every((condition) => {
    if (!tuples.some((tuple) => tuple.number === condition.number && tuple.unit === condition.unit)) return false;
    return !condition.direction || localConditionDirection(text, condition.number) === condition.direction;
  });
}

/**
 * Resolves one dense numeric family only when a bounded source scope proves a
 * unique subject + relation-role + conditions + value tuple.
 */
export function resolveRelationTuple({
  mode,
  question,
  answers,
  fragments,
  enableIntervalFamilies = true,
}: {
  mode: string;
  question: string;
  answers: AnswerOption[];
  fragments: RelationFragment[];
  enableIntervalFamilies?: boolean;
}) {
  if (mode !== "single" || negativeOrAmbiguousQuestion(question)) return null;
  const family = buildNumericFamily(answers, enableIntervalFamilies);
  if (!family) return null;
  const inferredRole = family.members[0]?.unitClass === "stage" && /(?:характер|соответств|относ|явля)/u.test(normalizeText(question)) ? "ordinal_stage" : null;
  const role = detectRelationRole(question) ?? inferredRole;
  if (!role) return null;
  if (role === "ordinal_stage" && family.members[0]?.unitClass !== "stage") return null;
  const questionFocus = focusTokens(question);
  if (!questionFocus.length) return null;
  const requiredConditions = conditionSpecs(question, family);
  const comparator = questionComparator(question);
  const requiredUnit = requiredUnitClass(question, family);
  const proofs = [];

  for (const fragment of fragments) {
    for (const scope of scopesForRole(fragment, role)) {
      if (!focusCompatible(scope.contextText, questionFocus)) continue;
      if (!conditionsCompatible(scope.conditionText, requiredConditions)) continue;
      const matching = family.members.filter((member) => memberMatchesScope(member, scope.valueText, role, comparator, requiredUnit));
      if (matching.length !== 1) continue;
      proofs.push({
        answerId: matching[0].answer.id,
        page: fragment.page,
        text: fragment.text,
        role,
        interval: Boolean(matching[0].intervalKey),
      });
    }
  }

  const resolvedIds = new Set(proofs.map((proof) => proof.answerId));
  if (resolvedIds.size !== 1) return null;
  return proofs.find((proof) => proof.answerId === [...resolvedIds][0]) ?? null;
}

export function applySingleRelationTupleResolver(
  answerScores: AnswerScore[],
  context: {
    mode: string;
    pages: any[];
    topQuestionPages?: Set<unknown>;
    question: string;
    answers: AnswerOption[];
    enableIntervalFamilies?: boolean;
  },
) {
  if (context.mode !== "single") return answerScores;
  const fragments = buildRelationTupleFragments(context.pages, context.topQuestionPages);
  const resolved = resolveRelationTuple({ ...context, fragments });
  if (!resolved) return answerScores;
  const target = answerScores.find((item) => item.answer.id === resolved.answerId);
  if (!target) return answerScores;
  const maxRaw = Math.max(...answerScores.map((item) => item.raw));
  const top = [...answerScores].sort((left, right) => right.raw - left.raw)[0];
  const trustedKinds = new Set(["coordinate_table_row", "coordinate_table_group", "coordinate_table_group_inverse", "fibrosis_stage_row", "drug_dose_segment"]);
  const trustedTop =
    top?.answer.id !== target.answer.id &&
    (top?.evidence ?? []).some((item) => trustedKinds.has(item.kind) && (item.score ?? 0) >= 12);
  const rawGap = maxRaw - target.raw;
  const rawRatio = target.raw / Math.max(0.001, maxRaw);
  const gapLimit = resolved.interval ? 20 : 12;
  const ratioFloor = resolved.interval ? 0.5 : 0.55;
  const mayOverride = target.raw >= maxRaw || (!trustedTop && rawGap <= gapLimit && rawRatio >= ratioFloor);
  if (!mayOverride) return answerScores;
  return answerScores.map((item) => {
    if (item.answer.id !== resolved.answerId) return item;
    return {
      ...item,
      raw: item.raw >= maxRaw ? item.raw : maxRaw + 0.1,
      evidence: [
        ...(item.evidence ?? []),
        {
          answerId: item.answer.id,
          page: resolved.page,
          text: resolved.text,
          score: resolved.interval ? 19 : 18,
          kind: resolved.interval ? "interval_relation_tuple_segment" : "relation_tuple_segment",
        },
      ],
    };
  });
}
