import {existsSync, readFileSync, readdirSync} from "node:fs";
import path from "node:path";
import ts from "typescript";
import {describe, expect, it} from "vitest";
import {BM25Index} from "../src/bm25.js";
import * as coordinateTable from "../src/predictor/scorers/coordinate-table/index.js";
import * as numeric from "../src/predictor/scorers/numeric/index.js";
import {createPredictorEngine} from "../src/predictor.js";
import {PredictorEngine, type PredictorEngineDependencies} from "../src/predictor/engine.js";
import {ScoreAdjustmentPipeline} from "../src/predictor/pipelines/score-adjustment-pipeline.js";
import {PdfRuntimeStore} from "../src/predictor/runtime.js";
import type {ScoreAdjustmentContext} from "../src/predictor/contracts.js";

describe("PredictorEngine orchestration", () => {
  it("creates independent default engines", () => {
    const first = createPredictorEngine();
    const second = createPredictorEngine();

    expect(first).toBeInstanceOf(PredictorEngine);
    expect(second).toBeInstanceOf(PredictorEngine);
    expect(first).not.toBe(second);
  });

  it("runs controller stages in a stable order and delegates cache clearing", async () => {
    const calls: string[] = [];
    const expected = {
      selected: ["A"],
      mode: "single",
      confidence: 0.8,
      scores: { A: 0.8 },
      rawScores: { A: 10 },
      evidence: [],
      source: null,
      sources: { question: null, answers: [], pages: [] },
      meta: {
        pageCount: 1,
        chunks: 1,
        ocrNeeded: false,
        intent: { negative: false, exception: false, numeric: false, listLike: false },
      },
    };
    const runtime = {
      pdfText: { pages: [], pageCount: 1, ocrNeeded: false },
      chunks: [{}],
      index: {},
    };
    const context = { mode: "single", config: {}, runtime };
    const structuralResolution = new Map();
    const initialScores = [{ answer: { id: "A", text: "answer" }, raw: 10, evidence: [] }];
    const adjustedScores = [{ ...initialScores[0], raw: 11 }];
    const calibrated = [{ ...adjustedScores[0], score: 0.8, relative: 1 }];

    const engine = new PredictorEngine({
      runtimeStore: {
        async get() {
          calls.push("runtime");
          return runtime;
        },
        clear() {
          calls.push("clear");
        },
      },
      contextBuilder: {
        build() {
          calls.push("context");
          return context;
        },
      },
      structuralResolverPipeline: {
        resolve() {
          calls.push("structural");
          return structuralResolution;
        },
      },
      answerScoringPipeline: {
        score() {
          calls.push("scoring");
          return initialScores;
        },
      },
      scoreAdjustmentPipeline: {
        apply() {
          calls.push("adjustments");
          return adjustedScores;
        },
      },
      answerSelector: {
        resolve() {
          calls.push("selection");
          return { calibrated, selected: ["A"] };
        },
      },
      confidenceCalculator: {
        calculate() {
          calls.push("confidence");
          return 0.8;
        },
      },
      resultBuilder: {
        build() {
          calls.push("result");
          return expected;
        },
      },
    } as unknown as PredictorEngineDependencies);

    const result = await engine.predict({
      pdfData: new Uint8Array([1]),
      question: "question",
      answers: [{ id: "A", text: "answer" }],
      mode: "single",
    });
    engine.clearCache();

    expect(result).toBe(expected);
    expect(calls).toEqual([
      "runtime",
      "context",
      "structural",
      "scoring",
      "adjustments",
      "selection",
      "confidence",
      "result",
      "clear",
    ]);
  });
});

describe("PdfRuntimeStore", () => {
  it("deduplicates concurrent keyed extraction and rebuilds after clear", async () => {
    let extractCalls = 0;
    let chunkCalls = 0;
    let indexCalls = 0;
    const store = new PdfRuntimeStore({
      async extractPdfText() {
        extractCalls += 1;
        return {
          pdfId: "test",
          cacheVersion: 2,
          pageCount: 0,
          extractedAt: "2026-01-01T00:00:00.000Z",
          pages: [],
          abbreviations: [],
          ocrNeeded: false,
        };
      },
      buildChunks() {
        chunkCalls += 1;
        return [];
      },
      createIndex() {
        indexCalls += 1;
        return new BM25Index([]);
      },
    });

    const firstInput = new Uint8Array([1]);
    const [first, second] = await Promise.all([
      store.get(firstInput, { cacheKey: "same-pdf" }),
      store.get(new Uint8Array([2]), { cacheKey: "same-pdf" }),
    ]);

    expect(first).toBe(second);
    expect({ extractCalls, chunkCalls, indexCalls }).toEqual({
      extractCalls: 1,
      chunkCalls: 1,
      indexCalls: 1,
    });

    store.clear();
    const third = await store.get(firstInput, { cacheKey: "same-pdf" });

    expect(third).not.toBe(first);
    expect({ extractCalls, chunkCalls, indexCalls }).toEqual({
      extractCalls: 2,
      chunkCalls: 2,
      indexCalls: 2,
    });
  });
});

describe("ScoreAdjustmentPipeline", () => {
  it("passes scores through processors in declared order", () => {
    const calls: string[] = [];
    const pipeline = new ScoreAdjustmentPipeline([
      {
        id: "first",
        apply(scores) {
          calls.push("first");
          return scores.map((item) => ({ ...item, raw: item.raw + 1 }));
        },
      },
      {
        id: "second",
        apply(scores) {
          calls.push("second");
          return scores.map((item) => ({ ...item, raw: item.raw * 2 }));
        },
      },
    ]);
    const result = pipeline.apply(
      [{ answer: { id: "A", text: "answer" }, raw: 3, evidence: [] }],
      {} as ScoreAdjustmentContext,
    );

    expect(calls).toEqual(["first", "second"]);
    expect(result[0].raw).toBe(8);
  });
});

describe("coordinate-table facade", () => {
  it("keeps the public scorer surface explicit", () => {
    expect(Object.keys(coordinateTable).sort()).toEqual([
      "bestCoordinateMultiCellRowSupport",
      "bestCoordinateRelationalRowSupport",
      "bestCoordinateTableGroupSupport",
      "bestCoordinateTableMembershipSupport",
      "bestCoordinateTableRowSupport",
      "buildCoordinateMultiCellRowsByPage",
      "buildCoordinateRelationalRowsByPage",
      "buildCoordinateTableGroupsByPage",
      "buildCoordinateTableMembershipsByPage",
      "buildCoordinateTableRowsByPage",
      "hasCoordinateComparisonTableCue",
      "hasCoordinateRelationalRowCue",
      "hasCoordinateTableCue",
      "hasCoordinateTableGroupCue",
    ]);
  });
});

describe("scorer feature folders", () => {
  const scorersRoot = path.join(process.cwd(), "src", "predictor", "scorers");
  const entries = readdirSync(scorersRoot, {withFileTypes: true});

  it("keeps every scorer behind a feature-folder index", () => {
    const flatModules = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => entry.name);
    const missingFacades = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !existsSync(path.join(scorersRoot, name, "index.ts")));

    expect(flatModules).toEqual([]);
    expect(missingFacades).toEqual([]);
  });

  it("documents every scorer module next to its implementation", () => {
    const missingReadmes = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !existsSync(path.join(scorersRoot, name, "README.md")));

    expect(missingReadmes).toEqual([]);
  });

  it("tests every scorer module next to its implementation", () => {
    const missingTests = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !existsSync(path.join(scorersRoot, name, "index.test.ts")));

    expect(missingTests).toEqual([]);
  });

  it("gives every named scorer function explicit parameter and return types", () => {
    const missingTypes: string[] = [];

    for (const entry of entries.filter((item) => item.isDirectory())) {
      const moduleDir = path.join(scorersRoot, entry.name);
      const sourceFiles = readdirSync(moduleDir)
        .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"));

      for (const fileName of sourceFiles) {
        const filePath = path.join(moduleDir, fileName);
        const text = readFileSync(filePath, "utf8");
        const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

        for (const statement of source.statements) {
          const callables: Array<{name: string; node: ts.FunctionLikeDeclaration}> = [];
          if (ts.isFunctionDeclaration(statement) && statement.name) {
            callables.push({name: statement.name.text, node: statement});
          }
          if (ts.isVariableStatement(statement)) {
            for (const declaration of statement.declarationList.declarations) {
              if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
              if (!ts.isArrowFunction(declaration.initializer) && !ts.isFunctionExpression(declaration.initializer)) continue;
              callables.push({name: declaration.name.text, node: declaration.initializer});
            }
          }

          for (const callable of callables) {
            const key = `${entry.name}/${fileName}:${callable.name}`;
            if (!callable.node.type) missingTypes.push(`${key}:return`);
            for (const [index, parameter] of callable.node.parameters.entries()) {
              if (!parameter.type) missingTypes.push(`${key}:parameter-${index + 1}`);
            }
          }
        }
      }
    }

    expect(missingTypes).toEqual([]);
  });

  it("explicitly names every scorer function in its colocated test", () => {
    const mismatches: string[] = [];

    for (const entry of entries.filter((item) => item.isDirectory())) {
      const moduleDir = path.join(scorersRoot, entry.name);
      const sourceKeys: string[] = [];
      for (const fileName of readdirSync(moduleDir)
        .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))) {
        const filePath = path.join(moduleDir, fileName);
        const text = readFileSync(filePath, "utf8");
        const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        for (const statement of source.statements) {
          if (ts.isFunctionDeclaration(statement) && statement.name) {
            sourceKeys.push(`${fileName}:${statement.name.text}`);
          }
          if (!ts.isVariableStatement(statement)) continue;
          for (const declaration of statement.declarationList.declarations) {
            if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
            if (!ts.isArrowFunction(declaration.initializer) && !ts.isFunctionExpression(declaration.initializer)) continue;
            sourceKeys.push(`${fileName}:${declaration.name.text}`);
          }
        }
      }

      const testPath = path.join(moduleDir, "index.test.ts");
      const testText = readFileSync(testPath, "utf8");
      const testSource = ts.createSourceFile(testPath, testText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const testKeys: string[] = [];
      for (const statement of testSource.statements) {
        if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) continue;
        const call = statement.expression;
        if (!ts.isIdentifier(call.expression) || call.expression.text !== "defineScorerFunctionContract") continue;
        const manifest = call.arguments[1];
        if (!manifest || !ts.isObjectLiteralExpression(manifest)) continue;
        for (const property of manifest.properties) {
          if (!ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.name)) continue;
          if (!ts.isArrayLiteralExpression(property.initializer)) continue;
          for (const element of property.initializer.elements) {
            if (ts.isStringLiteralLike(element)) testKeys.push(`${property.name.text}:${element.text}`);
          }
        }
      }

      const expected = [...sourceKeys].sort();
      const actual = [...testKeys].sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        const missing = expected.filter((key) => !actual.includes(key));
        const unexpected = actual.filter((key) => !expected.includes(key));
        mismatches.push(`${entry.name}: missing [${missing.join(", ")}], unexpected [${unexpected.join(", ")}]`);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("keeps the numeric public scorer surface explicit", () => {
    expect(Object.keys(numeric).sort()).toEqual([
      "bestClozeGapSupport",
      "bestConditionedNumberSupport",
      "bestCountRelationSupport",
      "bestExactHourAliasOptionSupport",
      "bestExactNumericOptionSupport",
      "bestNumericConditionSupport",
      "bestSubjectBoundNumericClauseSupport",
      "conditionPairAdjustment",
    ]);
  });
});
