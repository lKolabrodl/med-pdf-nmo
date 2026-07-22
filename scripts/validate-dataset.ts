#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { normalizeForSearch } from "../src/normalize.js";
import { loadDataset, groupSplit } from "./cases.js";
import { DATASET_CASE_FINGERPRINT, DATASET_PDF_FINGERPRINT } from "./dataset-manifest.js";

const LIKELY_DUPLICATE_GROUP_MIN_SHARED_CASES = 10;

function recordSignature(testCase: any) {
  return [
    normalizeForSearch(testCase.question),
    testCase.mode,
    ...testCase.answers.map((answer: any) => normalizeForSearch(answer.text)),
  ].join("|");
}

function duplicateValues(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

async function sha256(filePath: string) {
  return crypto.createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
}

async function main() {
  const root = process.cwd();
  const { groups, cases } = await loadDataset(root);
  const splits = groupSplit(groups);
  const splitByGroup = new Map<string, string>();
  for (const split of ["train", "dev", "holdout", "external"] as const) {
    for (const group of splits[split]) splitByGroup.set(group, split);
  }

  const pdfRows = [];
  const groupsByHash = new Map<string, string[]>();
  for (const group of groups) {
    const pdfPath = path.join(root, "__test__", group, "doc.pdf");
    const hash = await sha256(pdfPath);
    pdfRows.push(`${group}:${hash}`);
    const hashGroups = groupsByHash.get(hash) ?? [];
    hashGroups.push(group);
    groupsByHash.set(hash, hashGroups);
  }
  pdfRows.sort((left, right) => left.localeCompare(right, "en"));
  const fingerprint = crypto.createHash("sha256").update(pdfRows.join("\n")).digest("hex");
  const duplicatePdfs = [...groupsByHash.entries()].filter(([, hashGroups]) => hashGroups.length > 1);

  const problems: string[] = [];
  if (fingerprint !== DATASET_PDF_FINGERPRINT) {
    problems.push(`PDF fingerprint mismatch: expected ${DATASET_PDF_FINGERPRINT}, received ${fingerprint}`);
  }

  const caseRows = cases
    .map((testCase) =>
      JSON.stringify([
        testCase.id,
        testCase.question,
        testCase.mode,
        testCase.answers.map((answer: any) => [answer.id, answer.text]),
        testCase.expected,
      ]),
    )
    .sort((left, right) => left.localeCompare(right, "en"));
  const caseFingerprint = crypto.createHash("sha256").update(caseRows.join("\n")).digest("hex");
  if (caseFingerprint !== DATASET_CASE_FINGERPRINT) {
    problems.push(`Case fingerprint mismatch: expected ${DATASET_CASE_FINGERPRINT}, received ${caseFingerprint}`);
  }
  for (const [hash, hashGroups] of duplicatePdfs) {
    problems.push(`Duplicate PDF ${hash}: ${hashGroups.join(", ")}`);
  }

  const casesBySignature = new Map<string, any[]>();
  for (const testCase of cases) {
    const normalizedAnswers = testCase.answers.map((answer: any) => normalizeForSearch(answer.text));
    const duplicateAnswers = duplicateValues(normalizedAnswers.filter(Boolean));
    const normalizedExpected = testCase.expected.map((answer: string) => normalizeForSearch(answer));
    const duplicateExpected = duplicateValues(normalizedExpected.filter(Boolean));
    if (duplicateAnswers.length) problems.push(`${testCase.id}: duplicate answer variants: ${duplicateAnswers.join(", ")}`);
    if (duplicateExpected.length) problems.push(`${testCase.id}: duplicate expected values: ${duplicateExpected.join(", ")}`);
    if (testCase.expectedIds.length !== testCase.expected.length) {
      problems.push(`${testCase.id}: ${testCase.expected.length - testCase.expectedIds.length} expected values do not map to variants`);
    }
    if (testCase.expectedIds.length && testCase.mode === "single" && testCase.expectedIds.length !== 1) {
      problems.push(`${testCase.id}: keyed single case must contain exactly one expected answer`);
    }
    if (testCase.expectedIds.length && testCase.mode === "multi" && testCase.expectedIds.length < 2) {
      problems.push(`${testCase.id}: keyed multi case must contain at least two expected answers`);
    }

    const signature = recordSignature(testCase);
    const matchingCases = casesBySignature.get(signature) ?? [];
    matchingCases.push(testCase);
    casesBySignature.set(signature, matchingCases);
  }

  let sameSplitDuplicateRecords = 0;
  const sharedCaseCountsByGroupPair = new Map<string, number>();
  for (const matchingCases of casesBySignature.values()) {
    const matchingSplits = new Set(matchingCases.map((testCase) => splitByGroup.get(testCase.pdfGroup)));
    if (matchingSplits.size > 1) {
      problems.push(`Cross-split duplicate cases: ${matchingCases.map((testCase) => testCase.id).join(", ")}`);
    } else if (matchingCases.length > 1) {
      sameSplitDuplicateRecords += matchingCases.length;
    }

    const matchingGroups = [...new Set(matchingCases.map((testCase) => testCase.pdfGroup))].sort((left, right) =>
      left.localeCompare(right, "en"),
    );
    for (let left = 0; left < matchingGroups.length; left += 1) {
      for (let right = left + 1; right < matchingGroups.length; right += 1) {
        const pair = `${matchingGroups[left]} <-> ${matchingGroups[right]}`;
        sharedCaseCountsByGroupPair.set(pair, (sharedCaseCountsByGroupPair.get(pair) ?? 0) + 1);
      }
    }
  }

  const likelyDuplicateGroupPairs = [...sharedCaseCountsByGroupPair.entries()].filter(
    ([, sharedCases]) => sharedCases >= LIKELY_DUPLICATE_GROUP_MIN_SHARED_CASES,
  );
  for (const [pair, sharedCases] of likelyDuplicateGroupPairs) {
    problems.push(`Likely duplicate PDF groups (${sharedCases} shared cases): ${pair}`);
  }

  const summary = {
    manifestFingerprint: DATASET_PDF_FINGERPRINT,
    caseFingerprint: DATASET_CASE_FINGERPRINT,
    groups: groups.length,
    parsedCases: cases.length,
    keyedCases: cases.filter((testCase) => testCase.expectedIds.length).length,
    singleCases: cases.filter((testCase) => testCase.expectedIds.length && testCase.mode === "single").length,
    multiCases: cases.filter((testCase) => testCase.expectedIds.length && testCase.mode === "multi").length,
    duplicatePdfGroups: duplicatePdfs.length,
    crossSplitDuplicateRecords: problems.filter((problem) => problem.startsWith("Cross-split duplicate cases:")).length,
    sameSplitDuplicateRecords,
    likelyDuplicateGroupPairs: likelyDuplicateGroupPairs.length,
    multiMinimumExpectedAnswers: Math.min(
      ...cases.filter((testCase) => testCase.mode === "multi" && testCase.expectedIds.length).map((testCase) => testCase.expectedIds.length),
    ),
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (problems.length) {
    process.stderr.write(`${problems.join("\n")}\n`);
    process.exit(2);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
