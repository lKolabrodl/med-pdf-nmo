import {defineScorerFunctionContract} from "../../../../__test__/scorer-test-support.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "romanValue",
    "ordinalValue",
    "canonicalSuffix",
    "parseOrdinalFamily",
    "sourceSuffixPattern",
    "encodedOrdinalSets",
    "questionFocusTokens",
    "mandatoryConditionTokens",
    "recommendationPolarity",
    "interventionTargetTokens",
    "tokenHit",
    "sourceClauses",
    "resolveExplicitOrdinalRangeSet",
    "applyExplicitOrdinalRangeSetScores",
  ],
});
