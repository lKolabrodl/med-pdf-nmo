#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { loadDataset, groupSplit } from "./cases.js";
import { DEFAULT_CONFIG, type PredictorConfig } from "../src/predictor/config.js";
import { predict } from "../src/predictor.js";

const TARGET = 0.8;

function parseArgs(argv) {
  const args: Record<string, string | boolean> = { split: "dev" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function parseConfigOverrides(value: string | boolean | undefined): Partial<PredictorConfig> {
  if (typeof value !== "string" || !value.trim()) return {};
  const overrides: Partial<PredictorConfig> = {};
  const mutable = overrides as Record<string, boolean | number>;
  for (const assignment of value.split(",")) {
    const separator = assignment.indexOf("=");
    if (separator < 1) throw new Error(`Invalid config assignment "${assignment}"`);
    const key = assignment.slice(0, separator).trim();
    const rawValue = assignment.slice(separator + 1).trim();
    if (!(key in DEFAULT_CONFIG)) throw new Error(`Unknown predictor config key "${key}"`);
    const defaultValue = DEFAULT_CONFIG[key as keyof PredictorConfig];
    if (typeof defaultValue === "boolean") {
      if (rawValue !== "true" && rawValue !== "false") {
        throw new Error(`Config "${key}" requires true or false`);
      }
      mutable[key] = rawValue === "true";
      continue;
    }
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) throw new Error(`Config "${key}" requires a finite number`);
    mutable[key] = numeric;
  }
  return overrides;
}

function safeReportTag(value: string | boolean | undefined): string {
  if (typeof value !== "string") return "";
  return value.replace(/[^a-z0-9_-]+/giu, "-").replace(/^-+|-+$/gu, "");
}

function sameSet(left, right) {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((value, index) => value === b[index]);
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function bucketError(testCase, output) {
  if (output.meta?.ocrNeeded) return "no_text_or_ocr_needed";
  if (!output.evidence?.length || Math.max(...output.evidence.map((item) => item.score), 0) <= 0.5) return "weak_evidence";
  if (testCase.mode === "multi" && output.selected.length !== testCase.expectedIds.length) return "multi_cardinality";
  const selectedWrong = output.selected.filter((id) => !testCase.expectedIds.includes(id));
  const missed = testCase.expectedIds.filter((id) => !output.selected.includes(id));
  if (selectedWrong.length && missed.length) return "confused_with_distractor";
  if (missed.length) return "missed_correct";
  if (selectedWrong.length) return "selected_extra";
  return "other";
}

function summarize(results, splitName, splitGroups) {
  const total = results.length;
  const correct = results.filter((result) => result.correct);
  const singles = results.filter((result) => result.case.mode === "single");
  const multis = results.filter((result) => result.case.mode === "multi");
  const byPdf = new Map();
  const buckets = new Map();

  for (const result of results) {
    const group = result.case.pdfGroup;
    const pdfStats = byPdf.get(group) ?? { total: 0, correct: 0 };
    pdfStats.total += 1;
    if (result.correct) pdfStats.correct += 1;
    byPdf.set(group, pdfStats);
    if (!result.correct) {
      const bucket = bucketError(result.case, result.output);
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }
  }

  const pdfAccuracies = [...byPdf.values()].map((item) => item.correct / item.total);
  const correctConfidence = correct.map((result) => result.output.confidence);
  const incorrectConfidence = results.filter((result) => !result.correct).map((result) => result.output.confidence);

  return {
    split: splitName,
    groups: [...splitGroups].sort(),
    total,
    correct: correct.length,
    exactAccuracy: round4(correct.length / Math.max(1, total)),
    singleAccuracy: round4(singles.filter((result) => result.correct).length / Math.max(1, singles.length)),
    multiExactAccuracy: round4(multis.filter((result) => result.correct).length / Math.max(1, multis.length)),
    macroAccuracyByPdf: round4(mean(pdfAccuracies)),
    noEvidence: results.filter((result) => !result.output.evidence?.length || Math.max(...result.output.evidence.map((item) => item.score), 0) <= 0.5).length,
    avgConfidenceCorrect: round4(mean(correctConfidence)),
    avgConfidenceIncorrect: round4(mean(incorrectConfidence)),
    errorBuckets: Object.fromEntries([...buckets.entries()].sort((a, b) => b[1] - a[1])),
    byPdf: Object.fromEntries(
      [...byPdf.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], "en"))
        .map(([group, item]) => [group, { total: item.total, correct: item.correct, accuracy: round4(item.correct / item.total) }]),
    ),
  };
}

async function evaluate(
  splitName,
  explicitGroup = "",
  configOverrides: Partial<PredictorConfig> = {},
  reportTag = "",
) {
  const root = process.cwd();
  const { groups, cases } = await loadDataset(root);
  if (explicitGroup && !groups.includes(explicitGroup)) {
    throw new Error(`Unknown PDF group "${explicitGroup}"`);
  }
  const splits = explicitGroup ? null : groupSplit(groups);
  const selectedGroups =
    explicitGroup
      ? new Set([explicitGroup])
      : splitName === "all"
        ? new Set(groups)
        : splits[splitName];
  if (!selectedGroups) throw new Error(`Unknown split "${splitName}"`);
  const splitCases = cases.filter((testCase) => selectedGroups.has(testCase.pdfGroup));
  const skippedNoExpected = splitCases.filter((testCase) => !testCase.expectedIds.length);
  const selectedCases = splitCases.filter((testCase) => testCase.expectedIds.length);
  const results = [];
  const pdfBuffers = new Map();

  async function readPdf(pdfPath) {
    if (!pdfBuffers.has(pdfPath)) {
      pdfBuffers.set(pdfPath, await fs.readFile(pdfPath));
    }
    return pdfBuffers.get(pdfPath);
  }

  for (let i = 0; i < selectedCases.length; i += 1) {
    const testCase = selectedCases[i];
    const output = await predict(
      {
        pdfData: await readPdf(testCase.pdfPath),
        cacheKey: testCase.pdfPath,
        question: testCase.question,
        answers: testCase.answers,
        mode: testCase.mode,
      },
      { includeSources: false, ...configOverrides },
    );
    const correct = sameSet(output.selected, testCase.expectedIds);
    results.push({ case: testCase, output, correct });
    if ((i + 1) % 100 === 0) {
      process.stderr.write(`evaluated ${i + 1}/${selectedCases.length} ${splitName} cases\n`);
    }
  }

  const baseReportName = explicitGroup ? `group-${explicitGroup.replace(/[^a-z0-9_-]+/giu, "-")}` : splitName;
  const reportName = reportTag ? `${baseReportName}-${reportTag}` : baseReportName;
  const summary = {
    ...summarize(results, explicitGroup ? `group:${explicitGroup}` : splitName, selectedGroups),
    skippedNoExpected: skippedNoExpected.length,
    configOverrides,
    reportTag,
  };
  const reportDir = path.join(root, ".cache", "eval");
  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(
    path.join(reportDir, `${reportName}-results.json`),
    JSON.stringify(
      {
        summary,
        records: results.map((result) => ({
          id: result.case.id,
          pdfGroup: result.case.pdfGroup,
          mode: result.case.mode,
          expected: result.case.expectedIds,
          selected: result.output.selected,
          correct: result.correct,
          confidence: result.output.confidence,
          scores: result.output.scores,
          rawScores: result.output.rawScores,
        })),
        errors: results
          .filter((result) => !result.correct)
          .map((result) => ({
            id: result.case.id,
            pdfGroup: result.case.pdfGroup,
            mode: result.case.mode,
            question: result.case.question,
            expected: result.case.expectedIds,
            selected: result.output.selected,
            scores: result.output.scores,
            rawScores: result.output.rawScores,
            evidence: result.output.evidence.slice(0, 3),
            bucket: bucketError(result.case, result.output),
          })),
        skippedNoExpected: skippedNoExpected.map((testCase) => ({
          id: testCase.id,
          pdfGroup: testCase.pdfGroup,
          mode: testCase.mode,
          question: testCase.question,
        })),
      },
      null,
      2,
    ),
    "utf8",
  );

  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const explicitGroup = typeof args.group === "string" ? args.group : "";
  const configOverrides = parseConfigOverrides(args.config);
  const reportTag = safeReportTag(args["report-tag"]);
  const splitName =
    args.split === "all"
      ? "all"
      : args.split === "external"
        ? "external"
        : args.split === "holdout"
          ? "holdout"
          : args.split === "train"
            ? "train"
            : "dev";
  const summary = await evaluate(splitName, explicitGroup, configOverrides, reportTag);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!explicitGroup && splitName === "holdout" && summary.exactAccuracy < TARGET) {
    process.stderr.write(`holdout exact accuracy ${summary.exactAccuracy} is below target ${TARGET}\n`);
    process.exit(2);
  }
}

function round4(value) {
  return Math.round((Number.isFinite(value) ? value : 0) * 10000) / 10000;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
