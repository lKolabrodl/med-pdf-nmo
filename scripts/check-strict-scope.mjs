import { spawnSync } from "node:child_process";
import path from "node:path";

const scopes = process.argv
  .slice(2)
  .map((scope) => scope.replaceAll("\\", "/").replace(/\/+$/u, ""));

if (!scopes.length) {
  process.stderr.write(
    "Usage: node scripts/check-strict-scope.mjs <source-prefix> [...]\n",
  );
  process.exit(2);
}

const tscPath = path.join(
  process.cwd(),
  "node_modules",
  "typescript",
  "bin",
  "tsc",
);
const result = spawnSync(
  process.execPath,
  [tscPath, "--noEmit", "--strict", "--pretty", "false"],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  },
);

if (result.error) {
  throw result.error;
}

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const errorLines = output
  .split(/\r?\n/u)
  .filter((line) => /\berror TS\d+:/u.test(line));
const scopedErrors = errorLines.filter((line) => {
  const match = line.match(/^(.+?)\(\d+,\d+\):\s+error TS\d+:/u);
  if (!match) return false;
  const file = match[1].replaceAll("\\", "/");
  return scopes.some(
    (scope) =>
      file === scope ||
      file === `${scope}.ts` ||
      file.startsWith(`${scope}-`) ||
      file.startsWith(`${scope}/`),
  );
});

if (scopedErrors.length) {
  process.stderr.write(`${scopedErrors.join("\n")}\n`);
  process.stderr.write(
    `Strict scope failed: ${scopedErrors.length} error(s) in ${scopes.join(", ")}.\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `Strict scope passed: ${scopes.join(", ")}; ${errorLines.length} known error(s) remain outside the scope.\n`,
);
