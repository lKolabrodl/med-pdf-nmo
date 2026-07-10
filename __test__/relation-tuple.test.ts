import { describe, expect, it } from "vitest";
import {
  applySingleRelationTupleResolver,
  buildRelationTupleFragments,
  resolveRelationTuple,
} from "../src/predictor/scorers/relation-tuple.js";

function answers(values: string[]) {
  return values.map((text, index) => ({ id: String.fromCharCode(65 + index), text }));
}

function resolve(question: string, values: string[], text: string, mode = "single") {
  return resolveRelationTuple({ mode, question, answers: answers(values), fragments: [{ page: 1, text }] });
}

describe("relation tuple resolver", () => {
  it("binds a maximum daily dose instead of a nearby ordinary dose", () => {
    const result = resolve(
      "Максимальная суточная доза Альфазола составляет",
      ["500 мг", "1000 мг", "4000 мг", "6000 мг"],
      "Альфазол назначают по 500-1000 мг до 4 раз/сут; максимальная суточная доза Альфазола - 4000 мг.",
    );
    expect(result?.answerId).toBe("C");
  });

  it("keeps child and adult population scopes separate", () => {
    const result = resolve(
      "Распространенность болезни у детей составляет",
      ["5-37%", "15-63%", "1-2%", "8-14%"],
      "Распространенность болезни у взрослых - 5-37%, у детей - 15-63%.",
    );
    expect(result?.answerId).toBe("B");
  });

  it("keeps systolic and diastolic metric scopes separate", () => {
    const result = resolve(
      "Нестабильная гемодинамика характеризуется диастолическим давлением менее",
      ["90 мм рт. ст.", "60 мм рт. ст.", "70 мм рт. ст.", "80 мм рт. ст."],
      "Нестабильная гемодинамика: систолическое давление менее 90 мм рт. ст. или диастолическое давление менее 60 мм рт. ст.",
    );
    expect(result?.answerId).toBe("B");
  });

  it("binds maintenance phase and required weight condition", () => {
    const result = resolve(
      "Поддерживающая доза Медивира при массе 75 кг и более составляет",
      [
        "200 мг 2 раза/сут со 2 по 10 день",
        "800 мг 2 раза/сут со 2 по 10 день",
        "400 мг 2 раза/сут со 2 по 10 день",
        "600 мг 2 раза/сут со 2 по 10 день",
      ],
      "Для Медивира при массе менее 75 кг: стартовая доза 1600 мг, далее 600 мг 2 раза/сут со 2 по 10 день. Для Медивира при массе 75 кг и более: стартовая доза 1800 мг, далее 800 мг 2 раза/сут со 2 по 10 день.",
    );
    expect(result?.answerId).toBe("B");
  });

  it("binds an ordinal row to its predicate", () => {
    const result = resolve(
      "Выпадение узлов с самостоятельным вправлением характерно для",
      ["2 стадии", "1 стадии", "3 стадии", "4 стадии"],
      "2 стадия: выпадение узлов с самостоятельным вправлением.",
    );
    expect(result?.answerId).toBe("A");
  });

  it("abstains when the question does not identify a relation role", () => {
    const result = resolve(
      "Рекомендуемая доза Альфазола составляет",
      ["10 мг", "20 мг", "30 мг"],
      "Стартовая доза Альфазола 10 мг, поддерживающая 20 мг, максимальная 30 мг.",
    );
    expect(result).toBeNull();
  });

  it("does not resolve multi questions", () => {
    expect(resolve("Максимальная доза Альфазола составляет", ["10 мг", "20 мг", "30 мг"], "Максимальная доза Альфазола 20 мг.", "multi")).toBeNull();
  });

  it("rejects families with answer-specific subjects or mixed exact units", () => {
    expect(
      resolve(
        "Максимальная доза Альфазола составляет",
        ["10 мг препарата альфа", "20 мг препарата бета", "30 мг препарата гамма"],
        "Максимальная доза Альфазола составляет 20 мг.",
      ),
    ).toBeNull();
    expect(resolve("Максимальная доза Альфазола составляет", ["10 мл", "20 мг", "30 г"], "Максимальная доза Альфазола 20 мг.")).toBeNull();
  });

  it("does not confuse a condition number with an answer value", () => {
    expect(
      resolve(
        "Максимальная доза Альфазола при массе 20 кг составляет",
        ["20 мг", "40 мг", "60 мг"],
        "При массе 20 кг максимальная доза Альфазола составляет 45 мг.",
      ),
    ).toBeNull();
  });

  it("requires the subject in the same bounded clause", () => {
    expect(
      resolve(
        "Максимальная доза Альфазола составляет",
        ["10 мг", "20 мг", "30 мг"],
        "Альфазол применяется для лечения. Максимальная доза Бетазола составляет 20 мг.",
      ),
    ).toBeNull();
  });

  it("handles negated comparators before plain comparator cues", () => {
    expect(
      resolve(
        "Диастолическое давление не менее",
        ["90 мм рт. ст.", "60 мм рт. ст.", "70 мм рт. ст."],
        "Диастолическое давление менее 90 мм рт. ст.",
      ),
    ).toBeNull();
  });

  it("keeps a bullet start with its physical-line continuation", () => {
    const fragments = buildRelationTupleFragments(
      [{ page: 1, lines: ["• Максимальная доза Альфазола составляет", "20 мг."] }],
      new Set([1]),
    );
    expect(fragments.some((fragment) => fragment.text.includes("составляет 20 мг"))).toBe(true);
  });

  it("does not override a distant trusted structural winner", () => {
    const opts = answers(["10 мг", "20 мг", "30 мг"]);
    const scores = [
      {
        answer: opts[0],
        raw: 100,
        evidence: [{ answerId: "A", page: 1, text: "trusted row", score: 20, kind: "coordinate_table_row" }],
      },
      { answer: opts[1], raw: 1, evidence: [] },
      { answer: opts[2], raw: 0.5, evidence: [] },
    ];
    const adjusted = applySingleRelationTupleResolver(scores, {
      mode: "single",
      pages: [{ page: 1, lines: ["Максимальная доза Альфазола составляет 20 мг."] }],
      topQuestionPages: new Set([1]),
      question: "Максимальная доза Альфазола составляет",
      answers: opts,
    });
    expect(adjusted.map((item) => item.raw)).toEqual([100, 1, 0.5]);
  });
});
