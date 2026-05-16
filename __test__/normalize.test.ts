import { describe, expect, it } from "vitest";
import { normalizeForSearch, tokenize } from "../src/normalize.js";

describe("normalize", () => {
  it("aligns Greek letter symbols and Russian letter names", () => {
    const russianAlpha = normalizeForSearch("\u0438\u043d\u0433\u0438\u0431\u0438\u0442\u043e\u0440\u044b \u0424\u041d\u041e-\u0430\u043b\u044c\u0444\u0430");
    const greekAlpha = normalizeForSearch("\u0438\u043d\u0433\u0438\u0431\u0438\u0442\u043e\u0440\u044b \u0424\u041d\u041e-\u03b1");

    expect(russianAlpha).toBe(greekAlpha);
  });

  it("drops numeric reference marks before sentence punctuation", () => {
    const tokens = tokenize(
      "\u0414\u0440\u0443\u0433\u0438\u0435 \u0438\u043d\u0433\u0438\u0431\u0438\u0442\u043e\u0440\u044b \u0424\u041d\u041e-\u03b1 \u0438\u043c\u0435\u044e\u0442 \u043d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u044b\u0439 \u043e\u043f\u044b\u0442 \u043f\u0440\u0438\u043c\u0435\u043d\u0435\u043d\u0438\u044f [151].",
    );

    expect(tokens).not.toContain("151");
  });
});
