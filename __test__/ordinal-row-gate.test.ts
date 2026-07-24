import { describe, expect, it } from "vitest";
import { answerOrdinalRowApplicable } from "../src/predictor/scorers/ordinal-row-gate/index.js";

describe("answer ordinal row gate", () => {
  it("accepts options that directly name a classification row", () => {
    expect(
      answerOrdinalRowApplicable({
        question: "Какой стадии соответствует описание?",
        answerText: "2 стадии хронического состояния",
        label: { kind: "stage", number: 2 },
      }),
    ).toBe(true);
    expect(
      answerOrdinalRowApplicable({
        question: "Какой стадии соответствует описание?",
        answerText: "1Б стадии",
        label: { kind: "stage", number: 1 },
      }),
    ).toBe(true);
    expect(
      answerOrdinalRowApplicable({
        question: "Какой тип соответствует описанию?",
        answerText: "тип III — развернутое описание",
        label: { kind: "type", number: 3 },
      }),
    ).toBe(true);
  });

  it("rejects ordinals used only as answer conditions", () => {
    expect(
      answerOrdinalRowApplicable({
        question: "Кому рекомендовано вмешательство?",
        answerText: "только пациентам с заболеванием 1 типа",
        label: { kind: "type", number: 1 },
      }),
    ).toBe(false);
  });

  it("does not use a row mapper to answer a count question", () => {
    expect(
      answerOrdinalRowApplicable({
        question: "Сколько типов выделяют в классификации?",
        answerText: "2 типа",
        label: { kind: "type", number: 2 },
      }),
    ).toBe(false);
  });
});
