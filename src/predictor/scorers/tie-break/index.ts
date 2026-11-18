import { extractNumbers, normalizeForSearch, uniqueTokens } from "../../../normalize.js";
import type { PdfPage } from "../../../pdf.js";
import type { AnswerMode, AnswerScore } from "../../types.js";

/**
 * Контекст, необходимый для разрешения точной ничьей одиночного ответа.
 */
export type NumericTieConditionContext = {
  mode: AnswerMode;
  pages: PdfPage[];
  topQuestionPages: Set<number>;
  question: string;
};

/**
 * Итерация A / Теория 1.
 *
 * Многие оставшиеся single-ошибки — это cloze-вопросы о дозе/пороге/поколении,
 * где несколько числовых вариантов получают ТОЧНО одинаковый raw score. В этом
 * случае текущий селектор выбирает первый вариант в исходном порядке (часто "A"),
 * что для таких вопросов эквивалентно подбрасыванию монеты.
 *
 * Этот резолвер разрывает ТОЛЬКО точную ничью и ТОЛЬКО по доказательству из
 * самого PDF: он предпочитает тот из связанных вариантов, чьё значение стоит в
 * одной физической строке с наиболее редкими (специфичными) токенами условия из
 * вопроса. Он не читает ответы, метки, id, ожидаемое число — только со-встречаемость
 * в тексте документа. Если однозначного победителя нет, выбор не меняется.
 *
 * @param scores Исходные raw score вариантов ответа до финального выбора.
 * @param context Режим, страницы PDF, топ-страницы вопроса и текст вопроса.
 * @returns Те же score; при разрешённой точной ничьей raw победителя чуть повышен.
 */
export function applyNumericTieConditionBreak(
  scores: AnswerScore[],
  context: NumericTieConditionContext,
): AnswerScore[] {
  if (context.mode !== "single" || scores.length < 2) return scores;

  const sorted = [...scores].sort((a, b) => b.raw - a.raw);
  const maxRaw = sorted[0].raw;
  if (!(maxRaw > 0)) return scores;

  // Разрываем ТОЛЬКО точную ничью raw score. Любой ненулевой отрыв — это уже
  // сигнал скореров, который нельзя переопределять со-встречаемостью.
  const tieEpsilon = 1e-6;
  const tied = sorted.filter((item) => maxRaw - item.raw <= tieEpsilon);
  if (tied.length < 2) return scores;

  // Разрешаем только короткие/числовые варианты — это dose/threshold/generation
  // семейство. Длинные фразовые варианты не трогаем: там ничья менее вероятна
  // и цена ошибки выше.
  const eligible = tied.every((item) => {
    const numbers = extractNumbers(item.answer.text);
    const tokens = uniqueTokens(item.answer.text);
    return numbers.length > 0 || tokens.length <= 5;
  });
  if (!eligible) return scores;

  const pageById = new Map(context.pages.map((page) => [page.page, page] as const));
  const focusPages = [...context.topQuestionPages]
    .map((pageNumber) => pageById.get(pageNumber))
    .filter((page): page is PdfPage => Boolean(page));
  if (!focusPages.length) return scores;

  // Редкость токенов вопроса по числу страниц, где токен встречается.
  const questionTokens = uniqueTokens(context.question).filter((token) => token.length >= 3);
  if (!questionTokens.length) return scores;

  const totalPages = Math.max(1, context.pages.length);
  const pageTokenSets = context.pages.map((page) => new Set(uniqueTokens(page.normalized ?? page.text)));
  const pageFrequency = new Map<string, number>();
  for (const token of questionTokens) {
    let count = 0;
    for (const tokenSet of pageTokenSets) if (tokenSet.has(token)) count += 1;
    pageFrequency.set(token, count);
  }

  const distinctive = questionTokens
    .filter((token) => {
      const frequency = pageFrequency.get(token) ?? 0;
      return frequency >= 1 && frequency <= totalPages * 0.5;
    })
    .map((token) => ({ token, weight: Math.log((totalPages + 1) / (pageFrequency.get(token) ?? 1)) }));
  if (!distinctive.length) return scores;

  function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  }

  function coOccurrenceScore(answerText: string): number {
    const numbers = extractNumbers(answerText);
    const answerTokens = uniqueTokens(answerText).filter((token) => token.length >= 2);
    const numericKeys = numbers.map((value) => normalizeForSearch(String(value))).filter(Boolean);
    let best = 0;
    for (const page of focusPages) {
      for (const line of page.lines) {
        const normalizedLine = normalizeForSearch(line);
        if (!normalizedLine) continue;
        const lineTokens = new Set(uniqueTokens(normalizedLine));

        const hasNumericKey =
          numericKeys.length > 0 &&
          numericKeys.every((key) => new RegExp(`(?:^|\\D)${escapeRegExp(key)}(?:\\D|$)`).test(normalizedLine));
        const hasTokenKey =
          numericKeys.length === 0 &&
          answerTokens.length > 0 &&
          answerTokens.every((token) => lineTokens.has(token));
        if (!hasNumericKey && !hasTokenKey) continue;

        let lineScore = 0;
        for (const entry of distinctive) if (lineTokens.has(entry.token)) lineScore += entry.weight;
        if (lineScore > best) best = lineScore;
      }
    }
    return best;
  }

  const scored = tied.map((item) => ({ item, score: coOccurrenceScore(item.answer.text) }));
  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];
  const runnerUp = scored[1];
  if (!winner || winner.score <= 0) return scores;
  // Требуем строго доминирующего победителя.
  if (runnerUp && winner.score <= runnerUp.score * 1.15) return scores;

  const bump = 0.02;
  return scores.map((item) =>
    item.answer.id === winner.item.answer.id ? { ...item, raw: item.raw + bump } : item,
  );
}
