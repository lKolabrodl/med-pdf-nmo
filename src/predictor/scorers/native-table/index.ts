import {normalizeForSearch, tokenize, uniqueTokens} from "../../../normalize.js";
import type {PdfPage, PdfStructureNode} from "../../../pdf.js";
import type {AnswerScoringContext} from "../../contracts.js";
import {strictSoftCoverage} from "../../text-utils.js";
import type {AnswerOption, EvidenceItem} from "../../types.js";

type NativeTable = {page: number; rows: PdfStructureNode[][]};
type NativeProof = {answerId: string; page: number; text: string};
const tablesCache = new WeakMap<PdfPage[], NativeTable[]>();
const proofCache = new WeakMap<PdfPage[], Map<string, NativeProof | null>>();

/**
 * Reads native table rows without guessing missing cells or merging nested tables.
 * @param pages Extracted pages with optional PDF structure trees.
 * @returns Consistent rectangular tables whose rows are explicitly tagged.
 * @internal
 */
function nativeTables(pages: PdfPage[]): NativeTable[] {
  const cached = tablesCache.get(pages);
  if (cached) return cached;
  const tables: NativeTable[] = [];
  for (const page of pages) {
    if (!page.text || !page.structure) continue;
    const visit = (node: PdfStructureNode): void => {
      if (node.role === "Table") {
        const rows: PdfStructureNode[][] = [];
        const collect = (child: PdfStructureNode): void => {
          if (child.role === "Table") return;
          if (child.role === "TR") {
            rows.push(child.children.filter((cell) => cell.role === "TD" || cell.role === "TH"));
          } else child.children.forEach(collect);
        };
        node.children.forEach(collect);
        const width = rows[0]?.length ?? 0;
        if (rows.length >= 2 && width >= 2 && width <= 12 && rows.every((row) =>
          row.length === width && row.every((cell) =>
            (cell.colSpan ?? 1) === 1 && (cell.rowSpan ?? 1) === 1 && cell.text.length <= 600))) {
          tables.push({page: page.page, rows});
        }
        return;
      }
      node.children.forEach(visit);
    };
    visit(page.structure);
  }
  tablesCache.set(pages, tables);
  return tables;
}

/**
 * Requires a complete normalized option phrase within one cell, including polarity.
 * @param answer Candidate answer whose exact relation is being checked.
 * @param cell One native table cell, never a concatenation of neighboring cells.
 * @returns Whether the full option occurs with Unicode token boundaries.
 * @internal
 */
function cellContainsAnswer(answer: AnswerOption, cell: PdfStructureNode): boolean {
  const needle = normalizeForSearch(answer?.text ?? "");
  const haystack = normalizeForSearch(cell?.text ?? "");
  if (!needle || !haystack) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}<>])${escaped}(?=$|[^\\p{L}\\p{N}])`, "u").test(haystack);
}

/**
 * Binds a question to one native row and, for wider tables, one explicit column.
 * @param context Current question, answer options, and extracted PDF pages.
 * @returns Unique table-derived answer proof or null for ambiguous ownership.
 */
export function resolveNativeTable(context: AnswerScoringContext): NativeProof | null {
  if (context?.mode !== "single" || context.intent.negative || context.intent.exception) return null;
  const question = context.question ?? "";
  if (/(?:^|\s)(?:не|без|кроме|исключая)(?=\s|$)/iu.test(question)) return null;
  const questionTokens = uniqueTokens(question);
  if (questionTokens.length < 2) return null;
  const proofs: NativeProof[] = [];
  for (const table of nativeTables(context.pages ?? [])) {
    const labels = table.rows.map((row) => uniqueTokens(row[0].text));
    const candidates = labels.map((tokens, index) => ({
      index,
      tokens,
      coverage: strictSoftCoverage(tokens, questionTokens),
    })).filter(({tokens, coverage}) =>
      tokens.length > 0 && tokens.length <= 12 &&
      (tokens.length >= 2 || tokens[0].length >= 5) && coverage >= 0.95);
    const specific = candidates.filter((candidate) => !candidates.some((other) =>
      other.tokens.length > candidate.tokens.length && strictSoftCoverage(candidate.tokens, other.tokens) === 1));
    if (specific.length !== 1) continue;
    const target = specific[0];
    const row = table.rows[target.index];
    let columns = row.length === 2 ? [1] : [];
    if (row.length > 2 && target.index > 0) {
      const remainingQuestion = questionTokens.filter((token) =>
        strictSoftCoverage([token], target.tokens) < 1);
      columns = table.rows[0].flatMap((header, column) => {
        if (column === 0 || !header.text) return [];
        const tokens = uniqueTokens(header.text);
        return tokens.length && strictSoftCoverage(tokens, remainingQuestion) >= 0.95 ? [column] : [];
      });
      if (columns.length !== 1) continue;
    }
    if (!columns.length) continue;
    const matches = context.answers.filter((answer) => columns.some((column) => cellContainsAnswer(answer, row[column])));
    if (matches.length !== 1) continue;
    // A cell can hold a full proposition. Unrequested local negation is a conflict.
    const cellTokens = tokenize(row[columns[0]].text, {keepStopwords: true});
    const answerTokens = tokenize(matches[0].text, {keepStopwords: true});
    const negativeTokens = tokenize("не нет без", {keepStopwords: true});
    if (negativeTokens.some((token) => cellTokens.includes(token) && !answerTokens.includes(token))) continue;
    proofs.push({
      answerId: matches[0].id,
      page: table.page,
      text: [row[0].text, columns.length === 1 && row.length > 2 ? table.rows[0][columns[0]].text : "", ...columns.map((c) => row[c].text)].filter(Boolean).join(" — "),
    });
  }
  if (new Set(proofs.map((proof) => proof.answerId)).size !== 1) return null;
  return proofs[0] ?? null;
}

/**
 * Adds bounded table support once per option while caching the question-level proof.
 * @param context Complete scoring context for the current answer.
 * @returns Small score adjustment with source evidence, or an unchanged score.
 */
export function nativeTableAdjustment(context: AnswerScoringContext): {adjustment: number; evidence: EvidenceItem | null} {
  if (context?.mode !== "single" || !context.pages) return {adjustment: 0, evidence: null};
  let cache = proofCache.get(context.pages);
  if (!cache) {
    cache = new Map();
    proofCache.set(context.pages, cache);
  }
  const key = JSON.stringify([context.question, context.answers]);
  if (!cache.has(key)) cache.set(key, resolveNativeTable(context));
  const proof = cache.get(key);
  if (!proof || proof.answerId !== context.answer.id) return {adjustment: 0, evidence: null};
  return {adjustment: 3.6, evidence: {
    answerId: proof.answerId, page: proof.page, text: proof.text, score: 12, kind: "native_table_cell",
  }};
}
