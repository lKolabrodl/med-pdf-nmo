import { describe, expect, it } from "vitest";
import { buildHierarchicalListClusters, resolveHierarchicalList } from "../src/predictor/scorers/hierarchical-list/index.js";

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

  it("parses compact roman parents and decimal children without reversing negation", () => {
    const compact = [
      {
        page: 1,
        lines: [
          "I.Состояния, не связанные с нагрузкой:",
          "1.1 альфа реакция с дополнительным описанием;",
          "1.2 бета реакция с дополнительным описанием.",
          "II.Состояния, связанные с нагрузкой:",
          "2.1 гамма реакция с дополнительным описанием;",
          "2.2 дельта реакция с дополнительным описанием.",
        ],
      },
    ];
    const answers = [
      { id: "A", text: "альфа реакция" },
      { id: "B", text: "бета реакция" },
      { id: "C", text: "гамма реакция" },
      { id: "D", text: "дельта реакция" },
    ];
    const negative = resolveHierarchicalList({
      mode: "multi",
      pages: compact,
      question: "К состояниям, не связанным с нагрузкой, относятся",
      answers,
    });
    const positive = resolveHierarchicalList({
      mode: "multi",
      pages: compact,
      question: "К состояниям, связанным с нагрузкой, относятся",
      answers,
    });

    expect([...negative.entries()].filter(([, item]) => item.evidence).map(([id]) => id)).toEqual(["A", "B"]);
    expect([...positive.entries()].filter(([, item]) => item.evidence).map(([id]) => id)).toEqual(["C", "D"]);
  });
});
