import {describe, expect, it} from "vitest";
import {uniqueTokens} from "../../../normalize.js";
import {
  defineScorerFunctionContract,
  scorerTestContext,
  scorerTestPage,
} from "../../../../__test__/scorer-test-support.js";
import {bestExactAnswerSupport} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "exactAnswerPhrases",
    "exactAnswerApplicable",
    "bestExactAnswerSupport",
  ],
});

describe("bestExactAnswerSupport", () => {
  it("preserves a complete multi-number administration phrase", () => {
    const question = "Как препарат Альфазол назначается внутрь по схеме?";
    const answer = {id: "A", text: "500 мг 2 раза в сутки в течение 10 дней"};
    const text = `Альфазол назначается внутрь по ${answer.text}.`;
    const support = bestExactAnswerSupport(scorerTestContext({
      mode: "single",
      pages: [scorerTestPage(1, [text])],
      topQuestionPages: new Set([1]),
      question,
      answer,
      questionTokens: uniqueTokens(question),
      answerTokens: uniqueTokens(answer.text),
      focusTokens: uniqueTokens("Альфазол назначается внутрь"),
    }));

    expect(support?.kind).toBe("exact_answer_phrase");
  });
});
