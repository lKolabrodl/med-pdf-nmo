import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

export async function loadDataset(rootDir = process.cwd()) {
  const testDir = path.join(rootDir, "__test__");
  const entries = await fs.readdir(testDir, { withFileTypes: true });
  const groups = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  const cases = [];
  for (const group of groups) {
    const groupDir = path.join(testDir, group);
    const filePath = path.join(groupDir, "cases.test.ts");
    const pdfPath = path.join(groupDir, "doc.pdf");
    const source = await fs.readFile(filePath, "utf8");
    const parsed = parseCasesSource(source, filePath);
    parsed.forEach((item, index) => {
      cases.push({
        id: `${group}#${index + 1}`,
        pdfGroup: group,
        pdfPath,
        caseFile: filePath,
        question: item.question,
        answers: item.variants.map((text, answerIndex) => ({
          id: String.fromCharCode(65 + answerIndex),
          text,
        })),
        variants: item.variants,
        mode: item.type === "multi" ? "multi" : "single",
        expected: item.expected,
        expectedIds: item.expected
          .map((text) => item.variants.findIndex((variant) => variant === text))
          .filter((indexValue) => indexValue >= 0)
          .map((indexValue) => String.fromCharCode(65 + indexValue)),
      });
    });
  }
  return { groups, cases };
}

export function parseCasesSource(source, fileName = "cases.test.ts") {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const cases = [];

  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(file) === "runCase" && node.arguments.length === 1) {
      cases.push(evaluateExpression(node.arguments[0], file));
    }
    ts.forEachChild(node, visit);
  }

  visit(file);
  return cases;
}

function evaluateExpression(node, file) {
  if (ts.isObjectLiteralExpression(node)) {
    const value = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const key = property.name.getText(file).replace(/^['"]|['"]$/g, "");
      value[key] = evaluateExpression(property.initializer, file);
    }
    return value;
  }

  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((element) => evaluateExpression(element, file));
  }

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isNumericLiteral(node)) return Number(node.text);

  throw new Error(`Unsupported literal in ${file.fileName}: ${node.getText(file).slice(0, 120)}`);
}

export function groupSplit(groups, { seed = 20260509, holdoutRatio = 0.2, devRatio = 0.2 } = {}) {
  const shuffled = [...groups].sort((a, b) => seededScore(a, seed) - seededScore(b, seed));
  const holdoutCount = Math.max(1, Math.round(shuffled.length * holdoutRatio));
  const devCount = Math.max(1, Math.round(shuffled.length * devRatio));
  const holdout = new Set(shuffled.slice(0, holdoutCount));
  const dev = new Set(shuffled.slice(holdoutCount, holdoutCount + devCount));
  const train = new Set(shuffled.slice(holdoutCount + devCount));
  return { train, dev, holdout, orderedGroups: shuffled };
}

function seededScore(value, seed) {
  let hash = seed >>> 0;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  hash ^= hash << 13;
  hash ^= hash >>> 17;
  hash ^= hash << 5;
  return hash >>> 0;
}
