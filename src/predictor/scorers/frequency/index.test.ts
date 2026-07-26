import {describe, expect, it} from "vitest";
import {uniqueTokens} from "../../../normalize.js";
import {
  defineScorerFunctionContract,
  scorerTestContext,
  scorerTestPage,
} from "../../../../__test__/scorer-test-support.js";
import {bestFrequencyRecommendationSupport, frequencyAnswer, frequencySearchPhrases} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "frequencyAnswer",
    "frequencySearchPhrases",
    "lineWindowSegments",
    "cachedLineWindowSegments",
    "specificFrequencyFocusTokens",
    "frequencyAnswerSubjectTokens",
    "frequencySubjectCompatible",
    "bestFrequencyRecommendationSupport",
  ],
});

describe("frequency recommendation helpers", () => {
  it("recognizes time units and finds them in a recommendation line", () => {
    const answer = {id: "A", text: "исследование каждые 6 месяцев"};
    const question = "Как часто рекомендуется исследование при состоянии Альфа?";
    const support = bestFrequencyRecommendationSupport(scorerTestContext({
      mode: "single",
      pages: [
        scorerTestPage(1, [
          "При состоянии Альфа рекомендуется проводить исследование каждые 6 месяцев.",
        ]),
      ],
      topQuestionPages: new Set([1]),
      question,
      answer,
      focusTokens: uniqueTokens("состояние Альфа исследование"),
    }));

    expect(frequencyAnswer(answer.text)).toBe(true);
    expect(frequencySearchPhrases(answer.text)).toContain("6 месяцев");
    expect(support?.kind).toBe("frequency_recommendation_line");
  });
});
