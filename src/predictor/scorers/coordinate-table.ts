import { coverage, extractNumbers, normalizeForSearch, tokenize, uniqueTokens } from "../../normalize.js";
import { FOCUS_STOPWORDS } from "../constants.js";
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

const COORDINATE_TABLE_GENERIC_TOKENS = new Set(
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

function numericSearchBoundary(normalizedText, index, length) {
  const before = index > 0 ? normalizedText[index - 1] : "";
  const after = index + length < normalizedText.length ? normalizedText[index + length] : "";
  return !/[a-zа-я0-9]/iu.test(before) && !/[a-zа-я0-9]/iu.test(after);
}

/**
 * Быстрый gate для coordinate-table scorer'ов: включает их только когда вопрос
 * похож на таблицу, шкалу, классификацию, степень, стадию или числовой критерий.
 */
export function hasCoordinateTableCue(question, focusTokens) {
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
export function hasCoordinateTableGroupCue(question, focusTokens, intent) {
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

function coordinateCellText(cell) {
  return String(cell?.text ?? "").replace(/\s+/g, " ").trim();
}

function coordinateLineCells(line) {
  const items = [...(line?.items ?? [])]
    .filter((item) => String(item?.text ?? "").trim())
    .sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
  const cells = [];

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

    const visualGap = x - previous.endX;
    const originGap = x - previous.x;
    if (visualGap > 18 && originGap > 34) {
      cells.push({ text, x, endX, y: item.y ?? line?.y ?? 0, itemCount: 1 });
    } else {
      previous.text = `${previous.text} ${text}`.replace(/\s+/g, " ").trim();
      previous.endX = Math.max(previous.endX, endX);
      previous.itemCount += 1;
    }
  }

  return cells.filter((cell) => coordinateCellText(cell));
}

function coordinateGroupLineCells(line) {
  const items = [...(line?.items ?? [])]
    .filter((item) => String(item?.text ?? "").trim())
    .sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
  const cells = [];

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

    const visualGap = x - previous.endX;
    const originGap = x - previous.x;
    if (visualGap > 18 || originGap > 64) {
      cells.push({ text, x, endX, y: item.y ?? line?.y ?? 0, itemCount: 1 });
    } else {
      previous.text = `${previous.text} ${text}`.replace(/\s+/g, " ").trim();
      previous.endX = Math.max(previous.endX, endX);
      previous.itemCount += 1;
    }
  }

  return cells.filter((cell) => coordinateCellText(cell));
}

function coordinateCellsSpread(cells) {
  if (cells.length < 2) return 0;
  return Math.max(...cells.map((cell) => cell.endX)) - Math.min(...cells.map((cell) => cell.x));
}

function coordinateCellsHaveNumericValue(cells) {
  return cells.some((cell) => extractNumbers(cell.text).length > 0 || /[<>≤≥=]/u.test(String(cell.text ?? "")));
}

function isCoordinateTableLine(line, cells = coordinateLineCells(line)) {
  if (!cells.length) return false;
  const text = String(line?.text ?? "").replace(/\s+/g, " ").trim();
  const spread = coordinateCellsSpread(cells);
  if (text.length > 340) return false;
  if (cells.length >= 3 && spread >= 135) return true;
  if (cells.length >= 2 && spread >= 190 && coordinateCellsHaveNumericValue(cells)) return true;
  return false;
}

function coordinateLineHasHeaderCue(line) {
  const tokens = tokenize(line?.text ?? "");
  return tokenHitCount([...COORDINATE_TABLE_CUE_TOKENS], tokens) > 0;
}

function coordinateTextHasTableCaption(text) {
  const normalized = normalizeForSearch(text);
  if (containsNormalizedPhrase(normalized, "\u0441\u043e\u0433\u043b\u0430\u0441\u043d\u043e \u0442\u0430\u0431\u043b\u0438\u0446")) return false;
  return (
    containsNormalizedPhrase(normalized, "\u0442\u0430\u0431\u043b\u0438\u0446") ||
    containsNormalizedPhrase(normalized, "\u0448\u043a\u0430\u043b") ||
    containsNormalizedPhrase(normalized, "\u0433\u0440\u0430\u0434\u0430\u0446") ||
    containsNormalizedPhrase(normalized, "\u043a\u043b\u0430\u0441\u0441\u0438\u0444")
  );
}

function coordinateTextHasExplicitTableCaption(text) {
  const normalized = normalizeForSearch(text);
  if (containsNormalizedPhrase(normalized, "\u0441\u043e\u0433\u043b\u0430\u0441\u043d\u043e \u0442\u0430\u0431\u043b\u0438\u0446")) return false;
  return containsNormalizedPhrase(normalized, "\u0442\u0430\u0431\u043b\u0438\u0446");
}

function coordinateTextIsRecommendationMeta(text) {
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

function coordinateLineLooksLikeDataRow(line, cells = coordinateLineCells(line)) {
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

function coordinateSeverityCueCount(text) {
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

function coordinateRowHasTableContext(row) {
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

function coordinateTableQuestionBlocked(question) {
  const normalized = normalizeForSearch(question);
  return containsNormalizedPhrase(normalized, "\u0444\u0438\u0431\u0440\u043e\u0437") || containsNormalizedPhrase(normalized, "metavir");
}

function nearestCoordinateCell(cells, x) {
  let best = null;
  let bestDistance = Infinity;
  for (const cell of cells) {
    const center = (cell.x + cell.endX) / 2;
    const distance = Math.min(Math.abs(cell.x - x), Math.abs(center - x));
    if (distance < bestDistance) {
      best = cell;
      bestDistance = distance;
    }
  }
  return bestDistance <= 54 ? best : null;
}

function appendCoordinateContinuation(baseCells, continuationCells) {
  let appended = false;
  for (const cell of continuationCells) {
    const target = nearestCoordinateCell(baseCells, cell.x);
    if (!target) continue;
    target.text = `${target.text} ${cell.text}`.replace(/\s+/g, " ").trim();
    target.endX = Math.max(target.endX, cell.endX);
    target.itemCount += cell.itemCount ?? 1;
    appended = true;
  }
  return appended;
}

function coordinateHeaderText(lines, index) {
  const parts = [];
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

function coordinateNearbyTableContext(lines, index) {
  const localHeader = coordinateHeaderText(lines, index);
  if (coordinateTextHasTableCaption(localHeader)) return localHeader;
  const parts = [];
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

function coordinateTableRows(page) {
  if (page.__coordinateTableRows) return page.__coordinateTableRows;
  const lines = page.lineItems ?? [];
  const rows = [];

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
export function buildCoordinateTableRowsByPage(pages, topQuestionPages) {
  const byPage = new Map();
  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    const rows = coordinateTableRows(page);
    if (rows.length) byPage.set(page.page, rows);
  }
  return byPage;
}

function coordinateGroupLineLooksLikeStart(cells) {
  if (cells.length < 2) return false;
  const spread = coordinateCellsSpread(cells);
  if (spread < 115) return false;
  const firstX = cells[0]?.x ?? 0;
  const lastX = cells[cells.length - 1]?.x ?? firstX;
  return lastX - firstX >= 85;
}

function coordinateLooksLikeTableBoundary(line) {
  const text = String(line?.text ?? "").replace(/\s+/g, " ").trim();
  if (!text) return true;
  const normalized = normalizeForSearch(text);
  if (containsNormalizedPhrase(normalized, "\u0442\u0430\u0431\u043b\u0438\u0446") && !/^\s*\u0442\u0430\u0431\u043b\u0438\u0446/u.test(text.toLowerCase())) return false;
  if (/^\s*(?:\d+\.){1,3}\s+/u.test(text)) return true;
  if (text.length <= 90 && /^(?:\u0440\u0438\u0441\u0443\u043d\u043e\u043a|\u0441\u043f\u0438\u0441\u043e\u043a|\u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435)\b/iu.test(text)) return true;
  return false;
}

function coordinateShortCodeLike(text) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!value) return false;
  if (value.length > 44) return false;
  if (/[a-z\u0430-\u044f]{3,}/u.test(value)) return false;
  if (/[()]/u.test(value) && /[A-Z\u0410-\u042f0-9]{2,}/u.test(value)) return true;
  if (/\*\*/u.test(value)) return true;
  return /^[A-Z\u0410-\u042f0-9./+-]{2,}(?:\s+[A-Z\u0410-\u042f0-9./+-]{2,}){0,2}$/u.test(value);
}

function coordinateLabelContinuationLikely(labelText, nextLabelText, nextValueText) {
  const labelTokens = uniqueTokens(labelText);
  const nextTokens = uniqueTokens(nextLabelText);
  if (!labelTokens.length || !nextTokens.length) return false;
  if (coordinateShortCodeLike(nextValueText)) return true;
  if (String(labelText ?? "").length <= 48 && /[()/]/u.test(String(nextLabelText ?? ""))) return true;
  return false;
}

function coordinateGroupHeaderCells(cells) {
  const text = cells
    .map((cell) => cell.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = normalizeForSearch(text);
  const columnCueCount = [
    "\u043a\u043b\u0430\u0441\u0441",
    "\u0433\u0440\u0443\u043f\u043f",
    "\u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442",
    "\u043f\u043e\u043a\u0430\u0437\u0430\u0442",
    "\u0437\u043d\u0430\u0447\u0435\u043d",
    "\u043a\u0440\u0438\u0442\u0435\u0440",
    "\u043f\u0440\u0438\u0437\u043d\u0430\u043a",
    "\u043a\u0430\u0442\u0435\u0433\u043e\u0440",
    "\u044d\u0444\u0444\u0435\u043a\u0442",
  ]
    .map((item) => normalizeForSearch(item))
    .filter((cue) => containsNormalizedPhrase(normalized, cue)).length;
  return columnCueCount >= 2 && cells.every((cell) => coordinateCellText(cell).length <= 70);
}

function coordinateSplitGroupCells(cells, valueX) {
  const labelCells = [];
  const valueCells = [];
  for (const cell of cells) {
    const x = cell.x ?? 0;
    const center = (x + (cell.endX ?? x)) / 2;
    if (center < valueX - 28) labelCells.push(cell);
    else valueCells.push(cell);
  }
  return { labelCells, valueCells };
}

function coordinateAppendGroupText(parts, cells) {
  for (const cell of cells) {
    const text = coordinateCellText(cell);
    if (text) parts.push(text);
  }
}

function coordinateTableGroups(page) {
  if (page.__coordinateTableGroups) return page.__coordinateTableGroups;
  const lines = page.lineItems ?? [];
  const groups = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const cells = coordinateGroupLineCells(line).map((cell) => ({ ...cell }));
    if (!coordinateGroupLineLooksLikeStart(cells)) continue;
    if (coordinateGroupHeaderCells(cells)) continue;

    const valueX = cells[cells.length - 1]?.x ?? 0;
    const labelX = cells[0]?.x ?? 0;
    const baseSplit = coordinateSplitGroupCells(cells, valueX);
    if (!baseSplit.labelCells.length || !baseSplit.valueCells.length) continue;

    const labelParts = [];
    const valueParts = [];
    const rowLineTexts = [line.text];
    coordinateAppendGroupText(labelParts, baseSplit.labelCells);
    coordinateAppendGroupText(valueParts, baseSplit.valueCells);

    let previousY = line?.y ?? 0;
    for (let nextIndex = index + 1; nextIndex < lines.length && nextIndex <= index + 9; nextIndex += 1) {
      const nextLine = lines[nextIndex];
      const y = nextLine?.y ?? previousY;
      if (Math.abs(y - previousY) > 28) break;
      if (coordinateLooksLikeTableBoundary(nextLine)) break;
      const nextCells = coordinateGroupLineCells(nextLine).map((cell) => ({ ...cell }));
      if (!nextCells.length) break;

      const split = coordinateSplitGroupCells(nextCells, valueX);
      const nextLabelText = split.labelCells.map((cell) => cell.text).join(" ").replace(/\s+/g, " ").trim();
      const nextValueText = split.valueCells.map((cell) => cell.text).join(" ").replace(/\s+/g, " ").trim();
      const hasAlignedLabel = split.labelCells.some((cell) => Math.abs((cell.x ?? 0) - labelX) <= 34);
      const hasAlignedValue = split.valueCells.some((cell) => Math.abs((cell.x ?? 0) - valueX) <= 58);
      const looksLikeNewStart = coordinateGroupLineLooksLikeStart(nextCells) && hasAlignedLabel && hasAlignedValue;
      const shouldMergeStart =
        looksLikeNewStart &&
        coordinateLabelContinuationLikely(labelParts.join(" "), nextLabelText, nextValueText);

      if (looksLikeNewStart && !shouldMergeStart) break;
      if (!hasAlignedValue && !hasAlignedLabel) break;
      coordinateAppendGroupText(labelParts, split.labelCells);
      coordinateAppendGroupText(valueParts, split.valueCells);
      rowLineTexts.push(nextLine.text);
      previousY = y;
    }

    const labelText = labelParts.join(" ").replace(/\s+/g, " ").trim();
    const valueText = valueParts.join(" ").replace(/\s+/g, " ").trim();
    const text = `${labelText} ${valueText}`.replace(/\s+/g, " ").trim();
    if (labelText.length < 3 || valueText.length < 3 || text.length < 12) continue;

    groups.push({
      page: page.page,
      index,
      y: line?.y ?? 0,
      headerText: coordinateNearbyTableContext(lines, index),
      labelText,
      valueText,
      text,
      sourceText: rowLineTexts.join(" ").replace(/\s+/g, " ").trim(),
      valueX,
      labelX,
      labelTokens: uniqueTokens(labelText),
      valueTokens: uniqueTokens(valueText),
    });
  }

  Object.defineProperty(page, "__coordinateTableGroups", {
    value: groups,
    enumerable: false,
  });
  return groups;
}

/**
 * Строит группы вида `левая метка -> правые значения` для multi-вопросов, где
 * несколько правильных вариантов перечислены в одной строке или ее продолжениях.
 */
export function buildCoordinateTableGroupsByPage(pages, topQuestionPages) {
  const byPage = new Map();
  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    const groups = coordinateTableGroups(page).filter((group) => coordinateTextHasExplicitTableCaption(group.headerText));
    if (groups.length) byPage.set(page.page, groups);
  }
  return byPage;
}

function coordinateMultiCellHeaderRow(cells) {
  const first = normalizeForSearch(cells[0]?.text ?? "");
  const rest = normalizeForSearch(
    cells
      .slice(1)
      .map((cell) => cell.text)
      .join(" "),
  );
  const firstHeader =
    containsNormalizedPhrase(first, "\u0441\u0442\u0435\u043f\u0435\u043d") ||
    containsNormalizedPhrase(first, "\u0441\u0442\u0430\u0434") ||
    containsNormalizedPhrase(first, "\u043a\u043b\u0430\u0441\u0441") ||
    containsNormalizedPhrase(first, "\u043a\u0430\u0442\u0435\u0433\u043e\u0440") ||
    containsNormalizedPhrase(first, "\u0433\u0440\u0443\u043f\u043f");
  const restHeader =
    containsNormalizedPhrase(rest, "\u043a\u043b\u0438\u043d\u0438\u0447") ||
    containsNormalizedPhrase(rest, "\u043f\u0440\u0438\u0437\u043d\u0430\u043a") ||
    containsNormalizedPhrase(rest, "\u043e\u0431\u044a\u0435\u043c") ||
    containsNormalizedPhrase(rest, "\u0437\u043d\u0430\u0447\u0435\u043d") ||
    containsNormalizedPhrase(rest, "\u043f\u043e\u043a\u0430\u0437");
  return firstHeader && restHeader;
}

function coordinateMultiCellGenericLabel(text) {
  const normalized = normalizeForSearch(text);
  return [
    "\u044d\u0444\u0444\u0435\u043a\u0442",
    "\u0433\u0440\u0443\u043f\u043f\u0430",
    "\u043f\u0440\u0438\u0437\u043d\u0430\u043a",
    "\u043f\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u044c",
    "\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435",
    "\u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442\u044b",
    "\u0441\u043f\u043e\u0441\u043e\u0431",
  ].some((cue) => containsNormalizedPhrase(normalized, cue));
}

function coordinateMultiCellGenericValue(text) {
  const normalized = normalizeForSearch(text);
  return [
    "\u0433\u0440\u0443\u043f\u043f\u0430",
    "\u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442\u044b",
    "\u0441\u043f\u043e\u0441\u043e\u0431 \u043f\u0440\u0438\u043c\u0435\u043d\u0435\u043d\u0438\u044f",
  ].some((cue) => containsNormalizedPhrase(normalized, cue));
}

function coordinateMultiCellRows(page) {
  if (page.__coordinateMultiCellRows) return page.__coordinateMultiCellRows;
  const lines = page.lineItems ?? [];
  const rows = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const cells = coordinateGroupLineCells(line).map((cell) => ({ ...cell }));
    if (!coordinateGroupLineLooksLikeStart(cells)) continue;
    if (coordinateGroupHeaderCells(cells) || coordinateMultiCellHeaderRow(cells)) continue;
    const headerText = coordinateNearbyTableContext(lines, index);
    if (!coordinateTextHasExplicitTableCaption(headerText)) continue;

    const labelCell = cells[0];
    const labelText = coordinateCellText(labelCell);
    if (labelText.length < 3 || labelText.length > 90) continue;
    if (coordinateMultiCellGenericLabel(labelText) && coordinateMultiCellGenericValue(cells.slice(1).map((cell) => cell.text).join(" "))) continue;

    const labelX = labelCell.x ?? 0;
    const valueParts = cells.slice(1).map((cell) => coordinateCellText(cell)).filter(Boolean);
    if (!valueParts.length) continue;
    const rowLineTexts = [line.text];

    let previousY = line?.y ?? 0;
    for (let nextIndex = index + 1; nextIndex < lines.length && nextIndex <= index + 12; nextIndex += 1) {
      const nextLine = lines[nextIndex];
      const y = nextLine?.y ?? previousY;
      if (Math.abs(y - previousY) > 28) break;
      if (coordinateLooksLikeTableBoundary(nextLine)) break;
      const nextCells = coordinateGroupLineCells(nextLine).map((cell) => ({ ...cell }));
      if (!nextCells.length) break;
      const nextStartsRow =
        coordinateGroupLineLooksLikeStart(nextCells) &&
        Math.abs((nextCells[0]?.x ?? 0) - labelX) <= 36 &&
        coordinateCellText(nextCells[0]).length >= 3;
      if (nextStartsRow) break;

      const continuation = nextCells
        .filter((cell) => (cell.x ?? 0) > labelX + 48)
        .map((cell) => coordinateCellText(cell))
        .filter(Boolean);
      if (!continuation.length) break;
      valueParts.push(...continuation);
      rowLineTexts.push(nextLine.text);
      previousY = y;
    }

    const valueText = valueParts.join(" ").replace(/\s+/g, " ").trim();
    const text = `${labelText} ${valueText}`.replace(/\s+/g, " ").trim();
    if (valueText.length < 8 || text.length < 14) continue;
    rows.push({
      page: page.page,
      index,
      y: line?.y ?? 0,
      headerText,
      labelText,
      valueText,
      text,
      sourceText: rowLineTexts.join(" ").replace(/\s+/g, " ").trim(),
      labelX,
      labelTokens: uniqueTokens(labelText),
      valueTokens: uniqueTokens(valueText),
    });
  }

  Object.defineProperty(page, "__coordinateMultiCellRows", {
    value: rows,
    enumerable: false,
  });
  return rows;
}

/**
 * Строит multi-cell rows для таблиц, где одна строка содержит несколько
 * самостоятельных значений/кандидатов, связанных общей меткой и заголовком.
 */
export function buildCoordinateMultiCellRowsByPage(pages, topQuestionPages) {
  const byPage = new Map();
  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    const rows = coordinateMultiCellRows(page);
    if (rows.length) byPage.set(page.page, rows);
  }
  return byPage;
}

function coordinateTableFocusTokens(question, focusTokens, answerTokens) {
  const answerSet = new Set(answerTokens ?? []);
  const out = [];
  for (const token of [...(focusTokens ?? []), ...uniqueTokens(question)]) {
    if (!token || token.length < 3) continue;
    if (FOCUS_STOPWORDS.has(token) || COORDINATE_TABLE_GENERIC_TOKENS.has(token)) continue;
    if (answerSet.has(token) && !/^\d/u.test(token)) continue;
    if (!out.includes(token)) out.push(token);
  }
  return out.slice(0, 12);
}

function coordinateCompoundFocusMatches(tableFocus, labelTokens) {
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

function coordinateRouteSynonymSupport(answerText, cellText) {
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

function severityCue(text) {
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

function coordinateDirectionCuesAroundNumber(normalizedText, number) {
  const forms = [...new Set(expandNumberToken(number).map((item) => normalizeForSearch(item)).filter(Boolean))];
  const directions = new Set();
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

function coordinateNumericDirectionCompatible(cellText, answerText, answerNumbers) {
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

function coordinateCellAnswerSupport(cell, answer, answerTokens, answerPhrases, answerNumbers) {
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

function coordinateRowContrastBonus(row, bestCell, tableFocus, bestCellSupport, wholeRowAnswerMatch) {
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
}) {
  if (!coordinateTableRowsByPage) return null;
  if (mode !== "single") return null;
  if (coordinateTableQuestionBlocked(question)) return null;
  const answerNumbers = extractNumbers(answer.text);

  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 12);
  const tableFocus = coordinateTableFocusTokens(question, focusTokens, answerTokens);
  if (!tableFocus.length && !answerNumbers.length) return null;
  const questionSeverity = severityCue(question);
  let best = null;

  for (const rows of coordinateTableRowsByPage.values()) {
    for (const row of rows) {
      if (!row.cells?.length) continue;
      if (!coordinateRowHasTableContext(row)) continue;
      if (questionSeverity && coordinateSeverityCueCount(row.text) > 1) continue;
      let bestCell = null;
      let bestCellSupport = null;
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

/**
 * Оценивает multi-answer поддержку из явной табличной группы и допускает
 * обратное связывание `value -> label`, когда значение находится в вопросе.
 */
export function bestCoordinateTableGroupSupport({
  mode,
  question,
  answer,
  answerTokens,
  focusTokens,
  coordinateTableGroupsByPage,
}) {
  if (mode !== "multi") return null;
  if (!coordinateTableGroupsByPage) return null;
  const answerNumbers = extractNumbers(answer.text);
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 12);
  const tableFocus = coordinateTableFocusTokens(question, focusTokens, answerTokens);
  if (tableFocus.length < 2 && !answerNumbers.length) return null;
  let best = null;

  for (const groups of coordinateTableGroupsByPage.values()) {
    for (const group of groups) {
      const answerSupport = coordinateCellAnswerSupport(
        { text: group.valueText, index: 1 },
        answer,
        answerTokens,
        answerPhrases,
        answerNumbers,
      );
      const synonymSupport = coordinateRouteSynonymSupport(answer.text, `${group.valueText} ${group.headerText}`);
      const effectiveAnswerSupport = Math.max(answerSupport.support, synonymSupport);
      const minAnswerSupport = answerNumbers.length ? 0.5 : 0.58;
      const lexicalAnswerSupport = answerTokens.length ? strictSoftCoverage(answerTokens, answerSupport.tokens) : 0;
      if (effectiveAnswerSupport >= minAnswerSupport && (answerSupport.phraseHit || synonymSupport > 0 || lexicalAnswerSupport >= 0.42)) {
        const labelCoverage = tableFocus.length ? coverage(tableFocus, group.labelTokens) : 0;
        const labelHits = tokenHitCount(tableFocus, group.labelTokens);
        const headerCoverage = tableFocus.length ? coverage(tableFocus, uniqueTokens(group.headerText)) : 0;
        const hasSpecificLabel = labelCoverage >= 0.22 || labelHits >= Math.min(3, Math.max(2, Math.ceil(tableFocus.length * 0.25)));
        if ((hasSpecificLabel || headerCoverage >= 0.42) && coordinateCompoundFocusMatches(tableFocus, group.labelTokens)) {
          const score =
            14.6 +
            Math.min(1, effectiveAnswerSupport) * 8.6 +
            Math.min(0.78, labelCoverage) * 8.2 +
            Math.min(4, labelHits) * 1.45 +
            Math.min(0.5, headerCoverage) * 2.0 +
            (answerSupport.phraseHit ? 1.4 : 0) +
            synonymSupport * 1.4 +
            lexicalAnswerSupport * 2.0 +
            answerSupport.numericCoverage * 2.2;
          best = betterEvidence(best, {
            answerId: answer.id,
            page: group.page,
            text: `${group.headerText} | ${group.labelText} -> ${group.valueText}`.replace(/\s+/g, " ").trim(),
            score,
            kind: "coordinate_table_group",
          });
        }
      }

      const inverseFocusCoverage = tableFocus.length ? coverage(tableFocus, group.valueTokens) : 0;
      const inverseFocusHits = tokenHitCount(tableFocus, group.valueTokens);
      const inverseHeaderCoverage = tableFocus.length ? coverage(tableFocus, uniqueTokens(group.headerText)) : 0;
      const inverseFocusSupported =
        inverseFocusCoverage >= 0.28 ||
        inverseFocusHits >= Math.min(3, Math.max(2, Math.ceil(tableFocus.length * 0.25))) ||
        (inverseHeaderCoverage >= 0.42 && inverseFocusHits >= 1);
      if (!inverseFocusSupported) continue;

      const inverseAnswerSupport = coordinateCellAnswerSupport(
        { text: group.labelText, index: 0 },
        answer,
        answerTokens,
        answerPhrases,
        answerNumbers,
      );
      const inverseSynonymSupport = coordinateRouteSynonymSupport(answer.text, `${group.labelText} ${group.headerText}`);
      const inverseEffectiveAnswerSupport = Math.max(inverseAnswerSupport.support, inverseSynonymSupport);
      const inverseMinAnswerSupport = answerNumbers.length ? 0.5 : 0.58;
      if (inverseEffectiveAnswerSupport < inverseMinAnswerSupport) continue;
      const inverseLexicalAnswerSupport = answerTokens.length ? strictSoftCoverage(answerTokens, inverseAnswerSupport.tokens) : 0;
      if (!inverseAnswerSupport.phraseHit && inverseSynonymSupport <= 0 && inverseLexicalAnswerSupport < 0.42) continue;

      const inverseScore =
        14.4 +
        Math.min(1, inverseEffectiveAnswerSupport) * 8.2 +
        Math.min(0.78, inverseFocusCoverage) * 8.0 +
        Math.min(4, inverseFocusHits) * 1.35 +
        Math.min(0.5, inverseHeaderCoverage) * 1.6 +
        (inverseAnswerSupport.phraseHit ? 1.2 : 0) +
        inverseSynonymSupport * 1.2 +
        inverseLexicalAnswerSupport * 1.8 +
        inverseAnswerSupport.numericCoverage * 2.0;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: group.page,
        text: `${group.headerText} | ${group.valueText} <- ${group.labelText}`.replace(/\s+/g, " ").trim(),
        score: inverseScore,
        kind: "coordinate_table_group_inverse",
      });
    }
  }

  return best;
}

/**
 * Оценивает multi-cell row, где правильный ответ может находиться в любой
 * ячейке строки, но строка должна быть привязана к фокусу вопроса и заголовку.
 */
export function bestCoordinateMultiCellRowSupport({
  mode,
  question,
  answer,
  answerTokens,
  focusTokens,
  coordinateMultiCellRowsByPage,
}) {
  if (mode !== "multi") return null;
  if (!coordinateMultiCellRowsByPage) return null;
  const answerNumbers = extractNumbers(answer.text);
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 12);
  const tableFocus = coordinateTableFocusTokens(question, focusTokens, answerTokens);
  if (tableFocus.length < 1 && !answerNumbers.length) return null;
  const questionSeverity = severityCue(question);
  let best = null;

  for (const rows of coordinateMultiCellRowsByPage.values()) {
    for (const row of rows) {
      const rowSeverity = severityCue(row.labelText);
      if (questionSeverity && rowSeverity !== questionSeverity) continue;
      const labelCoverage = tableFocus.length ? coverage(tableFocus, row.labelTokens) : 0;
      const labelHits = tokenHitCount(tableFocus, row.labelTokens);
      const headerCoverage = tableFocus.length ? coverage(tableFocus, uniqueTokens(row.headerText)) : 0;
      const labelSupported = questionSeverity || labelCoverage >= 0.18 || labelHits >= 1;
      if (!labelSupported && headerCoverage < 0.38) continue;

      const answerSupport = coordinateCellAnswerSupport(
        { text: row.valueText, index: 1 },
        answer,
        answerTokens,
        answerPhrases,
        answerNumbers,
      );
      if (!coordinateNumericDirectionCompatible(row.valueText, answer.text, answerNumbers)) continue;
      const synonymSupport = coordinateRouteSynonymSupport(answer.text, `${row.valueText} ${row.headerText}`);
      const effectiveAnswerSupport = Math.max(answerSupport.support, synonymSupport);
      const answerTokenHits = tokenHitCount(answerTokens, answerSupport.tokens);
      const longListSupport = answerTokens.length >= 6 && answerTokenHits >= 4 && answerSupport.support >= 0.52;
      const minAnswerSupport = longListSupport ? 0.52 : answerNumbers.length ? 0.5 : 0.58;
      if (effectiveAnswerSupport < minAnswerSupport) continue;
      const lexicalAnswerSupport = answerTokens.length ? strictSoftCoverage(answerTokens, answerSupport.tokens) : 0;
      const minLexicalSupport = longListSupport ? 0.5 : 0.38;
      if (!answerSupport.phraseHit && synonymSupport <= 0 && lexicalAnswerSupport < minLexicalSupport) continue;

      const score =
        14.2 +
        Math.min(1, effectiveAnswerSupport) * 8.3 +
        Math.min(0.75, labelCoverage) * 7.4 +
        Math.min(3, labelHits) * 1.4 +
        (questionSeverity ? 2.2 : 0) +
        Math.min(0.5, headerCoverage) * 2.0 +
        (answerSupport.phraseHit ? 1.4 : 0) +
        synonymSupport * 1.3 +
        lexicalAnswerSupport * 1.8 +
        answerSupport.numericCoverage * 2.0 +
        (longListSupport ? 1.2 : 0);
      best = betterEvidence(best, {
        answerId: answer.id,
        page: row.page,
        text: `${row.headerText} | ${row.labelText} -> ${row.valueText}`.replace(/\s+/g, " ").trim(),
        score,
        kind: "coordinate_table_multicell_row",
      });
    }
  }

  return best;
}
