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
  CoordinatePdfPage,
  CoordinateRelationalRow,
  CoordinateRelationalRowsByPage,
  CoordinateRelationalRowSupportInput,
  CoordinateTextLine,
} from "./types.js";
import {
  COORDINATE_RELATIONAL_GENERIC_TOKENS,
  COORDINATE_TABLE_GENERIC_TOKENS,
  coordinateCellAnswerSupport,
  coordinateCellText,
  coordinateCellsSpread,
  coordinateGroupLineCells,
  coordinateNearbyTableContext,
  coordinateTableFocusTokens,
  hasCoordinateComparisonTableCue,
} from "./shared.js";

type CoordinateXValue = {
  x: number;
  line: number;
};

type CoordinateXCluster = {
  x: number;
  count: number;
  lines: Set<number>;
};

type CoordinateRelationalBand = {
  index: number;
  lastIndex: number;
  y: number;
  lastY: number;
  parts: string[][];
  source: string[];
};

type CoordinateInlineAlias = {
  page: number;
  abbr: string;
  key: string;
  expansion: string;
};

function clusterCoordinateXs(
  values: CoordinateXValue[],
  tolerance = 18,
): CoordinateXCluster[] {
  const clusters: CoordinateXCluster[] = [];
  for (const value of [...values].sort((left, right) => left.x - right.x)) {
    const cluster = clusters.find((item) => Math.abs(item.x - value.x) <= tolerance);
    if (!cluster) {
      clusters.push({ x: value.x, count: 1, lines: new Set([value.line]) });
      continue;
    }
    cluster.x = (cluster.x * cluster.count + value.x) / (cluster.count + 1);
    cluster.count += 1;
    cluster.lines.add(value.line);
  }
  return clusters;
}

function coordinateRelationalAnchors(lines: CoordinateTextLine[]): number[] {
  const candidates: Array<{ index: number; cells: CoordinateCell[] }> = [];
  const xValues: CoordinateXValue[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const cells = coordinateGroupLineCells(lines[index]);
    for (const cell of cells) xValues.push({ x: cell.x ?? 0, line: index });
    if (cells.length < 2 || coordinateCellsSpread(cells) < 105) continue;
    candidates.push({ index, cells });
  }
  if (candidates.length < 2) return [];

  const clustered = clusterCoordinateXs(xValues)
    .filter((cluster) => cluster.lines.size >= 3)
    .sort((left, right) => right.lines.size - left.lines.size || left.x - right.x);
  const strongest: CoordinateXCluster[] = [];
  for (const cluster of clustered) {
    if (strongest.some((item) => Math.abs(item.x - cluster.x) < 70)) continue;
    strongest.push(cluster);
    if (strongest.length >= 3) break;
  }
  const anchors = strongest.map((cluster) => cluster.x).sort((left, right) => left - right);
  if (anchors.length < 2 || anchors[anchors.length - 1] - anchors[0] < 100) return [];
  const alignedCandidateCount = candidates.filter((candidate) => {
    const mapped = new Set(
      candidate.cells
        .map((cell) => nearestCoordinateAnchorIndex(anchors, cell.x ?? 0))
        .filter((index) => index >= 0),
    );
    return mapped.size >= 2;
  }).length;
  return alignedCandidateCount >= 2 ? anchors : [];
}

function nearestCoordinateAnchorIndex(anchors: number[], x: number): number {
  let bestIndex = -1;
  let bestDistance = Infinity;
  for (let index = 0; index < anchors.length; index += 1) {
    const distance = Math.abs(anchors[index] - x);
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  }
  return bestDistance <= 48 ? bestIndex : -1;
}

function coordinateRelationalColumnIndex(anchors: number[], x: number): number {
  if (!anchors.length || x < anchors[0] - 28) return -1;
  for (let index = 0; index < anchors.length - 1; index += 1) {
    const midpoint = (anchors[index] + anchors[index + 1]) / 2;
    if (x < midpoint) return index;
  }
  return anchors.length - 1;
}

function coordinateRelationalHeader(cells: CoordinateCell[]): boolean {
  const raw = cells
    .map((cell) => cell.text)
    .join(" ")
    .toLowerCase();
  const cues = [
    "заболевание",
    "эндокринопат",
    "механизм",
    "показател",
    "отклонен",
    "симптом",
    "поврежден",
    "дзст",
    "параметр",
  ];
  const first = normalizeForSearch(cells[0]?.text ?? "");
  const explicitFirstColumn = ["параметр", "заболеван", "эндокринопат", "дзст"].some((cue) =>
    containsNormalizedPhrase(first, cue),
  );
  return explicitFirstColumn || cues.filter((cue) => raw.includes(cue)).length >= 2;
}

function coordinateRelationalRows(
  page: CoordinatePdfPage,
): CoordinateRelationalRow[] {
  if (page.__coordinateRelationalRows) return page.__coordinateRelationalRows;
  const lines = page.lineItems ?? [];
  const anchors = coordinateRelationalAnchors(lines);
  if (anchors.length < 2) return [];

  const bands: CoordinateRelationalRow[] = [];
  const headers: CoordinateRelationalRow[] = [];
  let band: CoordinateRelationalBand | null = null;
  const flushBand = () => {
    if (!band) return;
    const cells = band.parts.map((parts, index) => ({
      index,
      x: anchors[index],
      text: parts.join(" ").replace(/\s+/g, " ").trim(),
    }));
    const populated = cells.filter((cell) => cell.text);
    if (populated.length >= 2) {
      const row = {
        page: page.page,
        index: band.index,
        endIndex: band.lastIndex,
        y: band.y,
        anchors,
        cells: populated.map((cell) => ({
          ...cell,
          normalized: normalizeForSearch(cell.text),
          tokens: tokenize(cell.text),
        })),
        text: populated
          .map((cell) => cell.text)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
        sourceText: band.source.join(" ").replace(/\s+/g, " ").trim(),
        headerText: coordinateNearbyTableContext(lines, band.index),
      };
      if (coordinateRelationalHeader(populated)) headers.push(row);
      else bands.push(row);
    }
    band = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const cells = coordinateGroupLineCells(line);
    const mapped = cells
      .map((cell) => ({ cell, anchorIndex: coordinateRelationalColumnIndex(anchors, cell.x ?? 0) }))
      .filter((item) => item.anchorIndex >= 0);
    if (!mapped.length) {
      flushBand();
      continue;
    }

    const y = line?.y ?? 0;
    if (band && Math.abs(band.lastY - y) > 23) flushBand();
    if (!band) {
      band = {
        index,
        lastIndex: index,
        y,
        lastY: y,
        parts: anchors.map(() => []),
        source: [],
      };
    }
    for (const { cell, anchorIndex } of mapped) {
      const text = coordinateCellText(cell);
      if (text) band.parts[anchorIndex].push(text);
    }
    band.source.push(String(line?.text ?? ""));
    band.lastY = y;
    band.lastIndex = index;
  }
  flushBand();

  Object.defineProperty(page, "__coordinateRelationalRows", {
    value: bands,
    enumerable: false,
  });
  Object.defineProperty(page, "__coordinateRelationalHeaders", {
    value: headers,
    enumerable: false,
  });
  return bands;
}

function coordinateCodeKey(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function coordinateEditSimilarity(left: string, right: string): number {
  const a = coordinateCodeKey(left);
  const b = coordinateCodeKey(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= b.length; column += 1) {
      const above = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

function coordinateCodeSimilarity(left: string, right: string): number {
  const a = coordinateCodeKey(left);
  const b = coordinateCodeKey(right);
  let best = coordinateEditSimilarity(a, b);
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 3 && longer.length > shorter.length) {
    best = Math.max(best, coordinateEditSimilarity(longer.slice(-shorter.length), shorter));
  }
  return best;
}

function coordinateInlineAliases(
  pages: CoordinatePdfPage[],
): CoordinateInlineAlias[] {
  const aliases: CoordinateInlineAlias[] = [];
  for (const page of pages) {
    for (const line of page.lines ?? []) {
      for (const part of String(line ?? "").split(/\s*;\s*/u)) {
        const match = part.match(
          /^\s*([\p{L}\p{N}□§<>]{2,18}(?:\s*-\s*[\p{L}\p{N}□§<>]{1,12})?)\s*(?:\([^)]{2,140}\))?\s*[—–]\s*(.{4,220})$/u,
        );
        if (!match) continue;
        const key = coordinateCodeKey(match[1]);
        if (key.length < 2 || key.length > 20) continue;
        aliases.push({ page: page.page, abbr: match[1], key, expansion: match[2].trim() });
      }
    }
  }
  return aliases;
}

function coordinateCellAliasText(
  cellText: string,
  pageNumber: number,
  aliases: CoordinateInlineAlias[],
): string {
  const key = coordinateCodeKey(cellText);
  if (key.length < 2 || key.length > 22 || String(cellText ?? "").length > 48) return "";
  const matches = aliases
    .filter((alias) => Math.abs(alias.page - pageNumber) <= 2)
    .map((alias) => ({ alias, similarity: coordinateCodeSimilarity(key, alias.key) }))
    .filter((item) => item.similarity >= (Math.min(key.length, item.alias.key.length) <= 4 ? 0.64 : 0.7))
    .sort((left, right) => right.similarity - left.similarity);
  if (!matches.length) return "";
  if (matches[1] && matches[0].similarity - matches[1].similarity < 0.12) return "";
  return matches[0].alias.expansion;
}

function coordinateRelationalAliasFootnote(
  row: CoordinateRelationalRow,
): boolean {
  const first = String(row?.cells?.[0]?.text ?? "");
  const separators = (first.match(/[—–]/gu) ?? []).length;
  const semicolons = (first.match(/;/gu) ?? []).length;
  return first.length > 120 && (separators >= 2 || semicolons >= 2);
}

function coordinateRelationalTableRegion(
  rows: CoordinateRelationalRow[],
  localHeader: CoordinateRelationalRow | undefined,
): CoordinateRelationalRow[] {
  const ordered = [...rows]
    .filter((row) => !localHeader || row.index > localHeader.index)
    .sort((left, right) => left.index - right.index);
  const kept: CoordinateRelationalRow[] = [];
  let previousEnd: number | null = null;
  for (const row of ordered) {
    if (coordinateRelationalAliasFootnote(row)) break;
    if (previousEnd != null && row.index - previousEnd > 5) break;
    kept.push(row);
    previousEnd = row.endIndex ?? row.index;
  }
  return kept;
}

function coordinateRelationalExplicitHeaderRow(
  row: CoordinateRelationalRow,
): boolean {
  const firstText = String(row?.cells?.[0]?.text ?? "").replace(/\s+/g, " ").trim();
  if (!firstText || firstText.length > 90) return false;
  const first = normalizeForSearch(firstText);
  return ["параметр", "заболеван", "эндокринопат", "дзст"].some((cue) =>
    containsNormalizedPhrase(first, cue),
  );
}

/**
 * Строит строки обычных многоколоночных таблиц по повторяющимся X-якорям.
 * Вертикальные разрывы отделяют соседние строки, поэтому переносы внутри
 * ячейки не смешиваются со следующей сущностью.
 */
export function buildCoordinateRelationalRowsByPage(
  pages: CoordinatePdfPage[],
  topQuestionPages?: Set<number>,
  scanAllExplicitTables = false,
): CoordinateRelationalRowsByPage {
  const byPage: CoordinateRelationalRowsByPage = new Map();
  const aliases = coordinateInlineAliases(pages);
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage && !scanAllExplicitTables) continue;
    const hasNearbyCaption = pages
      .slice(Math.max(0, pageIndex - 2), pageIndex + 1)
      .some((candidate) => (candidate.lines ?? []).some((line) => /^\s*таблица\s+\d/iu.test(String(line ?? ""))));
    if (!hasNearbyCaption) continue;
    const rawRows = coordinateRelationalRows(page).filter((row) => row.text.length <= 650);
    const headerCandidates = pages
      .slice(Math.max(0, pageIndex - 2), pageIndex + 1)
      .flatMap((candidate) => {
        coordinateRelationalRows(candidate);
        return candidate.__coordinateRelationalHeaders ?? [];
      });
    const firstRawIndex = rawRows.length ? Math.min(...rawRows.map((row) => row.index)) : Number.POSITIVE_INFINITY;
    const localCandidates = headerCandidates.filter((candidate) => candidate.page === page.page);
    const localHeader =
      localCandidates.filter(coordinateRelationalExplicitHeaderRow).at(-1) ??
      localCandidates.filter((candidate) => candidate.index < firstRawIndex).at(-1);
    const inheritedHeader = headerCandidates.filter((candidate) => candidate.page < page.page).at(-1);
    const header = localHeader ?? inheritedHeader;
    const rows = coordinateRelationalTableRegion(rawRows, localHeader);
    const enrichedRows = rows.map((row) => ({
      ...row,
      headerText: `${row.headerText ?? ""} ${header?.text ?? ""}`.replace(/\s+/g, " ").trim(),
      columnHeaders: header?.cells ?? [],
      cells: row.cells.map((cell) => ({
        ...cell,
        aliasText: coordinateCellAliasText(cell.text, row.page, aliases),
      })),
    }));
    if (enrichedRows.length >= 2) byPage.set(page.page, enrichedRows);
  }
  return byPage;
}


function coordinateRelationalFocusTokens(
  question: string,
  focusTokens: string[],
  answerTokens: string[],
): string[] {
  return coordinateTableFocusTokens(question, focusTokens, answerTokens).filter(
    (token) => !COORDINATE_RELATIONAL_GENERIC_TOKENS.has(token),
  );
}

function coordinateComparisonTargetTokens(question: string): string[] {
  const raw = String(question ?? "");
  const match = raw.match(/отлич\p{L}*\s+(.+?)\s+от\s+.+?\s+(?:явля\p{L}*|служ\p{L}*|составля\p{L}*)/iu);
  if (!match?.[1]) return [];
  return uniqueTokens(match[1]).filter(
    (token) =>
      token.length >= 3 &&
      !FOCUS_STOPWORDS.has(token) &&
      !COORDINATE_RELATIONAL_GENERIC_TOKENS.has(token) &&
      !COORDINATE_TABLE_GENERIC_TOKENS.has(token),
  );
}

function coordinateComparisonPolarityCompatible(
  question: string,
  valueText: string,
): boolean {
  const normalizedQuestion = normalizeForSearch(question);
  const normalizedValue = normalizeForSearch(valueText);
  const asksAbsence =
    containsNormalizedPhrase(normalizedQuestion, "отсутств") ||
    containsNormalizedPhrase(normalizedQuestion, "не выяв") ||
    containsNormalizedPhrase(normalizedQuestion, "не характер");
  if (!asksAbsence) return true;
  return (
    containsNormalizedPhrase(normalizedValue, "отсутств") ||
    containsNormalizedPhrase(normalizedValue, "не выяв") ||
    containsNormalizedPhrase(normalizedValue, "не характер") ||
    /(?:^|\s)не(?:\s|$)/u.test(normalizedValue)
  );
}

/**
 * Связывает single-answer вариант с другой колонкой той же визуальной строки.
 * Совпадение ответа и фокуса в одной ячейке не считается доказательством.
 */
export function bestCoordinateRelationalRowSupport({
  mode,
  question,
  answer,
  answerTokens,
  focusTokens,
  coordinateRelationalRowsByPage,
}: CoordinateRelationalRowSupportInput): CoordinateEvidence {
  if (mode !== "single" || !coordinateRelationalRowsByPage?.size) return null;
  const tableFocus = coordinateRelationalFocusTokens(question, focusTokens, answerTokens);
  if (!tableFocus.length) return null;
  const answerNumbers = extractNumbers(answer.text);
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 12);
  const comparisonTarget = hasCoordinateComparisonTableCue(question)
    ? coordinateComparisonTargetTokens(question)
    : [];
  let best: EvidenceItem | null = null;

  for (const rows of coordinateRelationalRowsByPage.values()) {
    for (const row of rows) {
      for (const answerCell of row.cells) {
        const expandedAnswerCell = {
          ...answerCell,
          text: `${answerCell.text} ${answerCell.aliasText ?? ""}`.replace(/\s+/g, " ").trim(),
        };
        const answerSupport = coordinateCellAnswerSupport(
          expandedAnswerCell,
          answer,
          answerTokens,
          answerPhrases,
          answerNumbers,
        );
        const ocrSupport = cyrillicOcrCoverage(answer.text, expandedAnswerCell.text);
        answerSupport.support = Math.max(answerSupport.support, ocrSupport.coverage);
        const minimumAnswerSupport = answerNumbers.length ? 0.5 : 0.58;
        if (answerSupport.support < minimumAnswerSupport) continue;
        if (
          !answerSupport.phraseHit &&
          strictSoftCoverage(answerTokens, answerSupport.tokens) < 0.5 &&
          (ocrSupport.fuzzyMatches < 1 || ocrSupport.coverage < 0.74)
        ) {
          continue;
        }

        let bestFocus: {
          cell: CoordinateCell;
          coverage: number;
          hits: number;
        } | null = null;
        for (const focusCell of row.cells) {
          if (focusCell.index === answerCell.index) continue;
          const columnHeader = row.columnHeaders?.find((cell) => cell.index === focusCell.index)?.text ?? "";
          const focusText = `${columnHeader} ${focusCell.text}`.replace(/\s+/g, " ").trim();
          const cellTokens = tokenize(focusText);
          if (comparisonTarget.length) {
            const headerTokens = tokenize(columnHeader);
            const targetHits = tokenHitCount(comparisonTarget, headerTokens);
            const targetCoverage = coverage(comparisonTarget, headerTokens);
            if (targetHits < 2 && targetCoverage < 0.45) continue;
            if (!coordinateComparisonPolarityCompatible(question, focusCell.text)) continue;
          }
          const hits = tokenHitCount(tableFocus, cellTokens);
          const focusCoverage = coverage(tableFocus, cellTokens);
          if (hits < 1 || (hits < 2 && focusCoverage < 0.45)) continue;
          if (!bestFocus || focusCoverage > bestFocus.coverage || (focusCoverage === bestFocus.coverage && hits > bestFocus.hits)) {
            bestFocus = { cell: focusCell, coverage: focusCoverage, hits };
          }
        }
        if (!bestFocus) continue;

        const score =
          15.2 +
          Math.min(1, answerSupport.support) * 8.8 +
          Math.min(0.8, bestFocus.coverage) * 8.4 +
          Math.min(4, bestFocus.hits) * 1.35 +
          (answerSupport.phraseHit ? 1.6 : 0) +
          Math.min(2, ocrSupport.fuzzyMatches) * 0.8 +
          answerSupport.numericCoverage * 2.0 +
          (row.cells.length >= 3 ? 0.8 : 0);
        best = betterEvidence(best, {
          answerId: answer.id,
          page: row.page,
          text: `${row.headerText} | ${row.cells.map((cell) => cell.text).join(" | ")}`.replace(/\s+/g, " ").trim(),
          score,
          kind: "coordinate_relational_row",
        });
      }
    }
  }
  return best;
}
