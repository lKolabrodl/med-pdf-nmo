#!/usr/bin/env node
// Read-only: which PDFs still contain a "Состав рабочей группы" / "рабочая
// группа" section after current extraction (so the А1 removal missed it)?
// Shows the heading line and what follows. No predictor calls, no keys.
import fs from "node:fs/promises";
import path from "node:path";
import { extractPdfText } from "../src/pdf.js";
import { normalizeText } from "../src/normalize.js";

const WG = /состав рабочей групп|рабочая группа|рабочей группы по разработке/;

async function main() {
  const root = process.cwd();
  const testDir = path.join(root, "__test__");
  const groups = (await fs.readdir(testDir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  let survived = 0;
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
    const hitIdx = flat.findIndex((l) => WG.test(normalizeText(l)));
    if (hitIdx < 0) {
      console.log(`${group}: (clean)`);
      continue;
    }
    survived += 1;
    const ctx = flat.slice(hitIdx, hitIdx + 4).map((l) => l.slice(0, 60));
    console.log(`${group}: SURVIVED @${hitIdx}/${flat.length}`);
    for (const c of ctx) console.log(`    | ${c}`);
  }
  console.log(`\nPDFs where working-group text survived: ${survived}/${groups.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
