import {containsNormalizedPhrase, normalizeForSearch} from "./dependencies.js";

export type ConditionFamily = "heavy" | "moderate" | "mild";

export function conditionFamily(text: unknown): ConditionFamily | null {
  const normalized = normalizeForSearch(text);
  if (containsNormalizedPhrase(normalized, "тяжел")) return "heavy";
  if (containsNormalizedPhrase(normalized, "умерен") || containsNormalizedPhrase(normalized, "средн")) return "moderate";
  if (containsNormalizedPhrase(normalized, "легк")) return "mild";
  return null;
}

export function nearestConditionFamily(normalizedText: string): ConditionFamily | null {
  let best: {family: ConditionFamily; index: number} | null = null;
  const entries: Array<[ConditionFamily, string[]]> = [
    ["heavy", ["тяжел"]],
    ["moderate", ["умерен", "средн"]],
    ["mild", ["легк"]],
  ];
  for (const [family, cues] of entries) {
    for (const cueText of cues) {
      const cue = normalizeForSearch(cueText);
      const index = normalizedText.indexOf(cue);
      if (index >= 0 && (!best || index < best.index)) best = { family, index };
    }
  }
  return best?.family ?? null;
}
