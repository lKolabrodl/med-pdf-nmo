import { describe, expect, it } from "vitest";
import { resolveRecommendationProposition } from "../src/predictor/scorers/recommendation-proposition/index.js";

function pages(lines: string[]) {
  return [{ page: 1, lines }];
}

describe("atomic recommendation proposition resolver", () => {
  it("prefers an unrestricted affirmative answer over type-restricted alternatives", () => {
    const resolved = resolveRecommendationProposition({
      mode: "single",
      pages: pages([
        "• Во время вмешательства как при открытом, так и при эндоскопическом доступе рекомендуется сохранять структуру Альфа.",
        "Уровень убедительности рекомендаций - B.",
      ]),
      question: "Рекомендуется ли сохранять структуру Альфа во время вмешательства?",
      answers: [
        { id: "A", text: "рекомендуется только при состоянии 1 типа" },
        { id: "B", text: "не рекомендуется" },
        { id: "C", text: "рекомендуется во всех случаях" },
      ],
    });

    expect([...resolved.keys()]).toEqual(["C"]);
    expect(resolved.get("C")?.evidence?.kind).toBe("recommendation_proposition");
  });

  it("binds negation to a contraindication predicate", () => {
    const resolved = resolveRecommendationProposition({
      mode: "single",
      pages: pages([
        "• Состояние Бета рекомендуется не считать противопоказанием для хирургического лечения.",
        "Уровень убедительности рекомендаций - C.",
      ]),
      question: "Является ли состояние Бета противопоказанием для хирургического лечения?",
      answers: [
        { id: "A", text: "является" },
        { id: "B", text: "является только при состоянии 1 типа" },
        { id: "C", text: "не является" },
      ],
    });

    expect([...resolved.keys()]).toEqual(["C"]);
  });

  it("abstains when two distinct recommendation targets are equally plausible", () => {
    const resolved = resolveRecommendationProposition({
      mode: "single",
      pages: [
        { page: 1, lines: ["• При состоянии Гамма рекомендуется процедура Дельта."] },
        { page: 2, lines: ["• При состоянии Гамма не рекомендуется процедура Дельта."] },
      ],
      question: "Рекомендуется ли процедура Дельта при состоянии Гамма?",
      answers: [
        { id: "A", text: "рекомендуется" },
        { id: "B", text: "не рекомендуется" },
      ],
    });

    expect(resolved).toEqual(new Map());
  });

  it("abstains when an all-population determiner is conditionally restricted", () => {
    const resolved = resolveRecommendationProposition({
      mode: "single",
      pages: pages([
        " Рекомендовано всем участникам при наличии допуска выполнять контрольное упражнение.",
        "Уровень убедительности рекомендаций - C.",
      ]),
      question: "Кому рекомендовано выполнять контрольное упражнение?",
      answers: [
        { id: "A", text: "всем участникам" },
        { id: "B", text: "только участникам при наличии допуска" },
        { id: "C", text: "никому" },
      ],
    });

    expect(resolved).toEqual(new Map());
  });

  it("does not merge an unbound bullet heading with the next recommendation", () => {
    const resolved = resolveRecommendationProposition({
      mode: "single",
      pages: pages([
        " Выполнение контрольного упражнения",
        "рекомендуется всем участникам независимо от уровня подготовки.",
        "Уровень убедительности рекомендаций - C.",
        " Выполнение другого упражнения",
        "рекомендуется только инструкторам.",
      ]),
      question: "Кому рекомендуется выполнение контрольного упражнения?",
      answers: [
        { id: "A", text: "только инструкторам" },
        { id: "B", text: "всем участникам независимо от уровня подготовки" },
        { id: "C", text: "никому" },
      ],
    });

    expect(resolved).toEqual(new Map());
  });

  it("accepts a wrapped recommendation when one physical block proves its boundary", () => {
    const resolved = resolveRecommendationProposition({
      mode: "single",
      pages: [
        {
          page: 1,
          lines: [
            "• Выполнение контрольного упражнения",
            "рекомендуется всем участникам независимо от уровня подготовки.",
          ],
          blocks: [
            {
              text: "• Выполнение контрольного упражнения рекомендуется всем участникам независимо от уровня подготовки.",
              lineStart: 0,
              lineEnd: 1,
            },
          ],
        },
      ],
      question: "Кому рекомендуется выполнение контрольного упражнения?",
      answers: [
        { id: "A", text: "только инструкторам" },
        { id: "B", text: "всем участникам независимо от уровня подготовки" },
        { id: "C", text: "никому" },
      ],
    });

    expect([...resolved.keys()]).toEqual(["B"]);
  });

  it("uses a soft rare-token anchor across grammatical endings", () => {
    const resolved = resolveRecommendationProposition({
      mode: "single",
      pages: [
        { page: 1, lines: ["• Проверка восходящей секции рекомендуется только инструкторам."] },
        { page: 2, lines: ["• Реконструкция восходящего модуля рекомендуется всем участникам независимо от уровня подготовки."] },
      ],
      question: "Кому рекомендуется реконструкция восходящего модуля?",
      answers: [
        { id: "A", text: "только инструкторам" },
        { id: "B", text: "всем участникам независимо от уровня подготовки" },
      ],
    });

    expect([...resolved.keys()]).toEqual(["B"]);
  });

  it("defers two different restricted conditions to lexical matching", () => {
    const resolved = resolveRecommendationProposition({
      mode: "single",
      pages: pages([
        "• Контрольное исследование рекомендовано только для наблюдения после вмешательства.",
      ]),
      question: "Когда рекомендовано контрольное исследование?",
      answers: [
        { id: "A", text: "только участникам первой группы" },
        { id: "B", text: "только для наблюдения после вмешательства" },
        { id: "C", text: "во всех случаях" },
      ],
    });

    expect(resolved).toEqual(new Map());
  });
});
