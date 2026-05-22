#!/usr/bin/env node
// Read-only analysis of extracted PDF text noise across the whole corpus.
// It runs the real extractor (src/pdf.ts) on every __test__/NN/doc.pdf and reports:
//   - whether the extracted text is clean Cyrillic or mojibake;
//   - repeated header/footer/boilerplate lines (lines that appear on many pages);
//   - whether the current stripLikelyBoilerplate patterns actually match anything.
// No predictor calls, no answer-key reads. Nothing here changes runtime.
import fs from "node:fs/promises";
import path from "node:path";
import { extractPdfText } from "../src/pdf.js";

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// Clean-Cyrillic boilerplate signals (what we'd WANT to strip), tested generically.
const CLEAN_PATTERNS: Array<[string, RegExp]> = [
  ["page_word", /^страниц[аы]\s+\d+\s+из\s+\d+/i],
  ["page_num_only", /^[-–—\s]*\d{1,4}[-–—\s]*$/],
  ["guideline_header", /^клинические рекомендации\s*[-–—]/i],
  ["url", /(https?:\/\/|www\.|\.ru\b|\.com\b|disuria)/i],
  ["god_utver", /^год утверждения|^одобрен|^разработчик|профессиональн.*ассоциац/i],
  ["id_line", /^id\s*[:№]/i],
  // remaining candidates (NOT yet stripped) — measure before deciding:
  ["evidence_grade", /уровень убедительности|уровень достоверности|^удд\s|^уур\s|\bудд\b.*\bуур\b/i],
  ["registry_boiler", /перечн[юе]\s+жнвлп|лекарственного препарата корректно|показаниями к применению и противопоказан/i],
  ["appendix_ref", /^приложение\s+[а-я0-9]|см\.\s+приложение/i],
];

// The mojibake forms hard-coded in the current stripLikelyBoilerplate.
const MOJIBAKE_PATTERNS: Array<[string, RegExp]> = [
  ["moji_page", /^СЃСЂР°РЅРёС†Р°/],
  ["moji_disuria", /disuria\.ru/],
];

async function main() {
  const root = process.cwd();
  const testDir = path.join(root, "__test__");
  const groups = (await fs.readdir(testDir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  let totalLines = 0;
  let totalBoilerplate = 0;
  let cleanPdfs = 0;
  let mojibakePdfs = 0;
  const cleanHits: Record<string, number> = {};
  const mojiHits = { moji_page: 0, moji_disuria: 0 };
  const perPdf: Array<{ group: string; pages: number; lines: number; boiler: number; top: string[] }> = [];
  // line text (short) -> { total occurrences, set of PDFs it appears in }
  const globalLines = new Map<string, { count: number; pdfs: Set<string> }>();

  for (const group of groups) {
    const pdfPath = path.join(testDir, group, "doc.pdf");
    let extracted;
    try {
      const buf = await fs.readFile(pdfPath);
      extracted = await extractPdfText(buf, { cacheKey: pdfPath });
    } catch (err) {
      console.error(`skip ${group}: ${(err as Error).message}`);
      continue;
    }
    const pages = extracted.pages;
    const allText = pages.map((p: any) => p.text).join("\n");
    // cleanliness: real Cyrillic "клиническ" vs mojibake "РєР»РёРЅРёС‡РµСЃРєРё"
    const cleanCyr = /клиническ|рекомендац|пациент/i.test(allText);
    const mojiCyr = /РєР»РёРЅРёС‡/.test(allText) || /Рѕ/.test(allText);
    if (cleanCyr && !mojiCyr) cleanPdfs += 1;
    if (mojiCyr) mojibakePdfs += 1;

    // line frequency across pages
    const lineCount = new Map<string, number>();
    let pdfLines = 0;
    for (const p of pages) {
      for (const raw of p.lines) {
        const n = norm(raw);
        if (!n) continue;
        pdfLines += 1;
        lineCount.set(n, (lineCount.get(n) ?? 0) + 1);
        if (n.length >= 12 && n.length <= 90) {
          const key = n.slice(0, 80);
          const entry = globalLines.get(key) ?? { count: 0, pdfs: new Set<string>() };
          entry.count += 1;
          entry.pdfs.add(group);
          globalLines.set(key, entry);
        }
      }
    }
    // boilerplate = a line repeated on many pages, or matching a clean boilerplate pattern
    const repeatThreshold = Math.max(3, Math.round(pages.length * 0.3));
    let boiler = 0;
    const repeated: Array<[string, number]> = [];
    for (const [line, count] of lineCount) {
      const isRepeated = count >= repeatThreshold && line.length <= 120;
      const isPattern = CLEAN_PATTERNS.some(([, re]) => re.test(line));
      if (isPattern) {
        for (const [name, re] of CLEAN_PATTERNS) if (re.test(line)) cleanHits[name] = (cleanHits[name] ?? 0) + count;
      }
      for (const [name, re] of MOJIBAKE_PATTERNS) if (re.test(line)) (mojiHits as any)[name] += count;
      if (isRepeated || isPattern) {
        boiler += count;
        if (isRepeated) repeated.push([line, count]);
      }
    }
    repeated.sort((a, b) => b[1] - a[1]);
    totalLines += pdfLines;
    totalBoilerplate += boiler;
    perPdf.push({
      group,
      pages: pages.length,
      lines: pdfLines,
      boiler,
      top: repeated.slice(0, 3).map(([l, c]) => `${c}x ${l.slice(0, 70)}`),
    });
  }

  console.log("=== cleanliness ===");
  console.log(`clean-Cyrillic PDFs: ${cleanPdfs} | mojibake PDFs: ${mojibakePdfs} | total: ${perPdf.length}`);
  console.log("\n=== current stripLikelyBoilerplate (mojibake regex) match counts ===");
  console.log(JSON.stringify(mojiHits), "<- if ~0, the current boilerplate stripper never fires");
  console.log("\n=== clean boilerplate pattern hits (what we COULD strip) ===");
  console.log(JSON.stringify(cleanHits, null, 0));
  console.log(`\n=== noise totals ===`);
  console.log(`total lines: ${totalLines} | repeated/boilerplate lines: ${totalBoilerplate} = ${(totalBoilerplate / Math.max(1, totalLines) * 100).toFixed(1)}%`);
  console.log("\n=== cross-PDF repeated lines (appear in many PDFs = generic boilerplate) ===");
  const crossPdf = [...globalLines.entries()]
    .filter(([, v]) => v.pdfs.size >= 4 && v.count >= 10)
    .sort((a, b) => b[1].pdfs.size - a[1].pdfs.size || b[1].count - a[1].count)
    .slice(0, 20);
  for (const [line, v] of crossPdf) {
    console.log(`  ${v.pdfs.size} pdfs, ${v.count}x: ${line}`);
  }

  console.log("\n=== per-PDF top repeated lines ===");
  for (const p of perPdf.sort((a, b) => b.boiler / b.lines - a.boiler / a.lines).slice(0, 14)) {
    console.log(`\n${p.group} (${p.pages}p, ${p.lines} lines, ${(p.boiler / p.lines * 100).toFixed(0)}% repeated):`);
    for (const t of p.top) console.log(`   ${t}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
