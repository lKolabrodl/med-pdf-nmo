import { normalizeForSearch, uniqueTokens } from "../../../normalize.js";
import {
  answerSearchPhrases,
  betterEvidence,
  cachedLineWindowSegments,
  containsNormalizedPhrase,
  escapeRegExp,
  hasSearchBoundaries,
  numberCoverage,
  rawTokens,
  softCoverage,
  strictSoftCoverage,
  tokenHitCount,
  tokenizeNormalized,
} from "../../text-utils.js";
import { ordinalValueToNumber, romanStageVariants } from "../ordinal-utils/index.js";
import type {PdfPage} from "../../../pdf.js";
import type {AnswerScoringContext, ContextSegment, PredictionContext, QuestionIntent} from "../../contracts.js";
import type {AnswerMode, EvidenceItem} from "../../types.js";

type EvidenceAdjustment = {
  adjustment: number;
  evidence: EvidenceItem | null;
};

type SupportAdjustment = EvidenceAdjustment & {
  support: EvidenceItem | null;
};

type LineWindowSource = {
  normalized: string;
  text: string;
};

type BoundedListSegment = ContextSegment & {
  normalized: string;
  outside: string;
  anchor: string;
  priority: number;
};

type OrdinalKind = "line" | "stage" | "step" | "degree";
type OrdinalWordKind = "line" | "degree";

type OrdinalTarget = {
  number: number;
  kind: OrdinalKind;
};

type OrdinalForms = Record<OrdinalWordKind, Partial<Record<number, string[]>>>;

/**
 * Выполняет внутренний этап `boundedListQuestion`, подготавливающий ограниченного списка вопроса для основного scorer-а.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.question Исходный текст вопроса.
 * @param context.intent Определённый predictor-ом тип и полярность вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function boundedListQuestion({mode, question, intent}: Pick<PredictionContext, "mode" | "question" | "intent">): boolean {
  if (mode !== "multi" || intent.negative || intent.exception) return false;
  const normalized = normalizeForSearch(question);
  return (
    (containsNormalizedPhrase(normalized, "\u043a\u043b\u0438\u043d\u0438\u0447") &&
      containsNormalizedPhrase(normalized, "\u043f\u0440\u043e\u044f\u0432\u043b")) ||
    containsNormalizedPhrase(normalized, "\u0441\u0438\u043c\u043f\u0442\u043e\u043c") ||
    containsNormalizedPhrase(normalized, "\u0441\u043e\u043f\u0440\u043e\u0432\u043e\u0436\u0434") ||
    (containsNormalizedPhrase(normalized, "\u043e\u0441\u043d\u043e\u0432\u043d") && containsNormalizedPhrase(normalized, "\u044d\u0444\u0444\u0435\u043a\u0442")) ||
    containsNormalizedPhrase(normalized, "\u0432 \u043e\u0441\u043d\u043e\u0432\u0435")
  );
}

/**
 * Выполняет внутренний этап `boundedListAnchors`, подготавливающий ограниченного списка якорей для основного scorer-а.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function boundedListAnchors(question: string): string[] {
  const tokens = rawTokens(question);
  const anchors = new Set<string>();
  const addTokens = (items: string[]): void => {
    const cleaned = items.filter(Boolean).join(" ").trim();
    if (cleaned.length >= 3) anchors.add(cleaned);
  };

  const syndromeIndex = tokens.findIndex((token) => token.startsWith("\u0441\u0438\u043d\u0434\u0440\u043e\u043c"));
  if (syndromeIndex >= 0) {
    const stopPrefixes = [
      "\u044f\u0432\u043b\u044f",
      "\u0441\u043e\u043f\u0440\u043e\u0432\u043e\u0436\u0434",
      "\u0445\u0430\u0440\u0430\u043a\u0442\u0435\u0440",
      "\u043e\u0441\u043d\u043e\u0432\u043d",
      "\u043e\u0442\u043d\u043e\u0441",
    ];
    const anchor = [];
    for (let index = syndromeIndex + 1; index < Math.min(tokens.length, syndromeIndex + 6); index += 1) {
      if (stopPrefixes.some((prefix) => tokens[index].startsWith(prefix))) break;
      anchor.push(tokens[index]);
    }
    addTokens(anchor);
  }

  const ageIndex = tokens.findIndex((token) => token === "\u0432\u043e\u0437\u0440\u0430\u0441\u0442\u0435");
  if (ageIndex >= 0) {
    const next = tokens.slice(ageIndex, Math.min(tokens.length, ageIndex + 12));
    const directionIndex = next.findIndex(
      (token) => token.startsWith("\u043c\u043e\u043b\u043e\u0436") || token.startsWith("\u0441\u0442\u0430\u0440\u0448") || token.startsWith("\u043c\u043b\u0430\u0434\u0448"),
    );
    if (next.some((token) => /^\d/.test(token)) && directionIndex >= 0) {
      addTokens(next.slice(0, directionIndex + 1));
    }
  }

  return [...anchors].slice(0, 6);
}

/**
 * Находит структурную границу для ограниченного списка.
 *
 * @param after Значение `after`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function boundedListBoundary(after: string): number {
  const boundaries = [
    "\u0438 \u0441",
    "\u043e\u0431\u0449\u0438\u0435 \u0441\u0438\u043c\u043f\u0442\u043e\u043c\u044b",
    "\u044d\u0442\u043e \u0440\u0430\u0437\u0434\u0435\u043b\u0435\u043d\u0438\u0435",
    "\u0443\u0440\u043e\u0432\u0435\u043d\u044c \u0443\u0431\u0435\u0434\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u0438",
    "\u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438",
    "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438",
  ].map((item) => normalizeForSearch(item));
  let end = Math.min(after.length, 900);
  for (const boundary of boundaries) {
    const index = after.indexOf(` ${boundary} `, 70);
    if (index > 0) end = Math.min(end, index);
  }
  return Math.max(90, end);
}

/**
 * Находит элементы списка, ограниченного релевантным заголовком и секцией.
 *
 * @param pages Извлечённые страницы PDF, доступные scorer-у.
 * @param question Исходный текст вопроса.
 * @param topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param mode Режим выбора ответа: `single` или `multi`.
 * @param intent Определённый predictor-ом тип и полярность вопроса.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 */
export function findBoundedListSegments(
  pages: PdfPage[],
  question: string,
  topQuestionPages: Set<number>,
  mode: AnswerMode,
  intent: QuestionIntent,
): BoundedListSegment[] {
  if (!boundedListQuestion({ mode, question, intent })) return [];
  const anchors = boundedListAnchors(question);
  if (!anchors.length) return [];
  const segments: BoundedListSegment[] = [];
  const seen = new Set<string>();
  const triadCue = normalizeForSearch("\u0434\u043e\u043c\u0438\u043d\u0438\u0440\u0443\u0435\u0442 \u0442\u0440\u0438\u0430\u0434\u0430");

  for (const page of pages) {
    for (const source of cachedLineWindowSegments(page)) {
      for (const anchor of anchors) {
        const anchorNorm = normalizeForSearch(anchor);
        const anchorIndex = source.normalized.indexOf(anchorNorm);
        if (anchorIndex < 0) continue;
        let start = anchorIndex;
        const afterAnchor = source.normalized.slice(anchorIndex);
        const triadIndex = afterAnchor.indexOf(triadCue);
        if (triadIndex >= 0 && triadIndex <= 260) {
          start = anchorIndex + triadIndex + triadCue.length;
        }
        const after = source.normalized.slice(start);
        const end = start + boundedListBoundary(after);
        const included = source.normalized.slice(start, end);
        const outside = `${source.normalized.slice(0, start)} ${source.normalized.slice(end)}`.trim();
        const key = `${page.page}:${included.slice(0, 220)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        segments.push({
          page: page.page,
          text: source.text,
          normalized: included,
          outside,
          anchor,
          priority: topQuestionPages?.has(page.page) ? 1 : 0,
        });
      }
    }
  }

  return segments.sort((a, b) => b.priority - a.priority).slice(0, 40);
}

/**
 * Оценивает присутствие ответа внутри или вне найденной границы списка.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.boundedListSegments Ограниченные текстовые сегменты для анализа.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestBoundedListSupport(
  {boundedListSegments, answer, answerTokens}: AnswerScoringContext,
): SupportAdjustment {
  const segments = boundedListSegments as BoundedListSegment[];
  if (!segments.length) return {support: null, adjustment: 0, evidence: null};
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 16);
  let bestSupport = null;
  let bestPenalty = null;

  for (const segment of segments) {
    const segmentTokens = tokenizeNormalized(segment.normalized);
    const outsideTokens = tokenizeNormalized(segment.outside);
    const answerCoverage = strictSoftCoverage(answerTokens, segmentTokens);
    const outsideCoverage = strictSoftCoverage(answerTokens, outsideTokens);
    const insidePhrase = answerPhrases.some((phrase) => containsNormalizedPhrase(segment.normalized, phrase));
    const outsidePhrase = answerPhrases.some((phrase) => containsNormalizedPhrase(segment.outside, phrase));
    const hasInside = insidePhrase || answerCoverage >= 0.66;
    const hasOutside = outsidePhrase || outsideCoverage >= 0.72;

    if (hasInside) {
      const score = 10.8 + (insidePhrase ? 2.6 : 0) + answerCoverage * 3.2 + numberCoverage(answer.text, segment.normalized) * 0.8;
      bestSupport = betterEvidence(bestSupport, {
        answerId: answer.id,
        page: segment.page,
        text: segment.text,
        score,
        kind: "bounded_list_segment",
      });
    } else if (hasOutside) {
      bestPenalty = betterEvidence(bestPenalty, {
        answerId: answer.id,
        page: segment.page,
        text: segment.text,
        score: 6.0 + outsideCoverage * 2.0,
        kind: "bounded_list_outside_penalty",
      });
    }
  }

  if (bestSupport) return { support: bestSupport, adjustment: 0, evidence: null };
  return bestPenalty ? { support: null, adjustment: -4.8, evidence: bestPenalty } : { support: null, adjustment: 0, evidence: null };
}

/**
 * Выполняет внутренний этап `ordinalTarget`, подготавливающий порядкового значения целевого объекта для основного scorer-а.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function ordinalTarget(question: string): OrdinalTarget | null {
  const normalized = normalizeForSearch(question);
  const hasStage = containsNormalizedPhrase(normalized, "\u044d\u0442\u0430\u043f");
  const hasLine = containsNormalizedPhrase(normalized, "\u043b\u0438\u043d\u0438");
  const hasStep = containsNormalizedPhrase(normalized, "\u0441\u0442\u0443\u043f\u0435\u043d");
  const hasDegree = containsNormalizedPhrase(normalized, "\u0441\u0442\u0435\u043f\u0435\u043d");
  if (!hasStage && !hasLine && !hasStep && !hasDegree) return null;
  if (hasStep) {
    const stepCue = normalizeForSearch("\u0441\u0442\u0443\u043f\u0435\u043d");
    const stepMatch = normalized.match(new RegExp(`(?:^|\\s)(\\d{1,2})(?:\\s*-?\\s*\\S{0,2})?\\s+${escapeRegExp(stepCue)}`, "iu"));
    if (stepMatch) return { number: Number(stepMatch[1]), kind: "step" };
  }
  if (hasDegree) {
    const degreeCue = normalizeForSearch("\u0441\u0442\u0435\u043f\u0435\u043d");
    const degreeMatch = normalized.match(new RegExp(`(?:^|\\s)(\\d{1,2}|[ivx]{1,7})(?:\\s*-?\\s*\\S{0,2})?\\s+${escapeRegExp(degreeCue)}`, "iu"));
    if (degreeMatch) {
      const number = ordinalValueToNumber(degreeMatch[1]);
      if (number) return { number, kind: "degree" };
    }
  }
  const candidates = [
    { number: 1, cues: ["\u043f\u0435\u0440\u0432"] },
    { number: 2, cues: ["\u0432\u0442\u043e\u0440"] },
    { number: 3, cues: ["\u0442\u0440\u0435\u0442", "\u0442\u0440\u0435\u0442\u044c"] },
    { number: 4, cues: ["\u0447\u0435\u0442\u0432\u0435\u0440"] },
  ];
  for (const candidate of candidates) {
    if (candidate.cues.some((cue) => containsNormalizedPhrase(normalized, cue))) {
      return { number: candidate.number, kind: hasDegree ? "degree" : hasStage ? "stage" : "line" };
    }
  }
  return null;
}

/**
 * Строит допустимые формы записи для порядкового значения словесной формы.
 *
 * @param number Каноническое числовое значение.
 * @param kind Значение `kind`, необходимое этому этапу scorer-а.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function ordinalWordForms(number: number, kind: OrdinalWordKind = "line"): string[] {
  const formsByKind: OrdinalForms = {
    line: {
      1: [
      "\u043f\u0435\u0440\u0432\u043e\u0439 \u043b\u0438\u043d\u0438\u0438",
      "\u043f\u0435\u0440\u0432\u0430\u044f \u043b\u0438\u043d\u0438\u044f",
      "\u043f\u0435\u0440\u0432\u0443\u044e \u043b\u0438\u043d\u0438\u044e",
      ],
      2: [
      "\u0432\u0442\u043e\u0440\u043e\u0439 \u043b\u0438\u043d\u0438\u0438",
      "\u0432\u0442\u043e\u0440\u0430\u044f \u043b\u0438\u043d\u0438\u044f",
      "\u0432\u0442\u043e\u0440\u0443\u044e \u043b\u0438\u043d\u0438\u044e",
      ],
      3: [
    "\u0442\u0440\u0435\u0442\u044c\u0435\u0439 \u043b\u0438\u043d\u0438\u0438",
    "\u0442\u0440\u0435\u0442\u044c\u044f \u043b\u0438\u043d\u0438\u044f",
    "\u0442\u0440\u0435\u0442\u044c\u044e \u043b\u0438\u043d\u0438\u044e",
      ],
      4: [
        "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u043e\u0439 \u043b\u0438\u043d\u0438\u0438",
        "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u0430\u044f \u043b\u0438\u043d\u0438\u044f",
        "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u0443\u044e \u043b\u0438\u043d\u0438\u044e",
      ],
    },
    degree: {
      1: [
        "\u043f\u0435\u0440\u0432\u043e\u0439 \u0441\u0442\u0435\u043f\u0435\u043d\u0438",
        "\u043f\u0435\u0440\u0432\u0430\u044f \u0441\u0442\u0435\u043f\u0435\u043d\u044c",
        "\u043f\u0435\u0440\u0432\u0443\u044e \u0441\u0442\u0435\u043f\u0435\u043d\u044c",
      ],
      2: [
        "\u0432\u0442\u043e\u0440\u043e\u0439 \u0441\u0442\u0435\u043f\u0435\u043d\u0438",
        "\u0432\u0442\u043e\u0440\u0430\u044f \u0441\u0442\u0435\u043f\u0435\u043d\u044c",
        "\u0432\u0442\u043e\u0440\u0443\u044e \u0441\u0442\u0435\u043f\u0435\u043d\u044c",
      ],
      3: [
        "\u0442\u0440\u0435\u0442\u044c\u0435\u0439 \u0441\u0442\u0435\u043f\u0435\u043d\u0438",
        "\u0442\u0440\u0435\u0442\u044c\u044f \u0441\u0442\u0435\u043f\u0435\u043d\u044c",
        "\u0442\u0440\u0435\u0442\u044c\u044e \u0441\u0442\u0435\u043f\u0435\u043d\u044c",
      ],
      4: [
        "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u043e\u0439 \u0441\u0442\u0435\u043f\u0435\u043d\u0438",
        "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u0430\u044f \u0441\u0442\u0435\u043f\u0435\u043d\u044c",
        "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u0443\u044e \u0441\u0442\u0435\u043f\u0435\u043d\u044c",
      ],
    },
  };
  return formsByKind[kind]?.[number] ?? formsByKind.line[number] ?? [];
}

/**
 * Находит позицию следующей границы порядкового значения в локальном тексте или структуре.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @param start Начальная позиция рассматриваемого диапазона.
 * @param number Каноническое числовое значение.
 * @returns Вычисленное числовое значение или специальное граничное значение при отсутствии совпадения.
 * @internal
 */
function nextOrdinalIndex(normalized: string, start: number, number: number): number {
  let best = -1;
  for (const nextNumber of [number + 1, number + 2]) {
    const pattern = new RegExp(`(?:^|[ .])${nextNumber}(?:[ .]|$)`, "u");
    const match = normalized.slice(start).match(pattern);
    if (match?.index != null) {
      const index = start + match.index;
      if (best < 0 || index < best) best = index;
    }
  }
  return best;
}

/**
 * Находит позицию следующей границы `step` порядкового значения в локальном тексте или структуре.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @param start Начальная позиция рассматриваемого диапазона.
 * @param number Каноническое числовое значение.
 * @returns Вычисленное числовое значение или специальное граничное значение при отсутствии совпадения.
 * @internal
 */
function nextStepOrdinalIndex(normalized: string, start: number, number: number): number {
  const stepCue = normalizeForSearch("\u0441\u0442\u0443\u043f\u0435\u043d");
  let best = -1;
  for (const nextNumber of [number + 1, number + 2, number + 3]) {
    const pattern = new RegExp(`(?:^|\\s)${nextNumber}(?:\\s*-?\\s*\\S{0,2})?\\s+${escapeRegExp(stepCue)}`, "iu");
    const match = normalized.slice(start).match(pattern);
    if (match?.index != null) {
      const index = start + match.index;
      if (best < 0 || index < best) best = index;
    }
  }
  return best;
}


/**
 * Находит позицию следующей границы степени порядкового значения в локальном тексте или структуре.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @param start Начальная позиция рассматриваемого диапазона.
 * @param number Каноническое числовое значение.
 * @returns Вычисленное числовое значение или специальное граничное значение при отсутствии совпадения.
 * @internal
 */
function nextDegreeOrdinalIndex(normalized: string, start: number, number: number): number {
  const degreeCue = normalizeForSearch("\u0441\u0442\u0435\u043f\u0435\u043d");
  let best = -1;
  for (const nextNumber of [number + 1, number + 2, number + 3]) {
    for (const variant of romanStageVariants(String(nextNumber))) {
      const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(variant)}(?:\\s|-|$)`, "iu");
      const match = normalized.slice(start).match(pattern);
      if (!match?.index && match?.index !== 0) continue;
      const index = start + match.index;
      const before = normalized.slice(Math.max(0, index - 180), index);
      const after = normalized.slice(index, Math.min(normalized.length, index + 80));
      if (!before.includes(degreeCue) && !after.includes(degreeCue)) continue;
      if (best < 0 || index < best) best = index;
    }
  }
  return best;
}

/**
 * Строит ограниченные локальные окна для порядкового значения.
 *
 * @param source Ограниченный исходный фрагмент PDF.
 * @param target Значение `target`, необходимое этому этапу scorer-а.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function ordinalWindows(source: LineWindowSource, target: OrdinalTarget): string[] {
  const normalized = source.normalized;
  const windows: string[] = [];
  if (target.kind === "degree") {
    const degreeCue = normalizeForSearch("\u0441\u0442\u0435\u043f\u0435\u043d");
    for (const variant of romanStageVariants(String(target.number))) {
      const directPatterns = [
        new RegExp(`(?:^|\\s)${escapeRegExp(variant)}(?:\\s*-?\\s*\\S{0,3})?\\s+${escapeRegExp(degreeCue)}`, "giu"),
        new RegExp(`${escapeRegExp(degreeCue)}\\s+(?:\\S+\\s+){0,2}${escapeRegExp(variant)}(?:\\s|$)`, "giu"),
      ];
      for (const pattern of directPatterns) {
        for (const match of normalized.matchAll(pattern)) {
          const index = match.index ?? 0;
          const afterStart = index + match[0].length;
          const afterLimit = nextDegreeOrdinalIndex(normalized, afterStart + 8, target.number);
          const end = afterLimit > 0 ? afterLimit : Math.min(normalized.length, afterStart + 520);
          windows.push(normalized.slice(Math.max(0, index - 160), end));
        }
      }

      let start = 0;
      while (start < normalized.length) {
        const index = normalized.indexOf(variant, start);
        if (index < 0) break;
        if (!hasSearchBoundaries(normalized, index, variant.length)) {
          start = index + Math.max(1, variant.length);
          continue;
        }
        const before = normalized.slice(Math.max(0, index - 220), index);
        if (!before.includes(degreeCue)) {
          start = index + Math.max(1, variant.length);
          continue;
        }
        const afterLimit = nextDegreeOrdinalIndex(normalized, index + variant.length + 8, target.number);
        const end = afterLimit > 0 ? afterLimit : Math.min(normalized.length, index + 520);
        windows.push(normalized.slice(Math.max(0, index - 160), end));
        start = index + Math.max(1, variant.length);
      }
    }
    for (const form of ordinalWordForms(target.number, "degree")) {
      const formNorm = normalizeForSearch(form);
      let start = 0;
      while (start < normalized.length) {
        const index = normalized.indexOf(formNorm, start);
        if (index < 0) break;
        windows.push(normalized.slice(Math.max(0, index - 220), Math.min(normalized.length, index + formNorm.length + 480)));
        start = index + formNorm.length;
      }
    }
    return windows;
  }
  if (target.kind === "step") {
    const stepCue = normalizeForSearch("\u0441\u0442\u0443\u043f\u0435\u043d");
    const pattern = new RegExp(`(?:^|\\s)${target.number}(?:\\s*-?\\s*\\S{0,2})?\\s+${escapeRegExp(stepCue)}`, "giu");
    for (const match of normalized.matchAll(pattern)) {
      const index = match.index ?? 0;
      const afterStart = index + match[0].length;
      const afterLimit = nextStepOrdinalIndex(normalized, afterStart + 12, target.number);
      const end = afterLimit > 0 ? afterLimit : Math.min(normalized.length, afterStart + 700);
      windows.push(normalized.slice(index, end));
    }
    return windows;
  }
  if (target.kind === "stage") {
    if (!containsNormalizedPhrase(normalized, "\u044d\u0442\u0430\u043f")) return windows;
    const pattern = new RegExp(`(?:^|[ .])${target.number}(?:[ .]|$)`, "gu");
    for (const match of normalized.matchAll(pattern)) {
      const index = match.index ?? 0;
      const before = normalized.slice(Math.max(0, index - 180), index);
      const afterStart = index + match[0].length;
      const afterLimit = nextOrdinalIndex(normalized, afterStart + 12, target.number);
      const end = afterLimit > 0 ? afterLimit : Math.min(normalized.length, afterStart + 520);
      const local = normalized.slice(index, end);
      if (!containsNormalizedPhrase(`${before} ${local}`, "\u044d\u0442\u0430\u043f")) continue;
      windows.push(local);
    }
    return windows;
  }

  for (const form of ordinalWordForms(target.number, "line")) {
    const formNorm = normalizeForSearch(form);
    let start = 0;
    while (start < normalized.length) {
      const index = normalized.indexOf(formNorm, start);
      if (index < 0) break;
      windows.push(normalized.slice(lineOrdinalWindowStart(normalized, index), Math.min(normalized.length, index + formNorm.length + 420)));
      start = index + formNorm.length;
    }
  }
  return windows;
}

/**
 * Выполняет внутренний этап `lineOrdinalWindowStart`, подготавливающий строки порядкового значения локального окна `start` для основного scorer-а.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @param index Позиция текущего элемента или совпадения.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function lineOrdinalWindowStart(normalized: string, index: number): number {
  const before = normalized.slice(Math.max(0, index - 80), index);
  if (containsNormalizedPhrase(before, "\u0442\u0435\u0440\u0430\u043f")) return Math.max(0, index - 24);
  return Math.max(0, index - 110);
}

/**
 * Выполняет внутренний этап `abbreviationSupport`, подготавливающий сокращения поддержки ответа для основного scorer-а.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @param window Значение `window`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function abbreviationSupport(answerText: string, window: string): number {
  const answerNorm = normalizeForSearch(answerText);
  if (containsNormalizedPhrase(window, "\u0441\u0433\u043a\u0441") && containsNormalizedPhrase(answerNorm, "\u043a\u043e\u0440\u0442\u0438\u043a\u043e\u0441\u0442\u0435\u0440\u043e\u0438\u0434")) return 1;
  return 0;
}

const ORDINAL_GENERIC_FOCUS = new Set(
  [
    "\u043f\u0435\u0440\u0432\u044b\u0439",
    "\u0432\u0442\u043e\u0440\u043e\u0439",
    "\u0442\u0440\u0435\u0442\u0438\u0439",
    "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u044b\u0439",
    "\u0441\u0442\u0430\u0434\u0438\u044f",
    "\u0441\u0442\u0430\u0434\u0438\u0438",
    "\u0441\u0442\u0435\u043f\u0435\u043d\u044c",
    "\u0441\u0442\u0435\u043f\u0435\u043d\u0438",
    "\u043a\u043b\u0430\u0441\u0441",
    "\u043a\u043b\u0430\u0441\u0441\u0430",
    "\u043b\u0438\u043d\u0438\u044f",
    "\u043b\u0438\u043d\u0438\u0438",
    "\u044d\u0442\u0430\u043f",
    "\u044d\u0442\u0430\u043f\u043e\u043c",
    "\u0442\u0435\u0440\u0430\u043f\u0438\u044f",
    "\u0442\u0435\u0440\u0430\u043f\u0438\u0438",
    "\u043b\u0435\u0447\u0435\u043d\u0438\u0435",
    "\u043b\u0435\u0447\u0435\u043d\u0438\u044f",
    "\u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442",
    "\u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442\u043e\u043c",
    "\u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442\u0430\u043c\u0438",
    "\u044f\u0432\u043b\u044f\u0435\u0442\u0441\u044f",
    "\u044f\u0432\u043b\u044f\u044e\u0442\u0441\u044f",
    "\u0441\u0430\u0440\u043a\u043e\u0438\u0434\u043e\u0437",
    "\u0441\u0430\u0440\u043a\u043e\u0438\u0434\u043e\u0437\u0430",
  ].flatMap((item) => uniqueTokens(item)),
);

/**
 * Выделяет специфичные токены для специфичных порядкового значения фокуса вопроса.
 *
 * @param focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function specificOrdinalFocusTokens(focusTokens: string[]): string[] {
  return (focusTokens ?? []).filter((token) => token.length >= 4 && !/^\d/.test(token) && !ORDINAL_GENERIC_FOCUS.has(token));
}

/**
 * Выполняет внутренний этап `ordinalWindowNegatesSpecificFocus`, подготавливающий порядкового значения локального окна `negates` специфичных фокуса вопроса для основного scorer-а.
 *
 * @param window Значение `window`, необходимое этому этапу scorer-а.
 * @param specificTokens Нормализованные токены соответствующего текста.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function ordinalWindowNegatesSpecificFocus(window: string, specificTokens: string[]): boolean {
  for (const token of specificTokens ?? []) {
    if (token.length < 6) continue;
    const stem = token.slice(0, Math.min(8, token.length));
    let start = 0;
    while (start < window.length) {
      const index = window.indexOf(stem, start);
      if (index < 0) break;
      const before = window.slice(Math.max(0, index - 58), index);
      if (
        containsNormalizedPhrase(before, "\u0431\u0435\u0437") ||
        containsNormalizedPhrase(before, "\u043e\u0442\u0441\u0443\u0442") ||
        containsNormalizedPhrase(before, "\u043d\u0435\u0442")
      ) {
        return true;
      }
      start = index + stem.length;
    }
  }
  return false;
}

/**
 * Сопоставляет порядковый номер вопроса с содержимым соответствующего пункта.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @param context.focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestOrdinalListSupport(
  {mode, pages, question, answer, answerTokens, focusTokens}: AnswerScoringContext,
): EvidenceItem | null {
  const target = ordinalTarget(question);
  if (!target) return null;
  if (mode !== "single" && target.kind !== "degree") return null;
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 16);
  const specificTokens = specificOrdinalFocusTokens(focusTokens);
  let best = null;

  for (const page of pages) {
    const nextPage = target.kind === "step" ? pages.find((candidate) => candidate.page === page.page + 1) : null;
    const sources = [...cachedLineWindowSegments(page), { normalized: page.normalized, text: page.text }];
    if (nextPage) {
      const text = `${page.text}\n${nextPage.text}`;
      sources.push({ normalized: normalizeForSearch(text), text });
    }
    for (const source of sources) {
      for (const window of ordinalWindows(source, target)) {
        const tokens = tokenizeNormalized(window);
        const focusHits = tokenHitCount(specificTokens, tokens);
        const focusCoverage = strictSoftCoverage(specificTokens, tokens);
        if (target.kind !== "step" && specificTokens.length && focusHits <= 0 && focusCoverage < 0.72) continue;
        if (target.kind === "line" && ordinalWindowNegatesSpecificFocus(window, specificTokens)) continue;
        const answerCoverage = strictSoftCoverage(answerTokens, tokens);
        const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(window, phrase));
        const abbreviation = abbreviationSupport(answer.text, window);
        if (!phraseHit && answerCoverage < 0.58 && abbreviation <= 0) continue;
        const score =
          12.2 +
          (phraseHit ? 2.4 : 0) +
          Math.max(answerCoverage, abbreviation) * 4.4 +
          Math.min(2, focusHits) * 1.1 +
          Math.min(1, focusCoverage) * 0.8;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: source.text,
          score,
          kind: "ordinal_list_segment",
        });
      }
    }
  }

  return best;
}

/**
 * Выполняет внутренний этап `typeOrdinalNumber`, подготавливающий типа порядкового значения числа для основного scorer-а.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function typeOrdinalNumber(question: string): number | null {
  const normalized = normalizeForSearch(question);
  if (!containsNormalizedPhrase(normalized, "\u0442\u0438\u043f")) return null;
  if (
    !containsNormalizedPhrase(normalized, "\u0445\u0430\u0440\u0430\u043a\u0442\u0435\u0440") &&
    !containsNormalizedPhrase(normalized, "\u043c\u0435\u0445\u0430\u043d\u0438\u0437\u043c")
  ) {
    return null;
  }
  if (containsNormalizedPhrase(normalized, "\u043f\u0435\u0440\u0432")) return 1;
  if (containsNormalizedPhrase(normalized, "\u0432\u0442\u043e\u0440")) return 2;
  if (containsNormalizedPhrase(normalized, "\u0442\u0440\u0435\u0442")) return 3;
  return null;
}

/**
 * Строит допустимые формы записи для типа порядкового значения.
 *
 * @param number Каноническое числовое значение.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function typeOrdinalForms(number: number): string[] {
  if (number === 1) return ["\u043f\u0435\u0440\u0432\u044b\u0439", "\u043f\u0435\u0440\u0432\u043e\u0433\u043e", "\u043f\u0435\u0440\u0432\u044b\u043c"];
  if (number === 2) return ["\u0432\u0442\u043e\u0440\u043e\u0439", "\u0432\u0442\u043e\u0440\u043e\u0433\u043e", "\u0432\u0442\u043e\u0440\u044b\u043c"];
  return ["\u0442\u0440\u0435\u0442\u0438\u0439", "\u0442\u0440\u0435\u0442\u044c\u0435\u0433\u043e", "\u0442\u0440\u0435\u0442\u044c\u0438\u043c"];
}

/**
 * Находит структурную границу для следующей границы типа порядкового значения.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @param start Начальная позиция рассматриваемого диапазона.
 * @param number Каноническое числовое значение.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function nextTypeOrdinalBoundary(normalized: string, start: number, number: number): number {
  let best = -1;
  for (const otherNumber of [1, 2, 3]) {
    if (otherNumber === number) continue;
    for (const form of typeOrdinalForms(otherNumber)) {
      const formNorm = normalizeForSearch(form);
      let index = normalized.indexOf(formNorm, start);
      while (index >= 0) {
        const before = normalized.slice(Math.max(0, index - 20), index);
        const after = normalized.slice(index, Math.min(normalized.length, index + 40));
        if (/\d/u.test(form) || containsNormalizedPhrase(`${before} ${after}`, "\u0442\u0438\u043f") || containsNormalizedPhrase(before, "\u0438")) {
          best = best < 0 ? index : Math.min(best, index);
          break;
        }
        index = normalized.indexOf(formNorm, index + formNorm.length);
      }
    }
  }
  return best;
}

/**
 * Строит ограниченные локальные окна для типа порядкового значения.
 *
 * @param source Ограниченный исходный фрагмент PDF.
 * @param number Каноническое числовое значение.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function typeOrdinalWindows(source: LineWindowSource, number: number): string[] {
  const windows: string[] = [];
  const normalized = source.normalized;
  for (const form of typeOrdinalForms(number)) {
    const formNorm = normalizeForSearch(form);
    let start = 0;
    while (start < normalized.length) {
      const index = normalized.indexOf(formNorm, start);
      if (index < 0) break;
      const before = normalized.slice(Math.max(0, index - 180), index);
      const near = normalized.slice(index, Math.min(normalized.length, index + 90));
      if (containsNormalizedPhrase(`${before} ${near}`, "\u0442\u0438\u043f")) {
        const afterStart = index + formNorm.length;
        const boundary = nextTypeOrdinalBoundary(normalized, afterStart + 8, number);
        const end = boundary > afterStart ? boundary : Math.min(normalized.length, afterStart + 360);
        windows.push(normalized.slice(index, end));
      }
      start = index + Math.max(1, formNorm.length);
    }
  }
  return windows;
}

/**
 * Выполняет внутренний этап `typeAbbreviationSupport`, подготавливающий типа сокращения поддержки ответа для основного scorer-а.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @param window Значение `window`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function typeAbbreviationSupport(answerText: string, window: string): number {
  const answerNorm = normalizeForSearch(answerText);
  let support = 0;
  if (
    containsNormalizedPhrase(answerNorm, "\u0430\u043e\u0440\u0442") &&
    containsNormalizedPhrase(answerNorm, "\u043a\u043b\u0430\u043f\u0430\u043d") &&
    containsNormalizedPhrase(window, "\u0410\u041a")
  ) {
    support += 0.28;
  }
  if (
    containsNormalizedPhrase(answerNorm, "\u0432\u043e\u0441\u0445\u043e\u0434") &&
    containsNormalizedPhrase(answerNorm, "\u0430\u043e\u0440\u0442") &&
    containsNormalizedPhrase(window, "\u0412\u0410")
  ) {
    support += 0.22;
  }
  return support;
}

const TYPE_ORDINAL_GENERIC_ANSWER = new Set(
  [
    "\u0441\u0442\u0432\u043e\u0440\u043a\u0438",
    "\u0441\u0442\u0432\u043e\u0440\u043e\u043a",
    "\u0430\u043e\u0440\u0442\u0430\u043b\u044c\u043d\u043e\u0433\u043e",
    "\u0430\u043e\u0440\u0442\u0430\u043b\u044c\u043d\u044b\u0439",
    "\u043a\u043b\u0430\u043f\u0430\u043d",
    "\u043a\u043b\u0430\u043f\u0430\u043d\u0430",
    "\u0440\u0435\u0433\u0443\u0440\u0433\u0438\u0442\u0430\u0446\u0438\u0438",
    "\u043f\u043e\u0442\u043e\u043a",
    "\u043f\u043e\u0442\u043e\u043a\u043e\u043c",
  ].flatMap((item) => uniqueTokens(item)),
);

/**
 * Выделяет специфичные токены для типа различающих варианта ответа.
 *
 * @param answerTokens Нормализованные токены проверяемого варианта.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function typeDistinctiveAnswerTokens(answerTokens: string[]): string[] {
  return answerTokens.filter((token) => token.length >= 4 && !TYPE_ORDINAL_GENERIC_ANSWER.has(token));
}

/**
 * Ищет вариант ответа в строке явно названного типа или стадии.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestTypeOrdinalSupport(
  {pages, question, answer, answerTokens}: AnswerScoringContext,
): EvidenceItem | null {
  const number = typeOrdinalNumber(question);
  if (!number) return null;
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 16);
  const distinctiveTokens = typeDistinctiveAnswerTokens(answerTokens);
  let best = null;

  for (const page of pages) {
    const sources = [...cachedLineWindowSegments(page), { normalized: page.normalized, text: page.text }];
    for (const source of sources) {
      for (const window of typeOrdinalWindows(source, number)) {
        const tokens = tokenizeNormalized(window);
        const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(window, phrase));
        const coverageScore = strictSoftCoverage(answerTokens, tokens);
        const distinctiveCoverage = distinctiveTokens.length ? softCoverage(distinctiveTokens, tokens) : 0;
        if (distinctiveTokens.length && distinctiveCoverage <= 0) continue;
        const abbreviation = typeAbbreviationSupport(answer.text, window);
        const support = Math.min(1, coverageScore + abbreviation + Math.min(0.2, distinctiveCoverage * 0.2));
        if (!phraseHit && support < 0.5) continue;
        const score = 13.4 + (phraseHit ? 2.6 : 0) + support * 5.2;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: source.text,
          score,
          kind: "type_ordinal_segment",
        });
      }
    }
  }

  return best;
}

const INDICATION_LABEL_STOPS = new Set(
  [
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442\u0430",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442\u043e\u0432",
    "\u0431\u043e\u043b\u044c\u043d\u043e\u0439",
    "\u0431\u043e\u043b\u044c\u043d\u044b\u0445",
    "\u0437\u0430",
    "\u0441",
    "\u043f\u0440\u0438",
    "\u043f\u043e",
  ].flatMap((item) => rawTokens(item)),
);

/**
 * Извлекает из вопроса метку показания или противопоказания.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function questionIndicationLabel(question: string): string | null {
  const tokens = rawTokens(question);
  const indicationIndex = tokens.findIndex((token) => token.startsWith("\u043f\u043e\u043a\u0430\u0437\u0430\u043d"));
  if (indicationIndex < 0) return null;
  const relativeStart = tokens
    .slice(indicationIndex + 1)
    .findIndex((token) => token === "\u0434\u043b\u044f" || token === "\u043a");
  const start = relativeStart < 0 ? -1 : indicationIndex + 1 + relativeStart;
  if (start < 0) return null;
  const label = [];
  for (let index = start + 1; index < tokens.length && label.length < 5; index += 1) {
    const token = tokens[index];
    if (
      INDICATION_LABEL_STOPS.has(token) ||
      token.startsWith("\u043f\u0430\u0446\u0438\u0435\u043d\u0442") ||
      token.startsWith("\u0431\u043e\u043b\u044c\u043d") ||
      token === "\u0438\u0437" ||
      token === "\u0432" ||
      token.startsWith("\u044f\u0432\u043b\u044f")
    ) {
      break;
    }
    label.push(token);
  }
  return label.length ? label.join(" ") : null;
}

/**
 * Выполняет внутренний этап `dischargeIndicationLabel`, подготавливающий `discharge` показания метки для основного scorer-а.
 *
 * @param label Разобранная метка строки, стадии или типа.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function dischargeIndicationLabel(label: string): boolean {
  return rawTokens(label).some((token) => token.startsWith("\u0432\u044b\u043f\u0438\u0441\u043a"));
}

/**
 * Проверяет совпадение показания строки.
 *
 * @param line Значение `line`, необходимое этому этапу scorer-а.
 * @param labelTokens Нормализованные токены соответствующего текста.
 * @param strictScope Значение `strictScope`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function indicationLineMatches(line: string, labelTokens: string[], strictScope: boolean = false): boolean {
  const lineTokens = tokenizeNormalized(normalizeForSearch(line));
  if (strictScope) {
    const exactHits = tokenHitCount(labelTokens, lineTokens);
    const strictCoverage = strictSoftCoverage(labelTokens, lineTokens);
    if (labelTokens.length <= 2) {
      if (exactHits < 1 && strictCoverage < 0.9) return false;
    } else if (strictCoverage < 0.72 && exactHits < Math.min(2, labelTokens.length)) {
      return false;
    }
  } else if (softCoverage(labelTokens, lineTokens) < Math.min(1, labelTokens.length <= 3 ? 0.9 : 0.72)) {
    return false;
  }
  const normalized = normalizeForSearch(line);
  return (
    containsNormalizedPhrase(normalized, "\u043f\u043e\u043a\u0430\u0437\u0430\u043d") ||
    containsNormalizedPhrase(normalized, "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434") ||
    labelTokens.length >= 2
  );
}

/**
 * Выполняет внутренний этап `indicationHeading`, подготавливающий показания `heading` для основного scorer-а.
 *
 * @param line Значение `line`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function indicationHeading(line: string): boolean {
  const normalized = normalizeForSearch(line);
  if (!containsNormalizedPhrase(normalized, "\u043f\u043e\u043a\u0430\u0437\u0430\u043d")) return false;
  return (
    /(?:^|\s)показан\p{L}*\s+(?:к|для)\s+/iu.test(String(line ?? "")) ||
    containsNormalizedPhrase(normalized, "\u043f\u043e\u043a\u0430\u0437\u0430\u043d\u0438\u044f \u0434\u043b\u044f") ||
    containsNormalizedPhrase(normalized, "\u043f\u043e\u043a\u0430\u0437\u0430\u043d\u0438\u044f \u043a") ||
    containsNormalizedPhrase(normalized, "\u043f\u043e\u043a\u0430\u0437\u0430\u043d\u0438\u044f \u043e\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044e\u0442")
  );
}

/**
 * Строит структуру показания сегмента из переданного локального контекста.
 *
 * @param lines Физические строки извлечённой страницы PDF.
 * @param index Позиция текущего элемента или совпадения.
 * @param extendedScope Значение `extendedScope`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function buildIndicationSegment(lines: string[], index: number, extendedScope: boolean = false): string {
  const current = normalizeForSearch(lines[index]);
  const before = normalizeForSearch(lines.slice(Math.max(0, index - 2), index).join(" "));
  let start = index;
  if (!containsNormalizedPhrase(current, "\u0433\u043e\u0441\u043f\u0438\u0442\u0430\u043b") && containsNormalizedPhrase(before, "\u043e\u0442\u0441\u0443\u0442")) {
    start = Math.max(0, index - 2);
  }
  const out: string[] = [];
  const end = extendedScope ? index + 20 : index + 5;
  for (let cursor = start; cursor < Math.min(lines.length, end); cursor += 1) {
    if (cursor > index) {
      const normalized = normalizeForSearch(lines[cursor]);
      if (
        indicationHeading(lines[cursor]) ||
        containsNormalizedPhrase(normalized, "\u043f\u043b\u0430\u043d\u043e\u0432") ||
        containsNormalizedPhrase(normalized, "\u044d\u043a\u0441\u0442\u0440\u0435\u043d") ||
        containsNormalizedPhrase(normalized, "\u043f\u043e\u043a\u0430\u0437\u0430\u043d\u0438\u044f \u043a")
      ) {
        break;
      }
    }
    out.push(lines[cursor]);
  }
  return out.join(" ");
}

/**
 * Штрафует совпадение ответа в соседней, но не целевой секции показаний.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @returns Поправка score и, при наличии, объясняющее evidence.
 */
export function indicationScopeAdjustment(
  {mode, pages, question, answer, answerTokens}: AnswerScoringContext,
): EvidenceAdjustment {
  if (mode !== "multi") return { adjustment: 0, evidence: null };
  const label = questionIndicationLabel(question);
  if (!label || !dischargeIndicationLabel(label)) return { adjustment: 0, evidence: null };
  const labelTokens = uniqueTokens(label);
  if (!labelTokens.length) return { adjustment: 0, evidence: null };
  const phrases = answerSearchPhrases(answer.text).slice(0, 16);
  let targetHit = false;
  let siblingEvidence = null;

  for (const page of pages) {
    const lines = page.lines ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      if (!indicationHeading(lines[index])) continue;
      const targetHeading = indicationLineMatches(lines[index], labelTokens, true);
      const segment = buildIndicationSegment(lines, index, true);
      const normalized = normalizeForSearch(segment);
      const tokens = tokenizeNormalized(normalized);
      const phraseHit = phrases.some((phrase) => containsNormalizedPhrase(normalized, phrase));
      const answerCoverage = strictSoftCoverage(answerTokens, tokens);
      const answerHit = phraseHit || answerCoverage >= 0.66;
      if (!answerHit) continue;
      if (targetHeading) {
        targetHit = true;
        continue;
      }
      siblingEvidence = betterEvidence(siblingEvidence, {
        answerId: answer.id,
        page: page.page,
        text: segment,
        score: 8.2 + (phraseHit ? 1.8 : 0) + answerCoverage * 2.2,
        kind: "indication_sibling_scope_mismatch",
      });
    }
  }

  if (targetHit || !siblingEvidence) return { adjustment: 0, evidence: null };
  return { adjustment: -8.5, evidence: siblingEvidence };
}

/**
 * Выполняет внутренний этап `indicationSemanticSupport`, подготавливающий показания `semantic` поддержки ответа для основного scorer-а.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @param segment Значение `segment`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function indicationSemanticSupport(answerText: string, segment: string): number {
  const answerNorm = normalizeForSearch(answerText);
  const segmentNorm = normalizeForSearch(segment);
  if (
    containsNormalizedPhrase(answerNorm, "\u0441\u043e\u0445\u0440\u0430\u043d") &&
    containsNormalizedPhrase(answerNorm, "\u0444\u0443\u043d\u043a\u0446") &&
    containsNormalizedPhrase(segmentNorm, "\u043e\u0442\u0441\u0443\u0442") &&
    containsNormalizedPhrase(segmentNorm, "\u0441\u043d\u0438\u0436") &&
    containsNormalizedPhrase(segmentNorm, "\u0444\u0443\u043d\u043a\u0446")
  ) {
    return 0.78;
  }
  if (
    containsNormalizedPhrase(answerNorm, "\u043e\u0441\u0442\u0440") &&
    containsNormalizedPhrase(answerNorm, "\u043f\u0440\u043e\u0433\u0440\u0435\u0441") &&
    containsNormalizedPhrase(segmentNorm, "\u043e\u0441\u0442\u0440") &&
    containsNormalizedPhrase(segmentNorm, "\u043f\u0440\u043e\u0433\u0440\u0435\u0441")
  ) {
    return 0.86;
  }
  return 0;
}

/**
 * Определяет явное несовпадение показания контраста.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @param segment Значение `segment`, необходимое этому этапу scorer-а.
 * @returns `true`, если проверяемое условие выполнено; иначе `false`.
 * @internal
 */
function indicationContrastMismatch(answerText: string, segment: string): boolean {
  const answerNorm = normalizeForSearch(answerText);
  const segmentNorm = normalizeForSearch(segment);
  if (
    containsNormalizedPhrase(segmentNorm, "\u043e\u0442\u0441\u0443\u0442") &&
    !containsNormalizedPhrase(answerNorm, "\u043e\u0442\u0441\u0443\u0442") &&
    (containsNormalizedPhrase(answerNorm, "\u0443\u0433\u0440\u043e\u0437") || containsNormalizedPhrase(answerNorm, "\u043d\u0435\u0434\u043e\u0441\u0442\u0430\u0442")) &&
    containsNormalizedPhrase(segmentNorm, "\u043d\u0435\u0434\u043e\u0441\u0442\u0430\u0442")
  ) {
    return true;
  }
  return false;
}

/**
 * Ищет ответ внутри сегмента показания, названного в вопросе.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestIndicationSegmentSupport(
  {mode, pages, question, answer, answerTokens}: AnswerScoringContext,
): EvidenceItem | null {
  const label = questionIndicationLabel(question);
  if (!label) return null;
  const strictScope = dischargeIndicationLabel(label);
  const labelTokens = uniqueTokens(label);
  if (!labelTokens.length) return null;
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 16);
  let best = null;

  for (const page of pages) {
    const lines = page.lines ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      const neighborhood = lines.slice(index, Math.min(lines.length, index + 2)).join(" ");
      if (!indicationLineMatches(neighborhood, labelTokens, strictScope)) continue;
      const segment = buildIndicationSegment(lines, index, strictScope);
      if (indicationContrastMismatch(answer.text, segment)) continue;
      const normalized = normalizeForSearch(segment);
      const tokens = tokenizeNormalized(normalized);
      const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(normalized, phrase));
      const answerCoverage = strictSoftCoverage(answerTokens, tokens);
      const semantic = indicationSemanticSupport(answer.text, segment);
      const support = Math.max(answerCoverage, semantic);
      const minimumSupport = mode === "multi" && strictScope ? 0.66 : 0.45;
      if (!phraseHit && support < minimumSupport) continue;
      const score = 13.8 + (phraseHit ? 2.6 : 0) + support * 5.4;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text: segment,
        score,
        kind: "indication_label_segment",
      });
    }
  }

  return best;
}

/**
 * Возвращает штраф при явном возрастном противопоказании выбранного ответа.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @returns Поправка score и, при наличии, объясняющее evidence.
 */
export function ageEligibilityAdjustment({pages, question, answer}: AnswerScoringContext): EvidenceAdjustment {
  const questionNorm = normalizeForSearch(question);
  const answerNorm = normalizeForSearch(answer.text);
  if (
    !containsNormalizedPhrase(questionNorm, "\u043f\u043e\u043a\u0430\u0437") &&
    !containsNormalizedPhrase(questionNorm, "\u043d\u0430\u0437\u043d\u0430\u0447") &&
    !containsNormalizedPhrase(questionNorm, "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434")
  ) {
    return { adjustment: 0, evidence: null };
  }
  const childAnswer =
    containsNormalizedPhrase(answerNorm, "\u0434\u0435\u0442\u0441\u043a") ||
    containsNormalizedPhrase(answerNorm, "\u0434\u0435\u0442\u044f\u043c") ||
    containsNormalizedPhrase(answerNorm, "\u0434\u0435\u0442\u0438") ||
    containsNormalizedPhrase(answerNorm, "\u0434\u0435\u0442\u0435\u0439");
  if (!childAnswer || containsNormalizedPhrase(answerNorm, "\u0432\u0437\u0440\u043e\u0441")) return { adjustment: 0, evidence: null };

  for (const page of pages) {
    for (const source of cachedLineWindowSegments(page)) {
      const normalized = source.normalized;
      if (
        containsNormalizedPhrase(normalized, "\u0434\u0435\u0442") &&
        (containsNormalizedPhrase(normalized, "\u043f\u0440\u043e\u0442\u0438\u0432\u043e\u043f\u043e\u043a\u0430\u0437") ||
          (containsNormalizedPhrase(normalized, "\u0442\u043e\u043b\u044c\u043a\u043e \u0432\u0437\u0440\u043e\u0441") && containsNormalizedPhrase(normalized, "\u0434\u0435\u0442")))
      ) {
        return {
          adjustment: -4.2,
          evidence: {
            answerId: answer.id,
            page: page.page,
            text: source.text,
            score: 4.2,
            kind: "age_eligibility_contraindication",
          },
        };
      }
    }
  }

  return { adjustment: 0, evidence: null };
}
