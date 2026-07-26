import {describe, expect, it} from "vitest";
import {uniqueTokens} from "../../../normalize.js";
import {
  defineScorerFunctionContract,
  scorerTestContext,
  scorerTestPage,
} from "../../../../__test__/scorer-test-support.js";
import {polarityAdjustment} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "detectPolarity",
    "nearestPolarityBefore",
    "polarityAdjustment",
    "temporalCue",
    "nearestTemporalCue",
    "temporalCueAdjustment",
    "clinicalCourseCue",
    "clinicalCourseRelationQuestion",
    "clinicalCourseBindingTokens",
    "nearestClinicalCourseCueBeforeAnswer",
    "clinicalCourseCueAdjustment",
    "modifierTargetContrastMismatch",
    "contrastCueMismatchAdjustment",
    "excludedConditionTokens",
    "evidenceHasExcludedConditionBeforeAnswer",
    "excludedConditionMismatchAdjustment",
  ],
});

describe("polarityAdjustment", () => {
  it("penalizes evidence with the opposite local polarity", () => {
    const question = "При заболевании Альфа повышается маркер Бета?";
    const answer = {id: "A", text: "маркер Бета"};
    const result = polarityAdjustment(scorerTestContext({
      mode: "single",
      pages: [scorerTestPage(1, ["При заболевании Альфа снижается маркер Бета."])],
      topQuestionPages: new Set([1]),
      question,
      questionTokens: uniqueTokens(question),
      answer,
    }));

    expect(result.adjustment).toBeLessThan(0);
    expect(result.evidence?.kind).toBe("polarity_mismatch");
  });
});
