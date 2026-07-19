import { describe, expect, it } from "vitest";
import { uniqueTokens } from "../src/normalize.js";
import { buildSiblingListBlocks, resolveSiblingList } from "../src/predictor/scorers/sibling-list.js";

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
});
