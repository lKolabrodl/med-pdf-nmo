import { describe, expect, it } from "vitest";
import { uniqueTokens } from "../src/normalize.js";
import { buildSiblingListBlocks, resolveSiblingList } from "../src/predictor/scorers/sibling-list.js";
import { resolveRiskFactorList } from "../src/predictor/scorers/risk-factor-list.js";

function pages(lines: string[]) {
  return [
    {
      page: 1,
      lines,
    },
  ];
}

describe("sibling-list resolver", () => {
  it("keeps members inside the question-named sibling block", () => {
    const source = pages([
      "Классификация по происхождению",
      "- Наследственная форма. Альфа-синдром и Бета-синдром встречаются в этой категории.",
      "- Приобретенная форма. Гамма-синдром и Дельта-синдром относятся к этой категории.",
    ]);
    const answers = [
      { id: "A", text: "Альфа-синдром" },
      { id: "B", text: "Бета-синдром" },
      { id: "C", text: "Гамма-синдром" },
      { id: "D", text: "Дельта-синдром" },
    ];
    const resolved = resolveSiblingList({
      mode: "multi",
      pages: source,
      question: "К наследственной форме относятся",
      answers,
      enableMultiMembership: true,
    });

    expect([...resolved.keys()]).toEqual(["A", "B"]);
    expect(resolved.get("A")?.evidence?.kind).toBe("sibling_list_member");
  });

  it("maps a body description back to one sibling label", () => {
    const source = pages([
      "- Локальная. Вовлечена одна анатомическая область.",
      "- Сегментарная. Вовлечены две соседние анатомические области.",
      "- Распространенная. Вовлечены несколько несмежных областей.",
    ]);
    const answers = [
      { id: "A", text: "локальной" },
      { id: "B", text: "сегментарной" },
      { id: "C", text: "распространенной" },
    ];
    const resolved = resolveSiblingList({
      mode: "single",
      pages: source,
      question: "Вовлечение двух соседних анатомических областей относится к ____ форме",
      answers,
      focusTokens: uniqueTokens("вовлечены две соседние анатомические области"),
      enableSingleInverse: true,
    });

    expect([...resolved.keys()]).toEqual(["B"]);
    expect(resolved.get("B")?.evidence?.kind).toBe("sibling_list_label");
  });

  it("abstains for an isolated bullet without sibling contrast", () => {
    const source = pages(["- Наследственная форма. Альфа-синдром и Бета-синдром."]);
    expect(buildSiblingListBlocks(source)).toEqual([]);
  });

  it("maps a numbered classification row to its unique description", () => {
    const source = pages([
      "Состояние I степени: первый ограниченный признак.",
      "Состояние II степени: второй характерный признак.",
      "Состояние III степени: третий распространенный признак.",
    ]);
    const answers = [
      { id: "A", text: "первый ограниченный признак" },
      { id: "B", text: "второй характерный признак" },
      { id: "C", text: "третий распространенный признак" },
    ];
    const resolved = resolveSiblingList({
      mode: "single",
      pages: source,
      question: "Дайте характеристику состояния II степени",
      answers,
      enableSingleInverse: true,
    });

    expect([...resolved.keys()]).toEqual(["B"]);
    expect(resolved.get("B")?.evidence?.kind).toBe("sibling_list_body");
  });

  it("canonicalizes roman source labels and digit answer labels", () => {
    const source = pages([
      "Тип I - первый отличительный признак.",
      "Тип II - второй отличительный признак.",
      "Тип III - третий отличительный признак.",
    ]);
    const answers = [
      { id: "A", text: "1 тип" },
      { id: "B", text: "2 тип" },
      { id: "C", text: "3 тип" },
    ];
    const resolved = resolveSiblingList({
      mode: "single",
      pages: source,
      question: "Описание содержит второй отличительный признак. Какой это тип?",
      answers,
      focusTokens: uniqueTokens("второй отличительный признак"),
      enableSingleInverse: true,
    });

    expect([...resolved.keys()]).toEqual(["B"]);
    expect(resolved.get("B")?.evidence?.kind).toBe("sibling_list_label");
  });

  it("keeps qualitative degree descriptions inside their labelled bullets", () => {
    const source = pages([
      "• легкая степень (редкий слабый признак);",
      "• средняя степень тяжести (устойчивый выраженный признак);",
      "• тяжелая степень (осложненный распространенный признак).",
    ]);
    const answers = [
      { id: "A", text: "редкий слабый признак" },
      { id: "B", text: "устойчивый выраженный признак" },
      { id: "C", text: "осложненный распространенный признак" },
    ];
    const resolved = resolveSiblingList({
      mode: "single",
      pages: source,
      question: "Дайте характеристику средней степени тяжести",
      answers,
      enableSingleInverse: true,
    });

    expect([...resolved.keys()]).toEqual(["B"]);
  });

  it("expands an explicit plus-reference only for the queried target row", () => {
    const source = pages([
      "Тип I - первый базовый признак.",
      "Тип II - второй базовый признак.",
      "Тип III - первый и второй базовые признаки вместе.",
      "Тип IV: тип III + дополнительный отдельный признак.",
    ]);
    const answers = [
      { id: "A", text: "первый базовый признак" },
      { id: "B", text: "второй базовый признак" },
      { id: "C", text: "первый и второй базовые признаки вместе, дополнительный отдельный признак" },
    ];
    const resolved = resolveSiblingList({
      mode: "single",
      pages: source,
      question: "Дайте характеристику типа IV",
      answers,
      enableSingleInverse: true,
    });

    expect([...resolved.keys()]).toEqual(["C"]);
  });

  it("does not let stage zero match a different stage", () => {
    const resolved = resolveSiblingList({
      mode: "single",
      pages: pages([
        "СТАДИЯ 0 Нет изменений в контрольной области.",
        "СТАДИЯ II Выраженные изменения в контрольной области.",
      ]),
      question: "Согласно классификации, стадия II характеризуется",
      answers: [
        { id: "A", text: "отсутствием изменений в контрольной области" },
        { id: "B", text: "выраженными изменениями в контрольной области" },
      ],
      enableSingleInverse: true,
    });

    expect([...resolved.keys()]).not.toContain("A");
  });

  it("keeps the direction of an explicit risk-factor relation", () => {
    const source = pages([
      "Факторами риска развития АБС являются:",
      "– прием вещества Альфа;",
      "– прием вещества Бета.",
      "Показано, что АБС является фактором риска развития обратного осложнения.",
    ]);
    const resolved = resolveRiskFactorList({
      mode: "multi",
      pdfText: {
        abbreviations: [{ abbr: "АБС", expansion: "альфа-бета состояние", page: 1 }],
      },
      pages: source,
      topQuestionPages: new Set([1]),
      question: "Среди факторов риска развития альфа-бета состояния выделяют",
      answers: [
        { id: "A", text: "случайный признак" },
        { id: "B", text: "прием вещества Альфа" },
        { id: "C", text: "обратное осложнение" },
        { id: "D", text: "прием вещества Бета" },
      ],
    });

    expect([...resolved.keys()]).toEqual(["B", "D"]);
    expect(resolved.has("C")).toBe(false);
    expect(resolved.get("B")?.evidence.kind).toBe("risk_factor_list_member");
  });
});
