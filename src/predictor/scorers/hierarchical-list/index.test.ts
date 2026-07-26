import {defineScorerFunctionContract} from "../../../../__test__/scorer-test-support.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "flattenLines",
    "parentLabel",
    "childStart",
    "childBoundary",
    "buildHierarchicalListClusters",
    "informative",
    "commonLabelTokens",
    "parentQuestionMatch",
    "baseChildText",
    "childTokenFrequency",
    "distinctiveChildTokens",
    "childAnswerMatch",
    "bestChildMatch",
    "resolveHierarchicalList",
  ],
});
