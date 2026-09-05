import {extractNumbers, normalizeForSearch, normalizeText, tokenize, uniqueTokens} from "../../../normalize.js";
import type {PdfPage} from "../../../pdf.js";
import type {AnswerScoringContext} from "../../contracts.js";
import {softCoverage, strictSoftCoverage, tokenHitCount} from "../../text-utils.js";
import type {AnswerOption, EvidenceItem} from "../../types.js";
import {buildRelationTupleFragments} from "../relation-tuple/index.js";

type ContrastiveFragment = {
  page: number;
  text: string;
};

type ShortLabel = {
  anchor: string;
  value: string;
};

type ComparatorDirection = "less" | "greater" | "at_most" | "at_least";
type ContrastiveSeverity = "mild" | "moderate" | "severe" | "very_severe";
type ContrastiveUnit = "days" | "hours" | "months" | "percent" | "weeks" | "years";
type ContrastivePopulation = "adults" | "children" | "elderly" | "men" | "women";
type ContrastiveMagnitude = "giant" | "large" | "medium" | "small";

type EmbeddedNumberLabel = {
  anchor: string;
  number: string;
  order: "anchor_first" | "number_first";
};

type ContrastiveQuantity = {
  number: string;
  unit: string | null;
};

type ContrastiveProfile = {
  answer: AnswerOption;
  tokens: string[];
  slotTokens: string[];
  numbers: string[];
  variableNumbers: string[];
  quantities: ContrastiveQuantity[];
  shortLabel: ShortLabel | null;
  embeddedNumberLabel: EmbeddedNumberLabel | null;
  comparator: ComparatorDirection | null;
};

type ContrastiveFamily = {
  profiles: ContrastiveProfile[];
  sharedTokens: string[];
  numeric: boolean;
  lexical: boolean;
  shortLabel: boolean;
  ordinal: boolean;
  coded: boolean;
};

type ContrastiveSource = {
  fragment: ContrastiveFragment;
  normalized: string;
  tokens: string[];
  orderedTokens: string[];
  numbers: string[];
  quantities: ContrastiveQuantity[];
};

type SlotMatch = {
  matched: boolean;
  strength: number;
};

export type ContrastiveOptionFamilyProof = {
  answerId: string;
  page: number;
  text: string;
  score: number;
  margin: number;
};

type ContrastiveResolverContext = Pick<
  AnswerScoringContext,
  "mode" | "question" | "answers" | "pages" | "topQuestionPages" | "questionTokens" | "focusTokens" | "intent"
>;

type OptionFamilyAdjustment = {
  adjustment: number;
  evidence: EvidenceItem | null;
};

const CONTRASTIVE_SLOT_IGNORES = new Set(
  uniqueTokens(
    [
      "менее более больше меньше выше ниже до от ровно",
      "ответ вариант значение показатель составляет является",
    ].join(" "),
  ),
);

const CONTRASTIVE_FOCUS_IGNORES = new Set(
  uniqueTokens(
    [
      "соответствует характерно считается является относятся относится",
      "укажите выберите определить преимущественно правильный при для среди после перед",
      "диагноз код классификация болезнь международный мкб имеет",
    ].join(" "),
  ),
);

const STRUCTURAL_ORDINAL_TOKENS = new Set(
  uniqueTokens("этап стадия степень место группа класс тип категория уровень"),
);

const STRUCTURAL_LABEL_ANCHORS = new Set(
  uniqueTokens("группа серогруппа класс тип категория стадия степень вариант подтип форма"),
);

const NEGATION_CUE_TOKENS = new Set(
  contrastiveTokenSequence("без не нет отсутствие отсутствует невозможность невозможно"),
);

const NEGATION_TARGET_IGNORES = new Set(
  contrastiveTokenSequence("их его ее это этот эта быть является"),
);

const CLINICAL_RECOMMENDATION_TOKENS = new Set(
  contrastiveTokenSequence(
    "показан показана показано показаны рекомендуется рекомендуются рекомендован рекомендована рекомендовано рекомендованы",
  ),
);

const REGULATORY_APPROVAL_TOKENS = new Set(
  contrastiveTokenSequence(
    "одобрен одобрена одобрено одобрены разрешен разрешена разрешено разрешены зарегистрирован зарегистрирована зарегистрировано",
  ),
);

const EXCLUSION_QUESTION_TOKENS = contrastiveTokenSequence(
  "исключить исключает исключается исключен исключена исключено исключены исключение",
);
const RESPONSE_RELATION_TOKENS = contrastiveTokenSequence(
  "неэффективность неэффективности эффективность эффективности ответ ответа реакция реакции чувствительность резистентность",
);
const RESPONSE_OBJECT_PREPOSITION = contrastiveTokenSequence("на")[0] ?? "";
const RESPONSE_OBJECT_BOUNDARIES = new Set(
  contrastiveTokenSequence("рекомендуется рекомендовано показано назначается"),
);
const MILD_SEVERITY_TOKENS = contrastiveTokenSequence("легкий лёгкий слабый");
const MODERATE_SEVERITY_TOKENS = contrastiveTokenSequence("средний среднетяжелый умеренный");
const SEVERE_SEVERITY_TOKENS = contrastiveTokenSequence("тяжелый тяжёлый");
const EXTREME_SEVERITY_TOKENS = contrastiveTokenSequence("крайне чрезвычайно");
const PERCENT_UNIT_TOKENS = contrastiveTokenSequence("процент процента процентов");
const YEAR_UNIT_TOKENS = contrastiveTokenSequence("лет год года годов возраст возрасте");
const MONTH_UNIT_TOKENS = contrastiveTokenSequence("месяц месяца месяцев");
const WEEK_UNIT_TOKENS = contrastiveTokenSequence("неделя недели недель");
const DAY_UNIT_TOKENS = contrastiveTokenSequence("день дня дней сутки суток");
const HOUR_UNIT_TOKENS = contrastiveTokenSequence("час часа часов");
const POPULATION_TOKEN_GROUPS: ReadonlyArray<readonly [ContrastivePopulation, string[]]> = [
  ["adults", contrastiveTokenSequence("взрослый взрослые взрослых")],
  ["children", contrastiveTokenSequence("дети детей ребенок ребёнок детский подросток")],
  ["elderly", contrastiveTokenSequence("пожилой пожилые старческий")],
  ["men", contrastiveTokenSequence("мужчина мужчины мужчин мужской")],
  ["women", contrastiveTokenSequence("женщина женщины женщин женский")],
];
const ORDINAL_TOKEN_GROUPS: ReadonlyArray<readonly [string, string[]]> = [
  ["1", contrastiveTokenSequence("первый первая первое первые первым первой")],
  ["2", contrastiveTokenSequence("второй вторая второе вторые вторым второй")],
  ["3", contrastiveTokenSequence("третий третья третье третьи третьим третьей")],
  ["4", contrastiveTokenSequence("четвертый четвёртый четвертая четвёртая четвертым четвёртым")],
  ["5", contrastiveTokenSequence("пятый пятая пятое пятым")],
];
const ROOM_TEMPERATURE_TOKENS = contrastiveTokenSequence("комнатный температура");
const COUNT_RELATION_TOKENS = contrastiveTokenSequence("количество число численность всего");
const MEASUREMENT_ACTION_TOKENS = contrastiveTokenSequence("исследование определение измерение");
const LEVEL_RELATION_TOKENS = contrastiveTokenSequence(
  "уровень уровня уровней содержание содержания концентрация концентрации",
);
const MEASUREMENT_SUBJECT_BOUNDARIES = new Set(
  contrastiveTokenSequence("в у для при до после пациент пациенты каждые проводится определяется измеряется"),
);
const FIXED_MEASUREMENT_UNIT_TOKENS = contrastiveTokenSequence("кг мг мкг мл г/л мл/кг мкм");
const MAGNITUDE_CONTEXT_TOKENS = contrastiveTokenSequence("размер диаметр длина ширина дефект");
const SMALL_MAGNITUDE_TOKENS = contrastiveTokenSequence(
  "малый малого малых малые маленький маленького маленьких небольшой небольшого небольших",
);
const MEDIUM_MAGNITUDE_TOKENS = contrastiveTokenSequence("средний среднего средних средние");
const LARGE_MAGNITUDE_TOKENS = contrastiveTokenSequence(
  "большой большого больших большие крупный крупного крупных крупные",
);
const GIANT_MAGNITUDE_TOKENS = contrastiveTokenSequence(
  "гигантский гигантского гигантских гигантские",
);

const proofCache = new WeakMap<PdfPage[], Map<string, ContrastiveOptionFamilyProof | null>>();
const sourceCache = new WeakMap<PdfPage[], ContrastiveSource[]>();

/**
 * Rejects locally negated claims rather than treating a mentioned value as support.
 * Numeric lower/upper bounds retain their comparison meaning.
 * @param text Original source fragment before lookalike folding.
 * @returns True when a clause contains polarity this resolver cannot prove.
 * @internal
 */
function hasUnsupportedSourceNegation(text: string): boolean {
  const bounded = normalizeText(text).replace(/не\s+(?:менее|более|ниже|выше|раньше|позже)(?=\s|$)/giu, " ");
  return /(?:^|[^\p{L}])(?:не|нет|без|кроме|никогда|отсутств\p{L}*)(?=$|[^\p{L}])/iu.test(bounded);
}

/**
 * Builds normalized proof sources once per immutable PDF page collection and
 * optionally narrows them to the same adjacent-page window as the tuple builder.
 *
 * @param pages Extracted PDF pages available to the scorer.
 * @param topQuestionPages Pages selected by the question search stage.
 * @returns Cached sources for the complete PDF or the requested page neighborhood.
 * @internal
 */
function cachedContrastiveSources(
  pages: PdfPage[],
  topQuestionPages: Set<number> = new Set<number>(),
): ContrastiveSource[] {
  let sources = sourceCache.get(pages);
  if (!sources) {
    sources = buildRelationTupleFragments(pages).map((fragment) => ({
      fragment,
      normalized: normalizeForSearch(fragment.text),
      tokens: uniqueTokens(fragment.text),
      orderedTokens: contrastiveTokenSequence(fragment.text),
      numbers: canonicalContrastiveNumbers(fragment.text),
      quantities: contrastiveQuantities(fragment.text),
    }));
    sourceCache.set(pages, sources);
  }
  if (!topQuestionPages.size) return sources;
  return sources.filter(({fragment}) => (
    topQuestionPages.has(fragment.page) ||
    topQuestionPages.has(fragment.page - 1) ||
    topQuestionPages.has(fragment.page + 1)
  ));
}

const CONTRASTIVE_NUMBER_PATTERN = /[+-]?\d+(?:[.,]\d+)?(?:\s*-\s*[+-]?\d+(?:[.,]\d+)?)?/gu;
const CONTRASTIVE_UNIT_ATOMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(?:процент(?:а|ов|ы|ах)?|percent|percents)(?=$|[^\p{L}\p{N}])/iu, "percent"],
  [/^(?:градус(?:а|ов)?|degree|degrees)(?=$|[^\p{L}\p{N}])/iu, "degree"],
  [/^(?:мм\s*рт\.?\s*ст\.?|mm\s*hg)(?=$|[^\p{L}\p{N}])/iu, "mmhg"],
  [/^(?:мкмоль|mkmol|mcmol|[µμu]mol)(?=$|[^\p{L}\p{N}])/iu, "mcmol"],
  [/^(?:ммоль|mmol)(?=$|[^\p{L}\p{N}])/iu, "mmol"],
  [/^(?:моль|mol)(?=$|[^\p{L}\p{N}])/iu, "mol"],
  [/^(?:мкг|mcg|[µμu]g)(?=$|[^\p{L}\p{N}])/iu, "mcg"],
  [/^(?:[мm][гg]|mg)(?=$|[^\p{L}\p{N}])/iu, "mg"],
  [/^(?:[кk][гg]|kg)(?=$|[^\p{L}\p{N}])/iu, "kg"],
  [/^(?:[гg])(?!\.)(?=$|[^\p{L}\p{N}])/iu, "g"],
  [/^(?:[мm][лl]|ml)(?=$|[^\p{L}\p{N}])/iu, "ml"],
  [/^(?:[лl])(?=$|[^\p{L}\p{N}])/iu, "l"],
  [/^(?:мкм|mkm|mcm|[µμu]m)(?=$|[^\p{L}\p{N}])/iu, "mcm"],
  [/^(?:[мm][мm]|mm)(?=$|[^\p{L}\p{N}])/iu, "mm"],
  [/^(?:[сc][мm]|cm)(?=$|[^\p{L}\p{N}])/iu, "cm"],
  [/^(?:[мm])(?:²|2)(?=$|[^\p{L}\p{N}])/iu, "m2"],
  [/^(?:[мm])(?:³|3)(?=$|[^\p{L}\p{N}])/iu, "m3"],
  [/^(?:[мm])(?=$|[^\p{L}\p{N}])/iu, "m"],
  [/^(?:секунд(?:а|ы)?|сек|second|seconds|sec)(?=$|[^\p{L}\p{N}])/iu, "second"],
  [/^(?:минут(?:а|ы)?|мин|min(?:ute)?s?)(?=$|[^\p{L}\p{N}])/iu, "minute"],
  [/^(?:час(?:а|ов)?|ч\.?|hour|hours|hr)(?=$|[^\p{L}\p{N}])/iu, "hour"],
  [/^(?:сут(?:ки|ок)?|д(?:н)?\.?|день|дня|дней|day|days)(?=$|[^\p{L}\p{N}])/iu, "day"],
  [/^(?:недел(?:я|и|ь)|нед\.?|week|weeks)(?=$|[^\p{L}\p{N}])/iu, "week"],
  [/^(?:месяц(?:а|ев)?|мес\.?|month|months)(?=$|[^\p{L}\p{N}])/iu, "month"],
  [/^(?:год(?:а|ов)?|лет|г\.?|year|years)(?=$|[^\p{L}\p{N}])/iu, "year"],
  [/^(?:единиц(?:а|ы)?|ед\.?|units?)(?=$|[^\p{L}\p{N}])/iu, "unit"],
  [/^(?:ме|iu)(?=$|[^\p{L}\p{N}])/iu, "iu"],
  [/^(?:балл(?:а|ов)?|points?)(?=$|[^\p{L}\p{N}])/iu, "point"],
  [/^(?:раз(?:а|ов)?|р\.?|times?)(?=$|[^\p{L}\p{N}])/iu, "time"],
  [/^(?:кпа|kpa)(?=$|[^\p{L}\p{N}])/iu, "kpa"],
];

/**
 * Canonicalizes one signed scalar while preserving a meaningful unary minus.
 *
 * @param value Raw scalar extracted from an option or a bounded source fragment.
 * @returns Decimal-point, zero, and sign normalized scalar text.
 * @internal
 */
function canonicalScalarNumber(value: string): string {
  const normalized = String(value ?? "").replace(",", ".");
  const sign = normalized.startsWith("-") ? "-" : "";
  const unsigned = normalized.replace(/^[+-]/u, "").replace(/^0+(?=\d)/u, "") || "0";
  const compact = unsigned.replace(/\.0+$/u, "").replace(/(\.\d*?)0+$/u, "$1");
  return sign && Number(compact) !== 0 ? `${sign}${compact}` : compact;
}

/**
 * Canonicalizes a scalar or a two-ended numeric range without losing endpoint signs.
 *
 * @param value Raw numeric slot including an optional range delimiter.
 * @returns Stable scalar or range representation used by the local resolver.
 * @internal
 */
function canonicalContrastiveNumber(value: string): string {
  const compact = String(value ?? "").replace(/%$/u, "").replace(/\s+/gu, "");
  const range = compact.match(/^([+-]?\d+(?:[.,]\d+)?)-([+-]?\d+(?:[.,]\d+)?)$/u);
  if (range) return `${canonicalScalarNumber(range[1])}-${canonicalScalarNumber(range[2])}`;
  return canonicalScalarNumber(compact);
}

/**
 * Lists unsigned magnitudes represented by one signed scalar or range.
 *
 * @param value Canonical signed scalar or range.
 * @returns Whole-range and endpoint magnitudes used to suppress unsigned duplicates.
 * @internal
 */
function unsignedContrastiveNumbers(value: string): string[] {
  const range = String(value).match(/^([+-]?\d+(?:\.\d+)?)-([+-]?\d+(?:\.\d+)?)$/u);
  if (!range) return [String(value).replace(/^[+-]/u, "")];
  const first = range[1].replace(/^[+-]/u, "");
  const second = range[2].replace(/^[+-]/u, "");
  return [`${first}-${second}`, first, second];
}

/**
 * Reads one recognized measurement atom at the beginning of a text slice.
 *
 * @param text Source suffix beginning at a possible unit token.
 * @returns Consumed length and canonical atom, or `null` for unknown text.
 * @internal
 */
function readContrastiveUnitAtom(text: string): {length: number; unit: string} | null {
  for (const [pattern, unit] of CONTRASTIVE_UNIT_ATOMS) {
    const match = text.match(pattern);
    if (match?.[0]) return {length: match[0].length, unit};
  }
  return null;
}

/**
 * Binds a measurement signature to the number immediately preceding it.
 *
 * @param text Normalized option or bounded source text.
 * @param numberEnd Exclusive character offset of the numeric slot.
 * @returns Canonical simple or compound unit, or `null` when none is adjacent.
 * @internal
 */
function contrastiveUnitAfter(text: string, numberEnd: number): string | null {
  let tail = text.slice(numberEnd, numberEnd + 64);
  const leading = tail.match(/^\s*/u)?.[0].length ?? 0;
  tail = tail.slice(leading);
  if (tail.startsWith("%")) return "percent";
  const temperature = tail.match(/^°\s*[cс](?=$|[^\p{L}\p{N}])/iu);
  if (temperature) return "celsius";
  if (tail.startsWith("°")) return "degree";

  const first = readContrastiveUnitAtom(tail);
  if (!first) return null;
  const units = [first.unit];
  let offset = first.length;
  while (units.length < 4) {
    const separator = tail.slice(offset).match(/^\s*(?:\/|(?:в|на|за)\s+)(?:\s*)/iu);
    if (!separator?.[0]) break;
    const next = readContrastiveUnitAtom(tail.slice(offset + separator[0].length));
    if (!next) break;
    units.push(next.unit);
    offset += separator[0].length + next.length;
  }
  return units.join("/");
}

/**
 * Extracts local signed-number and adjacent-unit pairs without changing global normalization.
 *
 * @param text Option, question, or bounded source fragment to inspect.
 * @returns Deduplicated quantities in source order.
 * @internal
 */
function contrastiveQuantities(text: string): ContrastiveQuantity[] {
  const raw = String(text ?? "").normalize("NFKC");
  const rangeSafe = raw.replace(/[–—‒―]/gu, (_dash, offset: number, source: string) => {
    const before = source[offset - 1] ?? "";
    const after = source[offset + 1] ?? "";
    return /\d/u.test(before) && /[+\-\d]/u.test(after) ? "-" : " ";
  });
  const normalized = normalizeText(rangeSafe);
  const quantities: Array<ContrastiveQuantity & {start: number; end: number}> = [];
  for (const match of normalized.matchAll(CONTRASTIVE_NUMBER_PATTERN)) {
    const start = match.index ?? 0;
    const before = normalized[start - 1] ?? "";
    if (before && /[\p{L}\p{N}.,]/u.test(before)) continue;
    const rawNumber = match[0];
    const number = canonicalContrastiveNumber(rawNumber);
    const unit = contrastiveUnitAfter(normalized, start + rawNumber.length);
    if (number) quantities.push({number, unit, start, end: start + rawNumber.length});
  }
  for (let index = quantities.length - 2; index >= 0; index -= 1) {
    const current = quantities[index];
    const next = quantities[index + 1];
    const connector = normalized.slice(current.end, next.start);
    if (!current.unit && next.unit && /^\s*(?:до|по|и|или|,)\s*$/u.test(connector)) current.unit = next.unit;
  }
  return quantities
    .map(({number, unit}) => ({number, unit}))
    .filter((quantity, index, all) =>
      all.findIndex((candidate) => candidate.number === quantity.number && candidate.unit === quantity.unit) === index);
}

/**
 * Extracts signed numeric slots in a stable form. The local parser deliberately
 * keeps unary minus while leaving the global extraction contract unchanged.
 *
 * @param text Option or bounded source text to inspect.
 * @returns Unique signed scalar, range, word-number, and Roman slots.
 * @internal
 */
function canonicalContrastiveNumbers(text: string): string[] {
  const quantities = contrastiveQuantities(text);
  const values = quantities.map((quantity) => quantity.number);
  const representedUnsigned = new Set(values.flatMap(unsignedContrastiveNumbers));
  for (const extracted of extractNumbers(text)) {
    const value = canonicalContrastiveNumber(extracted);
    if (value && !representedUnsigned.has(value)) values.push(value);
  }
  const tokens = contrastiveTokenSequence(text);
  for (let index = 0; index < tokens.length; index += 1) {
    if (!/^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)$/u.test(tokens[index])) continue;
    const neighbors = tokens.slice(Math.max(0, index - 1), index + 2);
    if (neighbors.some((token) =>
      softCoverage([token], [...STRUCTURAL_ORDINAL_TOKENS]) === 1)) {
      values.push(`roman:${tokens[index]}`);
    }
  }
  return [...new Set(values.filter(Boolean))];
}

/**
 * Detects an explicit measured value in the question that is not one of the
 * answer slots. Such a value usually qualifies the requested row, so a nearby
 * clause about a different value must not override the ordinary predictor.
 *
 * @param question Original question that may contain a fixed measured value.
 * @param answers Complete numeric option family.
 * @returns `true` when the question has a non-option value with a measurement unit.
 * @internal
 */
function questionHasFixedMeasurementAnchor(question: string, answers: AnswerOption[]): boolean {
  const answerNumbers = new Set((answers ?? []).flatMap((answer) => canonicalContrastiveNumbers(answer.text)));
  const fixedNumbers = canonicalContrastiveNumbers(question)
    .filter((number) => !number.startsWith("roman:") && !answerNumbers.has(number));
  if (!fixedNumbers.length) return false;
  if (String(question ?? "").includes("%")) return true;
  const tokens = contrastiveTokenSequence(question);
  return FIXED_MEASUREMENT_UNIT_TOKENS.some((cue) => softCoverage([cue], tokens) === 1);
}

/**
 * Extracts a number that is visibly attached to a letter label in an option.
 * The label is structural syntax rather than domain knowledge and prevents a
 * bare table or reference number from impersonating an alphanumeric option.
 *
 * @param text Original option text.
 * @returns One unambiguous attached label/number pair or `null`.
 * @internal
 */
function embeddedNumberLabel(text: string): EmbeddedNumberLabel | null {
  const candidates: EmbeddedNumberLabel[] = [];
  const patterns: ReadonlyArray<readonly [RegExp, EmbeddedNumberLabel["order"]]> = [
    [/([\p{L}]{2,})(\d+(?:[.,]\d+)?)/giu, "anchor_first"],
    [/(\d+(?:[.,]\d+)?)([\p{L}]{2,})/giu, "number_first"],
  ];
  for (const [pattern, order] of patterns) {
    for (const match of String(text ?? "").matchAll(pattern)) {
      const rawAnchor = order === "anchor_first" ? match[1] : match[2];
      const rawNumber = order === "anchor_first" ? match[2] : match[1];
      const anchor = contrastiveTokenSequence(rawAnchor)[0] ?? "";
      const number = canonicalContrastiveNumbers(rawNumber)[0] ?? "";
      if (anchor && number) candidates.push({anchor, number, order});
    }
  }
  const unique = candidates.filter((candidate, index, all) =>
    all.findIndex((item) =>
      item.anchor === candidate.anchor &&
      item.number === candidate.number &&
      item.order === candidate.order) === index);
  return unique.length === 1 ? unique[0] : null;
}

/**
 * Requires an attached option label and its number to remain adjacent in the
 * local proof. A distant occurrence of the same bare number is insufficient.
 *
 * @param label Attached label/number pair extracted from an option.
 * @param source Prepared local PDF fragment considered as proof.
 * @returns `true` when the same ordered pair occurs locally.
 * @internal
 */
function sourceMatchesEmbeddedNumberLabel(label: EmbeddedNumberLabel | null, source: ContrastiveSource): boolean {
  if (!label) return true;
  const tokens = source?.orderedTokens ?? [];
  const numberAt = (index: number): boolean =>
    index >= 0 && canonicalContrastiveNumbers(tokens[index] ?? "").includes(label.number);
  for (let index = 0; index < tokens.length; index += 1) {
    const anchorMatch = softCoverage([label.anchor], [tokens[index]]) === 1;
    if (label.order === "anchor_first" && anchorMatch && numberAt(index + 1)) return true;
    if (label.order === "number_first" && numberAt(index) &&
      softCoverage([label.anchor], [tokens[index + 1] ?? ""]) === 1) return true;
  }
  return false;
}

/**
 * Извлекает направления сравнения, локально связанные с конкретным числом.
 * Поддерживаются символьные и словесные формы без медицинских предметных правил.
 *
 * @param text Текст варианта ответа или ограниченного source-фрагмента.
 * @param number Каноническое число, возле которого ищется компаратор.
 * @returns Comparison directions with strict and inclusive bounds kept distinct.
 * @internal
 */
function contrastiveComparatorDirections(text: string, number: string): Set<ComparatorDirection> {
  const normalized = normalizeText(text);
  const directions = new Set<ComparatorDirection>();
  if (!number) return directions;
  for (const match of normalized.matchAll(CONTRASTIVE_NUMBER_PATTERN)) {
    if (canonicalContrastiveNumber(match[0]) !== number) continue;
    const index = match.index ?? 0;
    if (index > 0 && /[\p{L}\p{N}]/u.test(normalized[index - 1])) continue;
    const before = normalized.slice(Math.max(0, index - 40), index).trim();
    const after = normalized.slice(index + match[0].length, index + match[0].length + 40);
    if (/(?:<=|≤|(?:^|\s)не\s+(?:более|выше)|(?:^|\s)до)\s*$/u.test(before)) directions.add("at_most");
    else if (/(?:>=|≥|(?:^|\s)не\s+(?:менее|ниже))\s*$/u.test(before)) directions.add("at_least");
    else if (/(?:<|(?:^|\s)(?:менее|меньше|ниже|младше))\s*$/u.test(before)) directions.add("less");
    else if (/(?:>|(?:^|\s)(?:более|больше|выше|свыше|старше))\s*$/u.test(before)) directions.add("greater");
    if (/^\s*(?:%|\p{L}+)?\s*и\s+(?:менее|ниже|меньше)(?=$|[^\p{L}])/u.test(after)) directions.add("at_most");
    if (/^\s*(?:%|\p{L}+)?\s*и\s+(?:более|выше|больше|старше)(?=$|[^\p{L}])/u.test(after)) directions.add("at_least");
  }
  return directions;
}

/**
 * Возвращает единственное направление сравнения для варианта ответа и
 * воздерживается, если форма отсутствует либо одновременно указывает обе стороны.
 *
 * @param text Исходный текст варианта ответа.
 * @param number Каноническое различающее число варианта.
 * @returns Одно направление сравнения или `null` при отсутствии однозначной формы.
 * @internal
 */
function contrastiveComparatorDirection(text: string, number: string): ComparatorDirection | null {
  const directions = [...contrastiveComparatorDirections(text, number)];
  return directions.length === 1 ? directions[0] : null;
}

/**
 * Возвращает упорядоченные токены с сохранением коротких структурных меток.
 * Последовательность нужна, чтобы буква группы совпадала только рядом со своим
 * якорем, а не с одноимённым предлогом или союзом в произвольном месте.
 *
 * @param text Исходный текст варианта ответа или source-фрагмента.
 * @returns Нормализованная последовательность токенов с сохранёнными стоп-словами.
 * @internal
 */
function contrastiveTokenSequence(text: string): string[] {
  return tokenize(text, {keepStopwords: true});
}

/**
 * Выделяет короткую буквенную метку условия вопроса вместе со стоящим перед
 * ней структурным якорем, например метку строки классификационной таблицы.
 *
 * @param question Исходный текст вопроса.
 * @returns Единственная структурная метка вопроса или `null` при неоднозначности.
 * @internal
 */
function questionShortCondition(question: string): ShortLabel | null {
  const tokens = contrastiveTokenSequence(question);
  const candidates: ShortLabel[] = [];
  for (let index = 1; index < tokens.length; index += 1) {
    const value = tokens[index];
    const anchor = tokens[index - 1];
    if (
      /^[a-zа-я]$/iu.test(value) &&
      anchor.length >= 3 &&
      softCoverage([anchor], [...STRUCTURAL_LABEL_ANCHORS]) === 1
    ) {
      candidates.push({anchor, value});
    }
  }
  const unique = candidates.filter(
    (candidate, index, all) =>
      all.findIndex((item) => item.anchor === candidate.anchor && item.value === candidate.value) === index,
  );
  return unique.length === 1 ? unique[0] : null;
}

/**
 * Проверяет привязку source-фрагмента к короткой метке из вопроса. Метка должна
 * стоять возле того же якоря либо открывать строку, как это бывает в таблице.
 *
 * @param condition Структурная метка, извлечённая из вопроса.
 * @param source Подготовленный локальный PDF-фрагмент.
 * @returns `true`, если фрагмент относится к требуемой строке или условию.
 * @internal
 */
function sourceMatchesQuestionCondition(condition: ShortLabel, source: ContrastiveSource): boolean {
  const tokens = source?.orderedTokens ?? [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (tokens[index] === condition.anchor && tokens.slice(index + 1, index + 3).includes(condition.value)) return true;
  }
  return tokens[0] === condition.value;
}

/**
 * Выделяет смысловые токены, которые в вопросе находятся под явной локальной
 * областью отрицания: после `без`, `не`, `отсутствие` или `невозможность`.
 *
 * @param text Исходный текст вопроса.
 * @returns Уникальные токены, для которых source обязан сохранить отрицание.
 * @internal
 */
function negatedFocusTargets(text: string): string[] {
  const tokens = contrastiveTokenSequence(text);
  const targets: string[] = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (!NEGATION_CUE_TOKENS.has(tokens[index])) continue;
    if (index > 0 && tokens[index - 1].includes("/")) continue;
    const target = tokens
      .slice(index + 1, index + 5)
      .find((token) => token.length >= 3 && !NEGATION_TARGET_IGNORES.has(token));
    if (target) targets.push(target);
  }
  return [...new Set(targets)];
}

/**
 * Проверяет, что каждый отрицательный фокус вопроса остаётся отрицательным в
 * локальном source-фрагменте, а не превращается в положительное упоминание.
 *
 * @param targets Токены под областью отрицания в вопросе.
 * @param source Подготовленный локальный PDF-фрагмент.
 * @returns `true`, если отрицательная полярность и её локальная цель сохранены.
 * @internal
 */
function sourceMatchesNegatedFocus(targets: string[], source: ContrastiveSource): boolean {
  if (!targets.length) return true;
  const tokens = source?.orderedTokens ?? [];
  return targets.every((target) => {
    for (let index = 0; index < tokens.length; index += 1) {
      const candidate = tokens[index];
      if (softCoverage([target], [candidate]) < 1) continue;
      if (tokens.slice(Math.max(0, index - 4), index).some((token) => NEGATION_CUE_TOKENS.has(token))) return true;
    }
    return false;
  });
}

/**
 * Prevents a regulatory approval statement from substituting for a clinical
 * indication or recommendation asked by the question. A matching clinical
 * predicate remains acceptable, while unrelated neutral prose is left to the
 * ordinary focus and margin checks.
 *
 * @param question Original question whose requested modality must be preserved.
 * @param source Prepared local PDF fragment considered as proof.
 * @returns `false` only for an approval-only modality conflict.
 * @internal
 */
function sourceMatchesQuestionModality(question: string, source: ContrastiveSource): boolean {
  const questionTokens = contrastiveTokenSequence(question);
  if (!questionTokens.some((token) => CLINICAL_RECOMMENDATION_TOKENS.has(token))) return true;
  const sourceTokens = source?.orderedTokens ?? [];
  if (sourceTokens.some((token) => CLINICAL_RECOMMENDATION_TOKENS.has(token))) return true;
  return !sourceTokens.some((token) => REGULATORY_APPROVAL_TOKENS.has(token));
}

/**
 * Detects an explicit request to rule a condition out. A positive occurrence
 * or threshold near the same words is not sufficient proof for that polarity.
 *
 * @param question Original question inspected for exclusion wording.
 * @returns `true` when the question explicitly asks to exclude something.
 * @internal
 */
function questionRequiresExclusion(question: string): boolean {
  const tokens = contrastiveTokenSequence(question);
  return EXCLUSION_QUESTION_TOKENS.some((cue) => strictSoftCoverage([cue], tokens) === 1);
}

/**
 * Extracts the named object in a response relation such as "ineffectiveness
 * on X". The parser uses only the local preposition and relation wording.
 *
 * @param question Original question inspected for a response object.
 * @returns Unique object anchors following a bounded response relation.
 * @internal
 */
function questionResponseObjectAnchors(question: string): string[] {
  const tokens = contrastiveTokenSequence(question);
  const anchors: string[] = [];
  for (let index = 1; index < tokens.length - 1; index += 1) {
    if (tokens[index] !== RESPONSE_OBJECT_PREPOSITION) continue;
    const relationWindow = tokens.slice(Math.max(0, index - 4), index);
    const hasRelation = RESPONSE_RELATION_TOKENS.some((cue) =>
      strictSoftCoverage([cue], relationWindow) === 1);
    if (!hasRelation) continue;
    for (const anchor of tokens.slice(index + 1, index + 3)) {
      if (RESPONSE_OBJECT_BOUNDARIES.has(anchor)) break;
      if (anchor.length >= 4) anchors.push(anchor);
    }
  }
  return [...new Set(anchors)];
}

/**
 * Requires the named response object from the question to remain in the local
 * proof, preventing evidence about another object from occupying the slot.
 *
 * @param anchors Named response objects extracted from the question.
 * @param source Prepared local PDF fragment considered as proof.
 * @returns `true` when every extracted object is locally present.
 * @internal
 */
function sourceMatchesQuestionResponseObject(anchors: string[], source: ContrastiveSource): boolean {
  if (!anchors.length) return true;
  return strictSoftCoverage(anchors, source?.tokens ?? []) === 1;
}

/**
 * Extracts explicit qualitative severity classes while keeping questions that
 * name more than one class distinguishable from single-row questions.
 *
 * @param text Question or local source text that may name severity classes.
 * @returns Explicit canonical severity classes present in the text.
 * @internal
 */
function contrastiveSeverityClasses(text: string): Set<ContrastiveSeverity> {
  const tokens = contrastiveTokenSequence(text).filter((token) => token.length >= 4);
  const hasCue = (cues: string[]): boolean =>
    cues.some((cue) => softCoverage([cue], tokens) === 1);
  const classes = new Set<ContrastiveSeverity>();
  const moderate = hasCue(MODERATE_SEVERITY_TOKENS);
  if (moderate) classes.add("moderate");
  if (hasCue(MILD_SEVERITY_TOKENS)) classes.add("mild");
  if (!moderate && hasCue(SEVERE_SEVERITY_TOKENS)) {
    classes.add(hasCue(EXTREME_SEVERITY_TOKENS) ? "very_severe" : "severe");
  }
  return classes;
}

/**
 * Canonicalizes one explicit qualitative severity class and abstains when the
 * text names no class or several different classes.
 *
 * @param text Question or local source text that may name severity classes.
 * @returns The sole canonical severity class or `null` for absent/ambiguous text.
 * @internal
 */
function contrastiveSeverityClass(text: string): ContrastiveSeverity | null {
  const classes = [...contrastiveSeverityClasses(text)];
  return classes.length === 1 ? classes[0] : null;
}

/**
 * Keeps a numeric or lexical slot attached to the qualitative severity class
 * named in the question, instead of accepting a nearby table header or row.
 *
 * @param question Original question that may contain a severity qualifier.
 * @param source Prepared local PDF fragment considered as proof.
 * @returns `true` when no class is requested or the source names the same class.
 * @internal
 */
function sourceMatchesQuestionSeverity(question: string, source: ContrastiveSource): boolean {
  const requested = contrastiveSeverityClass(question);
  return requested == null || contrastiveSeverityClasses(source?.fragment?.text ?? "").has(requested);
}

/**
 * Extracts one explicit relative size class only when the text also names a
 * size relation. Multiple classes are deliberately treated as ambiguous.
 *
 * @param text Question or local source text inspected for a size class.
 * @returns One canonical magnitude class or `null`.
 * @internal
 */
function contrastiveMagnitudeClass(text: string): ContrastiveMagnitude | null {
  const tokens = contrastiveTokenSequence(text).filter((token) => token.length >= 3);
  if (!MAGNITUDE_CONTEXT_TOKENS.some((cue) => softCoverage([cue], tokens) === 1)) return null;
  const classes = new Set<ContrastiveMagnitude>();
  const hasCue = (cues: string[]): boolean =>
    cues.some((cue) => softCoverage([cue], tokens) === 1);
  if (hasCue(SMALL_MAGNITUDE_TOKENS)) classes.add("small");
  if (hasCue(MEDIUM_MAGNITUDE_TOKENS)) classes.add("medium");
  if (hasCue(LARGE_MAGNITUDE_TOKENS)) classes.add("large");
  if (hasCue(GIANT_MAGNITUDE_TOKENS)) classes.add("giant");
  return classes.size === 1 ? [...classes][0] : null;
}

/**
 * Preserves the explicit relative size class requested by the question.
 *
 * @param question Original question that may name one magnitude class.
 * @param source Prepared local PDF fragment considered as proof.
 * @returns `true` when no size class is requested or the same class is local.
 * @internal
 */
function sourceMatchesQuestionMagnitude(question: string, source: ContrastiveSource): boolean {
  const requested = contrastiveMagnitudeClass(question);
  return requested == null || contrastiveMagnitudeClass(source?.fragment?.text ?? "") === requested;
}

/**
 * Extracts only unit classes that can be recognized reliably in short option
 * families even when the answer itself contains a bare number.
 *
 * @param text Question, option, or source fragment inspected for unit markers.
 * @returns Explicit percentage and age/year unit classes found in the text.
 * @internal
 */
function contrastiveUnitClasses(text: string): Set<ContrastiveUnit> {
  const tokens = contrastiveTokenSequence(text).filter((token) => token.length >= 3);
  const units = new Set<ContrastiveUnit>();
  if (
    String(text ?? "").includes("%") ||
    PERCENT_UNIT_TOKENS.some((cue) => softCoverage([cue], tokens) === 1)
  ) {
    units.add("percent");
  }
  if (YEAR_UNIT_TOKENS.some((cue) => softCoverage([cue], tokens) === 1)) units.add("years");
  if (MONTH_UNIT_TOKENS.some((cue) => softCoverage([cue], tokens) === 1)) units.add("months");
  if (WEEK_UNIT_TOKENS.some((cue) => softCoverage([cue], tokens) === 1)) units.add("weeks");
  if (DAY_UNIT_TOKENS.some((cue) => softCoverage([cue], tokens) === 1)) units.add("days");
  if (HOUR_UNIT_TOKENS.some((cue) => softCoverage([cue], tokens) === 1)) units.add("hours");
  return units;
}

/**
 * Derives units required by the question or shared explicitly by every option.
 *
 * @param question Original question text.
 * @param answers Complete option family.
 * @returns Unit classes that every accepted proof fragment must contain.
 * @internal
 */
function requiredContrastiveUnits(question: string, answers: AnswerOption[]): Set<ContrastiveUnit> {
  const required = contrastiveUnitClasses(question);
  const answerUnits = (answers ?? []).map((answer) => contrastiveUnitClasses(answer.text));
  for (const unit of ["days", "hours", "months", "percent", "weeks", "years"] as const) {
    if (answerUnits.length && answerUnits.every((units) => units.has(unit))) required.add(unit);
  }
  return required;
}

/**
 * Collects recognized measurement signatures occurring explicitly in text.
 *
 * @param text Question or answer text whose explicit units are inspected.
 * @returns Canonical unit signatures without inferred medical meaning.
 * @internal
 */
function contrastiveUnitSignatures(text: string): Set<string> {
  const signatures = new Set(contrastiveQuantities(text).flatMap((quantity) => quantity.unit ? [quantity.unit] : []));
  const normalized = normalizeText(text);
  if (normalized.includes("%")) signatures.add("percent");
  if (/°\s*[cс](?=$|[^\p{L}\p{N}])/iu.test(normalized)) signatures.add("celsius");
  else if (normalized.includes("°")) signatures.add("degree");
  for (const match of normalized.matchAll(/[\p{L}µμ]+(?:²|³|2|3)?/gu)) {
    const atom = readContrastiveUnitAtom(match[0]);
    if (atom?.length === match[0].length) signatures.add(atom.unit);
  }
  return signatures;
}

/**
 * Derives one unambiguous unit for numeric answer slots or requests abstention.
 *
 * @param question Original question that may state the answer dimension.
 * @param answers Complete option family used to find a shared explicit unit.
 * @returns Required unit and an ambiguity flag for incompatible dimensions.
 * @internal
 */
function requiredContrastiveNumericUnit(
  question: string,
  answers: AnswerOption[],
): {ambiguous: boolean; unit: string | null} {
  const answerUnits = (answers ?? []).map((answer) =>
    new Set(contrastiveQuantities(answer.text).flatMap((quantity) => quantity.unit ? [quantity.unit] : [])));
  const answersWithUnits = answerUnits.filter((units) => units.size > 0);
  if (answersWithUnits.length) {
    if (answersWithUnits.length !== answerUnits.length || answerUnits.some((units) => units.size !== 1)) {
      return {ambiguous: true, unit: null};
    }
    const shared = [...answerUnits[0]];
    if (shared.length !== 1 || answerUnits.some((units) => !units.has(shared[0]))) {
      return {ambiguous: true, unit: null};
    }
    return {ambiguous: false, unit: shared[0]};
  }

  const questionUnits = [...contrastiveUnitSignatures(question)];
  if (questionUnits.length > 1) return {ambiguous: true, unit: null};
  return {ambiguous: false, unit: questionUnits[0] ?? null};
}

/**
 * Checks that a numeric proof preserves every explicit unit required by the
 * question or the complete option family.
 *
 * @param required Unit classes that cannot be discarded during matching.
 * @param source Prepared local PDF fragment considered as proof.
 * @returns `true` when all required unit markers occur in the fragment.
 * @internal
 */
function sourceMatchesContrastiveUnits(required: Set<ContrastiveUnit>, source: ContrastiveSource): boolean {
  if (!required.size) return true;
  const sourceUnits = contrastiveUnitClasses(source?.fragment?.text ?? "");
  return [...required].every((unit) => sourceUnits.has(unit));
}

/**
 * Extracts explicit patient population classes without inferring them from
 * ages, diagnoses, or other indirect context.
 *
 * @param text Question or source text inspected for population wording.
 * @returns Explicit population classes named in the text.
 * @internal
 */
function contrastivePopulationClasses(text: string): Set<ContrastivePopulation> {
  const tokens = contrastiveTokenSequence(text).filter((token) => token.length >= 4);
  const populations = new Set<ContrastivePopulation>();
  for (const [population, cues] of POPULATION_TOKEN_GROUPS) {
    if (cues.some((cue) => softCoverage([cue], tokens) === 1)) populations.add(population);
  }
  return populations;
}

/**
 * Requires a uniquely named patient population in the question to remain
 * explicit in the local proof fragment.
 *
 * @param question Original question that may name one patient population.
 * @param source Prepared local PDF fragment considered as proof.
 * @returns `true` for no/ambiguous population request or an exact class match.
 * @internal
 */
function sourceMatchesQuestionPopulation(question: string, source: ContrastiveSource): boolean {
  const requested = [...contrastivePopulationClasses(question)];
  if (requested.length !== 1) return true;
  return contrastivePopulationClasses(source?.fragment?.text ?? "").has(requested[0]);
}

/**
 * Extracts explicit two-part hyphenated conditions without interpreting their
 * domain meaning. Keeping both sides prevents a generic neighboring clause
 * from replacing a named subtype, mechanism, or compound subject.
 *
 * @param question Original question inspected for hyphenated conditions.
 * @returns Normalized two-token condition groups in question order.
 * @internal
 */
function questionCompoundConditions(question: string): string[][] {
  const conditions: string[][] = [];
  for (const match of String(question ?? "").matchAll(/([\p{L}]{2,})\s*-\s*([\p{L}]{3,})/giu)) {
    const compound = [match[1], match[2]]
      .map((part) => normalizeForSearch(part))
      .filter((token) => token.length >= 2);
    if (compound.length === 2) conditions.push(compound);
  }
  return conditions;
}

/**
 * Extracts explicit local conditions whose omission changes the requested
 * proposition, currently ordinal time periods and room-temperature context.
 *
 * @param question Original question inspected for bounded condition phrases.
 * @returns Token groups that every accepted proof fragment must preserve.
 * @internal
 */
function questionContrastiveConditions(question: string): string[][] {
  const tokens = contrastiveTokenSequence(question).filter((token) => token.length >= 3);
  const conditions: string[][] = [];
  const timeCues = [
    ...YEAR_UNIT_TOKENS,
    ...MONTH_UNIT_TOKENS,
    ...WEEK_UNIT_TOKENS,
    ...DAY_UNIT_TOKENS,
    ...HOUR_UNIT_TOKENS,
  ];
  const timeIndex = tokens.findIndex((token) =>
    timeCues.some((cue) => softCoverage([cue], [token]) === 1));
  if (timeIndex >= 0) {
    for (const [, ordinalCues] of ORDINAL_TOKEN_GROUPS) {
      const ordinalIndex = tokens.findIndex((token) =>
        ordinalCues.some((cue) => softCoverage([cue], [token]) === 1));
      if (ordinalIndex >= 0 && Math.abs(ordinalIndex - timeIndex) <= 4) {
        conditions.push([tokens[ordinalIndex], tokens[timeIndex]]);
        break;
      }
    }
  }

  const roomCondition = ROOM_TEMPERATURE_TOKENS.map((cue) =>
    tokens.find((token) => softCoverage([cue], [token]) === 1) ?? "");
  if (roomCondition.every(Boolean)) conditions.push(roomCondition);

  conditions.push(...questionCompoundConditions(question));
  return conditions;
}

/**
 * Requires every explicit condition token group from the question to coexist
 * in the same bounded proof fragment.
 *
 * @param conditions Condition token groups extracted from the question.
 * @param source Prepared local PDF fragment considered as proof.
 * @returns `true` when every required condition group is locally preserved.
 * @internal
 */
function sourceMatchesQuestionConditions(conditions: string[][], source: ContrastiveSource): boolean {
  if (!conditions.length) return true;
  const tokens = (source?.orderedTokens ?? []).filter((token) => token.length >= 3);
  const compactSource = normalizeForSearch(source?.fragment?.text ?? "").replace(/[^\p{L}\d]+/gu, "");
  return conditions.every((condition) => {
    if (condition.every((cue) => softCoverage([cue], tokens) === 1)) return true;
    return compactSource.includes(
      condition.map(normalizeForSearch).join("").replace(/[^\p{L}\d]+/gu, ""),
    );
  });
}

/**
 * Extracts the bounded subject of an explicit measurement relation such as
 * "measurement of the level of X and Y". The boundary is syntactic and does
 * not encode any medical term or target value.
 *
 * @param question Original question inspected for a measurement subject.
 * @returns Subject tokens between the level relation and its next condition.
 * @internal
 */
function questionMeasurementSubjectAnchors(question: string): string[] {
  const tokens = contrastiveTokenSequence(question);
  const actionIndex = tokens.findIndex((token) =>
    MEASUREMENT_ACTION_TOKENS.some((cue) => softCoverage([cue], [token]) === 1));
  if (actionIndex < 0) return [];
  const levelIndex = tokens.findIndex((token, index) =>
    index > actionIndex &&
    index <= actionIndex + 4 &&
    LEVEL_RELATION_TOKENS.some((cue) => softCoverage([cue], [token]) === 1));
  if (levelIndex < 0) return [];
  const anchors: string[] = [];
  for (const token of tokens.slice(levelIndex + 1, levelIndex + 9)) {
    if (MEASUREMENT_SUBJECT_BOUNDARIES.has(token)) break;
    if (token.length >= 5 && !CONTRASTIVE_FOCUS_IGNORES.has(token)) anchors.push(token);
  }
  return [...new Set(anchors)];
}

/**
 * Requires a local numeric proof to retain the bounded subject of an explicit
 * measurement question, rather than only its cadence or population wording.
 *
 * @param anchors Subject tokens extracted from the measurement relation.
 * @param source Prepared local PDF fragment considered as proof.
 * @returns `true` when no subject was extracted or enough subject tokens match.
 * @internal
 */
function sourceMatchesQuestionMeasurementSubject(anchors: string[], source: ContrastiveSource): boolean {
  if (!anchors.length) return true;
  const minimumCoverage = anchors.length === 1 ? 1 : 0.5;
  return strictSoftCoverage(anchors, source?.tokens ?? []) >= minimumCoverage;
}

/**
 * Extracts explicit identifiers, including uppercase abbreviations in mixed-case
 * questions. Units and Roman ordinals retain their dedicated parsers.
 *
 * @param question Original question inspected for compact letter/number labels.
 * @returns Unique normalized labels in question order.
 * @internal
 */
function questionAlphanumericAnchors(question: string): string[] {
  const anchors = new Set(
    contrastiveTokenSequence(question)
      .filter((token) =>
        /^[\p{L}\d]+$/u.test(token) &&
        /[\p{L}]/u.test(token) &&
        /\d/u.test(token) &&
        token.length <= 16),
  );
  if (/[a-zа-яё]/u.test(question)) {
    for (const match of question.matchAll(/(?:^|[^\p{L}\p{N}])([A-ZА-ЯЁ]{2,8})(?=$|[^\p{L}\p{N}])/gu)) {
      const raw = match[1];
      if (/^[IVXLCDM]+$/u.test(raw)) continue;
      const unit = readContrastiveUnitAtom(raw.toLowerCase());
      if (unit?.length === raw.length) continue;
      const token = contrastiveTokenSequence(raw)[0];
      if (token) anchors.add(token);
    }
  }
  return [...anchors];
}

/**
 * Requires every explicit alphanumeric question label to occur intact or as
 * two adjacent OCR tokens in the local proof fragment.
 *
 * @param anchors Alphanumeric labels extracted from the question.
 * @param source Prepared local PDF fragment considered as proof.
 * @returns `true` when every requested label remains locally present.
 * @internal
 */
function sourceMatchesQuestionAlphanumericAnchors(anchors: string[], source: ContrastiveSource): boolean {
  if (!anchors.length) return true;
  const tokens = source?.orderedTokens ?? [];
  return anchors.every((anchor) =>
    tokens.includes(anchor) ||
    tokens.some((token, index) => `${token}${tokens[index + 1] ?? ""}` === anchor));
}

/**
 * Extracts one ordinal row requested next to a structural word such as stage,
 * degree, class, group, or type.
 *
 * @param question Original question that may request an ordinal structural row.
 * @returns Canonical row number or `null` for absent/ambiguous ordinal wording.
 * @internal
 */
function questionStructuralOrdinal(question: string): string | null {
  const tokens = contrastiveTokenSequence(question);
  const candidates = new Set<string>();
  for (let index = 0; index < tokens.length; index += 1) {
    const nearby = tokens.slice(Math.max(0, index - 3), index + 4);
    if (!nearby.some((token) => STRUCTURAL_ORDINAL_TOKENS.has(token))) continue;
    if (/^[1-5]$/u.test(tokens[index])) candidates.add(tokens[index]);
    for (const [value, cues] of ORDINAL_TOKEN_GROUPS) {
      if (cues.some((cue) => softCoverage([cue], [tokens[index]]) === 1)) candidates.add(value);
    }
  }
  return candidates.size === 1 ? [...candidates][0] : null;
}

/**
 * Checks that a source fragment belongs to the structural ordinal explicitly
 * requested by the question.
 *
 * @param ordinal Canonical requested structural row number.
 * @param source Prepared local PDF fragment considered as proof.
 * @returns `true` when the row number starts the fragment or is bound to an anchor.
 * @internal
 */
function sourceMatchesQuestionOrdinal(ordinal: string | null, source: ContrastiveSource): boolean {
  if (!ordinal) return true;
  const tokens = source?.orderedTokens ?? [];
  const romanByNumber: Readonly<Record<string, string>> = {1: "i", 2: "ii", 3: "iii", 4: "iv", 5: "v"};
  const variants = new Set([ordinal, romanByNumber[ordinal]]);
  if (variants.has(tokens[0])) return true;
  for (let index = 0; index < tokens.length; index += 1) {
    if (!STRUCTURAL_ORDINAL_TOKENS.has(tokens[index])) continue;
    if (tokens.slice(Math.max(0, index - 2), index + 3).some((token) => variants.has(token))) return true;
  }
  return false;
}

/**
 * Prevents numbers embedded in labels or examples from answering an explicit
 * count question unless the local source also states a count relation.
 *
 * @param question Original question that may ask for a quantity.
 * @param source Prepared local PDF fragment considered as proof.
 * @returns `true` for non-count questions or source fragments with a count cue.
 * @internal
 */
function sourceMatchesQuestionCount(question: string, source: ContrastiveSource): boolean {
  const questionTokens = contrastiveTokenSequence(question).filter((token) => token.length >= 4);
  const asksCount = COUNT_RELATION_TOKENS.some((cue) => softCoverage([cue], questionTokens) === 1);
  if (!asksCount) return true;
  const sourceTokens = (source?.orderedTokens ?? []).filter((token) => token.length >= 4);
  return COUNT_RELATION_TOKENS.some((cue) => softCoverage([cue], sourceTokens) === 1);
}

/**
 * Строит обобщённое семейство вариантов и выделяет только слоты, которыми
 * варианты реально отличаются: числа, лексические признаки и короткие метки.
 *
 * @param answers Полный набор вариантов одного вопроса.
 * @returns Плотное контрастное семейство или `null`, если безопасного семейства нет.
 * @internal
 */
function buildContrastiveFamily(answers: AnswerOption[]): ContrastiveFamily | null {
  if (!Array.isArray(answers) || answers.length < 3 || answers.length > 6) return null;

  const bases = answers.map((answer) => {
    const tokens = uniqueTokens(answer.text).filter((token) => token.length >= 2 && !/^\d/u.test(token));
    const orderedTokens = contrastiveTokenSequence(answer.text);
    return {
      answer,
      tokens: [...new Set(tokens)],
      orderedTokens,
      numbers: canonicalContrastiveNumbers(answer.text),
      quantities: contrastiveQuantities(answer.text),
    };
  });

  const tokenFrequency = new Map<string, number>();
  const numberFrequency = new Map<string, number>();
  for (const base of bases) {
    for (const token of new Set(base.tokens)) tokenFrequency.set(token, (tokenFrequency.get(token) ?? 0) + 1);
    for (const number of new Set(base.numbers)) numberFrequency.set(number, (numberFrequency.get(number) ?? 0) + 1);
  }

  const sharedThreshold = Math.max(2, Math.ceil(answers.length * 0.75));
  const sharedTokens = [...tokenFrequency.entries()]
    .filter(([, frequency]) => frequency >= sharedThreshold)
    .map(([token]) => token);

  const labelCandidatesByAnswer = bases.map((base) => {
    const candidates: ShortLabel[] = [];
    for (let index = 1; index < base.orderedTokens.length; index += 1) {
      const value = base.orderedTokens[index];
      const anchor = base.orderedTokens[index - 1];
      if (!/^[a-zа-я]$/iu.test(value) || anchor.length < 3) continue;
      candidates.push({anchor, value});
    }
    return candidates;
  });

  let labelAnchor: string | null = null;
  if (sharedTokens.length >= 2) {
    const possibleAnchors = labelCandidatesByAnswer[0]?.map((item) => item.anchor) ?? [];
    labelAnchor =
      possibleAnchors.find((anchor) => {
        const labels = labelCandidatesByAnswer.map((candidates) => candidates.find((item) => item.anchor === anchor)?.value);
        return labels.every(Boolean) && new Set(labels).size === answers.length;
      }) ?? null;
  }

  const profiles: ContrastiveProfile[] = bases.map((base, index) => {
    const variableNumbers = base.numbers.filter((number) => (numberFrequency.get(number) ?? 0) < answers.length);
    return {
      answer: base.answer,
      tokens: base.tokens,
      slotTokens: base.tokens.filter(
        (token) =>
          (tokenFrequency.get(token) ?? 0) <= Math.ceil(answers.length / 2) &&
          !CONTRASTIVE_SLOT_IGNORES.has(token),
      ),
      numbers: base.numbers,
      variableNumbers,
      quantities: base.quantities,
      shortLabel: labelAnchor
        ? labelCandidatesByAnswer[index]?.find((candidate) => candidate.anchor === labelAnchor) ?? null
        : null,
      embeddedNumberLabel: embeddedNumberLabel(base.answer.text),
      comparator: variableNumbers.length === 1
        ? contrastiveComparatorDirection(base.answer.text, variableNumbers[0])
        : null,
    };
  });

  if (profiles.some((profile) => profile.variableNumbers.length >= 4)) return null;

  const numericProfiles = profiles.filter((profile) => profile.variableNumbers.length > 0);
  const numeric =
    numericProfiles.length === profiles.length &&
    new Set(numericProfiles.map((profile) => profile.variableNumbers.join("|"))).size === numericProfiles.length;
  const lexicalProfiles = profiles.filter((profile) => profile.slotTokens.length > 0).length;
  const lexical = sharedTokens.length > 0 && lexicalProfiles >= Math.max(3, answers.length - 1);
  const shortLabel =
    Boolean(labelAnchor) &&
    profiles.every((profile) => profile.shortLabel) &&
    new Set(profiles.map((profile) => profile.shortLabel?.value)).size === profiles.length;
  const ordinal =
    numeric &&
    sharedTokens.some((token) =>
      softCoverage([token], [...STRUCTURAL_ORDINAL_TOKENS]) === 1);
  const coded = bases.every((base) =>
    /^[a-zа-я]*\d+(?:\.\d+)?$/iu.test(normalizeForSearch(base.answer.text).replace(/\s+/gu, "")),
  );

  if (!numeric && !lexical && !shortLabel) return null;
  return {profiles, sharedTokens, numeric, lexical, shortLabel, ordinal, coded};
}

/**
 * Проверяет, доказывает ли один ограниченный source-фрагмент различающий слот
 * конкретного варианта. Совпадение общей части семейства само по себе не считается.
 *
 * @param profile Профиль проверяемого варианта ответа.
 * @param family Общее контрастное семейство вариантов.
 * @param source Подготовленный локальный PDF-фрагмент.
 * @param requiredNumericUnit Единица, которую должен сохранить локальный числовой слот.
 * @returns Флаг строгого slot-match и его нормированная сила.
 * @internal
 */
function profileMatchesSource(
  profile: ContrastiveProfile,
  family: ContrastiveFamily,
  source: ContrastiveSource,
  requiredNumericUnit: string | null,
): SlotMatch {
  const variableNumbers = profile?.variableNumbers ?? [];
  const slotTokens = profile?.slotTokens ?? [];
  const sourceNumbers = source?.numbers ?? [];
  const sourceTokens = source?.tokens ?? [];
  let matched = false;
  let strength = 0;
  let numericConflict = false;

  // Shared attributes still constrain an option even when they do not distinguish it.
  for (const number of profile?.numbers ?? []) {
    if (!sourceNumbers.includes(number)) return {matched: false, strength: 0};
    const optionUnits = profile.quantities.filter((quantity) => quantity.number === number && quantity.unit)
      .map((quantity) => quantity.unit);
    const sourceUnits = source.quantities.filter((quantity) => quantity.number === number && quantity.unit)
      .map((quantity) => quantity.unit);
    if (optionUnits.length && !optionUnits.every((unit) => sourceUnits.includes(unit))) {
      return {matched: false, strength: 0};
    }
  }

  if (family?.numeric && variableNumbers.length) {
    const numberMatch = variableNumbers.every((number) => {
      if (!sourceNumbers.includes(number)) {
        const magnitudes = new Set(unsignedContrastiveNumbers(number));
        if (source.quantities.some((quantity) =>
          unsignedContrastiveNumbers(quantity.number).some((value) => magnitudes.has(value)))) {
          numericConflict = true;
        }
        return false;
      }
      const profileQuantities = profile.quantities.filter((quantity) => quantity.number === number);
      const requiredSlotUnits = new Set(
        profileQuantities.map((quantity) => quantity.unit ?? requiredNumericUnit).filter(Boolean),
      );
      if (!requiredSlotUnits.size && !requiredNumericUnit) return true;
      const sourceQuantities = source.quantities.filter((quantity) => quantity.number === number);
      const explicitSourceUnits = sourceQuantities.flatMap((quantity) => quantity.unit ? [quantity.unit] : []);
      if (!explicitSourceUnits.length) return true;
      const compatible = explicitSourceUnits.some((unit) => requiredSlotUnits.has(unit));
      if (!compatible) numericConflict = true;
      return compatible;
    });
    const embeddedLabelBound = sourceMatchesEmbeddedNumberLabel(profile.embeddedNumberLabel, source);
    const firstNumber = variableNumbers[0]?.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&") ?? "";
    const ordinalBound =
      !family.ordinal ||
      sourceTokens.some((token) => STRUCTURAL_ORDINAL_TOKENS.has(token)) ||
      (Boolean(firstNumber) && new RegExp(`^(?:-\\s*)?${firstNumber}(?:\\s|%|$)`, "u").test(source.normalized));
    const sourceDirections = profile.comparator
      ? contrastiveComparatorDirections(source.fragment.text, variableNumbers[0])
      : new Set<ComparatorDirection>();
    const comparatorBound = !profile.comparator || sourceDirections.has(profile.comparator);
    if (!numberMatch || !embeddedLabelBound || !ordinalBound || !comparatorBound) return {matched: false, strength: 0};
    if (!family.ordinal && family.lexical && slotTokens.length && strictSoftCoverage(slotTokens, sourceTokens) < 0.99) {
      return {matched: false, strength: 0};
    }
    if (numberMatch && embeddedLabelBound && ordinalBound && comparatorBound) {
      matched = true;
      strength = profile.comparator ? (sourceDirections.size === 1 ? 1.35 : 1.2) : 1;
    }
  }

  if (numericConflict) return {matched: false, strength: 0};

  if (family?.lexical && !family.ordinal && slotTokens.length) {
    const lexicalCoverage = Math.max(
      strictSoftCoverage(slotTokens, sourceTokens),
      softCoverage(
        slotTokens,
        sourceTokens.filter((token) => token.length >= 4 || /^\d/u.test(token)),
      ),
    );
    const minimum = 0.99;
    if (lexicalCoverage >= minimum) {
      matched = true;
      strength = Math.max(strength, lexicalCoverage);
    }
  }

  const label = profile?.shortLabel;
  if (family?.shortLabel && label) {
    let labelMatch = false;
    for (let index = 0; index < source.orderedTokens.length - 1; index += 1) {
      if (source.orderedTokens[index] !== label.anchor) continue;
      if (source.orderedTokens.slice(index + 1, index + 3).includes(label.value)) {
        labelMatch = true;
        break;
      }
    }
    if (labelMatch) {
      matched = true;
      strength = 1;
    }
  }

  return {matched, strength};
}

/**
 * Оценивает уже уникальный slot-match по связи с вопросом и полноте варианта.
 * Короткий фрагмент без фокуса вопроса отклоняется даже при точном числе.
 *
 * @param profile Профиль единственного варианта, совпавшего по слоту.
 * @param family Общее контрастное семейство вариантов.
 * @param source Подготовленный локальный PDF-фрагмент.
 * @param focusTokens Специфичные токены вопроса.
 * @param slotStrength Сила уникального совпадения различающего слота.
 * @param topQuestionPages Страницы с наиболее сильным поисковым соответствием вопросу.
 * @param conditionBound Флаг строгой привязки к короткой структурной метке вопроса.
 * @returns Оценка доказательства или `null`, если связь с вопросом недостаточна.
 * @internal
 */
function scoreContrastiveFragment(
  profile: ContrastiveProfile,
  family: ContrastiveFamily,
  source: ContrastiveSource,
  focusTokens: string[],
  slotStrength: number,
  topQuestionPages: Set<number>,
  conditionBound: boolean,
): number | null {
  const sourceTokens = source?.tokens ?? [];
  const profileTokens = profile?.tokens ?? [];
  const sharedTokens = family?.sharedTokens ?? [];
  const variableNumbers = profile?.variableNumbers ?? [];
  const focusCoverage = strictSoftCoverage(focusTokens, sourceTokens);
  const looseFocusCoverage = softCoverage(
    focusTokens,
    sourceTokens.filter((token) => token.length >= 4 || /^\d/u.test(token)),
  );
  const focusHits = tokenHitCount(focusTokens, sourceTokens);
  const answerCoverage = strictSoftCoverage(profileTokens, sourceTokens);
  const sharedCoverage = sharedTokens.length
    ? strictSoftCoverage(sharedTokens, sourceTokens)
    : 0;
  const longFocusHit = focusTokens.some(
    (token) =>
      token.length >= 8 &&
      softCoverage(
        [token],
        sourceTokens.filter((candidate) => candidate.length >= 4),
      ) === 1,
  );
  const weakFocusedNumeric =
    variableNumbers.length > 0 &&
    longFocusHit &&
    (looseFocusCoverage >= 0.34 || profile?.comparator != null) &&
    sharedCoverage >= 0.35;
  const minimumHits = focusTokens.length <= 3 ? 1 : 2;
  if (!conditionBound && !weakFocusedNumeric && focusHits < minimumHits && focusCoverage < 0.34) return null;
  if (!family.coded && !conditionBound && !weakFocusedNumeric && focusCoverage < 0.5) return null;
  const lexicalOnly = !variableNumbers.length && !profile?.shortLabel;
  if (lexicalOnly && answerCoverage < 0.48) return null;
  if (
    sharedTokens.length >= 2 &&
    sharedCoverage < 0.25 &&
    answerCoverage < 0.72 &&
    (focusCoverage < 0.55 || focusHits < 3)
  ) {
    return null;
  }

  const exactAnswer =
    normalizeForSearch(profile?.answer?.text ?? "").length >= 5 &&
    String(source?.normalized ?? "").includes(normalizeForSearch(profile?.answer?.text ?? ""));
  const fragmentText = source?.fragment?.text ?? "";
  const fragmentPage = source?.fragment?.page ?? 0;
  const lengthPenalty = fragmentText.length > 360
    ? Math.min(1.6, (fragmentText.length - 360) / 180)
    : 0;

  return (
    focusCoverage * 8 +
    Math.min(6, focusHits) * 0.45 +
    slotStrength * 3.4 +
    answerCoverage * 1.6 +
    sharedCoverage * 0.8 +
    (exactAnswer ? 0.7 : 0) +
    (conditionBound ? 4.2 : 0) +
    (weakFocusedNumeric ? 2.1 : 0) +
    (topQuestionPages.has(fragmentPage) ? 0.4 : 0) -
    lengthPenalty
  );
}

/**
 * Разрешает плотное семейство single-вариантов только при уникальной локальной
 * пропозиции и измеримом отрыве от лучшего конфликтующего source-фрагмента.
 *
 * @param context Контекст вопроса, вариантов и извлечённых PDF-страниц.
 * @returns Доказанный вариант с source-фрагментом или `null` при неоднозначности.
 */
export function resolveContrastiveOptionFamily(context: ContrastiveResolverContext): ContrastiveOptionFamilyProof | null {
  if (
    context.mode !== "single" ||
    context.intent?.negative ||
    context.intent?.exception ||
    questionRequiresExclusion(context.question)
  ) {
    return null;
  }

  const family = buildContrastiveFamily(context.answers ?? []);
  if (!family) return null;
  if (
    family.numeric &&
    !family.ordinal &&
    questionHasFixedMeasurementAnchor(context.question, context.answers ?? [])
  ) {
    return null;
  }
  const questionCondition = questionShortCondition(context.question);
  const questionSeverity = contrastiveSeverityClass(context.question);
  const questionMagnitude = contrastiveMagnitudeClass(context.question);
  const questionConditions = questionContrastiveConditions(context.question);
  const compoundConditions = questionCompoundConditions(context.question);
  const questionOrdinal = questionStructuralOrdinal(context.question);
  const alphanumericAnchors = questionAlphanumericAnchors(context.question);
  const measurementSubjectAnchors = questionMeasurementSubjectAnchors(context.question);
  const responseObjectAnchors = questionResponseObjectAnchors(context.question);
  const requiredUnits = requiredContrastiveUnits(context.question, context.answers ?? []);
  const requiredNumericUnit = requiredContrastiveNumericUnit(context.question, context.answers ?? []);
  if (family.numeric && !family.ordinal && requiredNumericUnit.ambiguous) return null;
  const negatedTargets = negatedFocusTargets(context.question);
  const candidateFocus = (context.focusTokens?.length ? context.focusTokens : context.questionTokens ?? [])
    .filter((token) => (/^\d/u.test(token) || token.length >= 3) && !CONTRASTIVE_FOCUS_IGNORES.has(token));
  const focusTokens = [...new Set(candidateFocus)].slice(0, 16);
  if (focusTokens.length < (family.coded ? 1 : 2)) return null;

  const topQuestionPages = context.topQuestionPages ?? new Set<number>();

  function collectProofs(sources: ContrastiveSource[]): Map<string, Omit<ContrastiveOptionFamilyProof, "margin">> {
    const bestByAnswer = new Map<string, Omit<ContrastiveOptionFamilyProof, "margin">>();
    for (const source of sources) {
      if (hasUnsupportedSourceNegation(source.fragment.text)) continue;
      const conditionBound = questionCondition
        ? sourceMatchesQuestionCondition(questionCondition, source)
        : false;
      if (questionCondition && !conditionBound) continue;
      if (!sourceMatchesNegatedFocus(negatedTargets, source)) continue;
      if (!sourceMatchesQuestionModality(context.question, source)) continue;
      if (!sourceMatchesQuestionSeverity(context.question, source)) continue;
      if (!sourceMatchesQuestionMagnitude(context.question, source)) continue;
      if (!sourceMatchesContrastiveUnits(requiredUnits, source)) continue;
      if (!sourceMatchesQuestionPopulation(context.question, source)) continue;
      if (!sourceMatchesQuestionConditions(questionConditions, source)) continue;
      if (!sourceMatchesQuestionMeasurementSubject(measurementSubjectAnchors, source)) continue;
      if (!sourceMatchesQuestionResponseObject(responseObjectAnchors, source)) continue;
      if (!sourceMatchesQuestionAlphanumericAnchors(alphanumericAnchors, source)) continue;
      if (!sourceMatchesQuestionOrdinal(questionOrdinal, source)) continue;
      if (!sourceMatchesQuestionCount(context.question, source)) continue;
      const severityBound = questionSeverity != null;
      const typedConditionBound =
        compoundConditions.length > 0 ||
        questionMagnitude != null ||
        questionOrdinal != null;
      const matches = family.profiles
        .map((profile) => ({
          profile,
          slot: profileMatchesSource(profile, family, source, family.ordinal ? null : requiredNumericUnit.unit),
        }))
        .filter((item) => item.slot.matched);
      if (matches.length !== 1) continue;

      const [{profile, slot}] = matches;
      const profileSlotSet = new Set(profile.slotTokens);
      const unresolvedSuperset = profile.slotTokens.length > 0 && family.profiles.some((other) =>
        other.answer.id !== profile.answer.id &&
        other.slotTokens.length > profile.slotTokens.length &&
        profile.slotTokens.every((token) => other.slotTokens.includes(token)) &&
        other.slotTokens.some((token) => !profileSlotSet.has(token)));
      if (unresolvedSuperset) continue;
      const score = scoreContrastiveFragment(
        profile,
        family,
        source,
        focusTokens,
        slot.strength,
        topQuestionPages,
        conditionBound || severityBound || typedConditionBound,
      );
      if (score == null || score < 8.2) continue;
      const current = bestByAnswer.get(profile.answer.id);
      if (!current || score > current.score) {
        bestByAnswer.set(profile.answer.id, {
          answerId: profile.answer.id,
          page: source.fragment.page,
          text: source.fragment.text,
          score,
        });
      }
    }
    return bestByAnswer;
  }

  function pickProof(
    bestByAnswer: Map<string, Omit<ContrastiveOptionFamilyProof, "margin">>,
  ): ContrastiveOptionFamilyProof | null {
    const ranked = [...bestByAnswer.values()].sort((left, right) => right.score - left.score);
    const best = ranked[0];
    if (!best) return null;
    const runnerScore = ranked[1]?.score ?? 0;
    const margin = best.score - runnerScore;
    if (runnerScore > 0 && margin < 1.15) return null;
    return {...best, margin};
  }

  const pages = context.pages ?? [];
  const focusedProof = pickProof(collectProofs(cachedContrastiveSources(pages, topQuestionPages)));
  if (focusedProof || !topQuestionPages.size) return focusedProof;
  return pickProof(collectProofs(cachedContrastiveSources(pages)));
}

/**
 * Формирует ключ внутреннего кеша для одного вопроса без меток, split-данных
 * или любых сведений о правильном ответе.
 *
 * @param context Полный scorer-контекст текущего варианта.
 * @returns Детерминированный ключ вопроса, вариантов и поисковых страниц.
 * @internal
 */
function contrastiveCacheKey(context: AnswerScoringContext): string {
  const answers = (context.answers ?? [])
    .map((answer) => `${answer.id}:${normalizeForSearch(answer.text)}`)
    .join("\u001f");
  const pages = [...(context.topQuestionPages ?? new Set<number>())].sort((left, right) => left - right).join(",");
  return `${context.mode}\u001e${normalizeForSearch(context.question)}\u001e${answers}\u001e${pages}`;
}

/**
 * Возвращает небольшую per-answer поправку только доказанному варианту.
 * Повторные вызовы для вариантов одного вопроса переиспользуют вычисленный proof.
 *
 * @param context Полный scorer-контекст текущего варианта.
 * @returns Поправка и диагностическое evidence либо безопасное воздержание.
 */
export function contrastiveOptionFamilyAdjustment(context: AnswerScoringContext): OptionFamilyAdjustment {
  if (!context?.pages || context.mode !== "single") return {adjustment: 0, evidence: null};
  let pageCache = proofCache.get(context.pages);
  if (!pageCache) {
    pageCache = new Map();
    proofCache.set(context.pages, pageCache);
  }
  const key = contrastiveCacheKey(context);
  if (!pageCache.has(key)) pageCache.set(key, resolveContrastiveOptionFamily(context));
  const proof = pageCache.get(key) ?? null;
  if (!proof || proof.answerId !== context.answer.id) return {adjustment: 0, evidence: null};

  return {
    adjustment: 3.6,
    evidence: {
      answerId: context.answer.id,
      page: proof.page,
      text: proof.text,
      score: Math.max(10.5, Math.min(15.5, proof.score)),
      kind: "option_family_contrastive_clause",
    },
  };
}
