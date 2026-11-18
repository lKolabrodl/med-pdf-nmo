import { describe, expect, it } from "vitest";
import { defineScorerFunctionContract, scorerTestContext, scorerTestPage } from "../../../../__test__/scorer-test-support.js";
import { AnswerSelector } from "../../selection.js";
import { QuotedContinuationProcessor } from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": ["literalTokens", "continuationAnchor"],
});

const question = "В контрольной группе образец хранится при температуре";
const options = [{ id: "a", text: "2,5 градуса" }, { id: "b", text: "5 градусов" }];
const quote = "В контрольной группе образец хранится при температуре: 2,5 градуса.";

function resolve(texts: string[], answers = options) {
  const pages = texts.map((text, index) => scorerTestPage(index + 1, text.split("\n")));
  return new QuotedContinuationProcessor().resolve(pages, question, answers);
}

describe("unique quoted continuation", () => {
  it("keeps decimal tokens intact and returns the supporting page", () => {
    expect(resolve(["Обложка", quote.replace("хранится при", "хранится\nпри")], [...options].reverse()))
      .toMatchObject({ page: 2, answerId: "a" });
    expect(resolve([quote.replace("2,5", "12,5")])).toBeNull();
    expect(resolve([quote.replace(": 2,5", " −2,5")])).toBeNull();
  });
  it("abstains when the anchor recurs, even with an unlisted continuation", () => {
    const other = quote.replace("2,5 градуса", "комнаты");
    expect(resolve([quote, other])).toBeNull();
    expect(resolve([quote + " " + other])).toBeNull();
  });
  it("abstains for competing answer prefixes and across a page break", () => {
    expect(resolve([quote], [...options, { id: "c", text: "2,5" }])).toBeNull();
    expect(resolve([question + ":", "2,5 градуса."])).toBeNull();
  });
  it("only changes a conflicting single selection and records its evidence", () => {
    const processor = new QuotedContinuationProcessor();
    const context = scorerTestContext({ answers: options, question, pages: [scorerTestPage(1, [quote])] });
    const scores = options.map((answer, index) => ({ answer, raw: 10 + index, evidence: [] }));
    const adjusted = processor.apply(scores, context);
    expect(new AnswerSelector().resolve(adjusted, "single", context.config).selected).toEqual(["a"]);
    expect(adjusted[0].evidence[0]).toMatchObject({ page: 1, kind: "quoted_continuation" });
    expect(processor.apply(adjusted, context)).toBe(adjusted);
    expect(processor.apply(scores, { ...context, mode: "multi" })).toBe(scores);
    expect(processor.apply(scores, { ...context, config: { ...context.config, quotedContinuation: false } })).toBe(scores);
  });
});
