#!/usr/bin/env node
// Read-only analysis of the bibliography ("Список литературы") section per PDF.
// Goal: see how big it is, where it starts/ends, and whether removing only that
// span is safe (the appendices after it carry clinical content and must stay).
// No predictor calls, no answer-key reads.
import fs from "node:fs/promises";
import path from "node:path";
import { extractPdfText } from "../src/pdf.js";

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

const BIBLIO_HEADING = /^(список\s+литературы|литература|библиографи)/;
const NEXT_SECTION = /^(приложение|критерии оценки качества|связанные документы|алгоритм)/;
// reference-entry shape: starts with a number and has a year or "//" or "с."
const REF_SHAPE = /^\d{1,3}\.?\s+.*(\b(19|20)\d\d\b|\/\/|с\.\s*\d)/;

async function main() {
  const root = process.cwd();
  const testDir = path.join(root, "__test__");
  const groups = (await fs.readdir(testDir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  let totalCorpusChars = 0;
  let totalBiblioChars = 0;
  let totalBiblioLines = 0;
  let pdfsWithBiblio = 0;
  const rows: string[] = [];

  for (const group of groups) {
    const pdfPath = path.join(testDir, group, "doc.pdf");
    let extracted;
    try {
      extracted = await extractPdfText(await fs.readFile(pdfPath), { cacheKey: pdfPath });
    } catch (err) {
      console.error(`skip ${group}: ${(err as Error).message}`);
      continue;
    }
    // flat list of lines with page
    const flat: Array<{ page: number; text: string }> = [];
    for (const p of extracted.pages) for (const l of p.lines) flat.push({ page: p.page, text: l });
    const corpusChars = flat.reduce((s, l) => s + l.text.length, 0);
    totalCorpusChars += corpusChars;

    // candidate heading positions (short standalone "список литературы" lines)
    const headingIdx: number[] = [];
    flat.forEach((l, i) => {
      const n = norm(l.text);
      if (BIBLIO_HEADING.test(n) && n.length <= 30) headingIdx.push(i);
    });
    if (!headingIdx.length) {
      rows.push(`${group}: NO biblio heading found`);
      continue;
    }
    // the real section is the LAST heading (earlier ones are TOC entries)
    const start = headingIdx[headingIdx.length - 1];
    // end = next section heading after start, else end of doc
    let end = flat.length;
    for (let i = start + 1; i < flat.length; i += 1) {
      if (NEXT_SECTION.test(norm(flat[i].text))) {
        end = i;
        break;
      }
    }
    const span = flat.slice(start, end);
    const chars = span.reduce((s, l) => s + l.text.length, 0);
    const refLines = span.filter((l) => REF_SHAPE.test(norm(l.text))).length;
    totalBiblioChars += chars;
    totalBiblioLines += span.length;
    pdfsWithBiblio += 1;
    const endLabel = end < flat.length ? norm(flat[end].text).slice(0, 40) : "<end of doc>";
    rows.push(
      `${group}: heading@p${flat[start].page} (${headingIdx.length} candidates) | span ${span.length} lines, ${chars} chars (${((chars / corpusChars) * 100).toFixed(1)}% of doc), ${refLines} ref-shaped | ends at: "${endLabel}"`,
    );
  }

  console.log("=== bibliography section per PDF ===");
  for (const r of rows) console.log(r);
  console.log("\n=== totals ===");
  console.log(`PDFs with detected biblio: ${pdfsWithBiblio}/${groups.length}`);
  console.log(
    `biblio chars: ${totalBiblioChars} / ${totalCorpusChars} corpus chars = ${((totalBiblioChars / Math.max(1, totalCorpusChars)) * 100).toFixed(1)}%`,
  );
  console.log(`biblio lines total: ${totalBiblioLines}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
