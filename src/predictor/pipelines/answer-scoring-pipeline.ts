import { uniqueTokens } from "../../normalize.js";
import type {
  AnswerScoreResult,
  AnswerScoringContext,
  PredictionContext,
  StructuralResolution,
} from "../contracts.js";
import type { AnswerScore } from "../types.js";

export type ScoreAnswer = (context: AnswerScoringContext) => AnswerScoreResult;

/**
 * Управляет per-answer scoring и гарантирует единый контекст и порядок ответов.
 */
export class AnswerScoringPipeline {
  constructor(private readonly scoreAnswer: ScoreAnswer) {}

  score(context: PredictionContext, structuralResolution: StructuralResolution): AnswerScore[] {
    return context.answers.map((answer) => {
      const result = this.scoreAnswer({
        ...context,
        pages: context.runtime.pdfText.pages,
        pdfText: context.runtime.pdfText,
        chunks: context.runtime.chunks,
        index: context.runtime.index,
        answer,
        answerTokens: uniqueTokens(answer.text),
        siblingListResolution: structuralResolution,
      } as AnswerScoringContext);

      return {
        answer,
        raw: result.raw,
        evidence: result.evidence,
      };
    });
  }
}
