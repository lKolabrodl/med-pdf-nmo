import type { PredictionContext } from "./contracts.js";
import { round4 } from "./selection.js";
import { SourceContextBuilder } from "./source-context.js";
import type { PredictorOptions, PredictorResult } from "./types.js";

/**
 * Собирает стабильный публичный результат после завершения scoring и selection.
 */
export class PredictionResultBuilder {
  constructor(private readonly sourceContextBuilder = new SourceContextBuilder()) {}

  build({
    context,
    options,
    calibrated,
    selected,
    confidence,
  }: {
    context: PredictionContext;
    options: PredictorOptions;
    calibrated: any[];
    selected: string[];
    confidence: number;
  }): PredictorResult {
    const { runtime, config, mode, question, answers, intent, topQuestionMatches } = context;
    const scores = Object.fromEntries(
      calibrated.map((item) => [item.answer.id, item.score]),
    );
    const rawScores = Object.fromEntries(
      calibrated.map((item) => [item.answer.id, round4(item.raw)]),
    );
    const sources =
      options.includeSources === false
        ? this.sourceContextBuilder.empty(answers, selected)
        : this.sourceContextBuilder.build({
            pages: runtime.pdfText.pages,
            question,
            answers,
            selected,
            answerScores: calibrated,
            questionAnchors: topQuestionMatches,
            options: {
              maxChars: options.sourcePassageMaxChars,
              excerptsPerAnswer: options.sourcePassagesPerAnswer,
            },
          });
    const source = sources.question
      ? { page: sources.question.page, text: sources.question.text }
      : null;
    const evidence = calibrated
      .flatMap((item) =>
        item.evidence.map((evidenceItem) => ({
          ...evidenceItem,
          answerId: item.answer.id,
          score: round4(evidenceItem.score),
        })),
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, config.evidenceLimit);
    const diagnostics = options.diagnostics
      ? { answerEvidence: this.buildAnswerEvidenceDiagnostics(calibrated) }
      : undefined;

    return {
      selected,
      mode,
      confidence: round4(confidence),
      scores,
      rawScores,
      evidence,
      source,
      sources,
      ...(diagnostics ? { diagnostics } : {}),
      meta: {
        pageCount: runtime.pdfText.pageCount,
        chunks: runtime.chunks.length,
        ocrNeeded: runtime.pdfText.ocrNeeded,
        intent,
      },
    };
  }

  private buildAnswerEvidenceDiagnostics(calibrated) {
    return Object.fromEntries(
      calibrated.map((item) => {
        const kindCounts = {};
        const kindBestScores = {};
        const pages = new Set();
        let bestEvidenceScore = 0;

        for (const evidenceItem of item.evidence ?? []) {
          const kind = String(evidenceItem.kind ?? "unknown");
          const score = Number(evidenceItem.score ?? 0);
          kindCounts[kind] = (kindCounts[kind] ?? 0) + 1;
          kindBestScores[kind] = round4(Math.max(kindBestScores[kind] ?? 0, score));
          bestEvidenceScore = Math.max(bestEvidenceScore, score);
          if (Number.isFinite(evidenceItem.page)) pages.add(evidenceItem.page);
        }

        return [
          item.answer.id,
          {
            evidenceCount: item.evidence?.length ?? 0,
            uniqueEvidencePages: pages.size,
            bestEvidenceScore: round4(bestEvidenceScore),
            kindCounts,
            kindBestScores,
            refs: (item.evidence ?? []).map((evidenceItem) => ({
              page: Number.isFinite(evidenceItem.page) ? evidenceItem.page : 0,
              kind: String(evidenceItem.kind ?? "unknown"),
              score: round4(Number(evidenceItem.score ?? 0)),
            })),
          },
        ];
      }),
    );
  }
}
