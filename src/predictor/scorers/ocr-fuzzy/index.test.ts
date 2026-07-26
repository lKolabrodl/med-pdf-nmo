import {defineScorerFunctionContract} from "../../../../__test__/scorer-test-support.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "rawLetterTokens",
    "hasCyrillic",
    "editDistance",
    "cyrillicOcrTokenSimilarity",
    "similarityThreshold",
    "hasInteriorDifference",
    "sourceTokenCandidates",
    "hasLongTokenCollision",
    "cyrillicOcrCoverage",
    "bestCyrillicOcrSupport",
  ],
});
