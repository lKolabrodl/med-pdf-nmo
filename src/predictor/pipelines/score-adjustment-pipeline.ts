import type {
  PredictionContext,
  ScoreAdjustmentProcessor,
} from "../contracts.js";
import type { AnswerScore } from "../types.js";

/**
 * Выполняет set-level и post-scoring корректировки в фиксированном порядке.
 */
export class ScoreAdjustmentPipeline {
  constructor(
    private readonly processors: readonly ScoreAdjustmentProcessor[],
  ) {}

  apply(inputScores: AnswerScore[], context: PredictionContext): AnswerScore[] {
    let answerScores = inputScores;
    for (const processor of this.processors) {
      answerScores = processor.apply(answerScores, context);
    }
    return answerScores;
  }
}
