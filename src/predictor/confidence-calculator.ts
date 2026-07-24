import {
  BROAD_EVIDENCE_KINDS as CONFIDENCE_BROAD_KINDS,
  CONFIDENCE_STRUCTURAL_EVIDENCE_KINDS as CONFIDENCE_STRUCTURAL_KINDS,
} from "./scorer-registry.js";
import type {
  AnswerMode,
  CalibratedAnswerScore,
} from "./types.js";

function confidenceEvidenceSummary(item: CalibratedAnswerScore) {
  let bestScore = 0;
  let bestKind = "";
  let structuralScore = 0;
  let broadCount = 0;
  for (const evidence of item.evidence ?? []) {
    const score = Number(evidence.score ?? 0);
    if (score > bestScore) {
      bestScore = score;
      bestKind = String(evidence.kind ?? "");
    }
    if (CONFIDENCE_STRUCTURAL_KINDS.has(evidence.kind)) {
      structuralScore = Math.max(structuralScore, score);
    }
    if (CONFIDENCE_BROAD_KINDS.has(evidence.kind)) broadCount += 1;
  }
  return {
    bestScore,
    bestKind,
    structuralScore,
    hasStructural: structuralScore > 0,
    broadOnly: broadCount > 0 && structuralScore <= 0,
  };
}

function clampConfidence(value: number) {
  return Math.max(0.05, Math.min(0.99, value));
}

/**
 * Считает итоговую уверенность прогноза без влияния на выбранные ответы.
 */
export class ConfidenceCalculator {
  calculate(
    calibrated: CalibratedAnswerScore[],
    selected: string[],
    mode: AnswerMode,
  ): number {
    const selectedScores = selected.map(
      (id) => calibrated.find((item) => item.answer.id === id)?.score ?? 0,
    );
    let confidence =
      mode === "single"
        ? Math.max(...selectedScores, 0)
        : selectedScores.reduce((sum, score) => sum + score, 0) /
          (selectedScores.length || 1);
    const sorted = [...calibrated].sort((a, b) => b.raw - a.raw);
    const selectedSet = new Set(selected);
    const selectedItems = calibrated.filter((item) => selectedSet.has(item.answer.id));
    const selectedSummaries = selectedItems.map(confidenceEvidenceSummary);

    const broadOnlySelected = selectedSummaries.filter((summary) => summary.broadOnly).length;
    const structuralSelected = selectedSummaries.filter((summary) => summary.hasStructural).length;
    const selectedCount = Math.max(1, selectedItems.length);

    let penalty = 0;
    if (broadOnlySelected) penalty += Math.min(0.16, 0.045 * broadOnlySelected);
    if (!structuralSelected && selectedItems.length) {
      penalty += mode === "multi" ? 0.055 : 0.035;
    }

    if (mode === "single") {
      const top = sorted[0];
      const second = sorted[1];
      if (top && second) {
        const gap = top.raw - second.raw;
        if (gap < 0.35) penalty += 0.095;
        else if (gap < 0.85) penalty += 0.06;
        else if (gap < 1.5) penalty += 0.03;
        const topSummary = confidenceEvidenceSummary(top);
        if (topSummary.broadOnly && gap < 2.2) penalty += 0.045;
      }
    } else {
      const selectedRaw = selectedItems.map((item) => item.raw);
      const unselectedRaw = calibrated
        .filter((item) => !selectedSet.has(item.answer.id))
        .map((item) => item.raw);
      const minSelected = selectedRaw.length ? Math.min(...selectedRaw) : 0;
      const maxUnselected = unselectedRaw.length ? Math.max(...unselectedRaw) : 0;
      const boundaryGap = minSelected - maxUnselected;
      if (boundaryGap < 0.2) penalty += 0.095;
      else if (boundaryGap < 0.7) penalty += 0.06;
      else if (boundaryGap < 1.4) penalty += 0.03;
      if (
        selected.length >= calibrated.length - 1 &&
        calibrated.length >= 4 &&
        !structuralSelected
      ) {
        penalty += 0.04;
      }
      penalty += Math.min(0.08, (broadOnlySelected / selectedCount) * 0.07);
    }

    const structuralBonus = structuralSelected
      ? Math.min(
          0.035,
          selectedSummaries.reduce(
            (sum, summary) => sum + Math.min(18, summary.structuralScore),
            0,
          ) /
            selectedCount /
            600,
        )
      : 0;
    return clampConfidence(confidence - penalty + structuralBonus);
  }
}
