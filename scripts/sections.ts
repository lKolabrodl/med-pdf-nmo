#!/usr/bin/env node
// Read-only structural analysis: segment each PDF into named sections and measure
// their size, to find removable non-answer noise. Runs the current extractor
// (bibliography already removed). No predictor calls, no answer-key reads.
import fs from "node:fs/promises";
import path from "node:path";
import { extractPdfText } from "../src/pdf.js";

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// Section markers. `late` = use the LAST occurrence (real section is near the end;
// earlier ones are table-of-contents entries). `early` = first occurrence (the TOC).
const MARKERS: Array<{ name: string; re: RegExp; pos: "early" | "late"; max?: number }> = [
  { name: "TOC", re: /^(содержание|оглавление)$/, pos: "early", max: 20 },
  { name: "abbrev", re: /^список сокращений/, pos: "late", max: 40 },
  { name: "terms", re: /^термины и определения/, pos: "late", max: 40 },
  { name: "quality", re: /^критерии оценки качества/, pos: "late", max: 60 },
  { name: "prilA1", re: /^приложение\s*а\s*1\b|^приложениеа1/, pos: "late", max: 80 },
  { name: "prilA2", re: /^приложение\s*а\s*2\b/, pos: "late", max: 80 },
  { name: "prilA3", re: /^приложение\s*а\s*3\b/, pos: "late", max: 80 },
  { name: "prilB", re: /^приложение\s*б\b/, pos: "late", max: 60 },
  { name: "prilV", re: /^приложение\s*в\b/, pos: "late", max: 60 },
  { name: "prilG", re: /^приложение\s*г\b/, pos: "late", max: 60 },
];

async function main() {
  const root = process.cwd();
  const testDir = path.join(root, "__test__");
  const groups = (await fs.readdir(testDir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  let totalCorpus = 0;
  const sectionChars: Record<string, number> = {};
  const sectionPdfs: Record<string, number> = {};
  const perPdf: string[] = [];

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
    for (const p of extracted.pages) for (const l of p.lines) flat.push(l);
    const corpus = flat.reduce((s, l) => s + l.length, 0);
    totalCorpus += corpus;

    // find marker positions
    const found: Array<{ name: string; idx: number }> = [];
    for (const m of MARKERS) {
      let idx = -1;
      flat.forEach((l, i) => {
        const n = norm(l);
        if (m.re.test(n) && (!m.max || n.length <= m.max)) {
          if (m.pos === "late") idx = i;
          else if (idx < 0) idx = i;
        }
      });
      if (idx >= 0) found.push({ name: m.name, idx });
    }
    found.sort((a, b) => a.idx - b.idx);

    // measure span of each section to the next marker (chars)
    const labels: string[] = [];
    for (let i = 0; i < found.length; i += 1) {
      const start = found[i].idx;
      const end = i + 1 < found.length ? found[i + 1].idx : flat.length;
      const chars = flat.slice(start, end).reduce((s, l) => s + l.length, 0);
      sectionChars[found[i].name] = (sectionChars[found[i].name] ?? 0) + chars;
      sectionPdfs[found[i].name] = (sectionPdfs[found[i].name] ?? 0) + 1;
      labels.push(`${found[i].name}=${chars}`);
    }
    perPdf.push(`${group}: ${labels.join(" ")}`);
  }

  console.log("=== aggregate section sizes (after bibliography already removed) ===");
  const rows = Object.entries(sectionChars).sort((a, b) => b[1] - a[1]);
  for (const [name, chars] of rows) {
    console.log(`  ${name.padEnd(8)} ${chars.toString().padStart(8)} chars = ${((chars / totalCorpus) * 100).toFixed(1)}% of corpus, in ${sectionPdfs[name]} PDFs`);
  }
  console.log(`  corpus total: ${totalCorpus}`);
  console.log("\n=== per-PDF section sizes (chars) ===");
  for (const r of perPdf) console.log(r);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
