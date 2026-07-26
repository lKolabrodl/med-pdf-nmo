import {describe, expect, it} from "vitest";
import {uniqueTokens} from "../../../normalize.js";
import {
  defineScorerFunctionContract,
  scorerTestContext,
  scorerTestPage,
} from "../../../../__test__/scorer-test-support.js";
import {bestAbbreviationAliasSupport} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "abbreviationForms",
    "answerExpansionSupport",
    "aliasMatchesAnswer",
    "bestAbbreviationAliasSupport",
  ],
});

describe("bestAbbreviationAliasSupport", () => {
  it("uses an abbreviation only when its expansion matches the answer", () => {
    const question = "alpha disease";
    const answer = {id: "A", text: "chronic renal failure"};
    const support = bestAbbreviationAliasSupport(scorerTestContext({
      mode: "multi",
      pdfText: {
        abbreviations: [{abbr: "CRF", expansion: answer.text, page: 1}],
      },
      pages: [scorerTestPage(2, ["alpha disease causes CRF"])],
      question,
      questionTokens: uniqueTokens(question),
      focusTokens: uniqueTokens(question),
      topQuestionPages: new Set([2]),
      answer,
      answerTokens: uniqueTokens(answer.text),
    }));

    expect(support?.kind).toBe("abbreviation_alias_window");
    expect(support?.page).toBe(2);
  });
});
