import {describe, expect, it} from "vitest";
import {scorerTestContext, scorerTestPage} from "../../../../__test__/scorer-test-support.js";
import {uniqueTokens} from "../../../normalize.js";
import {resolveContrastiveOptionFamily} from "./contrastive.js";

function contextFor(text: string, question = "Порог температуры датчика в градусах составляет") {
  return scorerTestContext({
    question,
    questionTokens: uniqueTokens(question),
    focusTokens: uniqueTokens(question),
    answers: [{id: "A", text: "10 градусов"}, {id: "B", text: "20 градусов"}, {id: "C", text: "30 градусов"}],
    pages: [scorerTestPage(1, [text])],
  });
}

describe("contrastive option proof invariants", () => {
  it("proves the varying quantity with its explicit unit", () => {
    expect(resolveContrastiveOptionFamily(contextFor("Порог температуры датчика составляет 20 градусов."))?.answerId).toBe("B");
  });
  it("abstains on another explicit unit even with exact shared context", () => {
    expect(resolveContrastiveOptionFamily(contextFor("Порог температуры датчика составляет 20 мг."))).toBeNull();
  });
  it("does not take a negated value as positive support", () => {
    expect(resolveContrastiveOptionFamily(contextFor("Порог температуры датчика не составляет 20 градусов."))).toBeNull();
  });
  it("does not combine competing values into a unique proof", () => {
    expect(resolveContrastiveOptionFamily(contextFor("Порог температуры датчика составляет 20 или 30 градусов."))).toBeNull();
  });
  it("preserves the outcome under answer order and id changes", () => {
    const context = contextFor("Порог температуры датчика составляет 20 градусов.");
    context.answers = [{id: "x", text: "30 градусов"}, {id: "y", text: "10 градусов"}, {id: "z", text: "20 градусов"}];
    expect(resolveContrastiveOptionFamily(context)?.answerId).toBe("z");
  });
  it("does not apply a single-answer proof to multi mode", () => {
    const context = contextFor("Порог температуры датчика составляет 20 градусов.");
    context.mode = "multi";
    expect(resolveContrastiveOptionFamily(context)).toBeNull();
  });
  it("preserves a negative numeric sign without confusing it with prose negation", () => {
    const context = contextFor("Порог температуры датчика составляет -20 градусов.");
    context.answers = [{id: "A", text: "-20 градусов"}, {id: "B", text: "20 градусов"}, {id: "C", text: "30 градусов"}];
    expect(resolveContrastiveOptionFamily(context)?.answerId).toBe("A");
  });
  it("requires every changing attribute, not just the number or the color", () => {
    const context = contextFor("Модель датчика альфа имеет красный корпус и массу 20 мг.", "Описание модели датчика альфа");
    context.answers = [{id: "A", text: "красный корпус 10 мг"}, {id: "B", text: "синий корпус 20 мг"}, {id: "C", text: "зеленый корпус 30 мг"}];
    expect(resolveContrastiveOptionFamily(context)).toBeNull();
  });
  it("rejects a number-only match when the changing textual attribute is absent", () => {
    const context = contextFor("Модель датчика альфа имеет красный корпус и массу 20 мг.", "Описание модели датчика альфа");
    context.answers = [{id: "A", text: "синий корпус 20 мг"}, {id: "B", text: "зеленый корпус 30 мг"}, {id: "C", text: "желтый корпус 40 мг"}];
    expect(resolveContrastiveOptionFamily(context)).toBeNull();
  });
  it("checks numeric attributes even when two options share a number", () => {
    const context = contextFor("Модель датчика альфа имеет красный корпус и массу 20 мг.", "Описание модели датчика альфа");
    context.answers = [{id: "A", text: "красный корпус 10 мг"}, {id: "B", text: "синий корпус 10 мг"}, {id: "C", text: "зеленый корпус 20 мг"}];
    expect(resolveContrastiveOptionFamily(context)).toBeNull();
  });
  it("does not discard a numeric attribute shared by all options", () => {
    const context = contextFor("Модель датчика альфа имеет красный корпус и массу 20 мг.", "Описание модели датчика альфа");
    context.answers = [{id: "A", text: "красный корпус 10 мг"}, {id: "B", text: "синий корпус 10 мг"}, {id: "C", text: "зеленый корпус 10 мг"}];
    expect(resolveContrastiveOptionFamily(context)).toBeNull();
  });
  it("preserves the direction of a negated upper bound", () => {
    const context = contextFor("Порог температуры датчика составляет не более 20 градусов.");
    context.answers = [{id: "A", text: "более 10 градусов"}, {id: "B", text: "более 20 градусов"}, {id: "C", text: "более 30 градусов"}];
    expect(resolveContrastiveOptionFamily(context)).toBeNull();
  });
  it("requires all changing lexical attributes of a long option", () => {
    const context = contextFor("Модель датчика альфа имеет красный круглый маленький корпус.", "Описание модели датчика альфа");
    context.answers = [
      {id: "A", text: "красный круглый маленький гладкий корпус"},
      {id: "B", text: "синий квадратный большой шероховатый корпус"},
      {id: "C", text: "зеленый овальный огромный неровный корпус"},
    ];
    expect(resolveContrastiveOptionFamily(context)).toBeNull();
  });
  it("does not replace an inclusive comparison with a strict one", () => {
    const context = contextFor("Порог температуры датчика составляет не менее 20 градусов.");
    context.answers = [{id: "A", text: "более 10 градусов"}, {id: "B", text: "более 20 градусов"}, {id: "C", text: "более 30 градусов"}];
    expect(resolveContrastiveOptionFamily(context)).toBeNull();
  });
  it("matches equivalent symbolic and verbal inclusive bounds", () => {
    const context = contextFor("Порог температуры датчика составляет не менее 20 градусов.");
    context.answers = [{id: "A", text: "≥10 градусов"}, {id: "B", text: "≥20 градусов"}, {id: "C", text: "≥30 градусов"}];
    expect(resolveContrastiveOptionFamily(context)?.answerId).toBe("B");
  });
  it("does not drop an explicit uppercase identifier from the question", () => {
    const context = contextFor("Порог температуры датчика составляет 20 градусов.", "Порог температуры датчика КЛМ в градусах составляет");
    expect(resolveContrastiveOptionFamily(context)).toBeNull();
  });
  it("accepts a local proof containing the requested uppercase identifier", () => {
    const context = contextFor("Порог температуры датчика КЛМ составляет 20 градусов.", "Порог температуры датчика КЛМ в градусах составляет");
    expect(resolveContrastiveOptionFamily(context)?.answerId).toBe("B");
  });
  it("does not interpret an entirely uppercased question as a list of abbreviations", () => {
    const context = contextFor("Порог температуры датчика составляет 20 градусов.", "ПОРОГ ТЕМПЕРАТУРЫ ДАТЧИКА В ГРАДУСАХ СОСТАВЛЯЕТ");
    expect(resolveContrastiveOptionFamily(context)?.answerId).toBe("B");
  });
});
