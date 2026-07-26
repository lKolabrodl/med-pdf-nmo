import {describe, expect, it} from "vitest";
import {
  defineScorerFunctionContract,
  scorerTestContext,
  scorerTestPage,
} from "../../../../__test__/scorer-test-support.js";
import {ageEligibilityAdjustment} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "boundedListQuestion",
    "boundedListAnchors",
    "boundedListBoundary",
    "findBoundedListSegments",
    "bestBoundedListSupport",
    "ordinalTarget",
    "ordinalWordForms",
    "nextOrdinalIndex",
    "nextStepOrdinalIndex",
    "nextDegreeOrdinalIndex",
    "ordinalWindows",
    "lineOrdinalWindowStart",
    "abbreviationSupport",
    "specificOrdinalFocusTokens",
    "ordinalWindowNegatesSpecificFocus",
    "bestOrdinalListSupport",
    "typeOrdinalNumber",
    "typeOrdinalForms",
    "nextTypeOrdinalBoundary",
    "typeOrdinalWindows",
    "typeAbbreviationSupport",
    "typeDistinctiveAnswerTokens",
    "bestTypeOrdinalSupport",
    "questionIndicationLabel",
    "dischargeIndicationLabel",
    "indicationLineMatches",
    "indicationHeading",
    "buildIndicationSegment",
    "indicationScopeAdjustment",
    "indicationSemanticSupport",
    "indicationContrastMismatch",
    "bestIndicationSegmentSupport",
    "ageEligibilityAdjustment",
  ],
});

describe("ageEligibilityAdjustment", () => {
  it("penalizes a child indication when the source states a contraindication", () => {
    const result = ageEligibilityAdjustment(scorerTestContext({
      pages: [
        scorerTestPage(1, [
          "Применение метода детям противопоказано; метод предназначен только взрослым.",
        ]),
      ],
      question: "Кому показано применение метода?",
      answer: {id: "A", text: "детям"},
    }));

    expect(result.adjustment).toBeLessThan(0);
    expect(result.evidence?.kind).toBe("age_eligibility_contraindication");
  });
});
