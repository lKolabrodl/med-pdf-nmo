import { describe, expect, it } from "vitest";
import { BM25Index } from "../src/bm25.js";
import { createPredictorEngine } from "../src/predictor.js";
import {
  PredictorEngine,
  type PredictorEngineDependencies,
} from "../src/predictor/engine.js";
import { ScoreAdjustmentPipeline } from "../src/predictor/pipelines/score-adjustment-pipeline.js";
import { PdfRuntimeStore } from "../src/predictor/runtime.js";
import type { ScoreAdjustmentContext } from "../src/predictor/contracts.js";

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
