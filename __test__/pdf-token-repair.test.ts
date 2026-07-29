import {describe, expect, it} from "vitest";
import {repairDocumentSplitTokens, type PdfPage} from "../src/pdf.js";

function page(lines: string[]): PdfPage {
  const text = lines.join("\n");
  return {
    page: 1,
    text,
    lines: [...lines],
    blocks: [],
    lineItems: lines.map((line, index) => ({text: line, y: 100 - index, items: []})),
    normalized: "",
    charLength: text.length,
  };
}

describe("document-internal split-token repair", () => {
  it("joins a split token when the intact form is repeated in the same PDF", () => {
    const source = page([
      "Грыжа передней брюшной стенки.",
      "Повторно описана грыжа.",
      "Диагностирована Гры жа передней брюшной стенки.",
    ]);

    const repairs = repairDocumentSplitTokens([source], 2);

    expect(source.lines[2]).toContain("Грыжа");
    expect(repairs).toHaveLength(1);
    expect(repairs[0].intactFrequency).toBe(2);
  });

  it("does not concatenate an ordinary pair of words without document evidence", () => {
    const source = page([
      "У пациента отмечается острая боль.",
      "Назначено симптоматическое лечение.",
    ]);

    expect(repairDocumentSplitTokens([source], 1)).toEqual([]);
    expect(source.lines[0]).toContain("острая боль");
  });

  it("does not join fragments that are valid independently or contain a number", () => {
    const source = page([
      "Препарат показан дважды: показан.",
      "Маршрут по Казани описан отдельно.",
      "Выделяют тип 2 заболевания.",
    ]);

    expect(repairDocumentSplitTokens([source], 1)).toEqual([]);
    expect(source.lines).toContain("Маршрут по Казани описан отдельно.");
    expect(source.lines).toContain("Выделяют тип 2 заболевания.");
  });

  it("honors the minimum intact-frequency threshold", () => {
    const source = page([
      "Грыжа передней брюшной стенки.",
      "Диагностирована Гры жа.",
    ]);

    expect(repairDocumentSplitTokens([source], 2)).toEqual([]);
    expect(source.lines[1]).toContain("Гры жа");
  });

  it("can restrict repair to structurally marked lines", () => {
    const source = page([
      "Энцефалопатия описана в разделе.",
      "Повторно упомянута энцефалопатия.",
      "I. Энцефал опатия: клинические признаки",
      "В обычном продолжении также написано энцефал опатия.",
    ]);

    const repairs = repairDocumentSplitTokens([source], 2, true);

    expect(repairs).toHaveLength(1);
    expect(source.lines[2]).toContain("Энцефалопатия");
    expect(source.lines[3]).toContain("энцефал опатия");
  });
});
