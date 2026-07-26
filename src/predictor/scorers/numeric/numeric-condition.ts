import {
  betterEvidence,
  cachedLineWindowSegments,
  containsNormalizedPhrase,
  escapeRegExp,
  evidenceSnippet,
  expandNumberToken,
  extractNumbers,
  frequencyAnswer,
  frequencySearchPhrases,
  hasSearchBoundaries,
  nearestCueName,
  normalizeForSearch,
  normalizeText,
  numberCoverage,
  strictSoftCoverage,
  tokenizeNormalized,
  tokenHitCount,
} from "./dependencies.js";
import {specificConditionNumberFocusTokens} from "./condition-focus.js";
import type {NumericConditionInput, NumericEvidence} from "./types.js";

type MarkerCondition =
  | {type: "hbeag"; value: "negative" | "positive"}
  | {type: "cirrhosis"; value: "without" | "with"};

type NumericHit = {
  index: number;
  length: number;
};

type NumericConditionAnchor = {
  kind: string;
  direction: "before" | "after";
  after: number;
  before: number;
  base: number;
  pattern?: RegExp;
  nextPattern?: RegExp;
  phrases?: string[];
  minPhraseHits?: number;
};

type NumericConditionSource = {
  page: number;
  text: string;
  normalized: string;
};

/**
 * Извлекает из вопроса маркеры числового условия и сравнения.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function questionMarkerConditions(question: string): MarkerCondition[] {
  const normalized = normalizeForSearch(question);
  const conditions: MarkerCondition[] = [];
  if (containsNormalizedPhrase(normalized, "hbeag")) {
    if (containsNormalizedPhrase(normalized, "\u043e\u0442\u0440\u0438\u0446")) conditions.push({ type: "hbeag", value: "negative" });
    if (containsNormalizedPhrase(normalized, "\u043f\u043e\u043b\u043e\u0436")) conditions.push({ type: "hbeag", value: "positive" });
  }
  if (containsNormalizedPhrase(normalized, "\u0431\u0435\u0437 \u0446\u0438\u0440\u0440\u043e\u0437")) {
    conditions.push({ type: "cirrhosis", value: "without" });
  } else if (containsNormalizedPhrase(normalized, "\u043f\u0440\u0438 \u0446\u0438\u0440\u0440\u043e\u0437") || containsNormalizedPhrase(normalized, "\u0441 \u0446\u0438\u0440\u0440\u043e\u0437")) {
    conditions.push({ type: "cirrhosis", value: "with" });
  }
  return conditions;
}

/**
 * Проверяет совпадение числового маркера условий.
 *
 * @param local Значение `local`, необходимое этому этапу scorer-а.
 * @param conditions Значение `conditions`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function markerConditionsMatch(local: string, conditions: MarkerCondition[]): boolean {
  for (const condition of conditions) {
    if (condition.type === "hbeag") {
      const nearestStatus = nearestCueName(local, [
        ["negative", ["\u043e\u0442\u0440\u0438\u0446"]],
        ["positive", ["\u043f\u043e\u043b\u043e\u0436"]],
      ]);
      if (!containsNormalizedPhrase(local, "hbeag") || nearestStatus !== condition.value) return false;
    } else if (condition.type === "cirrhosis") {
      if (condition.value === "without") {
        if (!containsNormalizedPhrase(local, "\u0431\u0435\u0437 \u0446\u0438\u0440\u0440\u043e\u0437")) return false;
      } else if (!containsNormalizedPhrase(local, "\u0446\u0438\u0440\u0440\u043e\u0437") || containsNormalizedPhrase(local, "\u0431\u0435\u0437 \u0446\u0438\u0440\u0440\u043e\u0437")) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Строит набор поисковых фраз для условного числа.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function conditionedNumberPhrases(answerText: string): string[] {
  const phrases = new Set<string>();
  for (const number of extractNumbers(answerText)) {
    phrases.add(number);
    for (const expanded of expandNumberToken(number)) phrases.add(expanded);
    const withoutPercent = String(number).replace("%", "");
    if (withoutPercent) phrases.add(withoutPercent);
  }
  for (const phrase of frequencySearchPhrases(answerText)) phrases.add(phrase);
  return [...phrases].map((phrase) => normalizeForSearch(phrase)).filter((phrase) => phrase.length >= 1).slice(0, 18);
}

/**
 * Строит допустимые формы записи для точного совпадения числового значения.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function exactNumericForms(text: string): string[] {
  const forms = new Set<string>();
  for (const number of extractNumbers(text)) {
    const normalized = normalizeForSearch(number);
    if (!normalized) continue;
    forms.add(normalized);
    forms.add(normalized.replace(/\.0+$/u, ""));
    if (normalized.includes(".")) forms.add(normalized.replace(/0+$/u, "").replace(/\.$/u, ""));
  }
  return [...forms].filter(Boolean);
}

/**
 * Находит структурную границу для числового значения поиска.
 *
 * @param normalizedText Текст, заранее приведённый к поисковой нормальной форме.
 * @param hit Значение `hit`, необходимое этому этапу scorer-а.
 * @param length Длина проверяемого диапазона или токена.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function numericSearchBoundary(normalizedText: string, hit: number, length: number): boolean {
  const before = hit > 0 ? normalizedText[hit - 1] : "";
  const after = hit + length < normalizedText.length ? normalizedText[hit + length] : "";
  const beforeBefore = hit > 1 ? normalizedText[hit - 2] : "";
  const afterAfter = hit + length + 1 < normalizedText.length ? normalizedText[hit + length + 1] : "";
  const tokenChar = /[a-zа-я0-9%.+/]/iu;
  if (before && tokenChar.test(before)) return false;
  if (after && tokenChar.test(after)) return false;
  if (before === "-" && /\d/u.test(beforeBefore)) return false;
  if (after === "-" && /\d/u.test(afterAfter)) return false;
  return true;
}

/**
 * Определяет локальные совпадения для числового значения формы.
 *
 * @param normalizedText Текст, заранее приведённый к поисковой нормальной форме.
 * @param form Значение `form`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function findNumericFormHits(normalizedText: string, form: string): NumericHit[] {
  const hits: NumericHit[] = [];
  if (!form) return hits;
  let start = 0;
  while (start < normalizedText.length) {
    const index = normalizedText.indexOf(form, start);
    if (index < 0) break;
    if (numericSearchBoundary(normalizedText, index, form.length)) hits.push({ index, length: form.length });
    start = index + Math.max(1, form.length);
    if (hits.length > 80) break;
  }
  return hits;
}

/**
 * Определяет локальные совпадения для исходного фрагмента условия.
 *
 * @param normalizedText Текст, заранее приведённый к поисковой нормальной форме.
 * @param anchor Значение `anchor`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function sourceConditionHits(normalizedText: string, anchor: NumericConditionAnchor): NumericHit[] {
  if (anchor.pattern) {
    const hits: NumericHit[] = [];
    for (const match of normalizedText.matchAll(anchor.pattern)) {
      hits.push({ index: match.index ?? 0, length: match[0].length });
      if (hits.length > 80) break;
    }
    return hits;
  }
  const hits: NumericHit[] = [];
  for (const phrase of anchor.phrases ?? []) {
    let start = 0;
    while (start < normalizedText.length) {
      const index = normalizedText.indexOf(phrase, start);
      if (index < 0) break;
      if (hasSearchBoundaries(normalizedText, index, phrase.length)) hits.push({ index, length: phrase.length });
      start = index + Math.max(1, phrase.length);
      if (hits.length > 80) break;
    }
  }
  return hits;
}

/**
 * Определяет локальные совпадения для следующей границы условия.
 *
 * @param normalizedText Текст, заранее приведённый к поисковой нормальной форме.
 * @param anchor Значение `anchor`, необходимое этому этапу scorer-а.
 * @param start Начальная позиция рассматриваемого диапазона.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function nextConditionHit(normalizedText: string, anchor: NumericConditionAnchor, start: number): number {
  if (!anchor.nextPattern) return -1;
  anchor.nextPattern.lastIndex = start;
  const match = anchor.nextPattern.exec(normalizedText);
  anchor.nextPattern.lastIndex = 0;
  return match?.index ?? -1;
}

/**
 * Выполняет внутренний этап `interveningNumberCount`, подготавливающий `intervening` числа количества для основного scorer-а.
 *
 * @param normalizedText Текст, заранее приведённый к поисковой нормальной форме.
 * @returns Вычисленное числовое значение или специальное граничное значение при отсутствии совпадения.
 * @internal
 */
function interveningNumberCount(normalizedText: string): number {
  return extractNumbers(normalizedText).length;
}

/**
 * Выполняет внутренний этап `numericConditionDirectionOk`, подготавливающий числового значения условия направления `ok` для основного scorer-а.
 *
 * @param normalizedText Текст, заранее приведённый к поисковой нормальной форме.
 * @param conditionHit Значение `conditionHit`, необходимое этому этапу scorer-а.
 * @param answerHit Значение `answerHit`, необходимое этому этапу scorer-а.
 * @param anchor Значение `anchor`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function numericConditionDirectionOk(normalizedText: string, conditionHit: NumericHit, answerHit: NumericHit, anchor: NumericConditionAnchor): boolean {
  const conditionEnd = conditionHit.index + conditionHit.length;
  const answerEnd = answerHit.index + answerHit.length;
  if (anchor.direction === "before") {
    if (answerHit.index < conditionEnd) return false;
    if (answerHit.index - conditionEnd > anchor.after) return false;
    const next = nextConditionHit(normalizedText, anchor, conditionEnd + 1);
    if (next >= 0 && answerHit.index >= next) return false;
    if (interveningNumberCount(normalizedText.slice(conditionEnd, answerHit.index)) > 0) return false;
    return true;
  }
  if (answerEnd > conditionHit.index) return false;
  if (conditionHit.index - answerEnd > anchor.before) return false;
  if (interveningNumberCount(normalizedText.slice(answerEnd, conditionHit.index)) > 0) return false;
  return true;
}

/**
 * Выполняет внутренний этап `numericConditionAnchorSatisfied`, подготавливающий числового значения условия якоря `satisfied` для основного scorer-а.
 *
 * @param local Значение `local`, необходимое этому этапу scorer-а.
 * @param anchor Значение `anchor`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function numericConditionAnchorSatisfied(local: string, anchor: NumericConditionAnchor): boolean {
  if (!anchor.phrases?.length || !anchor.minPhraseHits) return true;
  let hits = 0;
  for (const phrase of anchor.phrases) {
    if (local.includes(phrase)) hits += 1;
  }
  return hits >= anchor.minPhraseHits;
}

/**
 * Извлекает из вопроса якоря, связывающие числовое значение с условием.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function questionNumericConditionAnchors(question: string): NumericConditionAnchor[] {
  const raw = normalizeText(question);
  const normalized = normalizeForSearch(question);
  const anchors: NumericConditionAnchor[] = [];
  const weekCue = normalizeForSearch("\u043d\u0435\u0434\u0435\u043b");
  const kgCue = normalizeForSearch("\u043a\u0433");

  const weekMatch = normalized.match(new RegExp(`(?:^|\\s)(\\d{1,2})(?:\\s*-?\\s*[a-zа-я]{1,2})?\\s+${escapeRegExp(weekCue)}`, "iu"));
  if (weekMatch?.[1]) {
    const number = weekMatch[1];
    anchors.push({
      kind: "week_number",
      direction: "before",
      after: 170,
      before: 10,
      base: 58,
      pattern: new RegExp(`(?:^|\\s)${escapeRegExp(number)}(?:\\s*-?\\s*[a-zа-я]{1,2})?\\s+${escapeRegExp(weekCue)}`, "giu"),
      nextPattern: new RegExp(`(?:^|\\s)\\d{1,2}(?:\\s*-?\\s*[a-zа-я]{1,2})?\\s+${escapeRegExp(weekCue)}`, "giu"),
    });
  }

  for (const number of extractNumbers(question)) {
    const normalizedNumber = normalizeForSearch(number);
    if (!normalizedNumber.includes("-")) continue;
    const hits = findNumericFormHits(normalized, normalizedNumber);
    const hasKg = hits.some((hit) => normalized.slice(hit.index, Math.min(normalized.length, hit.index + 48)).includes(kgCue));
    if (!hasKg && !containsNormalizedPhrase(normalized, "\u043c\u0430\u0441\u0441\u0430") && !containsNormalizedPhrase(normalized, "\u0432\u0435\u0441")) continue;
    anchors.push({
      kind: "weight_range",
      direction: "before",
      after: 90,
      before: 8,
      base: 60,
      pattern: new RegExp(`(?:^|\\s)${escapeRegExp(normalizedNumber)}\\s*${escapeRegExp(kgCue)}`, "giu"),
      nextPattern: new RegExp(`(?:^|\\s)\\d+(?:-\\d+)?\\s*${escapeRegExp(kgCue)}`, "giu"),
    });
  }

  if (containsNormalizedPhrase(normalized, "\u0444\u0430\u0437")) {
    if (containsNormalizedPhrase(normalized, "\u0445\u0440\u043e\u043d\u0438\u0447")) {
      anchors.push({
        kind: "phase_abbreviation",
        direction: "after",
        after: 18,
        before: 95,
        base: 59,
        phrases: [normalizeForSearch("\u0445\u0444")],
        minPhraseHits: 1,
      });
    }
    const phasePhrases: string[] = [];
    if (containsNormalizedPhrase(normalized, "\u0430\u043a\u0441\u0435\u043b\u0435\u0440\u0430\u0446")) phasePhrases.push(normalizeForSearch("\u0444\u0430"));
    if (containsNormalizedPhrase(normalized, "\u0431\u043b\u0430\u0441\u0442")) phasePhrases.push(normalizeForSearch("\u0431\u043a"));
    if (phasePhrases.length) {
      anchors.push({
        kind: "phase_abbreviation",
        direction: "after",
        after: 24,
        before: 105,
        base: 59,
        phrases: phasePhrases,
        minPhraseHits: 1,
      });
    }
  }

  return anchors;
}

/**
 * Выполняет внутренний этап `numericConditionSources`, подготавливающий числового значения условия `sources` для основного scorer-а.
 *
 * @param pages Извлечённые страницы PDF, доступные scorer-у.
 * @param topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function numericConditionSources(pages: NumericConditionInput["pages"], topQuestionPages: NumericConditionInput["topQuestionPages"]): NumericConditionSource[] {
  const sources: NumericConditionSource[] = [];
  for (const page of pages) {
    const topPage = topQuestionPages?.has(page.page);
    const adjacentTopPage =
      topQuestionPages?.has(page.page - 1) || topQuestionPages?.has(page.page + 1);
    if (topQuestionPages?.size && !topPage && !adjacentTopPage) continue;
    for (const segment of cachedLineWindowSegments(page)) {
      sources.push({ page: page.page, text: segment.text, normalized: segment.normalized });
    }
  }
  return sources;
}

/**
 * Ищет значение ответа рядом с совместимым направлением числового сравнения.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @param context.focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestNumericConditionSupport({mode,pages,topQuestionPages,question,answer,answerTokens,focusTokens}: NumericConditionInput): NumericEvidence {
  if (mode !== "single") return null;
  const answerForms = exactNumericForms(answer.text);
  if (!answerForms.length) return null;
  const anchors = questionNumericConditionAnchors(question);
  if (!anchors.length) return null;
  const specificTokens = specificConditionNumberFocusTokens(focusTokens);
  let best: NumericEvidence = null;

  for (const source of numericConditionSources(pages, topQuestionPages)) {
    const sourceTokens = tokenizeNormalized(source.normalized);
    const focusHits = tokenHitCount(specificTokens, sourceTokens);
    for (const anchor of anchors) {
      const conditionHits = sourceConditionHits(source.normalized, anchor);
      if (!conditionHits.length) continue;
      for (const answerForm of answerForms) {
        const answerHits = findNumericFormHits(source.normalized, answerForm);
        for (const conditionHit of conditionHits) {
          for (const answerHit of answerHits) {
            if (!numericConditionDirectionOk(source.normalized, conditionHit, answerHit, anchor)) continue;
            const localStart = Math.max(0, Math.min(conditionHit.index, answerHit.index) - 32);
            const localEnd = Math.min(source.normalized.length, Math.max(conditionHit.index + conditionHit.length, answerHit.index + answerHit.length) + 56);
            const local = source.normalized.slice(localStart, localEnd);
            if (!numericConditionAnchorSatisfied(local, anchor)) continue;
            const score =
              anchor.base +
              numberCoverage(answer.text, local) * 5.4 +
              strictSoftCoverage(answerTokens, tokenizeNormalized(local)) * 1.6 +
              Math.min(3, focusHits) * 0.55;
            best = betterEvidence(best, {
              answerId: answer.id,
              page: source.page,
              text: source.text,
              score,
              kind: `numeric_condition_${anchor.kind}`,
            });
          }
        }
      }
    }
  }

  return best;
}

/**
 * Связывает точное число с дополнительным условием вопроса в одном сегменте.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @param context.focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestConditionedNumberSupport({mode,pages,topQuestionPages,question,answer,answerTokens,focusTokens}: NumericConditionInput): NumericEvidence {
  if (mode !== "single") return null;
  if (!extractNumbers(answer.text).length && !frequencyAnswer(answer.text)) return null;
  const conditions = questionMarkerConditions(question);
  if (!conditions.length) return null;
  const phrases = conditionedNumberPhrases(answer.text);
  if (!phrases.length) return null;
  const specificTokens = specificConditionNumberFocusTokens(focusTokens);
  let best: NumericEvidence = null;

  for (const page of pages) {
    if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
    for (const phrase of phrases) {
      let start = 0;
      while (start < page.normalized.length) {
        const hit = page.normalized.indexOf(phrase, start);
        if (hit < 0) break;
        const numericRangeStart = /^\d+(?:\.\d+)?%?$/.test(phrase) && page.normalized[hit + phrase.length] === "-";
        if (phrase.length > 1 && !hasSearchBoundaries(page.normalized, hit, phrase.length) && !numericRangeStart) {
          start = hit + Math.max(1, phrase.length);
          continue;
        }
        if (page.normalized.slice(Math.max(0, hit - 3), hit).includes("-")) {
          start = hit + Math.max(1, phrase.length);
          continue;
        }
        const local = page.normalized.slice(Math.max(0, hit - 180), Math.min(page.normalized.length, hit + phrase.length + 190));
        if (!markerConditionsMatch(local, conditions)) {
          start = hit + Math.max(1, phrase.length);
          continue;
        }
        const localTokens = tokenizeNormalized(local);
        const focusHits = tokenHitCount(specificTokens, localTokens);
        const score =
          15.0 +
          strictSoftCoverage(answerTokens, localTokens) * 2.6 +
          numberCoverage(answer.text, local) * 3.2 +
          Math.min(3, focusHits) * 0.9;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: evidenceSnippet(page.text, phrase, question),
          score,
          kind: "conditioned_number_segment",
        });
        start = hit + Math.max(1, phrase.length);
      }
    }
  }

  return best;
}
