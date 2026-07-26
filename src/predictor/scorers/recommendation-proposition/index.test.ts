import {defineScorerFunctionContract} from "../../../../__test__/scorer-test-support.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "propositionQuestion",
    "recommendationTargetTokens",
    "hasAny",
    "recommendationPropositionFeatures",
    "featureKey",
    "optionCompatibility",
    "physicalRecommendationBlockSegments",
    "resolveRecommendationProposition",
  ],
});
