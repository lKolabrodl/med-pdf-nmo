#!/usr/bin/env node
// Read-only: how reliably can we detect the standard NMO top-level clinical
// sections in every PDF? This decides whether section-based chunking + intent
// routing is feasible. Runs the current extractor; no predictor calls, no keys.
import fs from "node:fs/promises";
import path from "node:path";
import { extractPdfText } from "../src/pdf.js";

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// Standard order-103н sections. A heading line starts with the section number
// and contains the key word.
const SECTIONS: Array<{ id: string; re: RegExp }> = [
  { id: "1-краткая", re: /^1[.\s).]*\s*(краткая информация|общая информация|определение и понятия)/ },
  { id: "2-диагностика", re: /^2[.\s).]*\s*диагностика/ },
  { id: "3-лечение", re: /^3[.\s).]*\s*лечение/ },
  { id: "4-реабилитация", re: /^4[.\s).]*\s*(медицинская реабилитац|реабилитац)/ },
  { id: "5-профилактика", re: /^5[.\s).]*\s*профилактика/ },
  { id: "6-организация", re: /^6[.\s).]*\s*организация/ },
  { id: "7-доп", re: /^7[.\s).]*\s*дополнительная информация/ },
];
const PRE = [
  { id: "abbrev", re: /^список сокращений/ },
  { id: "terms", re: /^термины и определения/ },
];

async function main() {
  const root = process.cwd();
  const testDir = path.join(root, "__test__");
  const groups = (await fs.readdir(testDir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  const coverage: Record<string, number> = {};
  const perPdf: string[] = [];
  let allSeven = 0;

  for (const group of groups) {
    const pdfPath = path.join(testDir, group, "doc.pdf");
    let extracted;
    try {
      extracted = await extractPdfText(await fs.readFile(pdfPath), { cacheKey: pdfPath });
    } catch (err) {
      console.error(`skip ${group}: ${(err as Error).message}`);
      continue;
    }
    const flat: string[] = [];
    for (const p of extracted.pages) for (const l of p.lines) flat.push(norm(l));

    const found: Record<string, number> = {};
    for (const sec of [...PRE, ...SECTIONS]) {
      // first occurrence in body (TOC already removed) among short-ish heading lines
      const idx = flat.findIndex((l) => sec.re.test(l) && l.length <= 200);
      if (idx >= 0) {
        found[sec.id] = idx;
        coverage[sec.id] = (coverage[sec.id] ?? 0) + 1;
      }
    }
    const sevenHit = SECTIONS.filter((s) => found[s.id] !== undefined).length;
    if (sevenHit === 7) allSeven += 1;
    // verify monotonic order of the 7 (sanity)
    const order = SECTIONS.map((s) => found[s.id]).filter((v) => v !== undefined) as number[];
    const monotonic = order.every((v, i) => i === 0 || v > order[i - 1]);
    perPdf.push(`${group}: ${sevenHit}/7${monotonic ? "" : " (ORDER!)"}  missing=[${SECTIONS.filter((s) => found[s.id] === undefined).map((s) => s.id).join(",")}]`);
  }

  console.log("=== coverage (how many of 46 PDFs have each section heading) ===");
  for (const sec of [...PRE, ...SECTIONS]) {
    console.log(`  ${sec.id.padEnd(16)} ${coverage[sec.id] ?? 0}/46`);
  }
  console.log(`\nPDFs with all 7 clinical sections: ${allSeven}/46`);
  console.log("\n=== per-PDF ===");
  for (const r of perPdf) console.log(r);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
