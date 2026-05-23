#!/usr/bin/env node
// Read-only diagnostic for the section-priority idea: does the question-intent
// target section actually match the section where the CORRECT answer text lives?
// This is the core assumption behind section routing. Analysis only — it reads
// answer keys like eval does, never feeds them into runtime.
import fs from "node:fs/promises";
import path from "node:path";
import { loadDataset, groupSplit } from "./cases.js";
import { extractPdfText } from "../src/pdf.js";
import { normalizeForSearch, normalizeText } from "../src/normalize.js";

// Mirror of predictor.questionTargetSections (kept in sync manually for analysis).
const SECTION_INTENT_CUES: Array<[string, RegExp]> = [
  ["3", /леч|терап|препарат|доз|назнача|применя|схем|курс|антибиотик|обезбол/],
  ["2", /диагност|обследова|выявл|метод.*исследова|анамнез|осмотр|лаборатор|инструментальн/],
  ["1", /этиолог|патогенез|классификац|фактор.*риск|эпидемиолог|мкб|возбудител|определени/],
  ["5", /профилактик|диспансер|вакцин|скрининг/],
  ["4", /реабилитац|санаторн/],
  ["6", /организац|госпитализац|маршрутизац/],
];
function targetSections(question: string): Set<string> {
  const q = normalizeText(question);
  const out = new Set<string>();
  for (const [id, re] of SECTION_INTENT_CUES) if (re.test(q)) out.add(id);
  return out;
}

// sections (1..7) of pages whose normalized text contains a distinctive phrase of the answer
function answerSections(pages: any[], answerText: string): Set<string> {
  const phrases = normalizeForSearch(answerText)
    .split(/[^a-zа-я0-9]+/iu)
    .filter((w) => w.length >= 5);
  const key = phrases.sort((a, b) => b.length - a.length).slice(0, 3);
  const out = new Set<string>();
  if (!key.length) return out;
  for (const p of pages) {
    if (!p.section || !/^[1-7]$/.test(p.section)) continue;
    const norm = p.normalized as string;
    const hits = key.filter((w) => norm.includes(w)).length;
    if (hits >= Math.min(2, key.length)) out.add(p.section);
  }
  return out;
}

async function main() {
  const root = process.cwd();
  const { groups, cases } = await loadDataset(root);
  const dev = groupSplit(groups).dev;
  const devCases = cases.filter((c: any) => dev.has(c.pdfGroup) && c.expectedIds.length);

  const cache = new Map<string, any>();
  let withTarget = 0;
  let routeHit = 0; // correct answer lives in (one of) the target section(s)
  let routeMiss = 0; // target set, but correct answer NOT in any target section
  let answerInClinical = 0; // correct answer found in any clinical section at all
  const targetDist: Record<string, number> = {};
  const missExamples: string[] = [];

  for (const c of devCases) {
    if (!cache.has(c.pdfPath)) cache.set(c.pdfPath, await extractPdfText(await fs.readFile(c.pdfPath), { cacheKey: c.pdfPath }));
    const pages = cache.get(c.pdfPath).pages;
    const target = targetSections(c.question);
    for (const t of target) targetDist[t] = (targetDist[t] ?? 0) + 1;
    if (!target.size) continue;
    withTarget += 1;
    // union of sections where any expected answer lives
    const ansSecs = new Set<string>();
    for (const text of c.expected) for (const s of answerSections(pages, text)) ansSecs.add(s);
    if (ansSecs.size) answerInClinical += 1;
    const hit = [...ansSecs].some((s) => target.has(s));
    if (hit) routeHit += 1;
    else {
      routeMiss += 1;
      if (missExamples.length < 12) missExamples.push(`${c.id} target=[${[...target]}] answerIn=[${[...ansSecs]}] q="${c.question.slice(0, 60).replace(/\s+/g, " ")}"`);
    }
  }

  console.log(`dev cases with answer key: ${devCases.length}`);
  console.log(`cases where intent picked a target section: ${withTarget}`);
  console.log(`  correct answer found in some clinical section: ${answerInClinical}`);
  console.log(`  ROUTE HIT  (answer in a target section): ${routeHit} = ${(routeHit / Math.max(1, withTarget) * 100).toFixed(1)}%`);
  console.log(`  ROUTE MISS (answer NOT in target section): ${routeMiss} = ${(routeMiss / Math.max(1, withTarget) * 100).toFixed(1)}%`);
  console.log(`target-section distribution: ${JSON.stringify(targetDist)}`);
  console.log(`\nroute-miss examples (intent says one section, answer lives elsewhere):`);
  for (const e of missExamples) console.log(`  ${e}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
