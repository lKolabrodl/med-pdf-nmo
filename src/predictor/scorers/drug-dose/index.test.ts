import {describe, expect, it} from "vitest";
import {
  defineScorerFunctionContract,
  scorerTestContext,
  scorerTestPage,
} from "../../../../__test__/scorer-test-support.js";
import {bestDrugDoseSupport} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "doseTokenStartsWithAny",
    "doseContentTokens",
    "questionDoseDrugTokens",
    "drugTokenIndex",
    "doseSlashNumbers",
    "doseNearDrugNumbers",
    "doseAssignedToDrugNumbers",
    "normalizeDoseNumber",
    "answerDoseFact",
    "sourceDoseFacts",
    "doseFactMatchesAnswer",
    "bestDrugDoseSupport",
  ],
});

describe("bestDrugDoseSupport", () => {
  it("binds dose and frequency to the drug named in the question", () => {
    const support = bestDrugDoseSupport(scorerTestContext({
      mode: "single",
      pages: [scorerTestPage(1, ["Alfazol назначают по 500 мг."])],
      question: "Alfazol назначается в дозе",
      answer: {id: "A", text: "500 мг"},
    }));

    expect(support?.kind).toBe("drug_dose_segment");
  });
});
