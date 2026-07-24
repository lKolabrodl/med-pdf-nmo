import { detectQuestionIntent, uniqueTokens } from "../normalize.js";
import type { PredictorConfig } from "./config.js";
import type {
  ContextSegment,
  PredictionContext,
  QuestionIntent,
  TableContextByPage,
} from "./contracts.js";
import type { PdfRuntime } from "./runtime.js";
import {
  buildCoordinateMultiCellRowsByPage,
  buildCoordinateRelationalRowsByPage,
  buildCoordinateTableGroupsByPage,
  buildCoordinateTableMembershipsByPage,
  buildCoordinateTableRowsByPage,
  hasCoordinateComparisonTableCue,
  hasCoordinateRelationalRowCue,
  hasCoordinateTableCue,
  hasCoordinateTableGroupCue,
} from "./scorers/coordinate-table.js";
import { questionFocusTokens } from "./scorers/focused.js";
import { findAnchorSegments, findRowSegments, findSectionSegments } from "./scorers/search.js";
import type { AnswerMode, AnswerOption } from "./types.js";

export type ContextBuilderDependencies = {
  findBoundedListSegments(args: {
    pages: PdfRuntime["pdfText"]["pages"];
    question: string;
    topQuestionPages: Set<number>;
    mode: AnswerMode;
    intent: QuestionIntent;
  }): ContextSegment[];
  hasVisualTableColumnCue(question: string, focusTokens: string[]): boolean;
  buildVisualTableColumnTargetsByPage(
    pages: PdfRuntime["pdfText"]["pages"],
    question: string,
    focusTokens: string[],
    topQuestionPages: Set<number>,
  ): NonNullable<TableContextByPage>;
};

/**
 * Строит общий контекст вопроса до запуска scorer-ов отдельных ответов.
 *
 * Класс централизует дорогие document-level вычисления, чтобы они выполнялись
 * один раз на вопрос и не смешивались с per-answer scoring.
 */
export class PredictionContextBuilder {
  constructor(private readonly dependencies: ContextBuilderDependencies) {}

  build({
    runtime,
    config,
    mode,
    question,
    answers,
  }: {
    runtime: PdfRuntime;
    config: PredictorConfig;
    mode: AnswerMode;
    question: string;
    answers: AnswerOption[];
  }): PredictionContext {
    const questionTokens = uniqueTokens(question);
    const focusTokens = questionFocusTokens(question);
    const intent = detectQuestionIntent(question);
    const anchorSegments = findAnchorSegments(runtime.pdfText.pages, question);
    const sectionSegments = findSectionSegments(runtime.pdfText.pages, question);
    const topQuestionMatches = runtime.index.search(questionTokens, { limit: 6 });
    const topQuestionPages = new Set<number>(
      topQuestionMatches.map((result) => result.chunk.page),
    );
    const rowSegments = findRowSegments(runtime.pdfText.pages, question, topQuestionPages);
    const boundedListSegments = this.dependencies.findBoundedListSegments({
      pages: runtime.pdfText.pages,
      question,
      topQuestionPages,
      mode,
      intent,
    });
    const visualTableColumnTargetsByPage =
      mode === "multi" && this.dependencies.hasVisualTableColumnCue(question, focusTokens)
        ? this.dependencies.buildVisualTableColumnTargetsByPage(
            runtime.pdfText.pages,
            question,
            focusTokens,
            topQuestionPages,
          )
        : null;
    const coordinateTableRowsByPage = hasCoordinateTableCue(question, focusTokens)
      ? buildCoordinateTableRowsByPage(runtime.pdfText.pages, topQuestionPages)
      : null;
    const coordinateRelationalRowsByPage = hasCoordinateRelationalRowCue(question)
      ? buildCoordinateRelationalRowsByPage(
          runtime.pdfText.pages,
          topQuestionPages,
          hasCoordinateComparisonTableCue(question),
        )
      : null;
    const coordinateTableGroupsByPage =
      mode === "multi" && hasCoordinateTableGroupCue(question, focusTokens, intent)
        ? buildCoordinateTableGroupsByPage(runtime.pdfText.pages, topQuestionPages)
        : null;
    const coordinateMultiCellRowsByPage =
      mode === "multi" && hasCoordinateTableGroupCue(question, focusTokens, intent)
        ? buildCoordinateMultiCellRowsByPage(runtime.pdfText.pages, topQuestionPages)
        : null;
    const coordinateTableMembershipsByPage =
      mode === "multi" && hasCoordinateTableGroupCue(question, focusTokens, intent)
        ? buildCoordinateTableMembershipsByPage(runtime.pdfText.pages, topQuestionPages)
        : null;

    return {
      runtime,
      config,
      mode,
      question,
      answers,
      questionTokens,
      focusTokens,
      intent,
      anchorSegments,
      sectionSegments,
      topQuestionMatches,
      topQuestionPages,
      rowSegments,
      boundedListSegments,
      visualTableColumnTargetsByPage,
      coordinateTableRowsByPage,
      coordinateRelationalRowsByPage,
      coordinateTableGroupsByPage,
      coordinateMultiCellRowsByPage,
      coordinateTableMembershipsByPage,
    };
  }
}
