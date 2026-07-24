import { coverage, extractNumbers, normalizeForSearch, tokenize, uniqueTokens } from "../../../normalize.js";
import { FOCUS_STOPWORDS } from "../../constants.js";
import type { EvidenceItem } from "../../types.js";
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
} from "../../text-utils.js";
import { cyrillicOcrCoverage } from "../ocr-fuzzy/index.js";
import type {
  CoordinateCell,
  CoordinateEvidence,
  CoordinateMultiCellRow,
  CoordinateMultiCellRowsByPage,
  CoordinateMultiCellRowSupportInput,
  CoordinatePdfPage,
  CoordinateTableGroup,
  CoordinateTableGroupsByPage,
  CoordinateTableGroupSupportInput,
  CoordinateTextLine,
} from "./types.js";
import {
  coordinateCellAnswerSupport,
  coordinateCellText,
  coordinateCellsSpread,
  coordinateCompoundFocusMatches,
  coordinateGroupLineCells,
  coordinateNearbyTableContext,
  coordinateNumericDirectionCompatible,
  coordinateRouteSynonymSupport,
  coordinateTableFocusTokens,
  coordinateTextHasExplicitTableCaption,
  severityCue,
} from "./shared.js";

function coordinateGroupLineLooksLikeStart(
  cells: CoordinateCell[],
): boolean {
  if (cells.length < 2) return false;
  const spread = coordinateCellsSpread(cells);
  if (spread < 115) return false;
  const firstX = cells[0]?.x ?? 0;
  const lastX = cells[cells.length - 1]?.x ?? firstX;
  return lastX - firstX >= 85;
}

function coordinateLooksLikeTableBoundary(
  line: CoordinateTextLine | null | undefined,
): boolean {
  const text = String(line?.text ?? "").replace(/\s+/g, " ").trim();
  if (!text) return true;
  const normalized = normalizeForSearch(text);
  if (containsNormalizedPhrase(normalized, "\u0442\u0430\u0431\u043b\u0438\u0446") && !/^\s*\u0442\u0430\u0431\u043b\u0438\u0446/u.test(text.toLowerCase())) return false;
  if (/^\s*(?:\d+\.){1,3}\s+/u.test(text)) return true;
  if (text.length <= 90 && /^(?:\u0440\u0438\u0441\u0443\u043d\u043e\u043a|\u0441\u043f\u0438\u0441\u043e\u043a|\u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435)\b/iu.test(text)) return true;
  return false;
}

function coordinateShortCodeLike(text: string): boolean {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!value) return false;
  if (value.length > 44) return false;
  if (/[a-z\u0430-\u044f]{3,}/u.test(value)) return false;
  if (/[()]/u.test(value) && /[A-Z\u0410-\u042f0-9]{2,}/u.test(value)) return true;
  if (/\*\*/u.test(value)) return true;
  return /^[A-Z\u0410-\u042f0-9./+-]{2,}(?:\s+[A-Z\u0410-\u042f0-9./+-]{2,}){0,2}$/u.test(value);
}

function coordinateLabelContinuationLikely(
  labelText: string,
  nextLabelText: string,
  nextValueText: string,
): boolean {
  const labelTokens = uniqueTokens(labelText);
  const nextTokens = uniqueTokens(nextLabelText);
  if (!labelTokens.length || !nextTokens.length) return false;
  if (coordinateShortCodeLike(nextValueText)) return true;
  if (String(labelText ?? "").length <= 48 && /[()/]/u.test(String(nextLabelText ?? ""))) return true;
  return false;
}

function coordinateGroupHeaderCells(cells: CoordinateCell[]): boolean {
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

function coordinateSplitGroupCells(
  cells: CoordinateCell[],
  valueX: number,
): {
  labelCells: CoordinateCell[];
  valueCells: CoordinateCell[];
} {
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

function coordinateAppendGroupText(
  parts: string[],
  cells: CoordinateCell[],
): void {
  for (const cell of cells) {
    const text = coordinateCellText(cell);
    if (text) parts.push(text);
  }
}

function coordinateTableGroups(
  page: CoordinatePdfPage,
): CoordinateTableGroup[] {
  if (page.__coordinateTableGroups) return page.__coordinateTableGroups;
  const lines = page.lineItems ?? [];
  const groups: CoordinateTableGroup[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const cells = coordinateGroupLineCells(line).map((cell) => ({ ...cell }));
    if (!coordinateGroupLineLooksLikeStart(cells)) continue;
    if (coordinateGroupHeaderCells(cells)) continue;

    const valueX = cells[cells.length - 1]?.x ?? 0;
    const labelX = cells[0]?.x ?? 0;
    const baseSplit = coordinateSplitGroupCells(cells, valueX);
    if (!baseSplit.labelCells.length || !baseSplit.valueCells.length) continue;

    const labelParts: string[] = [];
    const valueParts: string[] = [];
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
export function buildCoordinateTableGroupsByPage(
  pages: CoordinatePdfPage[],
  topQuestionPages?: Set<number>,
): CoordinateTableGroupsByPage {
  const byPage: CoordinateTableGroupsByPage = new Map();
  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    const groups = coordinateTableGroups(page).filter((group) => coordinateTextHasExplicitTableCaption(group.headerText));
    if (groups.length) byPage.set(page.page, groups);
  }
  return byPage;
}

function coordinateMultiCellHeaderRow(cells: CoordinateCell[]): boolean {
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

function coordinateMultiCellGenericLabel(text: string): boolean {
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

function coordinateMultiCellGenericValue(text: string): boolean {
  const normalized = normalizeForSearch(text);
  return [
    "\u0433\u0440\u0443\u043f\u043f\u0430",
    "\u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442\u044b",
    "\u0441\u043f\u043e\u0441\u043e\u0431 \u043f\u0440\u0438\u043c\u0435\u043d\u0435\u043d\u0438\u044f",
  ].some((cue) => containsNormalizedPhrase(normalized, cue));
}

function coordinateMultiCellRows(
  page: CoordinatePdfPage,
): CoordinateMultiCellRow[] {
  if (page.__coordinateMultiCellRows) return page.__coordinateMultiCellRows;
  const lines = page.lineItems ?? [];
  const rows: CoordinateMultiCellRow[] = [];

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
export function buildCoordinateMultiCellRowsByPage(
  pages: CoordinatePdfPage[],
  topQuestionPages?: Set<number>,
): CoordinateMultiCellRowsByPage {
  const byPage: CoordinateMultiCellRowsByPage = new Map();
  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    const rows = coordinateMultiCellRows(page);
    if (rows.length) byPage.set(page.page, rows);
  }
  return byPage;
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
}: CoordinateTableGroupSupportInput): CoordinateEvidence {
  if (mode !== "multi") return null;
  if (!coordinateTableGroupsByPage) return null;
  const answerNumbers = extractNumbers(answer.text);
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 12);
  const tableFocus = coordinateTableFocusTokens(question, focusTokens, answerTokens);
  if (tableFocus.length < 2 && !answerNumbers.length) return null;
  let best: EvidenceItem | null = null;

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
}: CoordinateMultiCellRowSupportInput): CoordinateEvidence {
  if (mode !== "multi") return null;
  if (!coordinateMultiCellRowsByPage) return null;
  const answerNumbers = extractNumbers(answer.text);
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 12);
  const tableFocus = coordinateTableFocusTokens(question, focusTokens, answerTokens);
  if (tableFocus.length < 1 && !answerNumbers.length) return null;
  const questionSeverity = severityCue(question);
  let best: EvidenceItem | null = null;

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
