import {defineScorerFunctionContract} from "../../../../__test__/scorer-test-support.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "pureCountValue",
    "buildCountFamily",
    "countedObjectTokens",
    "tokenCompatible",
    "objectCoverage",
    "countValuePresent",
    "countQuestion",
    "sourceCountCue",
    "resolveClauseLocalCountTuple",
    "applyClauseLocalCountTupleResolver",
  ],
});
