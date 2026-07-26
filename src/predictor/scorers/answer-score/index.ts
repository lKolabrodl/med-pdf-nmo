import { extractNumbers } from "../../../normalize.js";
import type {
  AnswerScoreResult,
  AnswerScoringContext,
} from "../../contracts.js";
import { bestAbbreviationAliasSupport } from "../abbreviation-alias/index.js";
import {
  bestAgeFormSupport,
  bestAnswerOrdinalRowSupport,
  bestRomanStageSupport,
} from "../age-stage/index.js";
import {
  bestGeneSentenceSupport,
  bestLatinFuzzySupport,
} from "../biomedical-symbols/index.js";
import {
  bestClassificationCodeSupport,
  bestExactShortLabelRowSupport,
  bestLabelNumberSupport,
  bestMkbClassExclusionSupport,
  bestShortLabelRowSupport,
  bestVisualTableColumnSupport,
} from "../classification/index.js";
import { clinicalFeatureAdjustment } from "../clinical-feature/index.js";
import {
  bestCoordinateMultiCellRowSupport,
  bestCoordinateRelationalRowSupport,
  bestCoordinateTableGroupSupport,
  bestCoordinateTableMembershipSupport,
  bestCoordinateTableRowSupport,
} from "../coordinate-table/index.js";
import {
  activeTherapyIndicationAdjustment,
  bestDefinitionExactAnswerSupport,
  bestFrequencyPolaritySupport,
  bestLabelDefinitionSupport,
  bestTermDefinitionSupport,
  definitionCompletionAdjustment,
  frequencyPolarity,
  impossibilityOnlyAdjustment,
  negatedAnswerPrefixAdjustment,
  recommendationPolarityAdjustment,
} from "../definition/index.js";
import {
  clinicalCourseCueAdjustment,
  contrastCueMismatchAdjustment,
  excludedConditionMismatchAdjustment,
  polarityAdjustment,
  temporalCueAdjustment,
} from "../direction/index.js";
import { bestDrugDoseSupport } from "../drug-dose/index.js";
import { bestExactAnswerSupport } from "../exact-answer/index.js";
import { bestFibrosisStageSupport } from "../fibrosis-stage/index.js";
import {
  bestFocusedSupport,
  bestLineTokenSupport,
} from "../focused/index.js";
import { bestFrequencyRecommendationSupport } from "../frequency/index.js";
import {
  ageEligibilityAdjustment,
  bestBoundedListSupport,
  bestIndicationSegmentSupport,
  bestOrdinalListSupport,
  bestTypeOrdinalSupport,
  indicationScopeAdjustment,
} from "../list-evidence/index.js";
import {
  bestParentheticalGroupSupport,
  bestQuestionContinuationListSupport,
  bestShortMedicalAliasSupport,
} from "../multi-support/index.js";
import {
  bestClozeGapSupport,
  bestConditionedNumberSupport,
  bestCountRelationSupport,
  bestExactHourAliasOptionSupport,
  bestExactNumericOptionSupport,
  bestNumericConditionSupport,
  bestSubjectBoundNumericClauseSupport,
  conditionPairAdjustment,
} from "../numeric/index.js";
import { bestCyrillicOcrSupport } from "../ocr-fuzzy/index.js";
import {
  optionFamilyCompactComboAdjustment,
  optionFamilyComparatorAdjustment,
} from "../option-family/index.js";
import {
  bestRecommendationBlockSupport,
  bestRecommendationItemSupport,
  explicitRecommendationTargetAdjustment,
} from "../recommendation-item/index.js";
import {
  bestChunkSupport,
  bestClassSubjectSupport,
  bestPrefixSupport,
  genericPopulationConditionAdjustmentForMode,
  lineTokenApplicable,
  numberSpecificity,
  riskConditionAdjustment,
} from "../search-support/index.js";
import {
  bestAnchorSupport,
  bestPhraseSupport,
  bestPrecedingQuestionLabelSupport,
  bestRowLabelSupport,
  bestSectionSupport,
} from "../search/index.js";
import type {EvidenceItem} from "../../types.js";

/**
 * Собирает evidence всех scorer-модулей и вычисляет сырой score одного ответа.
 *
 * Функция не калибрует score и не выбирает итоговый вариант.
 *
 * @param context Полный контекст скоринга текущего варианта.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 */
export function scoreAnswer(
  context: AnswerScoringContext,
): AnswerScoreResult {
  const anchor = bestAnchorSupport(context);
  const section = bestSectionSupport(context);
  const rowLabel = bestRowLabelSupport(context);
  const focused = bestFocusedSupport(context);
  const lineToken = lineTokenApplicable(context) ? bestLineTokenSupport(context) : null;
  const prefix = bestPrefixSupport(context);
  const phrase = bestPhraseSupport(context);
  const precedingLabel = bestPrecedingQuestionLabelSupport(context);
  const exactAnswer = bestExactAnswerSupport(context);
  const chunk = bestChunkSupport(context);
  const polarity = polarityAdjustment(context);
  const temporal = temporalCueAdjustment(context);
  const clinicalCourseCue = clinicalCourseCueAdjustment(context);
  const conditionPair = conditionPairAdjustment(context);
  const riskCondition = riskConditionAdjustment(context);
  const genericPopulation = genericPopulationConditionAdjustmentForMode(context);
  const classSubject = bestClassSubjectSupport(context);
  const frequency = bestFrequencyRecommendationSupport(context);
  const negativeLocal = { adjustment: 0, evidence: null };
  const boundedList = bestBoundedListSupport(context);
  const ordinalList = bestOrdinalListSupport(context);
  const typeOrdinal = bestTypeOrdinalSupport(context);
  const indicationLabel = bestIndicationSegmentSupport(context);
  const indicationScope = indicationScopeAdjustment(context);
  const labelDefinition = bestLabelDefinitionSupport(context);
  const recommendationPolarity = recommendationPolarityAdjustment(context);
  const exactNumericOption = bestExactNumericOptionSupport(context);
  const subjectNumericClause = bestSubjectBoundNumericClauseSupport(context);
  const exactHourAlias = bestExactHourAliasOptionSupport(context);
  const ageEligibility = ageEligibilityAdjustment(context);
  const drugDose = bestDrugDoseSupport(context);
  const termDefinition = bestTermDefinitionSupport(context);
  const definitionExactAnswer = bestDefinitionExactAnswerSupport(context);
  const frequencyPolarity = bestFrequencyPolaritySupport(context);
  const negatedAnswerPrefix = negatedAnswerPrefixAdjustment(context);
  const impossibilityOnly = impossibilityOnlyAdjustment(context);
  const activeTherapyIndication = activeTherapyIndicationAdjustment(context);
  const recommendationItem = bestRecommendationItemSupport(context);
  const recommendationBlock = bestRecommendationBlockSupport(context);
  const explicitRecommendationTarget = explicitRecommendationTargetAdjustment(context);
  const conditionedNumber = bestConditionedNumberSupport(context);
  const numericCondition = bestNumericConditionSupport(context);
  const countRelation = context.config?.countRelationBoost ? bestCountRelationSupport(context) : null;
  const ageForm = bestAgeFormSupport(context);
  const fibrosisStage = bestFibrosisStageSupport(context);
  const romanStage = bestRomanStageSupport(context);
  const answerOrdinalRow = bestAnswerOrdinalRowSupport(context);
  const clozeGap = bestClozeGapSupport(context);
  const visualTableColumn = bestVisualTableColumnSupport(context);
  const coordinateTableRow = bestCoordinateTableRowSupport(context);
  const coordinateRelationalRow = bestCoordinateRelationalRowSupport(context);
  const coordinateTableGroup = bestCoordinateTableGroupSupport(context);
  const coordinateMultiCellRow = bestCoordinateMultiCellRowSupport(context);
  const coordinateTableMembership = bestCoordinateTableMembershipSupport(context);
  const parentheticalGroup = bestParentheticalGroupSupport(context);
  const questionContinuationList = bestQuestionContinuationListSupport(context);
  const shortMedicalAlias = bestShortMedicalAliasSupport(context);
  const abbreviationAlias = bestAbbreviationAliasSupport(context);
  const latinFuzzy = bestLatinFuzzySupport(context);
  const cyrillicOcr = bestCyrillicOcrSupport(context);
  const geneSentence = bestGeneSentenceSupport(context);
  const clinicalFeature = clinicalFeatureAdjustment(context);
  const mkbClassExclusion = bestMkbClassExclusionSupport(context);
  const labelNumber = bestLabelNumberSupport(context);
  const classificationCode = bestClassificationCodeSupport(context);
  const exactShortLabelRow = bestExactShortLabelRowSupport(context);
  const shortLabelRow = bestShortLabelRowSupport(context);
  const siblingList = context.siblingListResolution?.get(context.answer.id) ?? { adjustment: 0, evidence: null };
  const answerTokens = context.answerTokens;
  const numbers = extractNumbers(context.answer.text);
  const answerPhraseFound = phrase?.kind === "answer_window" || phrase?.kind === "answer_after_question" || phrase?.kind === "question_answer_phrase";
  const phraseWeight =
    phrase?.kind === "answer_window" ? 0.55 : phrase?.kind === "answer_directional_window" ? 0.95 : phrase ? 1.15 : 0;
  const focusedWeight = context.mode === "multi" ? 0.15 : 0.9;
  const lineTokenWeight = context.mode === "single" ? 0.85 : 0;
  const latinFuzzyWeight = context.mode === "multi" && polarity.evidence?.kind !== "polarity_mismatch" ? 1.15 : 0;
  const abbreviationAliasWeight =
    Math.max(chunk?.score ?? 0, phrase?.score ?? 0, focused?.score ?? 0, exactAnswer?.score ?? 0) >= 8.8 ? 0.04 : 0.23;
  let raw =
    (anchor?.score ?? 0) * 1.35 +
    (section?.score ?? 0) * 1.2 +
    (rowLabel?.score ?? 0) * 0.95 +
    (focused?.score ?? 0) * focusedWeight +
    (lineToken?.score ?? 0) * lineTokenWeight +
    (prefix?.score ?? 0) * 1.15 +
    (phrase?.score ?? 0) * phraseWeight +
    (precedingLabel?.score ?? 0) * 1.3 +
    (exactAnswer?.score ?? 0) * 1.08 +
    (chunk?.score ?? 0) * 1.0 +
    polarity.adjustment +
    (temporal.support?.score ?? 0) * 1.0 +
    temporal.adjustment +
    (clinicalCourseCue.support?.score ?? 0) * 1.05 +
    clinicalCourseCue.adjustment +
    conditionPair.adjustment +
    riskCondition.adjustment +
    genericPopulation.adjustment +
    (classSubject?.score ?? 0) * 1.15 +
    (frequency?.score ?? 0) * 1.1 +
    negativeLocal.adjustment +
    (boundedList.support?.score ?? 0) * 1.15 +
    boundedList.adjustment +
    (ordinalList?.score ?? 0) * 1.15 +
    (typeOrdinal?.score ?? 0) * 1.15 +
    (indicationLabel?.score ?? 0) * 1.15 +
    indicationScope.adjustment +
    (labelDefinition?.score ?? 0) * 1.15 +
    (recommendationPolarity.support?.score ?? 0) * 1.05 +
    recommendationPolarity.adjustment +
    (exactNumericOption?.score ?? 0) * 1.04 +
    (subjectNumericClause?.score ?? 0) * 1.08 +
    (exactHourAlias?.score ?? 0) * 1.08 +
    ageEligibility.adjustment +
    (drugDose?.score ?? 0) * 1.15 +
    (termDefinition?.score ?? 0) * 1.15 +
    (definitionExactAnswer?.score ?? 0) * 1.12 +
    (frequencyPolarity?.score ?? 0) * 1.08 +
    negatedAnswerPrefix.adjustment +
    impossibilityOnly.adjustment +
    activeTherapyIndication.adjustment +
    (recommendationItem?.score ?? 0) * 1.1 +
    (recommendationBlock?.score ?? 0) * 0.92 +
    (explicitRecommendationTarget.support?.score ?? 0) * 1.05 +
    explicitRecommendationTarget.adjustment +
    (conditionedNumber?.score ?? 0) * 1.1 +
    (numericCondition?.score ?? 0) * 1.05 +
    (countRelation?.score ?? 0) * 1.1 +
    (ageForm?.score ?? 0) * 1.15 +
    (fibrosisStage?.score ?? 0) * 1.15 +
    (romanStage?.score ?? 0) * 1.15 +
    (answerOrdinalRow?.score ?? 0) * 1.15 +
    (clozeGap?.score ?? 0) * 1.12 +
    (visualTableColumn?.score ?? 0) * 1.18 +
    (coordinateTableRow?.score ?? 0) * 1.12 +
    (coordinateRelationalRow?.score ?? 0) * 1.16 +
    (coordinateTableGroup?.score ?? 0) * 1.16 +
    (coordinateMultiCellRow?.score ?? 0) * 1.16 +
    (coordinateTableMembership?.score ?? 0) * 1.1 +
    (parentheticalGroup?.score ?? 0) * 1.16 +
    (questionContinuationList?.score ?? 0) * 1.1 +
    (shortMedicalAlias?.score ?? 0) * 0.35 +
    (abbreviationAlias?.score ?? 0) * abbreviationAliasWeight +
    (latinFuzzy?.score ?? 0) * latinFuzzyWeight +
    (cyrillicOcr?.score ?? 0) * 1.08 +
    (geneSentence?.score ?? 0) * 1.18 +
    (clinicalFeature.support?.score ?? 0) * 1.12 +
    clinicalFeature.adjustment +
    (mkbClassExclusion.support?.score ?? 0) * 1.12 +
    mkbClassExclusion.adjustment +
    (labelNumber?.score ?? 0) * 1.15 +
    (classificationCode?.score ?? 0) * 1.15 +
    (exactShortLabelRow?.score ?? 0) * 1.2 +
    (shortLabelRow?.score ?? 0) * 1.15 +
    (siblingList.evidence?.score ?? 0) * 1.15 +
    siblingList.adjustment +
    (answerPhraseFound ? 0.35 : 0) +
    (numbers.length ? numberSpecificity(context.answer.text) * 0.35 : 0) +
    Math.min(0.35, answerTokens.length * 0.015);
  if (context.intent.listLike && context.anchorSegments?.length && !anchor) {
    raw *= 0.62;
  }
  if (context.intent.listLike && context.sectionSegments?.length && !section) {
    raw *= 0.72;
  }

  let evidence: EvidenceItem[] = [
    anchor,
    section,
    rowLabel,
    focused,
    lineToken,
    prefix,
    phrase,
    precedingLabel,
    exactAnswer,
    chunk,
    polarity.evidence,
    temporal.support,
    temporal.evidence,
    clinicalCourseCue.support,
    clinicalCourseCue.evidence,
    conditionPair.evidence,
    riskCondition.evidence,
    genericPopulation.evidence,
    classSubject,
    frequency,
    negativeLocal.evidence,
    boundedList.support,
    boundedList.evidence,
    ordinalList,
    typeOrdinal,
    indicationLabel,
    indicationScope.evidence,
    labelDefinition,
    recommendationPolarity.support,
    recommendationPolarity.evidence,
    exactNumericOption,
    subjectNumericClause,
    exactHourAlias,
    ageEligibility.evidence,
    drugDose,
    termDefinition,
    definitionExactAnswer,
    frequencyPolarity,
    negatedAnswerPrefix.evidence,
    impossibilityOnly.evidence,
    activeTherapyIndication.evidence,
    recommendationItem,
    recommendationBlock,
    explicitRecommendationTarget.support,
    explicitRecommendationTarget.evidence,
    conditionedNumber,
    numericCondition,
    countRelation,
    ageForm,
    fibrosisStage,
    romanStage,
    answerOrdinalRow,
    clozeGap,
    visualTableColumn,
    coordinateTableRow,
    coordinateRelationalRow,
    coordinateTableGroup,
    coordinateMultiCellRow,
    coordinateTableMembership,
    parentheticalGroup,
    questionContinuationList,
    shortMedicalAlias,
    abbreviationAlias,
    latinFuzzy,
    cyrillicOcr,
    geneSentence,
    clinicalFeature.support,
    clinicalFeature.evidence,
    mkbClassExclusion.support,
    mkbClassExclusion.evidence,
    labelNumber,
    classificationCode,
    exactShortLabelRow,
    shortLabelRow,
    siblingList.evidence,
  ].filter((item): item is EvidenceItem => Boolean(item));
  const definitionCompletion = definitionCompletionAdjustment(context, evidence);
  raw += definitionCompletion.adjustment;
  if (definitionCompletion.evidence) evidence.push(definitionCompletion.evidence);
  const contrastCue = contrastCueMismatchAdjustment(context, evidence.sort((a, b) => b.score - a.score));
  raw += contrastCue.adjustment;
  if (contrastCue.evidence) evidence.push(contrastCue.evidence);
  if (context.config?.optionFamilyComparatorGuard) {
    const optionFamilyComparator = optionFamilyComparatorAdjustment({ answer: context.answer, answers: context.answers, evidence });
    raw += optionFamilyComparator.adjustment;
    if (optionFamilyComparator.evidence) evidence.push(optionFamilyComparator.evidence);
  }
  if (context.config?.optionFamilyCompactComboGuard) {
    const optionFamilyCompactCombo = optionFamilyCompactComboAdjustment({ question: context.question, answer: context.answer, evidence });
    raw += optionFamilyCompactCombo.adjustment;
    if (optionFamilyCompactCombo.evidence) evidence.push(optionFamilyCompactCombo.evidence);
  }
  const excludedCondition = excludedConditionMismatchAdjustment(context, evidence.sort((a, b) => b.score - a.score));
  raw += excludedCondition.adjustment;
  if (excludedCondition.evidence) evidence.push(excludedCondition.evidence);
  evidence = evidence.sort((a, b) => b.score - a.score);
  return { raw, evidence };
}
