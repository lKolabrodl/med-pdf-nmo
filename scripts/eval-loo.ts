#!/usr/bin/env node
import {spawn} from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {loadDataset, groupSplit} from "./cases.js";

type EvalRecord = {
  id: string;
  pdfGroup: string;
  mode: "single" | "multi";
  correct: boolean;
};

type GroupReport = {
  summary: {
    exactAccuracy: number;
    total: number;
    correct: number;
  };
  records: EvalRecord[];
  errors: Array<{bucket: string}>;
  skippedNoExpected: Array<{id: string}>;
};

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {split: "all", concurrency: "2"};
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

function safeTag(value: string | boolean | undefined): string {
  if (typeof value !== "string") return "";
  return value.replace(/[^a-z0-9_-]+/giu, "-").replace(/^-+|-+$/gu, "");
}

function round4(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 10000) / 10000;
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function standardDeviation(values: number[]): number {
  if (!values.length) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function reportFile(root: string, group: string, reportTag: string): string {
  const base = `group-${group.replace(/[^a-z0-9_-]+/giu, "-")}`;
  const name = reportTag ? `${base}-${reportTag}-results.json` : `${base}-results.json`;
  return path.join(root, ".cache", "eval", name);
}

async function runGroup(root: string, group: string, config: string, reportTag: string): Promise<void> {
  const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
  const childArgs = [tsxCli, "scripts/eval.ts", "--group", group];
  if (config) childArgs.push("--config", config);
  if (reportTag) childArgs.push("--report-tag", reportTag);

  await new Promise<void>((resolve, reject) => {
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
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Group ${group} failed with exit ${code}\n${stderr || stdout}`));
    });
  });
}

async function runPool(
  groups: string[],
  concurrency: number,
  worker: (group: string) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  let completed = 0;
  async function runWorker(): Promise<void> {
    while (cursor < groups.length) {
      const index = cursor;
      cursor += 1;
      const group = groups[index];
      await worker(group);
      completed += 1;
      process.stderr.write(`evaluated PDF group ${completed}/${groups.length}: ${group}\n`);
    }
  }
  await Promise.all(Array.from({length: Math.min(concurrency, groups.length)}, () => runWorker()));
}

function selectGroups(
  allGroups: string[],
  splitName: string,
  explicitGroups: string[],
): string[] {
  if (explicitGroups.length) {
    const unknown = explicitGroups.filter((group) => !allGroups.includes(group));
    if (unknown.length) throw new Error(`Unknown PDF groups: ${unknown.join(", ")}`);
    return [...new Set(explicitGroups)].sort((left, right) => left.localeCompare(right, "en"));
  }
  if (splitName === "all") return [...allGroups];
  const splits = groupSplit(allGroups);
  const selected = splits[splitName as keyof typeof splits];
  if (!selected) throw new Error(`Unknown split "${splitName}"`);
  return [...selected].sort((left, right) => left.localeCompare(right, "en"));
}

async function main(): Promise<void> {
  const root = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  const splitName = typeof args.split === "string" ? args.split : "all";
  const reportTag = safeTag(args["report-tag"]) || "loo";
  const config = typeof args.config === "string" ? args.config : "";
  const concurrency = Math.max(1, Math.min(8, Number(args.concurrency) || 2));
  const explicitGroups =
    typeof args.groups === "string"
      ? args.groups.split(",").map((group) => group.trim()).filter(Boolean)
      : [];
  const {groups: allGroups} = await loadDataset(root);
  const groups = selectGroups(allGroups, splitName, explicitGroups);

  await runPool(groups, concurrency, (group) => runGroup(root, group, config, reportTag));

  const reports: Array<{group: string; report: GroupReport}> = [];
  for (const group of groups) {
    const report = JSON.parse(await fs.readFile(reportFile(root, group, reportTag), "utf8")) as GroupReport;
    reports.push({group, report});
  }

  const records = reports.flatMap(({report}) => report.records);
  const singles = records.filter((record) => record.mode === "single");
  const multis = records.filter((record) => record.mode === "multi");
  const correct = records.filter((record) => record.correct);
  const perPdf = reports.map(({group, report}) => ({
    group,
    total: report.summary.total,
    correct: report.summary.correct,
    accuracy: report.summary.exactAccuracy,
  }));
  const accuracies = perPdf.map((item) => item.accuracy);
  const errorBuckets = new Map<string, number>();
  for (const {report} of reports) {
    for (const error of report.errors) {
      errorBuckets.set(error.bucket, (errorBuckets.get(error.bucket) ?? 0) + 1);
    }
  }

  const summary = {
    kind: "fit-free-pdf-group-stability",
    note:
      "The fixed heuristic predictor is not trained per fold. This is a per-PDF stability audit, not an unbiased learned-model LOO estimate.",
    split: splitName,
    groups: groups.length,
    total: records.length,
    correct: correct.length,
    exactAccuracy: round4(correct.length / Math.max(1, records.length)),
    singleAccuracy: round4(singles.filter((record) => record.correct).length / Math.max(1, singles.length)),
    multiExactAccuracy: round4(multis.filter((record) => record.correct).length / Math.max(1, multis.length)),
    macroAccuracyByPdf: round4(mean(accuracies)),
    medianAccuracyByPdf: round4(median(accuracies)),
    standardDeviationByPdf: round4(standardDeviation(accuracies)),
    minAccuracyByPdf: round4(accuracies.length ? Math.min(...accuracies) : 0),
    maxAccuracyByPdf: round4(accuracies.length ? Math.max(...accuracies) : 0),
    config,
    reportTag,
    errorBuckets: Object.fromEntries([...errorBuckets.entries()].sort((left, right) => right[1] - left[1])),
    perPdf,
  };
  const outputDir = path.join(root, ".cache", "eval");
  await fs.mkdir(outputDir, {recursive: true});
  const outputFile = path.join(outputDir, `loo-${safeTag(splitName)}-${reportTag}.json`);
  await fs.writeFile(outputFile, `${JSON.stringify({summary, records}, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
