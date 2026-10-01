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

  it.each([
    ["decimal prefix", "<50", ">50", "Порог >50.5."],
    ["overlapping decimal bound", ">50", "<50", "Порог <50.5."],
    ["range endpoint", "<50", ">50", "Порог >50–60."],
    ["fraction component", "<50", ">50", "Порог >50/60."],
    ["grouped integer prefix", "<9", ">9", "Порог >9 500."],
    ["percent of a different value", "<50%", ">50%", "Порог >50.5%."],
    ["precision in a long decimal", "<0.1234567891234567801", ">0.1234567891234567801", "Порог >0.1234567891234567802."],
    ["integer with extra digits", "<50", ">50", "Порог >150."],
    ["signed value", "<50", ">50", "Порог >-50."],
    ["numeric code", "<50", ">50", "Порог >R50."],
    ["power expression", "<10", ">10", "Порог >10^9."],
    ["multiplication expression", "<10", ">10", "Порог >10 x 9."],
  ])("does not use a partial numeric match from %s", (_name, answerText, otherText, source) => {
    const answer = {id: "left", text: answerText};
    const result = optionFamilyComparatorAdjustment({
      answer, answers: [answer, {id: "right", text: otherText}],
      evidence: [{page: 3, text: source, score: 10, kind: "answer_window"}],
    });

    expect(result).toEqual({adjustment: 0, evidence: null});
  });

  it.each([
    ["a full decimal", "<50.5", ">50.5", "Порог >50.5."],
    ["a full percentage", "<50%", ">50%", "Порог >50%."],
    ["a sentence-final integer", "<50", ">50", "Порог >50."],
  ])("retains the existing adjustment for %s", (_name, answerText, otherText, source) => {
    const answer = {id: "left", text: answerText};
    const result = optionFamilyComparatorAdjustment({
      answer, answers: [answer, {id: "right", text: otherText}],
      evidence: [{page: 3, text: source, score: 10, kind: "answer_window"}],
    });

    expect(result.adjustment).toBe(-4.2);
  });

  it("is independent of answer ids and their order", () => {
    const answers = [{id: "first", text: "<50"}, {id: "second", text: ">50"}];
    const renamed = answers.map((answer, index) => ({...answer, id: `renamed-${index}`})).reverse();
    const evidence = [{page: 7, text: "Порог >50.5.", score: 10, kind: "answer_window"}];
    expect(optionFamilyComparatorAdjustment({answer: answers[0], answers, evidence}).adjustment).toBe(0);
    expect(optionFamilyComparatorAdjustment({answer: renamed[1], answers: renamed, evidence}).adjustment).toBe(0);
  });
});
