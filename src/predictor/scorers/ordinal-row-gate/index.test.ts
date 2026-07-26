import {defineScorerFunctionContract} from "../../../../__test__/scorer-test-support.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "cueForKind",
    "roman",
    "escapeRegExp",
    "answerOrdinalRowApplicable",
  ],
});
