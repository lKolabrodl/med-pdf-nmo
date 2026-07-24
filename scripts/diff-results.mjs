#!/usr/bin/env node
// Read-only verification tool for behavior-preserving refactors.
// Compares two eval result JSON files case-by-case and reports any case
// whose selected-answer set changed. Used to prove zero-delta refactors.
import fs from "node:fs/promises";

function sameSet(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const x = [...a].sort();
  const y = [...b].sort();
  return x.every((value, index) => value === y[index]);
}

function sameArray(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameJson(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

async function load(path) {
  const parsed = JSON.parse(await fs.readFile(path, "utf8"));
  const map = new Map();
  for (const record of parsed.records ?? []) map.set(record.id, record);
  return { summary: parsed.summary, map };
}

async function main() {
  const [, , baselinePath, currentPath] = process.argv;
  if (!baselinePath || !currentPath) {
    process.stderr.write("usage: node scripts/diff-results.mjs <baseline.json> <current.json>\n");
    process.exit(1);
  }
  const baseline = await load(baselinePath);
  const current = await load(currentPath);

  const diffs = [];
  for (const [id, base] of baseline.map) {
    const now = current.map.get(id);
    if (!now) {
      diffs.push({ id, kind: "missing_in_current" });
      continue;
    }
    if (!sameSet(base.selected, now.selected)) {
      diffs.push({ id, kind: "selected_changed", before: base.selected, after: now.selected });
      continue;
    }
    if (!sameArray(base.selected, now.selected)) {
      diffs.push({ id, kind: "selected_order_changed", before: base.selected, after: now.selected });
      continue;
    }
    if (!sameJson(base.rawScores, now.rawScores)) {
      diffs.push({ id, kind: "raw_scores_changed", before: base.rawScores, after: now.rawScores });
      continue;
    }
    if (!sameJson(base.scores, now.scores)) {
      diffs.push({ id, kind: "scores_changed", before: base.scores, after: now.scores });
      continue;
    }
    if (base.confidence !== now.confidence) {
      diffs.push({ id, kind: "confidence_changed", before: base.confidence, after: now.confidence });
    }
  }
  for (const id of current.map.keys()) {
    if (!baseline.map.has(id)) diffs.push({ id, kind: "new_in_current" });
  }

  const b = baseline.summary ?? {};
  const c = current.summary ?? {};
  process.stdout.write(
    `baseline ${b.correct}/${b.total} exact=${b.exactAccuracy} | current ${c.correct}/${c.total} exact=${c.exactAccuracy}\n`,
  );
  if (!diffs.length) {
    process.stdout.write(
      `ZERO-DELTA: all ${baseline.map.size} cases have identical selections, raw scores, calibrated scores, and confidence\n`,
    );
    process.exit(0);
  }
  process.stdout.write(`DELTA: ${diffs.length} case(s) changed behavior\n`);
  for (const diff of diffs.slice(0, 50)) {
    if (Object.hasOwn(diff, "before") || Object.hasOwn(diff, "after")) {
      process.stdout.write(
        `  ${diff.id}: ${diff.kind} ${JSON.stringify(diff.before)} -> ${JSON.stringify(diff.after)}\n`,
      );
    } else {
      process.stdout.write(`  ${diff.id}: ${diff.kind}\n`);
    }
  }
  process.exit(2);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
