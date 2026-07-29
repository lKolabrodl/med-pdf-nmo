#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import {extractPdfText} from "../src/pdf.js";
import {DATASET_GROUPS, FROZEN_SPLIT_GROUPS} from "./dataset-manifest.js";

type AuditResult = {
  group: string;
  repairs: NonNullable<Awaited<ReturnType<typeof extractPdfText>>["tokenRepairs"]>;
};

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {split: "dev"};
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

function groupsForSplit(split: string): readonly string[] {
  if (split === "all") return DATASET_GROUPS;
  if (split === "train") return FROZEN_SPLIT_GROUPS.train;
  if (split === "holdout") return FROZEN_SPLIT_GROUPS.holdout;
  if (split === "external") return FROZEN_SPLIT_GROUPS.external;
  if (split === "dev") return FROZEN_SPLIT_GROUPS.dev;
  throw new Error(`Unknown split "${split}"`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const split = typeof args.split === "string" ? args.split : "dev";
  const minFrequency = Math.max(
    1,
    Math.floor(Number(typeof args["min-frequency"] === "string" ? args["min-frequency"] : 2) || 2),
  );
  const concurrency = Math.max(
    1,
    Math.floor(Number(typeof args.concurrency === "string" ? args.concurrency : 2) || 2),
  );
  const structuralOnly = args["structural-only"] === true || args["structural-only"] === "true";
  const root = process.cwd();
  const groups = [...groupsForSplit(split)];
  const results: AuditResult[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < groups.length) {
      const index = cursor;
      cursor += 1;
      const group = groups[index];
      const pdfPath = path.join(root, "__test__", group, "doc.pdf");
      const extracted = await extractPdfText(await fs.readFile(pdfPath), {
        cacheKey: pdfPath,
        documentTokenRepair: true,
        documentTokenRepairMinFrequency: minFrequency,
        documentTokenRepairStructuralOnly: structuralOnly,
      });
      results.push({group, repairs: extracted.tokenRepairs ?? []});
      process.stderr.write(`audited PDF group ${index + 1}/${groups.length}: ${group}\n`);
    }
  }

  await Promise.all(Array.from({length: Math.min(concurrency, groups.length)}, () => worker()));
  results.sort((left, right) => left.group.localeCompare(right.group, "en"));
  const repaired = results.filter((result) => result.repairs.length);
  const summary = {
    kind: "document-internal-split-token-audit",
    split,
    minFrequency,
    structuralOnly,
    groups: results.length,
    groupsWithRepairs: repaired.length,
    repairCount: repaired.reduce((sum, result) => sum + result.repairs.length, 0),
    perPdf: repaired.map((result) => ({
      group: result.group,
      repairCount: result.repairs.length,
      examples: result.repairs.slice(0, 5),
    })),
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
});
