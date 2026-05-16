import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function collectRuntimeSources(relativeDir: string) {
  const absoluteDir = path.join(ROOT, relativeDir);
  const out: string[] = [];
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const entryPath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectRuntimeSources(entryPath));
    } else if (entry.name.endsWith(".ts")) {
      out.push(readSource(entryPath));
    }
  }
  return out;
}

function collectBrowserRuntimeSources(relativeDir: string) {
  const absoluteDir = path.join(ROOT, relativeDir);
  const out: string[] = [];
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const entryPath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectBrowserRuntimeSources(entryPath));
    } else if (entry.name.endsWith(".ts") && entryPath !== path.join("src", "cli.ts")) {
      out.push(readSource(entryPath));
    }
  }
  return out;
}

describe("inference leakage guard", () => {
  it("predictor does not import eval fixtures or answer keys", () => {
    const predictorSource = [readSource("src/predictor.ts"), ...collectRuntimeSources("src/predictor")].join("\n");
    expect(predictorSource).not.toMatch(/__test__|expected|cases\.test|answer\s*key|eval/i);
  });

  it("predict CLI only delegates to predictor and does not load dataset files", () => {
    const cliSource = readSource("src/cli.ts");
    expect(cliSource).not.toMatch(/__test__|cases\.test|expected|answer\s*key/i);
  });

  it("browser runtime does not import Node built-ins", () => {
    const browserSources = collectBrowserRuntimeSources("src").join("\n");
    expect(browserSources).not.toMatch(/from\s+["']node:|require\(["']node:/);
  });
});
