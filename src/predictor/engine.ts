import { DEFAULT_CONFIG } from "./config.js";
import { ConfidenceCalculator } from "./confidence-calculator.js";
import type { PredictionContext } from "./contracts.js";
import { PredictionContextBuilder } from "./context-builder.js";
import { AnswerScoringPipeline } from "./pipelines/answer-scoring-pipeline.js";
import { ScoreAdjustmentPipeline } from "./pipelines/score-adjustment-pipeline.js";
import { StructuralResolverPipeline } from "./pipelines/structural-resolver-pipeline.js";
import { PredictionResultBuilder } from "./result-builder.js";
import { normalizeAnswers, PdfRuntimeStore } from "./runtime.js";
import { AnswerSelector } from "./selection.js";
import type { PredictorInput, PredictorOptions, PredictorResult } from "./types.js";

export type PredictorEngineDependencies = {
  runtimeStore: PdfRuntimeStore;
  contextBuilder: PredictionContextBuilder;
  structuralResolverPipeline: StructuralResolverPipeline;
  answerScoringPipeline: AnswerScoringPipeline;
  scoreAdjustmentPipeline: ScoreAdjustmentPipeline;
  answerSelector: AnswerSelector;
  confidenceCalculator: ConfidenceCalculator;
  resultBuilder: PredictionResultBuilder;
};

/**
 * Главный управляющий класс predictor.
 *
 * Класс отвечает только за порядок стадий и жизненный цикл зависимостей.
 * Медицинские правила, regex и scorer-эвристики остаются в специализированных
 * модулях.
 */
export class PredictorEngine {
  constructor(private readonly dependencies: PredictorEngineDependencies) {}

  async predict(
    input: PredictorInput,
    options: PredictorOptions = {},
  ): Promise<PredictorResult> {
    const config = { ...DEFAULT_CONFIG, ...options };
    const pdfInput =
      input.pdfData ??
      input.pdfBuffer ??
      input.pdf ??
      input.file ??
      input.blob ??
      input.pdfUrl ??
      input.url ??
      input.pdfPath;
    if (!pdfInput) {
      throw new Error(
        "predict input requires pdfData, pdfUrl, file/blob, or pdfPath-compatible data",
      );
    }
    const mode = input.mode === "multi" ? "multi" : "single";
    const answers = normalizeAnswers(input.answers ?? input.variants ?? []);
    if (!answers.length) throw new Error("predict input requires answers");

    const runtime = await this.dependencies.runtimeStore.get(pdfInput, {
      cacheKey: input.cacheKey ?? input.pdfPath ?? input.pdfUrl ?? input.url,
      pdfjsLib: options.pdfjsLib,
      pdfVerbosity: options.pdfVerbosity,
    });
    const context: PredictionContext = this.dependencies.contextBuilder.build({
      runtime,
      config,
      mode,
      question: String(input.question ?? ""),
      answers,
    });
    const structuralResolution =
      this.dependencies.structuralResolverPipeline.resolve(context);
    const initialScores = this.dependencies.answerScoringPipeline.score(
      context,
      structuralResolution,
    );
    const adjustedScores = this.dependencies.scoreAdjustmentPipeline.apply(
      initialScores,
      context,
    );
    const { calibrated, selected } = this.dependencies.answerSelector.resolve(
      adjustedScores,
      mode,
      config,
    );
    const confidence = this.dependencies.confidenceCalculator.calculate(
      calibrated,
      selected,
      mode,
    );

    return this.dependencies.resultBuilder.build({
      context,
      options,
      calibrated,
      selected,
      confidence,
    });
  }

  clearCache() {
    this.dependencies.runtimeStore.clear();
  }
}
