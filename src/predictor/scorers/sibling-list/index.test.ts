import {defineScorerFunctionContract} from "../../../../__test__/scorer-test-support.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "isRunningHeader",
    "isStrongBoundary",
    "recommendationLikeLabel",
    "validLabelBody",
    "hasOrdinalSignature",
    "parseStructuredLabel",
    "flattenLines",
    "buildSiblingListBlocks",
    "informativeTokens",
    "answerBodyMatch",
    "labelSpecificTokens",
    "ordinalNumber",
    "ordinalLabelKey",
    "blockWithPlusInheritance",
    "questionLabelMatch",
    "answerLabelMatch",
    "chooseUnique",
    "resolveMultiMembership",
    "bodyQuestionMatch",
    "resolveSingleInverse",
    "resolveSingleForward",
    "resolveSiblingList",
  ],
});
