#!/usr/bin/env node
import {spawn} from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {DEFAULT_CONFIG} from "../src/predictor/config.js";

type StabilitySummary = {
  total: number;
  correct: number;
  exactAccuracy: number;
  singleAccuracy: number;
  multiExactAccuracy: number;
  macroAccuracyByPdf: number;
  perPdf: Array<{group: string; total: number; correct: number; accuracy: number}>;
};

type AblationResult = {
  flag: string;
  baseline: boolean;
  correct: number;
  exactAccuracy: number;
  deltaCorrect: number;
  deltaExactAccuracy: number;
  deltaSingleAccuracy: number;
  deltaMultiExactAccuracy: number;
  deltaMacroAccuracyByPdf: number;
  perPdfDelta: Array<{group: string; deltaCorrect: number; deltaAccuracy: number}>;
};

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {
    split: "dev",
    concurrency: "2",
    "variant-concurrency": "1",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function safeTag(value: string): string {
  return value.replace(/[^a-z0-9_-]+/giu, "-").replace(/^-+|-+$/gu, "");
}

function round4(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 10000) / 10000;
}

async function runStabilityAudit({
  root,
  split,
  groups,
  config,
  reportTag,
  concurrency,
}: {
  root: string;
  split: string;
  groups: string;
  config: string;
  reportTag: string;
  concurrency: number;
}): Promise<StabilitySummary> {
  const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
  const childArgs = [
    tsxCli,
    "scripts/eval-loo.ts",
    "--split",
    split,
    "--report-tag",
    reportTag,
    "--concurrency",
    String(concurrency),
  ];
  if (groups) childArgs.push("--groups", groups);
  if (config) childArgs.push("--config", config);

  return new Promise<StabilitySummary>((resolve, reject) => {
    const child = spawn(process.execPath, childArgs, {
      cwd: root,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Ablation child failed with exit ${code}\n${stderr || stdout}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as StabilitySummary);
      } catch (error) {
        reject(new Error(`Could not parse ablation child output: ${error}\n${stdout}`));
      }
    });
  });
}

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function runWorker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({length: Math.min(concurrency, items.length)}, () => runWorker()));
  return results;
}

function compare(flag: string, baseline: StabilitySummary, variant: StabilitySummary): AblationResult {
  const baselineByPdf = new Map(baseline.perPdf.map((item) => [item.group, item]));
  return {
    flag,
    baseline: true,
    correct: variant.correct,
    exactAccuracy: variant.exactAccuracy,
    deltaCorrect: variant.correct - baseline.correct,
    deltaExactAccuracy: round4(variant.exactAccuracy - baseline.exactAccuracy),
    deltaSingleAccuracy: round4(variant.singleAccuracy - baseline.singleAccuracy),
    deltaMultiExactAccuracy: round4(variant.multiExactAccuracy - baseline.multiExactAccuracy),
    deltaMacroAccuracyByPdf: round4(variant.macroAccuracyByPdf - baseline.macroAccuracyByPdf),
    perPdfDelta: variant.perPdf
      .map((item) => {
        const previous = baselineByPdf.get(item.group);
        return {
          group: item.group,
          deltaCorrect: item.correct - (previous?.correct ?? 0),
          deltaAccuracy: round4(item.accuracy - (previous?.accuracy ?? 0)),
        };
      })
      .filter((item) => item.deltaCorrect || item.deltaAccuracy),
  };
}

async function main(): Promise<void> {
  const root = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  const split = typeof args.split === "string" ? args.split : "dev";
  const groups = typeof args.groups === "string" ? args.groups : "";
  const concurrency = Math.max(1, Math.min(8, Number(args.concurrency) || 2));
  const variantConcurrency = Math.max(1, Math.min(4, Number(args["variant-concurrency"]) || 1));
  const activeFlags = Object.entries(DEFAULT_CONFIG)
    .filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean" && entry[1])
    .map(([key]) => key);
  const requestedFlags =
    typeof args.flags === "string"
      ? args.flags.split(",").map((flag) => flag.trim()).filter(Boolean)
      : activeFlags;
  const unknownFlags = requestedFlags.filter(
    (flag) => typeof DEFAULT_CONFIG[flag as keyof typeof DEFAULT_CONFIG] !== "boolean",
  );
  if (unknownFlags.length) throw new Error(`Unknown boolean config flags: ${unknownFlags.join(", ")}`);
  const inactiveFlags = requestedFlags.filter((flag) => !DEFAULT_CONFIG[flag as keyof typeof DEFAULT_CONFIG]);
  if (inactiveFlags.length) {
    throw new Error(`Ablation only disables active flags; already inactive: ${inactiveFlags.join(", ")}`);
  }

  const scopeTag = safeTag(groups || split);
  const baseline = await runStabilityAudit({
    root,
    split,
    groups,
    config: "",
    reportTag: `ablation-${scopeTag}-baseline`,
    concurrency,
  });
  const results = await runPool(requestedFlags, variantConcurrency, async (flag) => {
    process.stderr.write(`starting ablation: ${flag}=false\n`);
    const variant = await runStabilityAudit({
      root,
      split,
      groups,
      config: `${flag}=false`,
      reportTag: `ablation-${scopeTag}-${safeTag(flag)}`,
      concurrency,
    });
    return compare(flag, baseline, variant);
  });
  results.sort((left, right) => right.deltaCorrect - left.deltaCorrect || left.flag.localeCompare(right.flag, "en"));

  const output = {
    scope: groups ? {groups: groups.split(",")} : {split},
    note:
      "This audits active top-level boolean mechanisms. Evidence kinds without an independent config toggle are not individually ablated.",
    baseline: {
      total: baseline.total,
      correct: baseline.correct,
      exactAccuracy: baseline.exactAccuracy,
      singleAccuracy: baseline.singleAccuracy,
      multiExactAccuracy: baseline.multiExactAccuracy,
      macroAccuracyByPdf: baseline.macroAccuracyByPdf,
    },
    results,
  };
  const outputDir = path.join(root, ".cache", "experiments");
  await fs.mkdir(outputDir, {recursive: true});
  const outputFile = path.join(outputDir, `ablation-${scopeTag}.json`);
  await fs.writeFile(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
