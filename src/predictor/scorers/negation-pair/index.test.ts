import {defineScorerFunctionContract} from "../../../../__test__/scorer-test-support.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "explicitNegativeWord",
    "hasExplicitNegation",
    "optionSkeleton",
    "buildNegationPair",
    "tokenCompatible",
    "rawCoverage",
    "atomicPolarityClauses",
    "clausePairPolarity",
    "questionFocusTokens",
    "focusCompatible",
    "resolveNegationPairClause",
    "applyNegationPairClauseResolver",
  ],
});
