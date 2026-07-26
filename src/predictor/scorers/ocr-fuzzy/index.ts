import {coverage, tokenize} from "../../../normalize.js";
import type {AnswerScoringContext} from "../../contracts.js";
import {
  betterEvidence,
  cachedLineWindowSegments,
  tokenHitCount,
} from "../../text-utils.js";
import type {AnswerOption, EvidenceItem} from "../../types.js";

type CyrillicOcrLocalMatch = {
  fragment: string;
  match: CyrillicOcrCoverage;
  focusHits: number;
  focusCoverage: number;
  strength: number;
};

type CyrillicOcrSupportContext = Pick<
  AnswerScoringContext,
  "mode" | "pages" | "topQuestionPages" | "answer" | "answers" | "focusTokens"
>;

/**
 * Выделяет специфичные токены для исходного текста `letter`.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function rawLetterTokens(text: string): string[] {
  return String(text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .match(/[a-zа-яё0-9]+/giu) ?? [];
}

/**
 * Проверяет наличие или совместимость кириллического OCR.
 *
 * @param value Входное значение, которое требуется нормализовать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function hasCyrillic(value: string): boolean {
  return /[а-яё]/iu.test(value);
}

/**
 * Выполняет внутренний этап `editDistance`, подготавливающий `edit` `distance` для основного scorer-а.
 *
 * @param left Левое сравниваемое значение.
 * @param right Правое сравниваемое значение.
 * @returns Вычисленное числовое значение или специальное граничное значение при отсутствии совпадения.
 * @internal
 */
function editDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        substitution,
      );
    }
    previous = current;
  }
  return previous[right.length];
}

/**
 * Нормированное сходство длинных кириллических токенов по edit distance.
 * Короткие слова намеренно не сравниваются нечетко.
 *
 * @param left Левое сравниваемое значение.
 * @param right Правое сравниваемое значение.
 * @returns Вычисленное числовое значение или специальное граничное значение при отсутствии совпадения.
 */
export function cyrillicOcrTokenSimilarity(left: string, right: string): number {
  const a = rawLetterTokens(left).join("");
  const b = rawLetterTokens(right).join("");
  if (!hasCyrillic(a) || !hasCyrillic(b) || Math.min(a.length, b.length) < 7) return 0;
  const lengthRatio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
  if (lengthRatio < 0.72) return 0;
  return 1 - editDistance(a, b) / Math.max(a.length, b.length);
}

/**
 * Выполняет внутренний этап `similarityThreshold`, подготавливающий сходства `threshold` для основного scorer-а.
 *
 * @param length Длина проверяемого диапазона или токена.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function similarityThreshold(length: number): number {
  if (length >= 15) return 0.78;
  if (length >= 10) return 0.8;
  return 0.84;
}

/**
 * Проверяет наличие или совместимость внутреннего различия `difference`.
 *
 * @param left Левое сравниваемое значение.
 * @param right Правое сравниваемое значение.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function hasInteriorDifference(left: string, right: string): boolean {
  const comparable = Math.max(1, Math.min(left.length, right.length) - 3);
  for (let index = 0; index < comparable; index += 1) {
    if (left[index] !== right[index]) return true;
  }
  return false;
}

/**
 * Извлекает из исходного PDF-фрагмента исходного фрагмента токена `candidates`.
 *
 * @param sourceText Исходный текст PDF или ограниченного сегмента.
 * @param targetLength Значение `targetLength`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function sourceTokenCandidates(sourceText: string, targetLength: number): string[] {
  const sourceTokens = rawLetterTokens(sourceText);
  const candidates = new Set<string>();
  for (let start = 0; start < sourceTokens.length; start += 1) {
    let joined = "";
    for (let end = start; end < sourceTokens.length && end < start + 6; end += 1) {
      joined += sourceTokens[end];
      if (joined.length > targetLength * 1.35) break;
      if (joined.length >= targetLength * 0.7) candidates.add(joined);
    }
  }
  return [...candidates];
}

/** Сводка точных и нечётких совпадений длинных кириллических токенов. */
export type CyrillicOcrCoverage = {
  coverage: number;
  fuzzyMatches: number;
  exactMatches: number;
  matchedTokens: number;
  totalTokens: number;
};

/**
 * Проверяет, конфликтует ли длинный OCR-токен с другим допустимым совпадением.
 *
 * @param answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param answers Полный набор вариантов, необходимый для контрастного сравнения.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function hasLongTokenCollision(answer: AnswerOption, answers: AnswerOption[]): boolean {
  const answerTokens = rawLetterTokens(answer.text).filter((token) => hasCyrillic(token) && token.length >= 7);
  for (const candidate of answers ?? []) {
    if (candidate.id === answer.id) continue;
    const candidateTokens = rawLetterTokens(candidate.text).filter((token) => hasCyrillic(token) && token.length >= 7);
    for (const answerToken of answerTokens) {
      if (candidateTokens.some((token) => cyrillicOcrTokenSimilarity(answerToken, token) >= 0.72)) return true;
    }
  }
  return false;
}

/**
 * Сопоставляет длинные слова ответа с обычными или разорванными OCR-токенами
 * одного ограниченного фрагмента.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @param sourceText Исходный текст PDF или ограниченного сегмента.
 * @returns Вычисленное числовое значение или специальное граничное значение при отсутствии совпадения.
 */
export function cyrillicOcrCoverage(answerText: string, sourceText: string): CyrillicOcrCoverage {
  const answerTokens = rawLetterTokens(answerText).filter((token) => hasCyrillic(token) && token.length >= 7);
  if (!answerTokens.length) {
    return { coverage: 0, fuzzyMatches: 0, exactMatches: 0, matchedTokens: 0, totalTokens: 0 };
  }

  let fuzzyMatches = 0;
  let exactMatches = 0;
  let matchedTokens = 0;
  let matchedWeight = 0;
  let totalWeight = 0;
  for (const answerToken of answerTokens) {
    const weight = Math.min(20, answerToken.length);
    totalWeight += weight;
    let best = 0;
    let bestCandidate = "";
    for (const candidate of sourceTokenCandidates(sourceText, answerToken.length)) {
      const similarity = cyrillicOcrTokenSimilarity(answerToken, candidate);
      if (similarity > best) {
        best = similarity;
        bestCandidate = candidate;
      }
      if (best === 1) break;
    }
    if (best < similarityThreshold(answerToken.length)) continue;
    matchedTokens += 1;
    matchedWeight += weight * best;
    if (best >= 0.999) exactMatches += 1;
    else if (hasInteriorDifference(answerToken, bestCandidate)) fuzzyMatches += 1;
    else exactMatches += 1;
  }

  return {
    coverage: totalWeight ? matchedWeight / totalWeight : 0,
    fuzzyMatches,
    exactMatches,
    matchedTokens,
    totalTokens: answerTokens.length,
  };
}

/**
 * OCR-fallback для single-answer: длинный термин должен нечетко совпасть
 * внутри короткого окна, которое одновременно содержит фокус вопроса.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answers Полный набор вариантов, необходимый для контрастного сравнения.
 * @param context.focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestCyrillicOcrSupport({
  mode,
  pages,
  topQuestionPages,
  answer,
  answers,
  focusTokens,
}: CyrillicOcrSupportContext): EvidenceItem | null {
  if (mode !== "single") return null;
  if (hasLongTokenCollision(answer, answers)) return null;
  let best: EvidenceItem | null = null;

  for (const page of pages) {
    const nearQuestionPage =
      !topQuestionPages?.size ||
      topQuestionPages.has(page.page) ||
      topQuestionPages.has(page.page - 1) ||
      topQuestionPages.has(page.page + 1);
    if (!nearQuestionPage) continue;
    for (const segment of cachedLineWindowSegments(page)) {
      let local: CyrillicOcrLocalMatch | null = null;
      for (const fragment of String(segment.text ?? "").split(/(?<=[.!?;])\s+/u)) {
        if (fragment.length < 12 || fragment.length > 620) continue;
        const match = cyrillicOcrCoverage(answer.text, fragment);
        if (match.fuzzyMatches < 1 || match.coverage < 0.74) continue;
        // Одно длинное слово с общим медицинским корнем может быть родственным
        // термином, а не OCR-искажением. Для одиночного токена нужен заметно
        // более близкий edit-match; многословные термины уже защищены совместным
        // покрытием нескольких независимых токенов.
        if (match.totalTokens === 1 && match.coverage < 0.86) continue;
        const fragmentTokens = tokenize(fragment);
        const focusHits = tokenHitCount(focusTokens, fragmentTokens);
        const focusCoverage = focusTokens.length ? coverage(focusTokens, fragmentTokens) : 0;
        if (focusHits < 2 || focusCoverage < 0.2) continue;
        const strength = match.coverage + Math.min(0.6, focusCoverage) + Math.min(3, focusHits) * 0.08;
        if (!local || strength > local.strength) {
          local = { fragment, match, focusHits, focusCoverage, strength };
        }
      }
      if (!local) continue;
      const score =
        13.8 +
        local.match.coverage * 6.2 +
        Math.min(3, local.focusHits) * 1.1 +
        Math.min(0.6, local.focusCoverage) * 3.0 +
        Math.min(2, local.match.fuzzyMatches) * 0.8;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text: local.fragment,
        score,
        kind: "cyrillic_ocr_segment",
      });
    }
  }
  return best;
}
