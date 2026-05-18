import { coverage, extractNumbers, normalizeForSearch, normalizeText, tokenize, uniqueTokens } from "../../normalize.js";
import { FOCUS_STOPWORDS } from "../constants.js";
import {
  answerSearchPhrases,
  betterEvidence,
  cachedPageTokens,
  containsNormalizedPhrase,
  evidenceSnippet,
  expandNumberToken,
  findPhraseOccurrences,
  focusedAnswerSearchPhrases,
  numberCoverage,
  pageWindow,
  strictSoftCoverage,
  tokenizeNormalized,
  tokenHitCount,
} from "../text-utils.js";

/**
 * Собирает компактный набор токенов вопроса, по которым остальные scorer'ы ищут
 * релевантные страницы, строки и локальные окна в PDF.
 *
 * В набор попадают явные cue-фразы, числа из вопроса и негeneric-токены; это
 * снижает шанс, что вариант ответа будет поддержан похожим, но чужим фрагментом.
 */
export function questionFocusTokens(question) {
  const allTokens = uniqueTokens(question);
  const cueTokens = cueFocusTokens(question);
  const numbers = new Set(extractNumbers(question).flatMap(expandNumberToken));
  const filtered = allTokens.filter((token) => {
    if (!token) return false;
    if (numbers.has(token) || /^\d/.test(token)) return true;
    if (FOCUS_STOPWORDS.has(token)) return false;
    return token.length > 2;
  });
  const merged = [];
  for (const token of [...cueTokens, ...filtered]) {
    if (!merged.includes(token)) merged.push(token);
  }
  return merged.slice(0, 16);
}

/**
 * Достает из вопроса короткие смысловые хвосты после устойчивых формулировок
 * вроде "с целью", "для" и возрастных ограничений.
 */
function cueFocusTokens(question) {
  const raw = normalizeText(question);
  const parts = [];
  const patterns = [
    /с\s+целью\s+(.+?)(?:\s+рекоменд|\s+провод|\s+назнач|$)/u,
    /для\s+(.+?)(?:\s+рекоменд|\s+провод|\s+назнач|$)/u,
    /(?:старше|младше|моложе|до|после)\s+\d+(?:[.,]\d+)?\s+(?:лет|года|месяц|дней|сут)/u,
    /по\s+([а-яa-z0-9 -]{4,48})/u,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[0]) parts.push(match[1] ?? match[0]);
  }
  return uniqueTokens(parts.join(" ")).filter((token) => !FOCUS_STOPWORDS.has(token));
}

/**
 * Ищет вариант ответа в небольшом окне вокруг точного/нормализованного вхождения
 * и требует рядом фокус вопроса или совпадающие числа из вопроса.
 */
export function bestFocusedSupport({ pages, topQuestionPages, question, answer, answerTokens, focusTokens, intent }) {
  if (!focusTokens?.length) return null;
  const answerPhrases = focusedAnswerSearchPhrases(answer.text).slice(0, 24);
  let best = null;
  for (const page of pages) {
    if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
    const pageNorm = page.normalized;
    for (const phrase of answerPhrases) {
      const normalizedPhrase = normalizeForSearch(phrase);
      if (!normalizedPhrase || normalizedPhrase.length < 5) continue;
      const hits = findPhraseOccurrences(pageNorm, phrase, { textIsNormalized: true });
      for (const hit of hits) {
        const local = pageWindow(page, hit, 260);
        const localTokens = tokenizeNormalized(local);
        const focusCoverage = coverage(focusTokens, localTokens);
        const questionNumberCoverage = numberCoverage(question, local);
        if (focusCoverage < 0.22 && questionNumberCoverage <= 0) continue;
        const answerCoverage = coverage(answerTokens, localTokens);
        const limitedPenalty = intent.negative || intent.exception ? 0 : limitedCuePenalty(local);
        const score =
          2.2 +
          focusCoverage * 5.2 +
          answerCoverage * 1.2 +
          questionNumberCoverage * (intent.numeric ? 4.0 : 2.2) -
          limitedPenalty;
        if (score <= 2.6) continue;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: evidenceSnippet(page.text, phrase, question),
          score,
          kind: "focused_answer_window",
        });
      }
    }
  }
  return best;
}

/**
 * Строит короткие строковые сегменты страницы: одну строку и пару соседних строк.
 * Эти сегменты дают дешевый локальный evidence без широкого поиска по странице.
 */
function lineTokenSegments(page) {
  const lines = page.lines ?? [];
  const segments = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line?.length >= 8) segments.push({ text: line, kind: "line" });
    if (index + 1 < lines.length) {
      const pair = `${line} ${lines[index + 1]}`.replace(/\s+/g, " ").trim();
      if (pair.length >= 16 && pair.length <= 700) segments.push({ text: pair, kind: "line_pair" });
    }
  }
  return segments;
}

/**
 * Возвращает кешированные line/pair-сегменты с уже посчитанной нормализацией и
 * токенами; кеш живет на объекте страницы и не попадает в публичный результат.
 */
export function cachedLineTokenSegments(page) {
  if (!page.__lineTokenSegments) {
    Object.defineProperty(page, "__lineTokenSegments", {
      value: lineTokenSegments(page).map((segment) => ({
        ...segment,
        normalized: normalizeForSearch(segment.text),
        tokens: tokenize(segment.text),
      })),
      enumerable: false,
    });
  }
  return page.__lineTokenSegments;
}

/**
 * Сравнивает вариант ответа с локальными line/pair-сегментами и отдает поддержку
 * только когда рядом есть фокус вопроса, числа или достаточно сильное совпадение.
 */
export function bestLineTokenSupport({ pages, topQuestionPages, question, answer, questionTokens, answerTokens, focusTokens, intent }) {
  if (!answerTokens.length) return null;
  const numericAnswer = extractNumbers(answer.text).length > 0;
  const minAnswerSupport = numericAnswer ? 0.65 : answerTokens.length <= 2 ? 0.95 : 0.62;
  const usefulFocusTokens = (focusTokens?.length ? focusTokens : questionTokens).filter((token) => token.length > 2 || /^\d/.test(token));
  if (!usefulFocusTokens.length) return null;
  const answerPhrases = answerSearchPhrases(answer.text);
  let best = null;

  for (const page of pages) {
    const isTopPage = topQuestionPages?.has(page.page);
    const pageTokens = cachedPageTokens(page);
    const pageFocusHits = tokenHitCount(usefulFocusTokens, pageTokens);
    const pageAnswerSupport = Math.max(strictSoftCoverage(answerTokens, pageTokens), numberCoverage(answer.text, page.normalized));
    if (!isTopPage && (pageFocusHits < 2 || pageAnswerSupport < minAnswerSupport)) continue;
    for (const segment of cachedLineTokenSegments(page)) {
      const segmentTokens = segment.tokens;
      if (!segmentTokens.length) continue;
      const answerCoverage = strictSoftCoverage(answerTokens, segmentTokens);
      const numericCoverage = numberCoverage(answer.text, segment.text);
      const answerSupport = Math.max(answerCoverage, numericCoverage);
      if (answerSupport < minAnswerSupport) continue;

      const focusHits = tokenHitCount(usefulFocusTokens, segmentTokens);
      const focusCoverage = coverage(usefulFocusTokens, segmentTokens);
      const questionNumberCoverage = numberCoverage(question, segment.text);
      const enoughFocus = isTopPage ? focusHits >= 1 || focusCoverage >= 0.16 : focusHits >= 2 || focusCoverage >= 0.24;
      if (!enoughFocus && questionNumberCoverage <= 0) continue;

      const exactPhrase = answerPhrases.some((phrase) => containsNormalizedPhrase(segment.normalized, phrase));
      const lengthPenalty = segment.text.length > 420 ? Math.min(1.4, (segment.text.length - 420) / 220) : 0;
      const score =
        3.2 +
        answerSupport * 4.4 +
        Math.min(0.55, focusCoverage) * 5.2 +
        Math.min(4, focusHits) * 0.42 +
        questionNumberCoverage * (intent.numeric ? 2.5 : 1.2) +
        (exactPhrase ? 0.8 : 0) +
        (isTopPage ? 0.5 : 0) -
        lengthPenalty;
      if (score < 6.2) continue;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text: segment.text,
        score,
        kind: `line_token_${segment.kind}`,
      });
    }
  }
  return best;
}

/**
 * Штрафует локальные окна с ограничивающими формулировками, чтобы "не
 * рекомендуется" и "только при невозможности" не выглядели как обычная поддержка.
 */
function limitedCuePenalty(normalizedText) {
  const limitedCues = ["не рекомендуется", "не рекомендовано", "только в случаях", "при невозможности", "невозможности", "за исключением"];
  let penalty = 0;
  for (const cue of limitedCues) {
    if (containsNormalizedPhrase(normalizedText, cue)) penalty += 0.8;
  }
  return Math.min(1.6, penalty);
}
