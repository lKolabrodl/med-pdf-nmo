import {defineScorerFunctionContract} from "../../../../__test__/scorer-test-support.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "rawRussianText",
    "riskQuestionTarget",
    "questionTargetTokens",
    "riskHeaderTarget",
    "startsListItem",
    "likelyNewParagraph",
    "collectRiskItems",
    "answerMatchesItem",
    "resolveRiskFactorList",
  ],
});
