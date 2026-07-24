import { latinAnswerTokens } from "../scorers/biomedical-symbols.js";
import { applyClauseLocalCountTupleResolver } from "../scorers/count-tuple.js";
import { applyNegationPairClauseResolver } from "../scorers/negation-pair.js";
import {
  applyExplicitOrdinalRangeSetScores,
  resolveExplicitOrdinalRangeSet,
} from "../scorers/multi-set.js";
import { applySingleRelationTupleResolver } from "../scorers/relation-tuple.js";
import { applyFrozenFeatureRanker } from "../selection.js";
import type {
  QuestionIntent,
  ScoreAdjustmentContext,
  ScoreAdjustmentProcessor,
} from "../contracts.js";
import type { AnswerMode, AnswerScore } from "../types.js";

export type SharedMultiSegmentSupport = (
  scores: AnswerScore[],
  intent: QuestionIntent,
  question: string,
) => AnswerScore[];

export type GeneSentenceSetSupport = (
  scores: AnswerScore[],
  mode: AnswerMode,
  question: string,
) => AnswerScore[];

export type QuestionDefinitionLabel = (question: string) => string | null;

/** Добавляет поддержку кандидатов из одного надежного multi-сегмента. */
export class SharedMultiSegmentProcessor implements ScoreAdjustmentProcessor {
  readonly id = "shared-multi-segment";

  constructor(private readonly addSupport: SharedMultiSegmentSupport) {}

  apply(scores: AnswerScore[], context: ScoreAdjustmentContext) {
    if (context.mode !== "multi" || !context.config.sharedMultiSegmentBoost) {
      return scores;
    }
    return this.addSupport(scores, context.intent, context.question);
  }
}

/** Применяет gene-sentence поддержку на уровне всего набора вариантов. */
export class GeneSentenceSetProcessor implements ScoreAdjustmentProcessor {
  readonly id = "gene-sentence-set";

  constructor(private readonly applySupport: GeneSentenceSetSupport) {}

  apply(scores: AnswerScore[], context: ScoreAdjustmentContext) {
    return this.applySupport(scores, context.mode, context.question);
  }
}

/** Ослабляет варианты вне найденного label-definition контракта. */
export class DefinitionLabelProcessor implements ScoreAdjustmentProcessor {
  readonly id = "definition-label";

  constructor(private readonly definitionLabel: QuestionDefinitionLabel) {}

  apply(scores: AnswerScore[], context: ScoreAdjustmentContext) {
    if (
      context.mode !== "single" ||
      !this.definitionLabel(context.question) ||
      !scores.some((item) =>
        item.evidence.some(
          (evidenceItem) => evidenceItem.kind === "label_definition_segment",
        ),
      )
    ) {
      return scores;
    }

    return scores.map((item) =>
      item.evidence.some(
        (evidenceItem) => evidenceItem.kind === "label_definition_segment",
      )
        ? item
        : { ...item, raw: item.raw * 0.48 },
    );
  }
}

/** Требует локальную OCR/gene поддержку для Latin-вариантов multi-вопроса. */
export class LatinOcrSetProcessor implements ScoreAdjustmentProcessor {
  readonly id = "latin-ocr-set";

  apply(scores: AnswerScore[], context: ScoreAdjustmentContext) {
    if (
      context.mode !== "multi" ||
      !scores.some((item) =>
        item.evidence.some(
          (evidenceItem) => evidenceItem.kind === "latin_fuzzy_ocr",
        ),
      )
    ) {
      return scores;
    }

    return scores.map((item) => {
      const hasLatin = latinAnswerTokens(item.answer.text).length > 0;
      const hasLatinSupport = item.evidence.some(
        (evidenceItem) =>
          evidenceItem.kind === "latin_fuzzy_ocr" ||
          evidenceItem.kind === "gene_sentence_segment",
      );
      return hasLatin && !hasLatinSupport
        ? { ...item, raw: item.raw * 0.68 }
        : item;
    });
  }
}

/** Декодирует явно записанный ordinal range/list как один multi-набор. */
export class ExplicitOrdinalRangeSetProcessor
  implements ScoreAdjustmentProcessor
{
  readonly id = "explicit-ordinal-range-set";

  apply(scores: AnswerScore[], context: ScoreAdjustmentContext) {
    if (!context.config.explicitOrdinalRangeSetDecoder) return scores;
    const resolution = resolveExplicitOrdinalRangeSet({
      mode: context.mode,
      pages: context.runtime.pdfText.pages,
      topQuestionPages: context.topQuestionPages,
      question: context.question,
      answers: context.answers,
    });
    return resolution
      ? applyExplicitOrdinalRangeSetScores(scores, resolution)
      : scores;
  }
}

/** Применяет frozen feature ranker с зафиксированными весами. */
export class FrozenFeatureRankerProcessor implements ScoreAdjustmentProcessor {
  readonly id = "frozen-feature-ranker";

  apply(scores: AnswerScore[], context: ScoreAdjustmentContext) {
    return applyFrozenFeatureRanker(
      scores,
      context.mode,
      context.config,
      { question: context.question },
    );
  }
}

/** Разрешает bounded subject/role/condition/value relation tuples. */
export class RelationTupleProcessor implements ScoreAdjustmentProcessor {
  readonly id = "relation-tuple";

  apply(scores: AnswerScore[], context: ScoreAdjustmentContext) {
    if (!context.config.relationTupleResolver) return scores;
    return applySingleRelationTupleResolver(scores, {
      mode: context.mode,
      pages: context.runtime.pdfText.pages,
      topQuestionPages: context.topQuestionPages,
      question: context.question,
      answers: context.answers,
      enableIntervalFamilies: context.config.intervalRelationTupleResolver,
    });
  }
}

/** Связывает count predicate, counted object и одно значение в одной clause. */
export class ClauseLocalCountTupleProcessor
  implements ScoreAdjustmentProcessor
{
  readonly id = "clause-local-count-tuple";

  apply(scores: AnswerScore[], context: ScoreAdjustmentContext) {
    if (!context.config.clauseLocalCountTupleResolver) return scores;
    return applyClauseLocalCountTupleResolver(scores, {
      mode: context.mode,
      pages: context.runtime.pdfText.pages,
      topQuestionPages: context.topQuestionPages,
      question: context.question,
      answers: context.answers,
    });
  }
}

/** Опциональный paired-negation resolver; по умолчанию feature flag выключен. */
export class NegationPairProcessor implements ScoreAdjustmentProcessor {
  readonly id = "negation-pair";

  apply(scores: AnswerScore[], context: ScoreAdjustmentContext) {
    if (!context.config.negationPairClauseResolver) return scores;
    return applyNegationPairClauseResolver(scores, {
      mode: context.mode,
      pages: context.runtime.pdfText.pages,
      topQuestionPages: context.topQuestionPages,
      question: context.question,
      answers: context.answers,
      focusTokens: context.focusTokens,
    });
  }
}
