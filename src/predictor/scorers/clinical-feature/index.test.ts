import {describe, expect, it} from "vitest";
import {
  defineScorerFunctionContract,
  scorerTestContext,
  scorerTestPage,
} from "../../../../__test__/scorer-test-support.js";
import {clinicalFeatureAdjustment} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "clinicalFeatureQuestion",
    "clinicalFeatureFocusTokens",
    "clinicalFeatureAnswerTokens",
    "answerHasNegativeClinicalCue",
    "clinicalFeatureSentenceNegative",
    "clinicalFeatureCandidateSentences",
    "clinicalFeatureAdjustment",
  ],
});

describe("clinicalFeatureAdjustment", () => {
  it("supports a positive clinical feature in the focused sentence", () => {
    const question = "Заболевание Альфа имеет следующие клинические признаки";
    const answer = {id: "A", text: "стойкая мышечная слабость"};
    const result = clinicalFeatureAdjustment(scorerTestContext({
      mode: "multi",
      pages: [
        scorerTestPage(1, [
          "Заболевание Альфа имеет следующие клинические признаки: стойкая мышечная слабость.",
        ]),
      ],
      topQuestionPages: new Set([1]),
      question,
      answer,
      intent: {negative: false, exception: false, numeric: false, listLike: true},
    }));

    expect(result.support?.kind).toBe("clinical_feature_segment");
    expect(result.adjustment).toBe(0);
  });
});
