import {defineScorerFunctionContract} from "../../../../__test__/scorer-test-support.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "repeatedRecommendationQuestion",
    "rawRussianText",
    "recommendationContextTokens",
    "recommendationTargetText",
    "commonPrefixLength",
    "longMedicalTokenMatch",
    "answerTargetSupport",
    "resolveRepeatedRecommendationSet",
  ],
});
