import { describe, expect, it } from "vitest";
import { buildAtomicRecommendationSegments } from "../src/predictor/scorers/recommendation-item.js";

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

});
