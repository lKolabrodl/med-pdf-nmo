import { ConfidenceCalculator } from "./predictor/confidence-calculator.js";
import { PredictionContextBuilder } from "./predictor/context-builder.js";
import { PredictorEngine } from "./predictor/engine.js";
import { AnswerScoringPipeline } from "./predictor/pipelines/answer-scoring-pipeline.js";
import { ScoreAdjustmentPipeline } from "./predictor/pipelines/score-adjustment-pipeline.js";
import { StructuralResolverPipeline } from "./predictor/pipelines/structural-resolver-pipeline.js";
import { PredictionResultBuilder } from "./predictor/result-builder.js";
import { PdfRuntimeStore } from "./predictor/runtime.js";
import {
  addSharedMultiSegmentSupport,
  applyGeneSentenceSetSupport,
  buildVisualTableColumnTargetsByPage,
  findBoundedListSegments,
  hasVisualTableColumnCue,
  questionDefinitionLabel,
  scoreAnswer,
} from "./predictor/scorers/legacy.js";
import { AnswerSelector } from "./predictor/selection.js";
import type { PredictorInput, PredictorOptions, PredictorResult } from "./predictor/types.js";

/**
 * Создает независимый predictor engine с собственным PDF runtime-кешем.
 */
export function createPredictorEngine() {
  return new PredictorEngine({
    runtimeStore: new PdfRuntimeStore(),
    contextBuilder: new PredictionContextBuilder({
      findBoundedListSegments: ({ pages, question, topQuestionPages, mode, intent }) =>
        findBoundedListSegments(pages, question, topQuestionPages, mode, intent),
      hasVisualTableColumnCue,
      buildVisualTableColumnTargetsByPage,
    }),
    structuralResolverPipeline: new StructuralResolverPipeline(),
    answerScoringPipeline: new AnswerScoringPipeline(scoreAnswer),
    scoreAdjustmentPipeline: new ScoreAdjustmentPipeline({
      addSharedMultiSegmentSupport,
      applyGeneSentenceSetSupport,
      questionDefinitionLabel,
    }),
    answerSelector: new AnswerSelector(),
    confidenceCalculator: new ConfidenceCalculator(),
    resultBuilder: new PredictionResultBuilder(),
  });
}

export { PredictorEngine };

const defaultPredictorEngine = createPredictorEngine();

/**
 * Запускает локальный non-LLM predictor для выбора ответа.
 */
export async function predict(
  input: PredictorInput,
  options: PredictorOptions = {},
): Promise<PredictorResult> {
  return defaultPredictorEngine.predict(input, options);
}

/**
 * Очищает in-memory кеши predictor, включая кешированный текст PDF и runtime-состояние.
 */
export function clearPredictorCache() {
  defaultPredictorEngine.clearCache();
}
