import {describe, expect, it} from "vitest";
import {normalizeForSearch} from "../../../normalize.js";
import {defineScorerFunctionContract} from "../../../../__test__/scorer-test-support.js";
import {frequencyPolarity, questionDefinitionLabel} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "questionDefinitionTerm",
    "definitionTermIndex",
    "definitionTermWindow",
    "answerAbbreviations",
    "bestTermDefinitionSupport",
    "definitionQuestionLike",
    "definitionCueWindow",
    "definitionExactFragments",
    "primaryDefinitionTermToken",
    "editDistanceAtMostOne",
    "definitionFragmentMatchesQuestionTerm",
    "bestDefinitionExactAnswerSupport",
    "definitionCompletionAdjustment",
    "frequencyPolarity",
    "frequencyPolarityFocusTokens",
    "containsPhraseOutsideParentheses",
    "frequencyPolarityFragments",
    "frequencyListItemLine",
    "frequencyPolarityListItems",
    "betterFrequencyListSupport",
    "bestFrequencyPolaritySupport",
    "negatedAnswerPrefixAdjustment",
    "impossibilityOnlyAdjustment",
    "activeTherapyIndicationAdjustment",
    "questionDefinitionLabel",
    "labelDefinitionWindows",
    "labelDefinitionFocusTokens",
    "bestLabelDefinitionSupport",
    "specificRecommendationFocusTokens",
    "recommendationQuestion",
    "segmentRecommendationPolarity",
    "recommendationQuestionPolarity",
    "recommendationAnswerHit",
    "recommendationPolarityAdjustment",
  ],
});

describe("definition intent helpers", () => {
  it("extracts definition labels and frequency polarity", () => {
    expect(questionDefinitionLabel("Проба считается положительной при значении выше порога")).toBe("положительной");
    expect(frequencyPolarity(normalizeForSearch("наиболее часто встречается"))).toBe("high");
    expect(frequencyPolarity(normalizeForSearch("редко встречается"))).toBe("low");
  });
});
