import {FOCUS_STOPWORDS} from "../../constants.js";
import {
  betterEvidence,
  cachedLineWindowSegments,
  extractNumbers,
  normalizeForSearch,
  strictSoftCoverage,
  tokenizeNormalized,
  tokenHitCount,
  uniqueTokens,
} from "./dependencies.js";
import type {AnswerOption} from "../../types.js";
import type {NumericEvidence, SubjectBoundNumericClauseInput} from "./types.js";

type NumericOptionValue = {
  id: string;
  values: string[];
};

type NumericComparator = "greater" | "less";

const SUBJECT_NUMERIC_GENERIC_FOCUS = new Set(
  uniqueTokens(
    [
      "болезнь болезни болезнью заболевание заболевания заболевании состояние состояния",
      "пациент пациенты пациентов больной больные больных случай случаи случаев",
      "поражение поражения поражений орган органы органов печень печени печенью",
      "функция функции показатель показатели показателей уровень уровня",
      "наблюдаться наблюдается наблюдаются наблюдать наблюдают",
      "встречаться встречается встречаются составлять составляет составляют",
      "достигать достигает достигают примерно приблизительно почти",
      "частота распространенность вероятность риск",
    ].join(" "),
  ),
);

/**
 * Выполняет внутренний этап `subjectBoundNumericClauses`, подготавливающий субъекта привязки числового значения клауз для основного scorer-а.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function subjectBoundNumericClauses(text: unknown): string[] {
  return String(text ?? "")
    .split(/\s*;\s*|(?<=[.!?])\s+/u)
    .map((clause) => clause.replace(/\s+/gu, " ").trim())
    .filter((clause) => clause.length >= 18 && clause.length <= 520);
}

/**
 * Выполняет внутренний этап `numericOptionValues`, подготавливающий числового значения варианта ответа значений для основного scorer-а.
 *
 * @param answers Полный набор вариантов, необходимый для контрастного сравнения.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function numericOptionValues(answers: AnswerOption[]): NumericOptionValue[] {
  return answers.map((candidate) => ({
    id: candidate.id,
    values: [...new Set(extractNumbers(candidate.text))],
  }));
}

/**
 * Выполняет внутренний этап `numericComparatorNearValue`, подготавливающий числового значения компаратора `near` значения для основного scorer-а.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @param value Входное значение, которое требуется нормализовать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function numericComparatorNearValue(text: string, value: string): NumericComparator | null {
  const normalized = normalizeForSearch(text).replace(/[≤]/gu, "<").replace(/[≥]/gu, ">");
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = new RegExp(escaped, "u").exec(normalized);
  if (!match || match.index == null) return null;
  const before = normalized.slice(Math.max(0, match.index - 34), match.index).trim();
  if (/(?:не\s+менее|не\s+ниже|более|больше|выше)\s*$/u.test(before) || />\s*$/u.test(before)) return "greater";
  if (/(?:не\s+более|не\s+выше|менее|меньше|ниже)\s*$/u.test(before) || /<\s*$/u.test(before)) return "less";
  return null;
}

/**
 * Связывает числовой вариант с субъектом внутри одного предложения или
 * части предложения. Это не дает проценту соседнего заболевания получить
 * поддержку только потому, что PDF склеил обе фразы в один line-window.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answers Полный набор вариантов, необходимый для контрастного сравнения.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestSubjectBoundNumericClauseSupport({mode,pages,topQuestionPages,question,answer,answers}: SubjectBoundNumericClauseInput): NumericEvidence {
  if (mode !== "single") return null;
  if (/_{2,}|…+/u.test(String(question ?? ""))) return null;
  // Число в самом вопросе обычно задаёт возрастную, стадийную или иную
  // подгруппу. Без локального связывания этой подгруппы процентный scorer
  // должен воздержаться, а не переносить значение соседней строки.
  if (/(?:^|[^\p{L}\p{N}])\d+(?:[.,-]\d+)*(?=$|[^\p{L}\p{N}])/u.test(String(question ?? ""))) return null;
  const answerValues = [...new Set(extractNumbers(answer.text))];
  if (answerValues.length !== 1) return null;
  const answerUsesPercent = /%|процент/u.test(normalizeForSearch(answer.text));
  if (!answerUsesPercent) return null;
  const optionValues = numericOptionValues(answers);
  if (optionValues.filter((item) => item.values.length === 1).length < 3) return null;

  const specificFocus = uniqueTokens(question).filter(
    (token) =>
      token.length >= 2 &&
      !/^\d/u.test(token) &&
      !FOCUS_STOPWORDS.has(token) &&
      !SUBJECT_NUMERIC_GENERIC_FOCUS.has(token),
  );
  if (!specificFocus.length || specificFocus.length > 10) return null;

  const competingValues = new Set<string>(
    optionValues
      .filter((item) => item.id !== answer.id)
      .flatMap((item) => item.values)
      .filter((value) => value !== answerValues[0]),
  );
  const requiredComparator = numericComparatorNearValue(answer.text, answerValues[0]);
  let best: NumericEvidence = null;

  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size ||
      topQuestionPages.has(page.page) ||
      topQuestionPages.has(page.page - 1) ||
      topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;

    for (const segment of cachedLineWindowSegments(page)) {
      const clauses = subjectBoundNumericClauses(segment.text);
      const percentClauses = clauses.filter((clause) => /%|процент/u.test(normalizeForSearch(clause)) && extractNumbers(clause).length > 0);
      if (percentClauses.length < 2) continue;
      for (const clause of percentClauses) {
        const normalized = normalizeForSearch(clause);
        const clauseNumbers = new Set(extractNumbers(clause));
        if (!clauseNumbers.has(answerValues[0])) continue;
        if (answerUsesPercent && !/%|процент/u.test(normalized)) continue;
        if ([...competingValues].some((value) => clauseNumbers.has(value))) continue;
        if (requiredComparator && numericComparatorNearValue(clause, answerValues[0]) !== requiredComparator) continue;

        const tokens = tokenizeNormalized(normalized);
        const focusHits = tokenHitCount(specificFocus, tokens);
        const focusCoverage = strictSoftCoverage(specificFocus, tokens);
        const requiredCoverage = specificFocus.length <= 2 ? 0.5 : 0.34;
        if (focusHits < 1 || focusCoverage < requiredCoverage) continue;

        const score = 17.2 + Math.min(3, focusHits) * 1.1 + Math.min(0.75, focusCoverage) * 4.2;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: clause,
          score,
          kind: "subject_numeric_clause",
        });
      }
    }
  }

  return best;
}
