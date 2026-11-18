import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { extractPdfText } from "../src/pdf.js";
import { createPredictorEngine } from "../src/predictor.js";
import { DEFAULT_CONFIG } from "../src/predictor/config.js";
import { literalTokens } from "../src/predictor/scorers/quoted-continuation/index.js";
import type { AnswerOption } from "../src/predictor/types.js";
import { loadDataset } from "./cases.js";
import { FROZEN_SPLIT_GROUPS } from "./dataset-manifest.js";

// The page strings are tokenized once per PDF. The matcher has no access to
// case IDs, labels, splits, control scores or option positions as evidence.
export function quotedGap(pages: string[], question: string, answers: AnswerOption[]): string | null {
  const sides = question.split(/_{2,}|…+|\.{3,}/u);
  if (sides.length !== 2) return null;
  const left = literalTokens(sides[0]).split(" ").slice(-4);
  const right = literalTokens(sides[1]).split(" ").slice(0, 4);
  if (![left, right].every(side => side.some(token => /[\p{L}\d%]/u.test(token)))) return null;
  if ([...left, ...right].filter(token => /\p{L}/u.test(token)).length < 4) return null;

  const prefix = ` ${left.join(" ")} `;
  const suffix = ` ${right.join(" ")} `;
  let observed: string | undefined;
  for (const page of pages) {
    for (let i = page.indexOf(prefix); i >= 0; i = page.indexOf(prefix, i + 1)) {
      // Start on the separator after the left flank. Inspect at most twelve
      // intervening tokens, without crossing a page or a sentence boundary.
      const start = i + prefix.length - 1;
      let cursor = start;
      for (let count = 0; count <= 12; count++) {
        if (page.startsWith(suffix, cursor)) {
          const filling = page.slice(start + 1, cursor);
          if (!filling || (observed !== undefined && observed !== filling)) return null;
          observed = filling;
          break;
        }
        const next = page.indexOf(" ", cursor + 1);
        if (next < 0 || /^[.!?;]$/u.test(page.slice(cursor + 1, next))) break;
        cursor = next;
      }
    }
  }
  if (!observed) return null;
  const matches = answers.filter(answer => literalTokens(answer.text) === observed);
  return matches.length === 1 ? matches[0].id : null;
}

async function evaluate(split: keyof typeof FROZEN_SPLIT_GROUPS) {
  const { cases, groups } = await loadDataset();
  const wanted = FROZEN_SPLIT_GROUPS[split];
  const missing = wanted.filter(group => !groups.includes(group));
  if (missing.length) throw new Error(`Incomplete ${split} split: ${missing.join(", ")}`);
  const totals = { keyed: 0, hits: 0, changed: 0, fixed: 0, broken: 0 };
  const rows = [];
  const fingerprint = createHash("sha256");
  for (const group of wanted) {
    const items = cases.filter(item => item.pdfGroup === group);
    const data = await readFile(items[0].pdfPath);
    fingerprint.update(group).update("\0").update(createHash("sha256").update(data).digest())
      .update(createHash("sha256").update(await readFile(items[0].caseFile)).digest());
    const document = await extractPdfText(data, DEFAULT_CONFIG);
    const pages = document.pages.map(page => ` ${literalTokens(page.text)} `);
    const engine = createPredictorEngine();
    for (const item of items) {
      if (!item.expectedIds.length) continue;
      totals.keyed++;
      if (item.mode !== "single") continue;
      const proposed = quotedGap(pages, item.question, item.answers);
      if (proposed === null) continue;
      totals.hits++;
      const baseline = await engine.predict({
        pdfData: data, cacheKey: group, question: item.question, answers: item.answers, mode: "single",
      }, { includeSources: false });
      if (baseline.selected.length !== 1) throw new Error("Invalid single-answer control");
      if (baseline.selected[0] === proposed) continue;
      const fixed = item.expectedIds.length === 1 && item.expectedIds[0] === proposed;
      const broken = item.expectedIds.length === 1 && item.expectedIds[0] === baseline.selected[0];
      totals.changed++;
      if (fixed) totals.fixed++;
      if (broken) totals.broken++;
      rows.push({ id: item.id, before: baseline.selected[0], proposed, fixed, broken });
    }
    engine.clearCache();
  }
  console.log(JSON.stringify({ split, groups: wanted.length, fingerprint: fingerprint.digest("hex"), totals, rows }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const split = process.argv[2];
  if (!Object.hasOwn(FROZEN_SPLIT_GROUPS, split)) throw new Error("Expected train, dev, holdout or external");
  await evaluate(split as keyof typeof FROZEN_SPLIT_GROUPS);
}
