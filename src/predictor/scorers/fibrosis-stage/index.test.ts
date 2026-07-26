import {describe, expect, it} from "vitest";
import {
  defineScorerFunctionContract,
  scorerTestContext,
  scorerTestPage,
} from "../../../../__test__/scorer-test-support.js";
import {bestFibrosisStageSupport} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "fibrosisDescriptorKey",
    "questionFibrosisStage",
    "answerFibrosisStage",
    "fibrosisRowStage",
    "bestFibrosisStageSupport",
  ],
});

describe("bestFibrosisStageSupport", () => {
  it("binds a fibrosis descriptor to the matching F-stage row", () => {
    const support = bestFibrosisStageSupport(scorerTestContext({
      mode: "single",
      pages: [
        scorerTestPage(1, [
          "F1 — слабовыраженный фиброз без септ.",
          "F2 — умеренный фиброз, единичные септы.",
          "F3 — выраженный фиброз без цирроза.",
        ]),
      ],
      question: "Стадии F2 фиброза соответствует",
      answer: {id: "A", text: "умеренный фиброз"},
    }));

    expect(support?.kind).toBe("fibrosis_stage_row");
  });
});
