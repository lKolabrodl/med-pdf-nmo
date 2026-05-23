#!/usr/bin/env node
// Read-only: which PDFs still contain a table of contents AFTER current
// extraction (removeTableOfContents already ran)? Shows the surviving TOC
// heading line and counts TOC-entry-like lines, to fix detection. No keys.
import fs from "node:fs/promises";
import path from "node:path";
import { extractPdfText } from "../src/pdf.js";
import { normalizeText } from "../src/normalize.js";

// A TOC entry usually ends with a page number, often after dot leaders:
// "3. Лечение .......... 15" or "Диагностика 12".
const TOC_ENTRY = /[а-я)]\s*\.{2,}\s*\d{1,3}\s*$|[а-я)]\s+\d{1,3}\s*$/i;

async function main() {
  const root = process.cwd();
  const testDir = path.join(root, "__test__");
  const groups = (await fs.readdir(testDir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "en"));

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
    const earlyLimit = Math.max(1, Math.floor(flat.length * 0.25));

    // surviving heading?
    let headingLine = "";
    let headingIdx = -1;
    for (let i = 0; i < earlyLimit; i += 1) {
      const n = normalizeText(flat[i]);
      if (/^(содержание|оглавление)\b/.test(n) || /\bоглавление\b/.test(n)) {
        headingLine = flat[i].slice(0, 70);
        headingIdx = i;
        break;
      }
    }
    // count TOC-entry-like lines in the early region
    const entryCount = flat.slice(0, earlyLimit).filter((l) => TOC_ENTRY.test(l)).length;

    if (headingIdx >= 0 || entryCount >= 5) {
      console.log(`${group}: heading@${headingIdx}="${headingLine}"  toc-entry-lines(early)=${entryCount}  totalLines=${flat.length}`);
    } else {
      console.log(`${group}: (no surviving TOC) entry-lines=${entryCount}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
