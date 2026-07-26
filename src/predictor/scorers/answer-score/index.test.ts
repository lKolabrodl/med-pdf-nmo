import {describe, expect, it} from "vitest";
import {BM25Index} from "../../../bm25.js";
import {uniqueTokens} from "../../../normalize.js";
import {DEFAULT_CONFIG} from "../../config.js";
import type {AnswerScoringContext} from "../../contracts.js";
import {defineScorerFunctionContract} from "../../../../__test__/scorer-test-support.js";
import {scoreAnswer} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": ["scoreAnswer"],
});

describe("scoreAnswer", () => {
  it("includes a structural resolver result in raw score and evidence", () => {
    const answer = {id: "A", text: "альфа-вариант"};
    const structuralEvidence = {
      answerId: answer.id,
      page: 1,
      text: "Структурная строка с альфа-вариантом.",
      score: 10,
      kind: "sibling_list_member",
    };
    const context = {
      runtime: {},
      config: DEFAULT_CONFIG,
      mode: "single",
      question: "Какой вариант соответствует условию?",
      answers: [answer],
      questionTokens: uniqueTokens("Какой вариант соответствует условию?"),
      focusTokens: uniqueTokens("вариант условие"),
      intent: {negative: false, exception: false, numeric: false, listLike: false},
      anchorSegments: [],
      sectionSegments: [],
      topQuestionMatches: [],
      topQuestionPages: new Set<number>(),
      rowSegments: [],
      boundedListSegments: [],
      visualTableColumnTargetsByPage: null,
      coordinateTableRowsByPage: null,
      coordinateRelationalRowsByPage: null,
      coordinateTableGroupsByPage: null,
      coordinateMultiCellRowsByPage: null,
      coordinateTableMembershipsByPage: null,
      pages: [],
      pdfText: {
        pdfId: "test",
        cacheVersion: 2,
        pageCount: 0,
        extractedAt: "2026-01-01T00:00:00.000Z",
        pages: [],
        abbreviations: [],
        ocrNeeded: false,
      },
      chunks: [],
      index: new BM25Index([]),
      answer,
      answerTokens: uniqueTokens(answer.text),
      siblingListResolution: new Map([
        [answer.id, {adjustment: 3, evidence: structuralEvidence}],
      ]),
    } as unknown as AnswerScoringContext;

    const result = scoreAnswer(context);

    expect(result.raw).toBeGreaterThan(14);
    expect(result.evidence).toContainEqual(structuralEvidence);
  });
});
