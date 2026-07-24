import { latinAnswerTokens } from "../scorers/biomedical-symbols.js";
import { applyClauseLocalCountTupleResolver } from "../scorers/count-tuple.js";
import { applyNegationPairClauseResolver } from "../scorers/negation-pair.js";
import {
  applyExplicitOrdinalRangeSetScores,
  resolveExplicitOrdinalRangeSet,
} from "../scorers/multi-set.js";
import { applySingleRelationTupleResolver } from "../scorers/relation-tuple.js";
import { applyFrozenFeatureRanker } from "../selection.js";
import type { PredictionContext } from "../contracts.js";
import type { AnswerScore } from "../types.js";

export type LegacyScoreAdjustments = {
  addSharedMultiSegmentSupport(scores: AnswerScore[], intent: any, question: string): AnswerScore[];
  applyGeneSentenceSetSupport(scores: AnswerScore[], mode: string, question: string): AnswerScore[];
  questionDefinitionLabel(question: string): unknown;
};

/**
 * Выполняет set-level и post-scoring корректировки в фиксированном порядке.
 */
export class ScoreAdjustmentPipeline {
  constructor(private readonly legacy: LegacyScoreAdjustments) {}

  apply(inputScores: AnswerScore[], context: PredictionContext): AnswerScore[] {
    const { runtime, config, mode, question, answers, focusTokens, topQuestionPages, intent } = context;
    let answerScores = inputScores;

    if (mode === "multi" && config.sharedMultiSegmentBoost) {
      answerScores = this.legacy.addSharedMultiSegmentSupport(answerScores, intent, question);
    }
    answerScores = this.legacy.applyGeneSentenceSetSupport(answerScores, mode, question);
    if (
      mode === "single" &&
      this.legacy.questionDefinitionLabel(question) &&
      answerScores.some((item) =>
        item.evidence.some((evidenceItem) => evidenceItem.kind === "label_definition_segment"),
      )
    ) {
      answerScores = answerScores.map((item) =>
        item.evidence.some((evidenceItem) => evidenceItem.kind === "label_definition_segment")
          ? item
          : { ...item, raw: item.raw * 0.48 },
      );
    }
    if (
      mode === "multi" &&
      answerScores.some((item) =>
        item.evidence.some((evidenceItem) => evidenceItem.kind === "latin_fuzzy_ocr"),
      )
    ) {
      answerScores = answerScores.map((item) => {
        const hasLatin = latinAnswerTokens(item.answer.text).length > 0;
        const hasLatinSupport = item.evidence.some(
          (evidenceItem) =>
            evidenceItem.kind === "latin_fuzzy_ocr" || evidenceItem.kind === "gene_sentence_segment",
        );
        return hasLatin && !hasLatinSupport ? { ...item, raw: item.raw * 0.68 } : item;
      });
    }
    const explicitOrdinalRangeSet = config.explicitOrdinalRangeSetDecoder
      ? resolveExplicitOrdinalRangeSet({
          mode,
          pages: runtime.pdfText.pages,
          topQuestionPages,
          question,
          answers,
        })
      : null;
    if (explicitOrdinalRangeSet) {
      answerScores = applyExplicitOrdinalRangeSetScores(answerScores, explicitOrdinalRangeSet);
    }
    answerScores = applyFrozenFeatureRanker(answerScores, mode, config, { question });
    if (config.relationTupleResolver) {
      answerScores = applySingleRelationTupleResolver(answerScores, {
        mode,
        pages: runtime.pdfText.pages,
        topQuestionPages,
        question,
        answers,
        enableIntervalFamilies: config.intervalRelationTupleResolver,
      });
    }
    if (config.clauseLocalCountTupleResolver) {
      answerScores = applyClauseLocalCountTupleResolver(answerScores, {
        mode,
        pages: runtime.pdfText.pages,
        topQuestionPages,
        question,
        answers,
      });
    }
    if (config.negationPairClauseResolver) {
      answerScores = applyNegationPairClauseResolver(answerScores, {
        mode,
        pages: runtime.pdfText.pages,
        topQuestionPages,
        question,
        answers,
        focusTokens,
      });
    }

    return answerScores;
  }
}
