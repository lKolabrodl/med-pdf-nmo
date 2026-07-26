import {describe, expect, it} from "vitest";
import {uniqueTokens} from "../../../normalize.js";
import {defineScorerFunctionContract} from "../../../../__test__/scorer-test-support.js";
import {hasVisualTableColumnCue} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "questionLabelCues",
    "bestLabelNumberSupport",
    "canonicalClassificationCode",
    "canonicalClassificationCodes",
    "classificationCodeWindows",
    "bestClassificationCodeSupport",
    "mkbClassExclusionQuestion",
    "questionMkbClassCode",
    "sameMkbClass",
    "lineHasMkbClass",
    "mkbClassSectionLines",
    "mkbClassIncludedRows",
    "mkbClassAnswerTokens",
    "mkbClassIncludedRowHit",
    "bestMkbClassExclusionSupport",
    "canonicalShortLabel",
    "questionShortLabels",
    "lineShortLabels",
    "visualRowText",
    "hasVisualTableColumnCue",
    "visualTableColumnFocusTokens",
    "lineXSpread",
    "visualTableColumnTargets",
    "visualTableTargetsNearPage",
    "buildVisualTableColumnTargetsByPage",
    "answerMetricTokens",
    "comparatorSigns",
    "visualValueMatchesAnswer",
    "targetCellText",
    "nearbyMetricText",
    "bestVisualTableColumnSupport",
    "lineStartX",
    "linePrefixShortLabels",
    "lineStartsWithShortLabelStem",
    "splitShortLabelSuffix",
    "lineExactShortLabels",
    "visualExactLabelRowText",
    "bestExactShortLabelRowSupport",
    "bestShortLabelRowSupport",
  ],
});

describe("hasVisualTableColumnCue", () => {
  it("requires an explicit classification-column cue", () => {
    expect(
      hasVisualTableColumnCue(
        "Какие признаки относятся к тяжелой степени?",
        uniqueTokens("тяжелая степень"),
      ),
    ).toBe(true);
    expect(
      hasVisualTableColumnCue(
        "Какие признаки встречаются при заболевании Альфа?",
        uniqueTokens("заболевание Альфа"),
      ),
    ).toBe(false);
  });
});
