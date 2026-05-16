#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { predict } from "./predictor.js";

function parseArgs(argv) {
  const args: Record<string, any> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (key === "answer") {
      args.answer ??= [];
      args.answer.push(next);
      i += 1;
    } else if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function parseAnswers(args) {
  if (args.answers) {
    const parsed = JSON.parse(args.answers);
    if (!Array.isArray(parsed)) throw new Error("--answers must be a JSON array");
    return parsed;
  }

  if (args.answer?.length) {
    return args.answer.map((value, index) => {
      const separator = value.indexOf("=");
      if (separator > 0) {
        return { id: value.slice(0, separator), text: value.slice(separator + 1) };
      }
      return { id: String.fromCharCode(65 + index), text: value };
    });
  }

  throw new Error("Provide --answers JSON or one or more --answer ID=text arguments");
}

async function readInput(args) {
  if (args.input) {
    const inputPath = path.resolve(args.input);
    const raw = await fs.readFile(inputPath, "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  }

  return {
    pdfPath: args.pdf ?? args.pdfPath,
    question: args.question,
    answers: parseAnswers(args),
    mode: args.mode ?? "single",
  };
}

async function attachLocalPdfData(input) {
  if (input.pdfData || input.pdfBuffer || input.pdf || input.file || input.blob || input.pdfUrl || input.url || !input.pdfPath) return input;
  const absolutePath = path.resolve(input.pdfPath);
  return {
    ...input,
    pdfData: await fs.readFile(absolutePath),
    cacheKey: absolutePath,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    process.stdout.write(
      [
        "Usage:",
        "  npm run predict -- --input request.json",
        "  npm run predict -- --pdf doc.pdf --question \"...\" --mode single --answer A=\"...\" --answer B=\"...\"",
        "",
      ].join("\n"),
    );
    return;
  }

  const input = await attachLocalPdfData(await readInput(args));
  const output = await predict(input);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
