import { coverage, extractNumbers, normalizeForSearch, tokenize, uniqueTokens } from "../../normalize.js";
import { FOCUS_STOPWORDS } from "../constants.js";
import type { QuestionIntent } from "../contracts.js";
import type { AnswerOption, EvidenceItem } from "../types.js";
import {
  answerSearchPhrases,
  betterEvidence,
  containsNormalizedPhrase,
  evidenceSnippet,
  expandNumberToken,
  numberCoverage,
  strictSoftCoverage,
  tokenizeNormalized,
  tokenHitCount,
} from "../text-utils.js";
import { cyrillicOcrCoverage } from "./ocr-fuzzy.js";
import type {
  CoordinateCell,
  CoordinateCellAnswerSupport,
  CoordinateEvidence,
  CoordinatePdfPage,
  CoordinateTableRow,
  CoordinateTableRowsByPage,
  CoordinateTableRowSupportInput,
  CoordinateTextLine,
} from "./coordinate-table-types.js";

export const COORDINATE_TABLE_GENERIC_TOKENS = new Set(
  [
    "\u0442\u0430\u0431\u043b\u0438\u0446\u0430 \u0442\u0430\u0431\u043b\u0438\u0446\u0435 \u0442\u0430\u0431\u043b\u0438\u0447\u043d\u044b\u0439 \u0441\u043e\u0433\u043b\u0430\u0441\u043d\u043e",
    "\u043f\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u044c \u043f\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u0438 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u044f",
    "\u043a\u0440\u0438\u0442\u0435\u0440\u0438\u0439 \u043a\u0440\u0438\u0442\u0435\u0440\u0438\u0438 \u043f\u0440\u0438\u0437\u043d\u0430\u043a \u043f\u0440\u0438\u0437\u043d\u0430\u043a\u0438",
    "\u043a\u043b\u0430\u0441\u0441\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u044f \u043a\u043b\u0430\u0441\u0441\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u0438 \u0433\u0440\u0430\u0434\u0430\u0446\u0438\u044f",
    "\u043f\u043e\u043a\u0430\u0437\u0430\u043d\u0438\u044f \u043f\u043e\u043a\u0430\u0437\u0430\u043d\u0438\u0435 \u0441\u043e\u0441\u0442\u0430\u0432\u043b\u044f\u0435\u0442 \u0441\u043e\u0441\u0442\u0430\u0432\u043b\u044f\u044e\u0442",
  ].flatMap((item) => uniqueTokens(item)),
);

const COORDINATE_TABLE_CUE_TOKENS = new Set(
  [
    "\u0442\u0430\u0431\u043b\u0438\u0446\u0430 \u0442\u0430\u0431\u043b\u0438\u0446\u0435 \u0448\u043a\u0430\u043b\u0430 \u0448\u043a\u0430\u043b\u0435 \u043a\u043b\u0430\u0441\u0441\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u044f \u043a\u043b\u0430\u0441\u0441\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u0438",
    "\u0441\u0442\u0435\u043f\u0435\u043d\u044c \u0441\u0442\u0435\u043f\u0435\u043d\u0438 \u0441\u0442\u0430\u0434\u0438\u044f \u0441\u0442\u0430\u0434\u0438\u0438 \u043a\u043b\u0430\u0441\u0441 \u043a\u043b\u0430\u0441\u0441\u0430 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438",
    "\u043f\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u044c \u043f\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u0438 \u043f\u043e\u043a\u0430\u0437\u0430\u043d\u0438\u044f \u043f\u043e\u043a\u0430\u0437\u0430\u043d\u0438\u0435",
    "\u043a\u0440\u0438\u0442\u0435\u0440\u0438\u0439 \u043a\u0440\u0438\u0442\u0435\u0440\u0438\u0438 \u0433\u0440\u0430\u0434\u0430\u0446\u0438\u044f \u0430\u0431\u0441\u043e\u043b\u044e\u0442\u043d\u044b\u0435 \u043e\u0442\u043d\u043e\u0441\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435",
  ].flatMap((item) => uniqueTokens(item)),
);

export const COORDINATE_TABLE_MEMBERSHIP_GENERIC_TOKENS = new Set(
  [
    "препарат препараты лекарственный лекарственные лекарственных",
    "группа группы групп средство средства терапия терапии лечение лечения",
    "применяют применяется применяются используются назначают назначение",
    "местно виде мазь мазей суппозиторий суппозиториев",
    "цель цели достижение достижения риск риска снижение снижения",
  ].flatMap((item) => uniqueTokens(item)),
);

export const COORDINATE_RELATIONAL_GENERIC_TOKENS = new Set(
  [
    "основной основные основным тип типы типом повреждение повреждения печень печени",
    "болезнь болезни болезнью заболевание заболевания заболевании",
    "наиболее характерный характерные характерных",
    "показатель показатели состояние состояния отклонение отклонения повышение повышается",
    "механизм механизмы симптом симптомы наблюдается возникают относится характерно",
    "проявляется связано выступает формируется является являются заболевание заболевания",
  ].flatMap((item) => uniqueTokens(item)),
);

function numericSearchBoundary(
  normalizedText: string,
  index: number,
  length: number,
): boolean {
  const before = index > 0 ? normalizedText[index - 1] : "";
  const after = index + length < normalizedText.length ? normalizedText[index + length] : "";
  return !/[a-zа-я0-9]/iu.test(before) && !/[a-zа-я0-9]/iu.test(after);
}

/**
 * Быстрый gate для coordinate-table scorer'ов: включает их только когда вопрос
 * похож на таблицу, шкалу, классификацию, степень, стадию или числовой критерий.
 */
export function hasCoordinateTableCue(
  question: string,
  focusTokens: string[],
): boolean {
  const raw = String(question ?? "").toLowerCase();
  const rawCue = [
    "\u0442\u0430\u0431\u043b\u0438\u0446",
    "\u0448\u043a\u0430\u043b",
    "\u043a\u043b\u0430\u0441\u0441\u0438\u0444",
    "\u0441\u0442\u0435\u043f\u0435\u043d",
    "\u0441\u0442\u0430\u0434",
    "\u043a\u043b\u0430\u0441\u0441",
    "\u043a\u0430\u0442\u0435\u0433\u043e\u0440",
    "\u043f\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b",
    "\u043f\u043e\u043a\u0430\u0437\u0430\u043d",
    "\u043a\u0440\u0438\u0442\u0435\u0440",
    "\u0433\u0440\u0430\u0434\u0430\u0446",
    "\u0430\u0431\u0441\u043e\u043b\u044e\u0442",
    "\u043e\u0442\u043d\u043e\u0441\u0438\u0442\u0435\u043b",
  ].some((cue) => raw.includes(cue));
  if (rawCue) return true;
  const tokens = [...new Set([...(focusTokens ?? []), ...uniqueTokens(question)])];
  return tokens.some((token) => COORDINATE_TABLE_CUE_TOKENS.has(token));
}

/**
 * Более широкий gate для multi-групп: кроме явных таблиц допускает list-like
 * вопросы и формулировки про группы/состав/комбинации, где ответы часто живут
 * в одной табличной строке.
 */
export function hasCoordinateTableGroupCue(
  question: string,
  focusTokens: string[],
  intent: QuestionIntent,
): boolean {
  if (hasCoordinateTableCue(question, focusTokens)) return true;
  if (intent?.listLike) return true;
  const normalized = normalizeForSearch(question);
  const cuePhrases = [
    "\u0433\u0440\u0443\u043f\u043f",
    "\u043e\u0442\u043d\u043e\u0441",
    "\u0432\u043a\u043b\u044e\u0447",
    "\u0441\u043e\u0441\u0442\u0430\u0432",
    "\u043f\u0440\u0435\u0434\u0441\u0442\u0430\u0432",
    "\u043a\u043e\u043c\u0431\u0438\u043d\u0430\u0446",
  ].map((item) => normalizeForSearch(item));
  if (cuePhrases.some((cue) => containsNormalizedPhrase(normalized, cue))) return true;
  const tokens = [...new Set([...(focusTokens ?? []), ...uniqueTokens(question)])];
  return tokenHitCount([...COORDINATE_TABLE_CUE_TOKENS], tokens) > 0;
}

/**
 * Узкий gate для реляционных таблиц: вопрос должен запрашивать тип, механизм,
 * показатель, симптом или другую явно сформулированную связь между колонками.
 */
export function hasCoordinateRelationalRowCue(question: string): boolean {
  const raw = String(question ?? "").toLowerCase();
  const cueGroups = [
    ["тип", "поврежден"],
    ["механизм"],
    ["отклонен", "показател"],
    ["наблюда"],
    ["возника"],
    ["сочета"],
    ["проявля"],
    ["связан"],
    ["выступа"],
    ["формиру"],
    ["отлич", "отсутств"],
    ["различ"],
  ];
  const symptomRelation =
    raw.includes("симптом") &&
    /(?:симптом\p{L}*.{0,120}(?:явля|наблюд|возника|характер)|(?:явля|наблюд|возника|характер).{0,120}симптом)/iu.test(raw);
  return symptomRelation || cueGroups.some((group) => group.every((cue) => raw.includes(cue)));
}

/** Вопросы сравнения могут ссылаться на таблицу далеко от BM25 top-pages. */
export function hasCoordinateComparisonTableCue(question: string): boolean {
  const raw = String(question ?? "").toLowerCase();
  return (
    (raw.includes("отлич") && (raw.includes("отсутств") || raw.includes("налич") || raw.includes("выяв"))) ||
    (raw.includes("различ") && (raw.includes("между") || raw.includes("от ")))
  );
}

export function coordinateCellText(
  cell: Pick<CoordinateCell, "text"> | null | undefined,
): string {
  return String(cell?.text ?? "").replace(/\s+/g, " ").trim();
}

export function coordinateLineCells(
  line: CoordinateTextLine | null | undefined,
): CoordinateCell[] {
  const items = [...(line?.items ?? [])]
    .filter((item) => String(item?.text ?? "").trim())
    .sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
  const cells: CoordinateCell[] = [];

  for (const item of items) {
    const text = String(item.text ?? "").replace(/\s+/g, " ").trim();
    const x = item.x ?? 0;
    const width = item.width ?? Math.max(8, text.length * 4.2);
    const endX = x + Math.max(width, 4);
    const previous = cells[cells.length - 1];
    if (!previous) {
      cells.push({ text, x, endX, y: item.y ?? line?.y ?? 0, itemCount: 1 });
      continue;
    }

    const visualGap = x - (previous.endX ?? 0);
    const originGap = x - (previous.x ?? 0);
    if (visualGap > 18 && originGap > 34) {
      cells.push({ text, x, endX, y: item.y ?? line?.y ?? 0, itemCount: 1 });
    } else {
      previous.text = `${previous.text} ${text}`.replace(/\s+/g, " ").trim();
      previous.endX = Math.max(previous.endX ?? 0, endX);
      previous.itemCount = (previous.itemCount ?? 0) + 1;
    }
  }

  return cells.filter((cell) => coordinateCellText(cell));
}

export function coordinateGroupLineCells(
  line: CoordinateTextLine | null | undefined,
): CoordinateCell[] {
  const items = [...(line?.items ?? [])]
    .filter((item) => String(item?.text ?? "").trim())
    .sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
  const cells: CoordinateCell[] = [];

  for (const item of items) {
    const text = String(item.text ?? "").replace(/\s+/g, " ").trim();
    const x = item.x ?? 0;
    const width = item.width ?? Math.max(8, text.length * 4.2);
    const endX = x + Math.max(width, 4);
    const previous = cells[cells.length - 1];
    if (!previous) {
      cells.push({ text, x, endX, y: item.y ?? line?.y ?? 0, itemCount: 1 });
      continue;
    }

    const visualGap = x - (previous.endX ?? 0);
    const originGap = x - (previous.x ?? 0);
    if (visualGap > 18 || originGap > 64) {
      cells.push({ text, x, endX, y: item.y ?? line?.y ?? 0, itemCount: 1 });
    } else {
      previous.text = `${previous.text} ${text}`.replace(/\s+/g, " ").trim();
      previous.endX = Math.max(previous.endX ?? 0, endX);
      previous.itemCount = (previous.itemCount ?? 0) + 1;
    }
  }

  return cells.filter((cell) => coordinateCellText(cell));
}

export function coordinateCellsSpread(cells: CoordinateCell[]): number {
  if (cells.length < 2) return 0;
  return (
    Math.max(...cells.map((cell) => cell.endX ?? 0)) -
    Math.min(...cells.map((cell) => cell.x ?? 0))
  );
}

export function coordinateCellsHaveNumericValue(
  cells: CoordinateCell[],
): boolean {
  return cells.some((cell) => extractNumbers(cell.text).length > 0 || /[<>≤≥=]/u.test(String(cell.text ?? "")));
}

export function isCoordinateTableLine(
  line: CoordinateTextLine | null | undefined,
  cells: CoordinateCell[] = coordinateLineCells(line),
): boolean {
  if (!cells.length) return false;
  const text = String(line?.text ?? "").replace(/\s+/g, " ").trim();
  const spread = coordinateCellsSpread(cells);
  if (text.length > 340) return false;
  if (cells.length >= 3 && spread >= 135) return true;
  if (cells.length >= 2 && spread >= 190 && coordinateCellsHaveNumericValue(cells)) return true;
  return false;
}

export function coordinateLineHasHeaderCue(
  line: CoordinateTextLine | null | undefined,
): boolean {
  const tokens = tokenize(line?.text ?? "");
  return tokenHitCount([...COORDINATE_TABLE_CUE_TOKENS], tokens) > 0;
}

export function coordinateTextHasTableCaption(text: string): boolean {
  const normalized = normalizeForSearch(text);
  if (containsNormalizedPhrase(normalized, "\u0441\u043e\u0433\u043b\u0430\u0441\u043d\u043e \u0442\u0430\u0431\u043b\u0438\u0446")) return false;
  return (
    containsNormalizedPhrase(normalized, "\u0442\u0430\u0431\u043b\u0438\u0446") ||
    containsNormalizedPhrase(normalized, "\u0448\u043a\u0430\u043b") ||
    containsNormalizedPhrase(normalized, "\u0433\u0440\u0430\u0434\u0430\u0446") ||
    containsNormalizedPhrase(normalized, "\u043a\u043b\u0430\u0441\u0441\u0438\u0444")
  );
}

export function coordinateTextHasExplicitTableCaption(text: string): boolean {
  const normalized = normalizeForSearch(text);
  if (containsNormalizedPhrase(normalized, "\u0441\u043e\u0433\u043b\u0430\u0441\u043d\u043e \u0442\u0430\u0431\u043b\u0438\u0446")) return false;
  return containsNormalizedPhrase(normalized, "\u0442\u0430\u0431\u043b\u0438\u0446");
}

export function coordinateTextIsRecommendationMeta(text: string): boolean {
  const raw = String(text ?? "").toLowerCase();
  if (
    raw.includes("\u0443\u0440\u043e\u0432\u0435\u043d\u044c \u0443\u0431\u0435\u0434\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442") ||
    raw.includes("\u0434\u043e\u0441\u0442\u043e\u0432\u0435\u0440\u043d\u043e\u0441\u0442") ||
    raw.includes("\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434") ||
    raw.includes("\u043a\u043e\u043c\u043c\u0435\u043d\u0442")
  ) {
    return true;
  }
  const normalized = normalizeForSearch(text);
  return (
    containsNormalizedPhrase(normalized, "\u0443\u0440\u043e\u0432\u0435\u043d\u044c \u0443\u0431\u0435\u0434\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442") ||
    containsNormalizedPhrase(normalized, "\u0434\u043e\u0441\u0442\u043e\u0432\u0435\u0440\u043d\u043e\u0441\u0442\u0438 \u0434\u043e\u043a\u0430\u0437") ||
    containsNormalizedPhrase(normalized, "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434") ||
    containsNormalizedPhrase(normalized, "\u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440")
  );
}

export function coordinateLineLooksLikeDataRow(
  line: CoordinateTextLine | null | undefined,
  cells: CoordinateCell[] = coordinateLineCells(line),
): boolean {
  if (!cells.length) return false;
  if (coordinateLineHasHeaderCue(line)) return false;
  const firstCell = normalizeForSearch(cells[0]?.text ?? "");
  const firstTwoText = cells
    .slice(0, 2)
    .map((cell) => cell.text)
    .join(" ");
  if (/^(?:[ivxlcdm]+|\d+(?:[.)])?)$/iu.test(firstCell)) return true;
  if (severityCue(firstTwoText)) return true;
  if (cells.length >= 3 && coordinateCellsHaveNumericValue(cells) && !containsNormalizedPhrase(normalizeForSearch(line?.text ?? ""), "\u0442\u0430\u0431\u043b\u0438\u0446")) return true;
  return false;
}

export function coordinateSeverityCueCount(text: string): number {
  const normalized = normalizeForSearch(text);
  const cues = [
    "\u043a\u0440\u0430\u0439\u043d",
    "\u0441\u0440\u0435\u0434\u043d\u0435\u0442\u044f\u0436",
    "\u0441\u0440\u0435\u0434\u043d",
    "\u0443\u043c\u0435\u0440\u0435\u043d",
    "\u0442\u044f\u0436\u0435\u043b",
    "\u043b\u0435\u0433\u043a",
  ];
  let count = 0;
  for (const cue of cues) {
    if (containsNormalizedPhrase(normalized, cue)) count += 1;
  }
  return count;
}

export function coordinateRowHasTableContext(
  row: CoordinateTableRow,
): boolean {
  const firstCell = normalizeForSearch(row.cells?.[0]?.text ?? "");
  const firstTwoText = (row.cells ?? [])
    .slice(0, 2)
    .map((cell) => cell.text)
    .join(" ");
  const structuralFirstCell =
    ((row.cells?.length ?? 0) >= 3 && /^(?:[ivxlcdm]+|\d+(?:[.)])?)$/iu.test(firstCell)) ||
    ((row.cells?.length ?? 0) >= 3 && severityCue(firstTwoText));
  if (coordinateTextIsRecommendationMeta(row.sourceText || row.text) && !structuralFirstCell) return false;
  if (coordinateTextHasTableCaption(row.headerText)) return true;
  if (structuralFirstCell) return true;
  return false;
}

export function coordinateTableQuestionBlocked(question: string): boolean {
  const normalized = normalizeForSearch(question);
  return containsNormalizedPhrase(normalized, "\u0444\u0438\u0431\u0440\u043e\u0437") || containsNormalizedPhrase(normalized, "metavir");
}

function nearestCoordinateCell(
  cells: CoordinateCell[],
  x: number,
): CoordinateCell | null {
  let best: CoordinateCell | null = null;
  let bestDistance = Infinity;
  for (const cell of cells) {
    const cellX = cell.x ?? 0;
    const center = (cellX + (cell.endX ?? cellX)) / 2;
    const distance = Math.min(Math.abs(cellX - x), Math.abs(center - x));
    if (distance < bestDistance) {
      best = cell;
      bestDistance = distance;
    }
  }
  return bestDistance <= 54 ? best : null;
}

function appendCoordinateContinuation(
  baseCells: CoordinateCell[],
  continuationCells: CoordinateCell[],
): boolean {
  let appended = false;
  for (const cell of continuationCells) {
    const target = nearestCoordinateCell(baseCells, cell.x ?? 0);
    if (!target) continue;
    target.text = `${target.text} ${cell.text}`.replace(/\s+/g, " ").trim();
    target.endX = Math.max(target.endX ?? 0, cell.endX ?? 0);
    target.itemCount = (target.itemCount ?? 0) + (cell.itemCount ?? 1);
    appended = true;
  }
  return appended;
}

export function coordinateHeaderText(
  lines: CoordinateTextLine[],
  index: number,
): string {
  const parts: string[] = [];
  for (let current = index - 1; current >= 0 && parts.length < 5; current -= 1) {
    const line = lines[current];
    const text = String(line?.text ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (coordinateTextIsRecommendationMeta(text)) break;
    const cells = coordinateLineCells(line);
    if (coordinateLineLooksLikeDataRow(line, cells)) break;
    const normalized = normalizeForSearch(text);
    const headerLike =
      isCoordinateTableLine(line, cells) ||
      containsNormalizedPhrase(normalized, "\u0442\u0430\u0431\u043b\u0438\u0446") ||
      (text.length <= 140 && (cells.length <= 2 || coordinateCellsSpread(cells) < 180));
    if (!headerLike) break;
    parts.unshift(text);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function coordinateNearbyTableContext(
  lines: CoordinateTextLine[],
  index: number,
): string {
  const localHeader = coordinateHeaderText(lines, index);
  if (coordinateTextHasTableCaption(localHeader)) return localHeader;
  const parts: string[] = [];
  for (let current = index - 1; current >= 0 && current >= index - 24; current -= 1) {
    const line = lines[current];
    const text = String(line?.text ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (coordinateTextHasTableCaption(text)) {
      parts.unshift(text);
      break;
    }
  }
  return [...parts, localHeader].join(" ").replace(/\s+/g, " ").trim();
}

function coordinateTableRows(page: CoordinatePdfPage): CoordinateTableRow[] {
  if (page.__coordinateTableRows) return page.__coordinateTableRows;
  const lines = page.lineItems ?? [];
  const rows: CoordinateTableRow[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const baseCells = coordinateLineCells(line).map((cell) => ({ ...cell }));
    if (!isCoordinateTableLine(line, baseCells)) continue;

    let previousY = line?.y ?? 0;
    const rowLineTexts = [line.text];
    for (let nextIndex = index + 1; nextIndex < lines.length && nextIndex <= index + 4; nextIndex += 1) {
      const nextLine = lines[nextIndex];
      const y = nextLine?.y ?? previousY;
      if (Math.abs(y - previousY) > 25) break;
      const nextCells = coordinateLineCells(nextLine);
      if (!nextCells.length) break;
      const looksLikeNewRow =
        isCoordinateTableLine(nextLine, nextCells) &&
        nextCells.length >= Math.max(2, baseCells.length - 1) &&
        Math.abs((nextCells[0]?.x ?? 0) - (baseCells[0]?.x ?? 0)) <= 32;
      if (looksLikeNewRow) break;
      const appended = appendCoordinateContinuation(baseCells, nextCells);
      if (!appended) break;
      rowLineTexts.push(nextLine.text);
      previousY = y;
    }

    const text = baseCells.map((cell) => cell.text).join(" ").replace(/\s+/g, " ").trim();
    if (text.length < 8) continue;
    rows.push({
      page: page.page,
      index,
      y: line?.y ?? 0,
      headerText: coordinateHeaderText(lines, index),
      text,
      sourceText: rowLineTexts.join(" ").replace(/\s+/g, " ").trim(),
      cells: baseCells.map((cell, cellIndex) => ({
        ...cell,
        index: cellIndex,
        normalized: normalizeForSearch(cell.text),
        tokens: tokenize(cell.text),
      })),
    });
  }

  Object.defineProperty(page, "__coordinateTableRows", {
    value: rows,
    enumerable: false,
  });
  return rows;
}

/**
 * Строит по страницам обычные coordinate rows: строка PDF разбивается на
 * x-ячейки, рядом лежащие continuation-строки приклеиваются к базовой строке.
 */
export function buildCoordinateTableRowsByPage(
  pages: CoordinatePdfPage[],
  topQuestionPages?: Set<number>,
): CoordinateTableRowsByPage {
  const byPage: CoordinateTableRowsByPage = new Map();
  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    const rows = coordinateTableRows(page);
    if (rows.length) byPage.set(page.page, rows);
  }
  return byPage;
}


export function coordinateTableFocusTokens(
  question: string,
  focusTokens: string[],
  answerTokens: string[],
): string[] {
  const answerSet = new Set(answerTokens ?? []);
  const out: string[] = [];
  for (const token of [...(focusTokens ?? []), ...uniqueTokens(question)]) {
    if (!token || token.length < 3) continue;
    if (FOCUS_STOPWORDS.has(token) || COORDINATE_TABLE_GENERIC_TOKENS.has(token)) continue;
    if (answerSet.has(token) && !/^\d/u.test(token)) continue;
    if (!out.includes(token)) out.push(token);
  }
  return out.slice(0, 12);
}

export function coordinateCompoundFocusMatches(
  tableFocus: string[],
  labelTokens: string[],
): boolean {
  const compound = tableFocus.filter((token) => /[+/]/u.test(token));
  if (!compound.length) return true;
  const labelSet = new Set(labelTokens ?? []);
  for (const token of compound) {
    if (labelSet.has(token)) return true;
    const parts = token
      .split(/[+/]+/u)
      .map((part) => part.trim())
      .filter((part) => part.length >= 2);
    if (parts.length >= 2 && parts.every((part) => labelSet.has(part))) return true;
  }
  return false;
}

export function coordinateRouteSynonymSupport(
  answerText: string,
  cellText: string,
): number {
  const answer = normalizeForSearch(answerText);
  const cell = normalizeForSearch(cellText);
  const routeGroups = [
    ["\u043f\u0435\u0440\u043e\u0440\u0430\u043b", "\u0432\u043d\u0443\u0442\u0440\u044c", "per os", "peros", "p o"],
    ["\u0432\u043d\u0443\u0442\u0440\u0438\u0432", "\u0432/\u0432"],
    ["\u0432\u043d\u0443\u0442\u0440\u0438\u043c\u044b\u0448", "\u0432/\u043c"],
    ["\u043f\u043e\u0434\u043a\u043e\u0436", "\u043f/\u043a"],
  ];
  for (const cues of routeGroups) {
    const answerHit = cues.some((cue) => containsNormalizedPhrase(answer, cue));
    if (!answerHit) continue;
    const cellHit = cues.some((cue) => containsNormalizedPhrase(cell, cue));
    if (cellHit) return 0.96;
  }
  return 0;
}

export function severityCue(
  text: string,
): "very_severe" | "moderate" | "severe" | "mild" | null {
  const normalized = normalizeForSearch(text);
  if (containsNormalizedPhrase(normalized, "\u043a\u0440\u0430\u0439\u043d") && containsNormalizedPhrase(normalized, "\u0442\u044f\u0436")) return "very_severe";
  if (
    containsNormalizedPhrase(normalized, "\u0441\u0440\u0435\u0434\u043d\u0435\u0442\u044f\u0436") ||
    containsNormalizedPhrase(normalized, "\u0441\u0440\u0435\u0434\u043d") ||
    containsNormalizedPhrase(normalized, "\u0443\u043c\u0435\u0440\u0435\u043d")
  ) {
    return "moderate";
  }
  if (containsNormalizedPhrase(normalized, "\u0442\u044f\u0436\u0435\u043b")) return "severe";
  if (containsNormalizedPhrase(normalized, "\u043b\u0435\u0433\u043a")) return "mild";
  return null;
}

function coordinateDirectionCuesAroundNumber(
  normalizedText: string,
  number: string,
): Set<"gt" | "lt"> {
  const forms = [...new Set(expandNumberToken(number).map((item) => normalizeForSearch(item)).filter(Boolean))];
  const directions = new Set<"gt" | "lt">();
  for (const form of forms) {
    let start = 0;
    while (start < normalizedText.length) {
      const index = normalizedText.indexOf(form, start);
      if (index < 0) break;
      if (!numericSearchBoundary(normalizedText, index, form.length)) {
        start = index + Math.max(1, form.length);
        continue;
      }
      const local = normalizedText.slice(Math.max(0, index - 32), Math.min(normalizedText.length, index + form.length + 20));
      if (
        containsNormalizedPhrase(local, "\u0431\u043e\u043b\u0435\u0435") ||
        containsNormalizedPhrase(local, "\u0431\u043e\u043b\u044c\u0448\u0435") ||
        containsNormalizedPhrase(local, "\u0432\u044b\u0448\u0435") ||
        />|>=/u.test(local)
      ) {
        directions.add("gt");
      }
      if (
        containsNormalizedPhrase(local, "\u043c\u0435\u043d\u0435\u0435") ||
        containsNormalizedPhrase(local, "\u043c\u0435\u043d\u044c\u0448\u0435") ||
        containsNormalizedPhrase(local, "\u043d\u0438\u0436\u0435") ||
        containsNormalizedPhrase(local, "\u0434\u043e ") ||
        /<|<=/u.test(local)
      ) {
        directions.add("lt");
      }
      if (
        containsNormalizedPhrase(local, "\u043d\u0435 \u0431\u043e\u043b\u0435\u0435") ||
        containsNormalizedPhrase(local, "\u043d\u0435\u0431\u043e\u043b\u0435\u0435")
      ) {
        directions.delete("gt");
        directions.add("lt");
      }
      if (
        containsNormalizedPhrase(local, "\u043d\u0435 \u043c\u0435\u043d\u0435\u0435") ||
        containsNormalizedPhrase(local, "\u043d\u0435\u043c\u0435\u043d\u0435\u0435")
      ) {
        directions.delete("lt");
        directions.add("gt");
      }
      start = index + Math.max(1, form.length);
    }
  }
  return directions;
}

export function coordinateNumericDirectionCompatible(
  cellText: string,
  answerText: string,
  answerNumbers: string[],
): boolean {
  if (!answerNumbers.length) return true;
  const normalizedCell = normalizeForSearch(cellText);
  const normalizedAnswer = normalizeForSearch(answerText);
  for (const number of answerNumbers) {
    const answerDirections = coordinateDirectionCuesAroundNumber(normalizedAnswer, number);
    if (!answerDirections.size) continue;
    const cellDirections = coordinateDirectionCuesAroundNumber(normalizedCell, number);
    if (!cellDirections.size) continue;
    const sameDirection = [...answerDirections].some((direction) => cellDirections.has(direction));
    if (!sameDirection) return false;
  }
  return true;
}

export function coordinateCellAnswerSupport(
  cell: CoordinateCell,
  answer: AnswerOption,
  answerTokens: string[],
  answerPhrases: string[],
  answerNumbers: string[],
): CoordinateCellAnswerSupport {
  const text = coordinateCellText(cell);
  const normalized = normalizeForSearch(text);
  const tokens = tokenizeNormalized(normalized);
  const numericCoverage = numberCoverage(answer.text, normalized);
  const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(normalized, phrase));
  const tokenSupport = answerTokens.length ? strictSoftCoverage(answerTokens, tokens) : 0;
  let support = Math.max(tokenSupport, phraseHit ? 1 : 0, numericCoverage);
  if (answerNumbers.length) {
    const expanded = [...new Set(answerNumbers.flatMap(expandNumberToken))];
    const required = expanded.length > 1 ? 0.82 : 0.5;
    if (numericCoverage < required) support = Math.min(support, numericCoverage * 0.7);
  }
  return { support, numericCoverage, phraseHit, tokens, normalized };
}

function coordinateRowContrastBonus(
  row: CoordinateTableRow,
  bestCell: CoordinateCell,
  tableFocus: string[],
  bestCellSupport: CoordinateCellAnswerSupport,
  wholeRowAnswerMatch: boolean,
): number {
  if (!row?.cells?.length || !bestCell || wholeRowAnswerMatch) return -0.35;
  const cellIndex = bestCell.index ?? -1;
  if (cellIndex < 0) return -0.35;

  const labelText = row.cells
    .filter((cell) => (cell.index ?? 0) < cellIndex)
    .slice(-2)
    .map((cell) => cell.text)
    .join(" ");
  const labelTokens = tokenize(labelText);
  const leftFocusHits = tokenHitCount(tableFocus, labelTokens);
  const leftFocusCoverage = tableFocus.length ? coverage(tableFocus, labelTokens) : 0;
  const headerCue = coordinateTextHasTableCaption(row.headerText) ? 0.25 : 0;
  const numericSpecificity = bestCellSupport?.numericCoverage >= 0.82 ? 0.35 : 0;

  if (leftFocusHits <= 0 && leftFocusCoverage < 0.18) return headerCue + numericSpecificity - 0.2;
  return Math.min(1.4, leftFocusHits * 0.35 + leftFocusCoverage * 1.6 + headerCue + numericSpecificity);
}

/**
 * Оценивает single-answer поддержку из coordinate row: вариант должен совпасть
 * с конкретной ячейкой, а соседние ячейки/заголовок должны объяснять фокус вопроса.
 */
export function bestCoordinateTableRowSupport({
  mode,
  question,
  answer,
  answerTokens,
  focusTokens,
  coordinateTableRowsByPage,
}: CoordinateTableRowSupportInput): CoordinateEvidence {
  if (!coordinateTableRowsByPage) return null;
  if (mode !== "single") return null;
  if (coordinateTableQuestionBlocked(question)) return null;
  const answerNumbers = extractNumbers(answer.text);

  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 12);
  const tableFocus = coordinateTableFocusTokens(question, focusTokens, answerTokens);
  if (!tableFocus.length && !answerNumbers.length) return null;
  const questionSeverity = severityCue(question);
  let best: EvidenceItem | null = null;

  for (const rows of coordinateTableRowsByPage.values()) {
    for (const row of rows) {
      if (!row.cells?.length) continue;
      if (!coordinateRowHasTableContext(row)) continue;
      if (questionSeverity && coordinateSeverityCueCount(row.text) > 1) continue;
      let bestCell: CoordinateCell | null = null;
      let bestCellSupport: CoordinateCellAnswerSupport | null = null;
      for (const cell of row.cells) {
        const support = coordinateCellAnswerSupport(cell, answer, answerTokens, answerPhrases, answerNumbers);
        if (!bestCellSupport || support.support > bestCellSupport.support) {
          bestCell = cell;
          bestCellSupport = support;
        }
      }
      const minAnswerSupport = answerNumbers.length ? 0.5 : 0.64;
      let wholeRowAnswerMatch = false;
      if ((!bestCellSupport || bestCellSupport.support < minAnswerSupport) && answerNumbers.length) {
        const rowSupport = coordinateCellAnswerSupport(
          { text: `${row.headerText} ${row.text}`.replace(/\s+/g, " ").trim(), index: -1 },
          answer,
          answerTokens,
          answerPhrases,
          answerNumbers,
        );
        if (rowSupport.support >= minAnswerSupport) {
          bestCell = { text: "", index: -1 };
          bestCellSupport = rowSupport;
          wholeRowAnswerMatch = true;
        }
      }
      if (!bestCell || !bestCellSupport || bestCellSupport.support < minAnswerSupport) continue;

      const otherCellsText = row.cells
        .filter((cell) => wholeRowAnswerMatch || cell.index !== bestCell.index)
        .map((cell) => cell.text)
        .join(" ");
      const rowSpecificTokens = tokenize(otherCellsText);
      const rowSpecificCoverage = tableFocus.length ? coverage(tableFocus, rowSpecificTokens) : 0;
      const rowSpecificHits = tokenHitCount(tableFocus, rowSpecificTokens);
      const headerTokens = tokenize(row.headerText);
      const headerCoverage = tableFocus.length ? coverage(tableFocus, headerTokens) : 0;
      if (tableFocus.length && rowSpecificCoverage < 0.16 && rowSpecificHits < 1) continue;

      const rowLabelText = row.cells
        .filter((cell) => cell.index !== bestCell.index)
        .slice(0, 2)
        .map((cell) => cell.text)
        .join(" ");
      const rowSeverity = severityCue(rowLabelText || otherCellsText);
      if (questionSeverity && rowSeverity !== questionSeverity) continue;

      const score =
        13.4 +
        Math.min(1, bestCellSupport.support) * 8.4 +
        Math.min(0.75, rowSpecificCoverage) * 7.0 +
        Math.min(3, rowSpecificHits) * 1.2 +
        Math.min(0.45, headerCoverage) * 2.4 +
        bestCellSupport.numericCoverage * 2.6 +
        (bestCellSupport.phraseHit ? 1.1 : 0) +
        (row.cells.length >= 3 ? 1.3 : 0) +
        coordinateRowContrastBonus(row, bestCell, tableFocus, bestCellSupport, wholeRowAnswerMatch);
      best = betterEvidence(best, {
        answerId: answer.id,
        page: row.page,
        text: `${row.headerText} ${row.sourceText || row.text}`.replace(/\s+/g, " ").trim(),
        score,
        kind: "coordinate_table_row",
      });
    }
  }

  return best;
}
