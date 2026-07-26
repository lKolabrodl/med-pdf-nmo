import {extractNumbers, normalizeForSearch} from "../../../normalize.js";
import type {AnswerScoringContext} from "../../contracts.js";
import {betterEvidence, containsNormalizedPhrase, rawTokens} from "../../text-utils.js";
import type {EvidenceItem} from "../../types.js";

type FibrosisDescriptor = "none" | "mild" | "moderate" | "marked" | "severe" | "cirrhosis";

/**
 * Выполняет внутренний этап `fibrosisDescriptorKey`, подготавливающий стадии фиброза описания `key` для основного scorer-а.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function fibrosisDescriptorKey(text: string): FibrosisDescriptor | null {
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

/**
 * Извлекает из вопроса номер стадии фиброза в форме `F1`–`F4`.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function questionFibrosisStage(question: string): string | null {
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

/**
 * Извлекает или проверяет варианта ответа стадии фиброза стадии в варианте ответа.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function answerFibrosisStage(answerText: string): string | null {
  const normalized = normalizeForSearch(answerText);
  const exact = normalized.match(/^(?:f\s*)?([0-4])$/iu);
  if (exact) return exact[1];
  const numbers = extractNumbers(answerText).map((item) => String(item).replace(",", "."));
  const stageNumbers = numbers.filter((number) => /^[0-4]$/u.test(number));
  return stageNumbers.length === 1 ? stageNumbers[0] : null;
}

/**
 * Выполняет внутренний этап `fibrosisRowStage`, подготавливающий стадии фиброза строки стадии для основного scorer-а.
 *
 * @param line Значение `line`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function fibrosisRowStage(line: string): string | null {
  const normalized = normalizeForSearch(line).trim();
  const numeric = normalized.match(/^([0-4])\s*-/u);
  if (numeric) return numeric[1];
  const metavir = normalized.match(/^f\s*([0-4])\b/iu);
  return metavir?.[1] ?? null;
}

/**
 * Связывает номер стадии фиброза с её описанием в одной строке шкалы.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestFibrosisStageSupport({mode, pages, question, answer}: AnswerScoringContext): EvidenceItem | null {
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
