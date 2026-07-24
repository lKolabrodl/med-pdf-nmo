import { describe, expect, it } from "vitest";
import { buildAtomicRecommendationSegments } from "../src/predictor/scorers/recommendation-item/index.js";
import { resolveRepeatedRecommendationSet } from "../src/predictor/scorers/recommendation-set/index.js";

function page(lines: string[]) {
  return { page: 1, lines, text: lines.join("\n") };
}

describe("atomic recommendation segments", () => {
  it("stops before evidence grade, comments, and the next recommendation", () => {
    const segments = buildAtomicRecommendationSegments([
      page([
        "Пациентам с хроническим состоянием и выраженным симптомом рекомендуется назначать средство альфа.",
        "Уровень убедительности рекомендаций C (уровень достоверности доказательств – 5).",
        "Комментарии: средство бета обсуждается отдельно.",
        "При другом состоянии рекомендуется назначать средство гамма.",
      ]),
    ]);

    expect(segments).toHaveLength(2);
    expect(segments[0].text).toContain("средство альфа");
    expect(segments[0].text).not.toContain("Уровень убедительности");
    expect(segments[0].text).not.toContain("средство бета");
    expect(segments[0].text).not.toContain("средство гамма");
  });

  it("keeps a bare numeric dose continuation inside the item", () => {
    const segments = buildAtomicRecommendationSegments([
      page(["Пациентам с выраженным симптомом рекомендуется средство в дозе", "5 мг ежедневно в течение недели.", "УУР C, УДД 5."]),
    ]);

    expect(segments).toHaveLength(1);
    expect(segments[0].text).toContain("5 мг ежедневно");
  });

  it("collects targets from repeated recommendations with one patient context", () => {
    const source = [
      page([
        "Рекомендуется исследование Альфа всем пациентам с осложненным состоянием при подготовке к процедуре.",
        "Уровень убедительности рекомендаций C.",
        "Рекомендуется регистрация электрофизиограммы всем пациентам с осложненным состоянием при подготовке к процедуре.",
        "Уровень убедительности рекомендаций C.",
      ]),
    ];
    const resolved = resolveRepeatedRecommendationSet({
      mode: "multi",
      pages: source,
      question: "Всем пациентам с осложненным состоянием при подготовке к процедуре рекомендовано проведение",
      answers: [
        { id: "A", text: "исследования Гамма" },
        { id: "B", text: "исследования Альфа" },
        { id: "C", text: "электрофизиографии" },
        { id: "D", text: "оценки показателя Дельта" },
      ],
    });

    expect([...resolved.keys()]).toEqual(["B", "C"]);
    expect(resolved.get("B")?.evidence.kind).toBe("repeated_recommendation_target");
  });

  it("abstains from set decoding when only one recommendation matches", () => {
    const resolved = resolveRepeatedRecommendationSet({
      mode: "multi",
      pages: [page(["Рекомендуется исследование Альфа всем пациентам с осложненным состоянием при подготовке к процедуре."])],
      question: "Всем пациентам с осложненным состоянием при подготовке к процедуре рекомендовано проведение",
      answers: [
        { id: "A", text: "исследования Альфа" },
        { id: "B", text: "исследования Бета" },
        { id: "C", text: "исследования Гамма" },
      ],
    });

    expect(resolved).toEqual(new Map());
  });

  it("abstains when the question ends with a specific incomplete analyte target", () => {
    const resolved = resolveRepeatedRecommendationSet({
      mode: "multi",
      pages: [
        page([
          "Рекомендуется исследование уровня маркера Альфа всем пациентам с осложненным состоянием при подготовке к процедуре.",
          "Рекомендуется исследование уровня маркера Бета всем пациентам с осложненным состоянием при подготовке к процедуре.",
        ]),
      ],
      question:
        "Всем пациентам с осложненным состоянием при подготовке к процедуре рекомендовано исследование уровня",
      answers: [
        { id: "A", text: "маркера Альфа" },
        { id: "B", text: "маркера Бета" },
        { id: "C", text: "маркера Гамма" },
      ],
    });

    expect(resolved).toEqual(new Map());
  });
});
