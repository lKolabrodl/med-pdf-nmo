import {describe, expect, it} from "vitest";
import {
  defineScorerFunctionContract,
  scorerTestContext,
  scorerTestPage,
} from "../../../../__test__/scorer-test-support.js";
import {bestGeneSentenceSupport, geneMutationQuestion, latinAnswerTokens} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "latinAnswerTokens",
    "latinTokenVariants",
    "geneTokenVariants",
    "relaxedLatinText",
    "relaxedLatinTokens",
    "cachedLatinTokens",
    "diceSimilarity",
    "bestLatinFuzzySupport",
    "geneMutationQuestion",
    "geneQuestionFocusTokens",
    "sentenceSegments",
    "geneSentenceHit",
    "bestGeneSentenceSupport",
  ],
});

describe("gene-symbol helpers", () => {
  it("binds a gene symbol to the focused mutation sentence", () => {
    const question = "Мутация какого гена связана с осложнением при заболевании Альфа?";
    const answer = {id: "A", text: "ABCD1"};
    const support = bestGeneSentenceSupport(scorerTestContext({
      pages: [
        scorerTestPage(1, [
          "При заболевании Альфа мутация гена ABCD1 связана с развитием осложнения.",
        ]),
      ],
      topQuestionPages: new Set([1]),
      question,
      answer,
    }));

    expect(geneMutationQuestion(question)).toBe(true);
    expect(latinAnswerTokens(answer.text)).toEqual(["ABCD1"]);
    expect(support?.kind).toBe("gene_sentence_segment");
  });
});
