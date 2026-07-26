import {describe, expect, it} from "vitest";
import {defineScorerFunctionContract} from "../../../../__test__/scorer-test-support.js";
import {lineTokenApplicable, numberSpecificity} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "questionPrefixes",
    "bestPrefixSupport",
    "bestChunkSupport",
    "normalizeBm25",
    "numberSpecificity",
    "lineTokenApplicable",
    "questionRiskCondition",
    "windowRiskCondition",
    "primaryNumberPhrase",
    "riskConditionAdjustment",
    "genericPopulationAnswer",
    "genericPopulationConditionAdjustment",
    "genericPopulationConditionAdjustmentForMode",
    "populationStem",
    "hasSpecificPopulationAlternative",
    "questionClassSubject",
    "romanClassVariants",
    "bestClassSubjectSupport",
  ],
});

describe("search-support gates", () => {
  it("gates broad line matching and measures numeric specificity", () => {
    expect(
      lineTokenApplicable({
        mode: "single",
        question: "Альфа-синдром является заболеванием",
        answer: {id: "A", text: "редкое наследственное состояние"},
        intent: {numeric: false},
      }),
    ).toBe(true);
    expect(
      lineTokenApplicable({
        mode: "single",
        question: "Альфа-синдром является заболеванием",
        answer: {id: "A", text: "10 мг"},
        intent: {numeric: true},
      }),
    ).toBe(false);
    expect(numberSpecificity("10 мг 2 раза 7 дней")).toBe(1);
  });
});
