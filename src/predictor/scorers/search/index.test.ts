import {describe, expect, it} from "vitest";
import {normalizeForSearch} from "../../../normalize.js";
import {defineScorerFunctionContract, scorerTestPage} from "../../../../__test__/scorer-test-support.js";
import {findAnchorSegments} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "questionAnchorPhrases",
    "findAnchorSegments",
    "questionSectionAnchor",
    "findSectionSegments",
    "findAnchorBoundary",
    "bestPhraseSupport",
    "bestPrecedingQuestionLabelSupport",
    "bestAnchorSupport",
    "bestSectionSupport",
    "questionRowCues",
    "rowCueMatch",
    "rowBoundary",
    "rowSegmentText",
    "findRowSegments",
    "rowCueSpecificityPenalty",
    "answerCodeVariants",
    "rowAnswerPhrases",
    "bestRowLabelSupport",
  ],
});

describe("findAnchorSegments", () => {
  it("builds a bounded segment after a question anchor", () => {
    const question = "К наследственным формам относятся";
    const segments = findAnchorSegments(
      [scorerTestPage(1, [`${question}: альфа-синдром и бета-синдром.`, "Следующий раздел"])],
      question,
    );

    expect(segments.length).toBeGreaterThan(0);
    expect(segments.some((segment) => segment.normalized.includes(normalizeForSearch("альфа-синдром")))).toBe(true);
  });
});
