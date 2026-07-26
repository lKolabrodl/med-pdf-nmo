import {describe, expect, it} from "vitest";
import {uniqueTokens} from "../../../normalize.js";
import {
  defineScorerFunctionContract,
  scorerTestContext,
  scorerTestPage,
} from "../../../../__test__/scorer-test-support.js";
import {bestRomanStageSupport} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "questionAgeFormCues",
    "ageFormLabelIndex",
    "nextAgeFormBoundary",
    "answerComparatorMismatch",
    "ageAnswerSupport",
    "bestAgeFormSupport",
    "questionRomanStage",
    "nextRomanStageRowIndex",
    "romanStageWindow",
    "bestRomanStageSupport",
    "answerOrdinalLabel",
    "ordinalKindCue",
    "hasOrdinalKindCue",
    "nextAnswerOrdinalIndex",
    "nearestTokenBefore",
    "nearestTokenAfter",
    "isRomanOneConjunctionMatch",
    "answerOrdinalRowWindows",
    "ordinalRangeIncludesValue",
    "specificAnswerOrdinalFocusTokens",
    "orderedFocusPairHits",
    "bestAnswerOrdinalRowSupport",
  ],
});

describe("bestRomanStageSupport", () => {
  it("maps a Roman stage in the question to its source row", () => {
    const answer = {id: "A", text: "выраженный отек мягких тканей"};
    const support = bestRomanStageSupport(scorerTestContext({
      mode: "single",
      pages: [
        scorerTestPage(1, [
          "Стадия I — ограниченное покраснение.",
          "Стадия II — выраженный отек мягких тканей.",
          "Стадия III — распространенное поражение.",
        ]),
      ],
      question: "Стадия II характеризуется",
      answer,
      answerTokens: uniqueTokens(answer.text),
    }));

    expect(support?.kind).toBe("roman_stage_segment");
  });
});
