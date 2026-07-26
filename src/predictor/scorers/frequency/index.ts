import type {PdfPage} from "../../../pdf.js";
import {coverage, extractNumbers, normalizeForSearch, normalizeText, tokenize, uniqueTokens} from "../../../normalize.js";
import type {AnswerScoringContext} from "../../contracts.js";
import {betterEvidence, containsNormalizedPhrase, numberCoverage, tokenHitCount} from "../../text-utils.js";
import type {EvidenceItem} from "../../types.js";

type FrequencyLineSegment = {
  text: string;
  normalized: string;
  tokens: string[];
};

type CachedFrequencyPage = PdfPage & {
  __lineWindowSegments?: FrequencyLineSegment[];
};

/**
 * Проверяет, содержит ли ответ число вместе с единицей времени или кратности.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 */
export function frequencyAnswer(answerText: string): boolean {
  const raw = normalizeText(answerText);
  return /\d|один|два|три|четыре|пять|шесть|семь|восемь|девять/u.test(raw) && /(год|месяц|недел|дн|сут|час|(?:^|\s)ч\.?(?:\s|$)|раз)/u.test(raw);
}

/**
 * Строит нормализуемые словоформы частоты и длительности для поиска в PDF.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 */
export function frequencySearchPhrases(answerText: string): string[] {
  const raw = normalizeText(answerText);
  const numbers = extractNumbers(answerText);
  const phrases = new Set<string>();
  if (answerText && /(год|месяц|недел|дн|сут|час|(?:^|\s)ч\.?(?:\s|$)|раз|\d)/u.test(raw)) phrases.add(answerText);
  for (const number of numbers) {
    if (/год/u.test(raw)) {
      phrases.add(`${number} год`);
      phrases.add(`${number} раз в год`);
    }
    if (/месяц/u.test(raw)) {
      phrases.add(`${number} месяц`);
      phrases.add(`${number} месяцев`);
      phrases.add(`${number} месяца`);
    }
    if (/недел/u.test(raw)) {
      phrases.add(`${number} неделю`);
      phrases.add(`${number} недели`);
      phrases.add(`${number} недель`);
    }
    if (/(дн|сут)/u.test(raw)) {
      phrases.add(`${number} день`);
      phrases.add(`${number} дня`);
      phrases.add(`${number} дней`);
      phrases.add(`${number} сутки`);
      phrases.add(`${number} суток`);
    }
    if (/час|(?:^|\s)ч\.?(?:\s|$)/u.test(raw)) {
      phrases.add(`${number} ч`);
      phrases.add(`${number} ч.`);
      phrases.add(`${number} час`);
      phrases.add(`${number} часа`);
      phrases.add(`${number} часов`);
    }
  }
  return [...phrases].filter((phrase) => {
    const phraseNorm = normalizeForSearch(phrase);
    if (!/\u0441\u0443\u0442/u.test(raw) && containsNormalizedPhrase(phraseNorm, "\u0441\u0443\u0442")) return false;
    if (!/\u0434\u043d/u.test(raw) && (containsNormalizedPhrase(phraseNorm, "\u0434\u0435\u043d\u044c") || containsNormalizedPhrase(phraseNorm, "\u0434\u043d\u044f") || containsNormalizedPhrase(phraseNorm, "\u0434\u043d\u0435\u0439"))) return false;
    if (!/\u0447\u0430\u0441|(?:^|\s)\u0447\.?(?:\s|$)/u.test(raw) && (containsNormalizedPhrase(phraseNorm, "\u0447\u0430\u0441") || containsNormalizedPhrase(phraseNorm, "\u0447."))) return false;
    if (/^\d+\s+\u0447$/u.test(phraseNorm)) return true;
    return phraseNorm.length >= 4;
  });
}

/**
 * Строит ограниченные текстовые сегменты для строки локального окна.
 *
 * @param page Текущая страница PDF или её номер.
 * @param radius Радиус локального окна вокруг совпадения.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function lineWindowSegments(page: PdfPage, radius: number = 2): FrequencyLineSegment[] {
  const lines = page.lines ?? [];
  const segments = [];
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines.slice(index, Math.min(lines.length, index + radius + 1)).join(" ").replace(/\s+/g, " ").trim();
    if (text.length >= 16 && text.length <= 900) {
      segments.push({
        text,
        normalized: normalizeForSearch(text),
        tokens: tokenize(text),
      });
    }
  }
  return segments;
}

/**
 * Строит ограниченные текстовые сегменты для кешированных строки локального окна.
 *
 * @param page Текущая страница PDF или её номер.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function cachedLineWindowSegments(page: CachedFrequencyPage): FrequencyLineSegment[] {
  if (!page.__lineWindowSegments) {
    Object.defineProperty(page, "__lineWindowSegments", {
      value: lineWindowSegments(page, 3),
      enumerable: false,
    });
  }
  return page.__lineWindowSegments!;
}

const FREQUENCY_GENERIC_FOCUS = new Set(
  [
    "динамическое",
    "динамического",
    "наблюдение",
    "наблюдения",
    "пациент",
    "пациентам",
    "хвгс",
    "хвгв",
    "цп",
    "цирроз",
    "печень",
    "печени",
    "рекомендуется",
    "рекомендовано",
    "выполнение",
    "выполнять",
    "проведение",
    "проводить",
    "контроль",
    "контроля",
    "эффективность",
    "эффективности",
    "исключение",
    "рецидив",
    "раз",
  ].flatMap((item) => uniqueTokens(item)),
);

const FREQUENCY_ANSWER_GENERIC = new Set(
  [
    "внутривенное",
    "внутривенно",
    "внутримышечно",
    "местное",
    "перорально",
    "введение",
    "вводят",
    "назначение",
    "назначают",
    "применение",
    "применяют",
    "дозе",
    "доза",
    "средняя",
    "суточная",
    "содержанием",
    "составе",
    "область",
    "боли",
    "сутки",
    "суток",
    "дней",
    "дня",
    "недель",
    "недели",
    "течение",
    "каждые",
    "каждый",
    "курсом",
    "раствора",
    "раствор",
    "таблеток",
    "крема",
    "геля",
    "мг",
    "мл",
    "кг",
    "раз",
  ].flatMap((item) => uniqueTokens(item)),
);

/**
 * Выделяет специфичные токены для специфичных частоты фокуса вопроса.
 *
 * @param focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function specificFrequencyFocusTokens(focusTokens: string[]): string[] {
  return focusTokens.filter((token) => token.length >= 4 && !/^\d/.test(token) && !FREQUENCY_GENERIC_FOCUS.has(token));
}

/**
 * Выделяет из числового варианта предмет назначения: препарат, действующее вещество
 * или медицинское средство. Это защищает scorer от ложных совпадений, когда в PDF
 * рядом найден только срок или кратность, но указан другой препарат.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function frequencyAnswerSubjectTokens(answerText: string): string[] {
  const tokens = uniqueTokens(answerText).filter(
    (token) => token.length >= 5 && !/^\d/u.test(token) && !/[/%]/u.test(token) && !FREQUENCY_ANSWER_GENERIC.has(token),
  );
  return tokens.slice(0, 5);
}

/**
 * Проверяет структурную совместимость частоты субъекта.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @param segmentTokens Нормализованные токены соответствующего текста.
 * @returns `true`, если проверяемое условие выполнено; иначе `false`.
 * @internal
 */
function frequencySubjectCompatible(answerText: string, segmentTokens: string[]): boolean {
  const subjectTokens = frequencyAnswerSubjectTokens(answerText);
  if (!subjectTokens.length) return true;
  return tokenHitCount(subjectTokens, segmentTokens) > 0;
}

/**
 * Ищет частоту ответа в той же строке рекомендации и у того же предмета.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestFrequencyRecommendationSupport(
  {mode, pages, topQuestionPages, question, answer, focusTokens}: AnswerScoringContext,
): EvidenceItem | null {
  if (mode !== "single") return null;
  if (!frequencyAnswer(answer.text)) return null;
  const questionRaw = normalizeText(question);
  if (!/(рекоменд|наблюден|контрол|выполн|провод)/u.test(questionRaw)) return null;
  const phrases = frequencySearchPhrases(answer.text).slice(0, 10);
  if (!phrases.length) return null;
  const specificTokens = specificFrequencyFocusTokens(focusTokens);
  let best = null;

  for (const page of pages) {
    if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
    for (const segment of cachedLineWindowSegments(page)) {
      if (!containsNormalizedPhrase(segment.normalized, "рекоменд")) continue;
      const hasAnswer = phrases.some((phrase) => containsNormalizedPhrase(segment.normalized, phrase));
      if (!hasAnswer) continue;
      if (!frequencySubjectCompatible(answer.text, segment.tokens)) continue;
      if (specificTokens.length && tokenHitCount(specificTokens, segment.tokens) < Math.min(2, specificTokens.length)) continue;
      const focusCoverage = coverage(focusTokens, segment.tokens);
      const score = 11.8 + focusCoverage * 9.0 + numberCoverage(answer.text, segment.normalized) * 1.0;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text: segment.text,
        score,
        kind: "frequency_recommendation_line",
      });
    }
  }

  return best;
}
