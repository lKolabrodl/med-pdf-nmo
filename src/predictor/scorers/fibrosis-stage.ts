import { extractNumbers, normalizeForSearch } from "../../normalize.js";
import { betterEvidence, containsNormalizedPhrase, rawTokens } from "../text-utils.js";

function fibrosisDescriptorKey(text) {
  const normalized = normalizeForSearch(text);
  const metavir = normalized.match(/^f\s*([0-4])\b/iu);
  if (metavir?.[1] === "0" && containsNormalizedPhrase(normalized, "\u043e\u0442\u0441\u0443\u0442")) return "none";
  if (metavir?.[1] === "1" && containsNormalizedPhrase(normalized, "\u0431\u0435\u0437") && containsNormalizedPhrase(normalized, "\u0441\u0435\u043f\u0442")) return "mild";
  if (metavir?.[1] === "2" && containsNormalizedPhrase(normalized, "\u0435\u0434\u0438\u043d\u0438\u0447") && containsNormalizedPhrase(normalized, "\u0441\u0435\u043f\u0442")) return "moderate";
  if (metavir?.[1] === "3" && (containsNormalizedPhrase(normalized, "\u043c\u043d\u043e\u0433\u043e\u0447\u0438\u0441\u043b") || containsNormalizedPhrase(normalized, "\u0431\u0435\u0437 \u0446\u0438\u0440\u0440\u043e\u0437"))) return "marked";
  if (metavir?.[1] === "4" && containsNormalizedPhrase(normalized, "\u0446\u0438\u0440\u0440\u043e\u0437")) return "cirrhosis";
  if (!containsNormalizedPhrase(normalized, "\u0444\u0438\u0431\u0440\u043e\u0437") && !containsNormalizedPhrase(normalized, "\u0446\u0438\u0440\u0440\u043e\u0437")) return null;
  if (containsNormalizedPhrase(normalized, "\u0431\u0435\u0437 \u0446\u0438\u0440\u0440\u043e\u0437") && !containsNormalizedPhrase(normalized, "\u0444\u0438\u0431\u0440\u043e\u0437")) return null;
  if (containsNormalizedPhrase(normalized, "\u0431\u0435\u0437 \u0444\u0438\u0431\u0440\u043e\u0437") || containsNormalizedPhrase(normalized, "\u043e\u0442\u0441\u0443\u0442")) return "none";
  if (containsNormalizedPhrase(normalized, "\u0441\u043b\u0430\u0431\u043e\u0432\u044b\u0440\u0430\u0436")) return "mild";
  if (containsNormalizedPhrase(normalized, "\u0443\u043c\u0435\u0440\u0435\u043d")) return "moderate";
  if (containsNormalizedPhrase(normalized, "\u0442\u044f\u0436\u0435\u043b")) return "severe";
  if (containsNormalizedPhrase(normalized, "\u0446\u0438\u0440\u0440\u043e\u0437")) return "cirrhosis";
  if (containsNormalizedPhrase(normalized, "\u0432\u044b\u0440\u0430\u0436")) return "marked";
  return null;
}

function questionFibrosisStage(question) {
  const tokens = rawTokens(question);
  const stageIndex = tokens.findIndex((token) => token.startsWith("\u0441\u0442\u0430\u0434"));
  for (let index = Math.max(0, stageIndex); index >= 0 && index < Math.min(tokens.length, stageIndex + 4); index += 1) {
    const token = tokens[index];
    if (/^[0-4]$/u.test(token)) return token;
  }
  const normalized = normalizeForSearch(question);
  const fStage = normalized.match(/\bf\s*([0-4])\b/iu);
  return fStage?.[1] ?? null;
}

function answerFibrosisStage(answerText) {
  const normalized = normalizeForSearch(answerText);
  const exact = normalized.match(/^(?:f\s*)?([0-4])$/iu);
  if (exact) return exact[1];
  const numbers = extractNumbers(answerText).map((item) => String(item).replace(",", "."));
  const stageNumbers = numbers.filter((number) => /^[0-4]$/u.test(number));
  return stageNumbers.length === 1 ? stageNumbers[0] : null;
}

function fibrosisRowStage(line) {
  const normalized = normalizeForSearch(line).trim();
  const numeric = normalized.match(/^([0-4])\s*-/u);
  if (numeric) return numeric[1];
  const metavir = normalized.match(/^f\s*([0-4])\b/iu);
  return metavir?.[1] ?? null;
}

export function bestFibrosisStageSupport({ mode, pages, question, answer }) {
  if (mode !== "single") return null;
  const questionNorm = normalizeForSearch(question);
  if (
    !containsNormalizedPhrase(questionNorm, "\u0444\u0438\u0431\u0440\u043e\u0437") &&
    !containsNormalizedPhrase(questionNorm, "\u0446\u0438\u0440\u0440\u043e\u0437") &&
    !containsNormalizedPhrase(questionNorm, "\u0441\u0442\u0430\u0434")
  ) {
    return null;
  }
  const qStage = questionFibrosisStage(question);
  const qDescriptor = fibrosisDescriptorKey(question);
  const answerStage = answerFibrosisStage(answer.text);
  const answerDescriptor = fibrosisDescriptorKey(answer.text);
  if (!qStage && answerStage && !containsNormalizedPhrase(questionNorm, "\u0441\u043e\u043e\u0442\u0432\u0435\u0442")) return null;
  const targetStage = qStage ?? answerStage;
  const targetDescriptor = qStage ? answerDescriptor : qDescriptor;
  if (!targetStage || !targetDescriptor) return null;
  let best = null;

  for (const page of pages) {
    const lines = page.lines ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      const text = lines[index];
      const stage = fibrosisRowStage(text);
      if (stage !== targetStage) continue;
      const descriptor = fibrosisDescriptorKey(text);
      if (descriptor !== targetDescriptor) continue;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text,
        score: 22.4,
        kind: "fibrosis_stage_row",
      });
    }
  }

  return best;
}
