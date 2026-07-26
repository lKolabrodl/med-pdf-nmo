import {describe, expect, it} from "vitest";
import {uniqueTokens} from "../../../normalize.js";
import {defineScorerFunctionContract, scorerTestPage} from "../../../../__test__/scorer-test-support.js";
import {cachedLineTokenSegments, questionFocusTokens} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "questionFocusTokens",
    "cueFocusTokens",
    "bestFocusedSupport",
    "lineTokenSegments",
    "cachedLineTokenSegments",
    "bestLineTokenSupport",
    "limitedCuePenalty",
  ],
});

describe("focused text helpers", () => {
  it("extracts stable focus tokens and caches physical-line segments", () => {
    const tokens = questionFocusTokens("Какие признаки характерны для редкого альфа-синдрома?");
    const page = scorerTestPage(1, [
      "Альфа-синдром имеет устойчивый первый признак.",
      "Дополнительный второй признак встречается реже.",
    ]);

    expect(tokens).toContain(uniqueTokens("альфа")[0]);
    expect(cachedLineTokenSegments(page)).toBe(cachedLineTokenSegments(page));
    expect(cachedLineTokenSegments(page).length).toBeGreaterThan(0);
  });
});
