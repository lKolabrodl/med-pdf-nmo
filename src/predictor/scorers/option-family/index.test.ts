import {describe, expect, it} from "vitest";
import {defineScorerFunctionContract} from "../../../../__test__/scorer-test-support.js";
import {optionFamilyComparatorAdjustment} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "contrastive.ts": [
    "hasUnsupportedSourceNegation",
    "cachedContrastiveSources",
    "canonicalScalarNumber",
    "canonicalContrastiveNumber",
    "unsignedContrastiveNumbers",
    "readContrastiveUnitAtom",
    "contrastiveUnitAfter",
    "contrastiveQuantities",
    "canonicalContrastiveNumbers",
    "questionHasFixedMeasurementAnchor",
    "embeddedNumberLabel",
    "sourceMatchesEmbeddedNumberLabel",
    "contrastiveComparatorDirections",
    "contrastiveComparatorDirection",
    "contrastiveTokenSequence",
    "questionShortCondition",
    "sourceMatchesQuestionCondition",
    "negatedFocusTargets",
    "sourceMatchesNegatedFocus",
    "sourceMatchesQuestionModality",
    "questionRequiresExclusion",
    "questionResponseObjectAnchors",
    "sourceMatchesQuestionResponseObject",
    "contrastiveSeverityClasses",
    "contrastiveSeverityClass",
    "sourceMatchesQuestionSeverity",
    "contrastiveMagnitudeClass",
    "sourceMatchesQuestionMagnitude",
    "contrastiveUnitClasses",
    "requiredContrastiveUnits",
    "contrastiveUnitSignatures",
    "requiredContrastiveNumericUnit",
    "sourceMatchesContrastiveUnits",
    "contrastivePopulationClasses",
    "sourceMatchesQuestionPopulation",
    "questionCompoundConditions",
    "questionContrastiveConditions",
    "sourceMatchesQuestionConditions",
    "questionMeasurementSubjectAnchors",
    "sourceMatchesQuestionMeasurementSubject",
    "questionAlphanumericAnchors",
    "sourceMatchesQuestionAlphanumericAnchors",
    "questionStructuralOrdinal",
    "sourceMatchesQuestionOrdinal",
    "sourceMatchesQuestionCount",
    "buildContrastiveFamily",
    "profileMatchesSource",
    "scoreContrastiveFragment",
    "resolveContrastiveOptionFamily",
    "contrastiveCacheKey",
    "contrastiveOptionFamilyAdjustment",
  ],
  "index.ts": [
    "answerComparatorSpecs",
    "opposite",
    "answerFamilyHasOppositeComparator",
    "sourceDirectionsForNumber",
    "optionFamilyComparatorAdjustment",
    "compactComboPhrases",
    "validCompactComboPhrase",
    "comboQuestion",
    "alternativeComboTokens",
    "evidenceHasCompactTokenPair",
    "optionFamilyCompactComboAdjustment",
  ],
});

describe("optionFamilyComparatorAdjustment", () => {
  it("penalizes the opposite comparator within the same numeric family", () => {
    const answer = {id: "A", text: "<50%"};
    const result = optionFamilyComparatorAdjustment({
      answer,
      answers: [answer, {id: "B", text: ">50%"}],
      evidence: [
        {
          answerId: answer.id,
          page: 1,
          text: "Порог показателя >50%.",
          score: 10,
          kind: "answer_window",
        },
      ],
    });

    expect(result.adjustment).toBeLessThan(0);
    expect(result.evidence?.kind).toBe("option_family_comparator_mismatch");
  });
});
