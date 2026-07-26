import {describe, expect, it} from "vitest";
import {defineScorerFunctionContract} from "../../../../__test__/scorer-test-support.js";
import {applyGeneSentenceSetSupport} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "answerShortMedicalAliases",
    "bestShortMedicalAliasSupport",
    "sharedMultiTokens",
    "parentheticalGroupFocusTokens",
    "answerInParentheticalGroup",
    "parentheticalGroupAnswerHit",
    "inlineParentheticalGroupContext",
    "bestParentheticalGroupSupport",
    "continuationListQuestion",
    "answerContinuationListHit",
    "continuationLineSegments",
    "bestQuestionContinuationListSupport",
    "sharedMultiSectionCue",
    "sharedMultiFocusedNormalized",
    "sharedMultiRequiredCueMismatch",
    "sharedMultiTokenPosition",
    "sharedMultiCompactSpan",
    "sharedMultiNumericComparatorMismatch",
    "sharedMultiSegmentHit",
    "addSharedMultiSegmentSupport",
    "applyGeneSentenceSetSupport",
  ],
});

describe("applyGeneSentenceSetSupport", () => {
  it("boosts a coherent gene set and suppresses an unsupported gene option", () => {
    const sentence = "При болезни Альфа выявлены мутации генов ABCD1 и EFGH2.";
    const scores = [
      {
        answer: {id: "A", text: "ABCD1"},
        raw: 10,
        evidence: [{answerId: "A", page: 1, text: sentence, score: 15, kind: "gene_sentence_segment"}],
      },
      {
        answer: {id: "B", text: "EFGH2"},
        raw: 6,
        evidence: [{answerId: "B", page: 1, text: sentence, score: 14, kind: "gene_sentence_segment"}],
      },
      {
        answer: {id: "C", text: "IJKL3"},
        raw: 5,
        evidence: [],
      },
    ];

    const adjusted = applyGeneSentenceSetSupport(
      scores,
      "multi",
      "Мутации каких генов выявлены при болезни Альфа?",
    );

    expect(adjusted[1].raw).toBe(9.3);
    expect(adjusted[2].raw).toBeCloseTo(2.8);
  });
});
