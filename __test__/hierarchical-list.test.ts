import { describe, expect, it } from "vitest";
import { buildHierarchicalListClusters, resolveHierarchicalList } from "../src/predictor/scorers/hierarchical-list.js";

const source = [
  {
    page: 1,
    lines: [
      "I. Первая локальная форма:",
      "1) альфа-вариант состояния;",
      "2) бета-вариант состояния.",
      "II. Вторая распространенная форма:",
      "1) гамма-вариант состояния;",
    ],
  },
  {
    page: 2,
    lines: ["2) дельта-вариант состояния;", "3) эпсилон-вариант состояния."],
  },
];

describe("hierarchical list resolver", () => {
  it("reconstructs consecutive roman parents and numbered children across a page", () => {
    const clusters = buildHierarchicalListClusters(source);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].map((parent) => parent.children.length)).toEqual([2, 3]);
  });

  it("selects only children of the question-named parent", () => {
    const answers = [
      { id: "A", text: "альфа-вариант состояния" },
      { id: "B", text: "гамма-вариант состояния" },
      { id: "C", text: "дельта-вариант состояния" },
      { id: "D", text: "эпсилон-вариант состояния" },
    ];
    const resolved = resolveHierarchicalList({
      mode: "multi",
      pages: source,
      question: "Перечислите варианты второй распространенной формы",
      answers,
    });

    expect([...resolved.entries()].filter(([, item]) => item.evidence).map(([id]) => id)).toEqual(["B", "C", "D"]);
    expect(resolved.get("A")?.adjustment).toBeLessThan(0);
  });

  it("abstains when there is no sibling parent contrast", () => {
    const isolated = [{ page: 1, lines: ["I. Единственная форма:", "1) альфа-вариант;", "2) бета-вариант."] }];
    expect(
      resolveHierarchicalList({
        mode: "multi",
        pages: isolated,
        question: "Перечислите варианты единственной формы",
        answers: [
          { id: "A", text: "альфа-вариант" },
          { id: "B", text: "бета-вариант" },
          { id: "C", text: "гамма-вариант" },
        ],
      }),
    ).toEqual(new Map());
  });
});
