import { describe, expect, it } from "vitest";
import { defineScorerFunctionContract, scorerTestPage } from "../../../../__test__/scorer-test-support.js";
import { applyNumericTieConditionBreak } from "./index.js";
import type { AnswerScore } from "../../types.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": ["applyNumericTieConditionBreak"],
});

function score(id: string, text: string, raw: number): AnswerScore {
  return { answer: { id, text }, raw, evidence: [] };
}

const PAGES = [
  scorerTestPage(1, ["у пациентов с мутацией t315i доза составляет 20 мг в сутки"]),
  scorerTestPage(2, [
    "у пациентов без мутации доза составляет 40 мг в сутки",
    "общие сведения о лечении заболевания",
  ]),
];

const CONTEXT = {
  mode: "single" as const,
  pages: PAGES,
  topQuestionPages: new Set([1, 2]),
  question: "доза при мутации t315i составляет",
};

describe("numeric exact-tie condition break", () => {
  it("breaks an exact raw tie toward the value that co-occurs with the rare condition token", () => {
    const result = applyNumericTieConditionBreak(
      [score("A", "20", 5), score("B", "40", 5)],
      CONTEXT,
    );
    const a = result.find((item) => item.answer.id === "A")!.raw;
    const b = result.find((item) => item.answer.id === "B")!.raw;
    expect(a).toBeGreaterThan(b);
  });

  it("never overrides a real raw gap", () => {
    const result = applyNumericTieConditionBreak(
      [score("A", "20", 5), score("B", "40", 4)],
      CONTEXT,
    );
    expect(result[0].raw).toBe(5);
    expect(result[1].raw).toBe(4);
  });

  it("abstains on an exact tie without a distinctive co-occurrence signal", () => {
    const result = applyNumericTieConditionBreak(
      [score("A", "20", 5), score("B", "40", 5)],
      { ...CONTEXT, question: "доза составляет" },
    );
    expect(result[0].raw).toBe(5);
    expect(result[1].raw).toBe(5);
  });

  it("does not act in multi mode", () => {
    const result = applyNumericTieConditionBreak(
      [score("A", "20", 5), score("B", "40", 5)],
      { ...CONTEXT, mode: "multi" },
    );
    expect(result[0].raw).toBe(5);
    expect(result[1].raw).toBe(5);
  });
});
