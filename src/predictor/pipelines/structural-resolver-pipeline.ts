import type {
  PredictionContext,
  StructuralResolution,
  StructuralResolutionItem,
} from "../contracts.js";
import { resolveHierarchicalList } from "../scorers/hierarchical-list/index.js";
import { resolveRecommendationProposition } from "../scorers/recommendation-proposition/index.js";
import { resolveRepeatedRecommendationSet } from "../scorers/recommendation-set/index.js";
import { resolveRiskFactorList } from "../scorers/risk-factor-list/index.js";
import { resolveSiblingList } from "../scorers/sibling-list/index.js";

/**
 * Запускает document-level resolver-ы и объединяет их корректировки по answer id.
 */
export class StructuralResolverPipeline {
  resolve(context: PredictionContext): StructuralResolution {
    const { runtime, config, mode, question, answers, focusTokens, topQuestionPages } = context;
    const boundedSiblingListResolution = resolveSiblingList({
      mode,
      pages: runtime.pdfText.pages,
      question,
      answers,
      focusTokens,
      enableMultiMembership: config.siblingListMultiResolver,
      enableSingleInverse: config.siblingListSingleResolver,
    });
    const hierarchicalListResolution = config.hierarchicalListResolver
      ? resolveHierarchicalList({ mode, pages: runtime.pdfText.pages, question, answers })
      : new Map();
    const recommendationPropositionResolution = config.recommendationPropositionResolver
      ? resolveRecommendationProposition({ mode, pages: runtime.pdfText.pages, question, answers })
      : new Map();
    const repeatedRecommendationSetResolution = resolveRepeatedRecommendationSet({
      mode,
      pages: runtime.pdfText.pages,
      question,
      answers,
    });
    const riskFactorListResolution = resolveRiskFactorList({
      mode,
      pdfText: runtime.pdfText,
      pages: runtime.pdfText.pages,
      topQuestionPages,
      question,
      answers,
    });

    return this.merge(
      boundedSiblingListResolution,
      hierarchicalListResolution,
      recommendationPropositionResolution,
      repeatedRecommendationSetResolution,
      riskFactorListResolution,
    );
  }

  private merge(
    ...resolutions: Array<
      ReadonlyMap<string, StructuralResolutionItem> | null | undefined
    >
  ): StructuralResolution {
    const merged: StructuralResolution = new Map();
    for (const resolution of resolutions) {
      for (const [answerId, item] of resolution ?? []) {
        const previous = merged.get(answerId) ?? { adjustment: 0, evidence: null };
        merged.set(answerId, {
          adjustment: previous.adjustment + (item.adjustment ?? 0),
          evidence:
            !previous.evidence || (item.evidence?.score ?? -Infinity) > previous.evidence.score
              ? item.evidence ?? previous.evidence
              : previous.evidence,
        });
      }
    }
    return merged;
  }
}
