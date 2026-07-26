import {extractNumbers, normalizeForSearch, normalizeText, uniqueTokens} from "../../../normalize.js";
import type {PdfLinePage} from "../../../pdf.js";
import {FOCUS_STOPWORDS} from "../../constants.js";
import type {AnswerScoringContext} from "../../contracts.js";
import {answerSearchPhrases, betterEvidence, containsNormalizedPhrase, numberCoverage, strictSoftCoverage, tokenizeNormalized, tokenHitCount} from "../../text-utils.js";
import type {AnswerOption, EvidenceItem} from "../../types.js";

type SupportAdjustment = {
  support: EvidenceItem | null;
  adjustment: number;
  evidence: EvidenceItem | null;
};

type RecommendationSegmentAnswerHit = {
  phraseHit: boolean;
  strongPhraseHit: boolean;
  answerCoverage: number;
  numericCoverage: number;
  supportHit: boolean;
  mismatchHit: boolean;
};

type AnticoagulationContraPolarity = "absence" | "presence";

const RECOMMENDATION_QUESTION_GENERIC = new Set(
  [
    "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u0442\u0441\u044f",
    "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u043e\u0432\u0430\u043d\u043e",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442\u0430\u043c",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442\u043e\u0432",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442\u044b",
    "\u043f\u0440\u0438",
    "\u0434\u043b\u044f",
    "\u0441",
    "\u0438",
    "\u0443",
    "\u044f\u0432\u043b\u044f\u044e\u0442\u0441\u044f",
    "\u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442\u0430\u043c\u0438",
    "\u043f\u0435\u0440\u0432\u043e\u0439",
    "\u043b\u0438\u043d\u0438\u0438",
  ].flatMap((item) => uniqueTokens(item)),
);

const RECOMMENDATION_TARGET_GENERIC = new Set(
  [
    "\u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435",
    "\u043d\u0430\u0437\u043d\u0430\u0447",
    "\u043f\u0440\u043e\u0432\u0435\u0434",
    "\u043f\u0440\u043e\u0432\u043e\u0434",
    "\u0432\u044b\u043f\u043e\u043b\u043d",
    "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442\u0430\u043c",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442\u043e\u0432",
    "\u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442",
    "\u043b\u0435\u043a\u0430\u0440\u0441\u0442\u0432",
    "\u0441",
    "\u043f\u0440\u0438",
    "\u0434\u043b\u044f",
    "\u0438",
  ].flatMap((item) => uniqueTokens(item)),
);

/**
 * Выполняет внутренний этап `recommendationItemQuestion`, подготавливающий рекомендации пункта рекомендации вопроса для основного scorer-а.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function recommendationItemQuestion(question: string): boolean {
  const normalized = normalizeForSearch(question);
  const firstLineTherapy = containsNormalizedPhrase(normalized, "\u043f\u0435\u0440\u0432\u043e\u0439 \u043b\u0438\u043d\u0438\u0438");
  const valveProsthesisChoice =
    containsNormalizedPhrase(normalized, "\u043f\u0440\u043e\u0442\u0435\u0437") &&
    containsNormalizedPhrase(normalized, "\u043a\u043b\u0430\u043f") &&
    (containsNormalizedPhrase(normalized, "\u0431\u0438\u043e\u043b\u043e\u0433") || containsNormalizedPhrase(normalized, "\u043c\u0435\u0445\u0430\u043d"));
  const universalInstrumental =
    containsNormalizedPhrase(normalized, "\u0432\u0441\u0435\u043c \u043f\u0430\u0446\u0438\u0435\u043d\u0442") &&
    ((containsNormalizedPhrase(normalized, "\u043f\u0435\u0440\u0432\u0438\u0447") && containsNormalizedPhrase(normalized, "\u0441\u0442\u0430\u0434")) ||
      (containsNormalizedPhrase(normalized, "\u0434\u0438\u043d\u0430\u043c\u0438\u0447") && containsNormalizedPhrase(normalized, "\u044d\u0444\u0444\u0435\u043a\u0442")));
  return firstLineTherapy || valveProsthesisChoice || universalInstrumental;
}

/**
 * Выделяет специфичные токены для рекомендации вопроса.
 *
 * @param question Исходный текст вопроса.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function recommendationQuestionTokens(question: string): string[] {
  return uniqueTokens(question).filter((token) => token.length >= 4 && !FOCUS_STOPWORDS.has(token) && !RECOMMENDATION_QUESTION_GENERIC.has(token));
}

/**
 * Проверяет наличие или совместимость `page` числа `only`.
 *
 * @param line Значение `line`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function isPageNumberOnly(line: string): boolean {
  return /^\s*\d+\s*$/u.test(String(line ?? ""));
}

/**
 * Проверяет наличие или совместимость пункта списка.
 *
 * @param line Значение `line`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function startsBullet(line: string): boolean {
  return /^\s*[•*\-]\s*/u.test(String(line ?? ""));
}

/**
 * Проверяет наличие или совместимость рекомендации пункта списка.
 *
 * @param line Значение `line`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function startsRecommendationBullet(line: string): boolean {
  return /^\s*[•\uF0B7*\-]\s*/u.test(String(line ?? ""));
}

/**
 * Выполняет внутренний этап `recommendationLineStart`, подготавливающий рекомендации строки `start` для основного scorer-а.
 *
 * @param line Значение `line`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function recommendationLineStart(line: string): boolean {
  if (isPageNumberOnly(line)) return false;
  const normalized = normalizeForSearch(line);
  return (
    startsRecommendationBullet(line) ||
    containsNormalizedPhrase(normalized, "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434") ||
    containsNormalizedPhrase(normalized, "\u043f\u0435\u0440\u0432\u043e\u0439 \u043b\u0438\u043d\u0438\u0438")
  );
}

/**
 * Выполняет внутренний этап `recommendationBoundaryLine`, подготавливающий рекомендации границы строки для основного scorer-а.
 *
 * @param line Значение `line`, необходимое этому этапу scorer-а.
 * @param isFirstLine Значение `isFirstLine`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function recommendationBoundaryLine(line: string, isFirstLine: boolean): boolean {
  if (isPageNumberOnly(line)) return true;
  if (!isFirstLine && startsRecommendationBullet(line)) return true;
  const normalized = normalizeForSearch(line);
  return (
    /^e\s*o?k\b/iu.test(normalized) ||
    normalized.startsWith("eok") ||
    normalized.startsWith("ypobeh") ||
    containsNormalizedPhrase(normalized, "\u0443\u0443\u0440") ||
    containsNormalizedPhrase(normalized, "\u0443\u0434\u0434")
  );
}

/**
 * Собирает рекомендации сегмента, не выходя за структурные границы текущего блока.
 *
 * @param pages Извлечённые страницы PDF, доступные scorer-у.
 * @param pageIndex Позиция соответствующего элемента в локальной структуре.
 * @param lineIndex Позиция соответствующего элемента в локальной структуре.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function collectRecommendationSegment(pages: PdfLinePage[], pageIndex: number, lineIndex: number): string {
  const lines: string[] = [];
  for (let currentPageIndex = pageIndex; currentPageIndex < Math.min(pages.length, pageIndex + 2); currentPageIndex += 1) {
    const page = pages[currentPageIndex];
    const pageLines = page.lines ?? [];
    const startLine = currentPageIndex === pageIndex ? lineIndex : 0;
    for (let index = startLine; index < pageLines.length && lines.length < 12; index += 1) {
      const line = pageLines[index];
      if (recommendationBoundaryLine(line, currentPageIndex === pageIndex && index === lineIndex)) {
        if (!isPageNumberOnly(line)) return lines.join(" ");
        continue;
      }
      lines.push(line);
    }
    if (lines.length >= 12) break;
    const nextPage = pages[currentPageIndex + 1];
    if (!nextPage?.lines?.length || startsRecommendationBullet(nextPage.lines[0])) break;
  }
  return lines.join(" ");
}

/**
 * Строит ограниченные текстовые сегменты для рекомендации.
 *
 * @param pages Извлечённые страницы PDF, доступные scorer-у.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function recommendationSegments(pages: PdfLinePage[]): RecommendationSegment[] {
  const segments: RecommendationSegment[] = [];
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const lines = page.lines ?? [];
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      if (!recommendationLineStart(lines[lineIndex])) continue;
      const text = collectRecommendationSegment(pages, pageIndex, lineIndex).replace(/\s+/gu, " ").trim();
      if (text.length < 24) continue;
      segments.push({
        page: page.page,
        text,
        normalized: normalizeForSearch(text),
      });
    }
  }
  return segments;
}

/**
 * Выполняет внутренний этап `explicitRecommendationLineStart`, подготавливающий явного рекомендации строки `start` для основного scorer-а.
 *
 * @param line Значение `line`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function explicitRecommendationLineStart(line: string): boolean {
  if (isPageNumberOnly(line)) return false;
  const normalized = normalizeForSearch(line);
  return containsNormalizedPhrase(normalized, "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u043e\u0432\u0430") || containsNormalizedPhrase(normalized, "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443");
}

/**
 * Собирает явного рекомендации блока, не выходя за структурные границы текущего блока.
 *
 * @param pages Извлечённые страницы PDF, доступные scorer-у.
 * @param pageIndex Позиция соответствующего элемента в локальной структуре.
 * @param lineIndex Позиция соответствующего элемента в локальной структуре.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function collectExplicitRecommendationBlock(pages: PdfLinePage[], pageIndex: number, lineIndex: number): string {
  const lines: string[] = [];
  for (let currentPageIndex = pageIndex; currentPageIndex < Math.min(pages.length, pageIndex + 2); currentPageIndex += 1) {
    const page = pages[currentPageIndex];
    const pageLines = page.lines ?? [];
    const startLine = currentPageIndex === pageIndex ? lineIndex : 0;
    for (let index = startLine; index < pageLines.length && lines.length < 22; index += 1) {
      const line = pageLines[index];
      if (isPageNumberOnly(line)) continue;
      if (!(currentPageIndex === pageIndex && index === lineIndex) && explicitRecommendationLineStart(line)) {
        return lines.join(" ");
      }
      lines.push(line);
    }
    if (lines.length >= 22) break;
  }
  return lines.join(" ");
}

/**
 * Строит ограниченные текстовые сегменты для явного рекомендации.
 *
 * @param pages Извлечённые страницы PDF, доступные scorer-у.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function explicitRecommendationSegments(pages: PdfLinePage[]): RecommendationSegment[] {
  const segments: RecommendationSegment[] = [];
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const lines = page.lines ?? [];
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      if (!explicitRecommendationLineStart(lines[lineIndex])) continue;
      const text = collectExplicitRecommendationBlock(pages, pageIndex, lineIndex).replace(/\s+/gu, " ").trim();
      if (text.length < 24) continue;
      segments.push({
        page: page.page,
        text,
        normalized: normalizeForSearch(text),
      });
    }
  }
  return segments;
}

/**
 * Находит структурную границу одной атомарной рекомендации.
 *
 * @param line Значение `line`, необходимое этому этапу scorer-а.
 * @param isFirstLine Значение `isFirstLine`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function atomicRecommendationBoundary(line: string, isFirstLine: boolean): boolean {
  if (isFirstLine) return false;
  if (isPageNumberOnly(line)) return false;
  if (explicitRecommendationLineStart(line) || startsBullet(line)) return true;
  const clean = normalizeText(line);
  return (
    /^(?:уровень\s+(?:убедительности|достоверности)(?:\s|$)|ууд(?:\s|$|[-–—:])|уур(?:\s|$|[-–—:])|комментари(?:й|и)(?:\s|$|:)|примечани(?:е|я)(?:\s|$|:))/u.test(clean) ||
    /^(?:\d+\.\s+|\d+(?:\.\d+)+\.?\s+)[а-яё]/u.test(clean)
  );
}

/**
 * Строит узкие пункты рекомендаций: от явного `рекомендовано/рекомендуется`
 * до УДД/УУР, комментария, следующего пункта или следующей рекомендации.
 *
 * В отличие от широких 12/22-строчных окон, эти сегменты не захватывают
 * комментарий и соседний пункт, поэтому пригодны для однозначного single-bind.
 */
export type RecommendationSegment = {
  page: number;
  text: string;
  normalized: string;
};

/**
 * Объединяет переносы рекомендации, сохраняя границы соседних пунктов.
 *
 * @param pages Извлечённые страницы PDF, доступные scorer-у.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 */
export function buildAtomicRecommendationSegments(
  pages: PdfLinePage[],
): RecommendationSegment[] {
  const segments: RecommendationSegment[] = [];
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const pageLines = page.lines ?? [];
    for (let lineIndex = 0; lineIndex < pageLines.length; lineIndex += 1) {
      if (!explicitRecommendationLineStart(pageLines[lineIndex]) && !startsBullet(pageLines[lineIndex])) continue;
      const startedWithBullet = startsBullet(pageLines[lineIndex]);
      const lines: string[] = [];
      let done = false;
      for (let currentPageIndex = pageIndex; currentPageIndex < Math.min(pages.length, pageIndex + 2) && !done; currentPageIndex += 1) {
        const currentLines = pages[currentPageIndex]?.lines ?? [];
        const start = currentPageIndex === pageIndex ? lineIndex : 0;
        for (let index = start; index < currentLines.length && lines.length < 10; index += 1) {
          const line = currentLines[index];
          const first = currentPageIndex === pageIndex && index === lineIndex;
          const recommendationContinuation =
            !first &&
            startedWithBullet &&
            lines.length <= 3 &&
            /(?:^|\s)(?:и|или|в|на|с|при|для|по|к|от|до)\s*$/u.test(lines[lines.length - 1]) &&
            !startsBullet(line) &&
            /^[а-яё]/u.test(String(line ?? "").trim()) &&
            !lines.some((item) => explicitRecommendationLineStart(item)) &&
            explicitRecommendationLineStart(line);
          if (!recommendationContinuation && atomicRecommendationBoundary(line, first)) {
            done = true;
            break;
          }
          if (isPageNumberOnly(line)) continue;
          lines.push(line);
          if (lines.join(" ").length >= 1800) {
            done = true;
            break;
          }
        }
      }
      const text = lines.join(" ").replace(/\s+/gu, " ").trim();
      if (text.length < 24) continue;
      if (!recommendationCueSegment(normalizeForSearch(text))) continue;
      segments.push({
        page: page.page,
        text,
        normalized: normalizeForSearch(text),
      });
    }
  }
  return segments;
}

/**
 * Проверяет структурную совместимость рекомендации субъекта.
 *
 * @param questionNorm Значение `questionNorm`, необходимое этому этапу scorer-а.
 * @param segmentNorm Значение `segmentNorm`, необходимое этому этапу scorer-а.
 * @returns `true`, если проверяемое условие выполнено; иначе `false`.
 * @internal
 */
function recommendationSubjectCompatible(questionNorm: string, segmentNorm: string): boolean {
  const questionBiological = containsNormalizedPhrase(questionNorm, "\u0431\u0438\u043e\u043b\u043e\u0433");
  const questionMechanical = containsNormalizedPhrase(questionNorm, "\u043c\u0435\u0445\u0430\u043d");
  const segmentBiological = containsNormalizedPhrase(segmentNorm, "\u0431\u0438\u043e\u043b\u043e\u0433");
  const segmentMechanical = containsNormalizedPhrase(segmentNorm, "\u043c\u0435\u0445\u0430\u043d");
  if (questionBiological && segmentMechanical && !segmentBiological) return false;
  if (questionMechanical && segmentBiological && !segmentMechanical) return false;
  if (questionBiological && !segmentBiological) return false;
  if (questionMechanical && !segmentMechanical) return false;
  if (containsNormalizedPhrase(questionNorm, "\u043f\u0435\u0440\u0432\u043e\u0439 \u043b\u0438\u043d\u0438\u0438") && !containsNormalizedPhrase(segmentNorm, "\u043f\u0435\u0440\u0432\u043e\u0439 \u043b\u0438\u043d\u0438\u0438")) {
    return false;
  }
  return true;
}

/**
 * Выполняет внутренний этап `recommendationQuestionCoverage`, подготавливающий рекомендации вопроса `coverage` для основного scorer-а.
 *
 * @param questionNorm Значение `questionNorm`, необходимое этому этапу scorer-а.
 * @param questionTokens Нормализованные токены вопроса.
 * @param segmentNorm Значение `segmentNorm`, необходимое этому этапу scorer-а.
 * @returns Вычисленное числовое значение или специальное граничное значение при отсутствии совпадения.
 * @internal
 */
function recommendationQuestionCoverage(questionNorm: string, questionTokens: string[], segmentNorm: string): number {
  const segmentTokens = tokenizeNormalized(segmentNorm);
  let coverageScore = strictSoftCoverage(questionTokens, segmentTokens);
  const valveProsthesisQuestion =
    containsNormalizedPhrase(questionNorm, "\u043f\u0440\u043e\u0442\u0435\u0437") &&
    containsNormalizedPhrase(questionNorm, "\u0430\u043e\u0440\u0442") &&
    containsNormalizedPhrase(questionNorm, "\u043a\u043b\u0430\u043f");
  if (valveProsthesisQuestion && containsNormalizedPhrase(segmentNorm, "\u041f\u0410\u041a")) coverageScore = Math.max(coverageScore, 0.58);
  return coverageScore;
}

/**
 * Строит ограниченное локальное окно для рекомендации варианта ответа.
 *
 * @param questionNorm Значение `questionNorm`, необходимое этому этапу scorer-а.
 * @param segmentNorm Значение `segmentNorm`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function recommendationAnswerWindow(questionNorm: string, segmentNorm: string): string {
  if (containsNormalizedPhrase(questionNorm, "\u0434\u0438\u043b\u0430\u0442\u0430\u0446")) {
    const withoutDilation = segmentNorm.indexOf(normalizeForSearch("\u0431\u0435\u0437 \u0434\u0438\u043b\u0430\u0442\u0430\u0446"));
    if (withoutDilation > 80) return segmentNorm.slice(0, withoutDilation);
  }
  return segmentNorm;
}

/**
 * Выполняет внутренний этап `recommendationAliasSupport`, подготавливающий рекомендации алиаса поддержки ответа для основного scorer-а.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @param segmentNorm Значение `segmentNorm`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function recommendationAliasSupport(answerText: string, segmentNorm: string): number {
  const answerNorm = normalizeForSearch(answerText);
  let support = 0;
  if (
    containsNormalizedPhrase(answerNorm, "\u0438\u043d\u0433\u0438\u0431") &&
    containsNormalizedPhrase(answerNorm, "\u0430\u043f\u0444") &&
    containsNormalizedPhrase(segmentNorm, "\u0438\u0410\u041f\u0424")
  ) {
    support = Math.max(support, 0.98);
  }
  if (
    containsNormalizedPhrase(answerNorm, "\u0431\u0435\u0442\u0430") &&
    containsNormalizedPhrase(answerNorm, "\u0430\u0434\u0440\u0435\u043d\u043e") &&
    containsNormalizedPhrase(answerNorm, "\u0431\u043b\u043e\u043a") &&
    containsNormalizedPhrase(segmentNorm, "\u0431\u0435\u0442\u0430")
  ) {
    support = Math.max(support, 0.96);
  }
  return support;
}

/**
 * Выполняет внутренний этап `anticoagulationContraPolarity`, подготавливающий `anticoagulation` `contra` полярности для основного scorer-а.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function anticoagulationContraPolarity(normalized: string): AnticoagulationContraPolarity | null {
  if (!containsNormalizedPhrase(normalized, "\u0430\u043d\u0442\u0438\u043a\u043e\u0430\u0433")) return null;
  const contra = normalizeForSearch("\u043f\u0440\u043e\u0442\u0438\u0432\u043e\u043f\u043e\u043a\u0430\u0437");
  let start = 0;
  while (start < normalized.length) {
    const index = normalized.indexOf(contra, start);
    if (index < 0) break;
    const before = normalized.slice(Math.max(0, index - 58), index);
    if (containsNormalizedPhrase(before, "\u043e\u0442\u0441\u0443\u0442")) return "absence";
    if (containsNormalizedPhrase(before, "\u043d\u0430\u043b\u0438\u0447")) return "presence";
    start = index + contra.length;
  }
  return null;
}

/**
 * Определяет явное несовпадение рекомендации `presence`.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @param segmentNorm Значение `segmentNorm`, необходимое этому этапу scorer-а.
 * @returns `true`, если проверяемое условие выполнено; иначе `false`.
 * @internal
 */
function recommendationPresenceMismatch(answerText: string, segmentNorm: string): boolean {
  const answerNorm = normalizeForSearch(answerText);
  const answerContraPolarity = anticoagulationContraPolarity(answerNorm);
  const segmentContraPolarity = anticoagulationContraPolarity(segmentNorm);
  if (answerContraPolarity && segmentContraPolarity && answerContraPolarity !== segmentContraPolarity) return true;
  if (containsNormalizedPhrase(answerNorm, "\u043e\u043f\u0442\u0438\u043c") && !containsNormalizedPhrase(segmentNorm, "\u043e\u043f\u0442\u0438\u043c")) return true;
  if (
    (containsNormalizedPhrase(answerNorm, "\u043c\u0435\u043d\u044c\u0448") || containsNormalizedPhrase(answerNorm, "\u043d\u0438\u0436\u0435")) &&
    !containsNormalizedPhrase(segmentNorm, "\u043c\u0435\u043d\u044c\u0448") &&
    !containsNormalizedPhrase(segmentNorm, "\u043d\u0438\u0436\u0435")
  ) {
    return true;
  }
  const answerAbsence = containsNormalizedPhrase(answerNorm, "\u043e\u0442\u0441\u0443\u0442\u0441\u0442");
  const answerPresence = containsNormalizedPhrase(answerNorm, "\u043d\u0430\u043b\u0438\u0447");
  const segmentAbsence = containsNormalizedPhrase(segmentNorm, "\u043e\u0442\u0441\u0443\u0442\u0441\u0442");
  const segmentPresence = containsNormalizedPhrase(segmentNorm, "\u043d\u0430\u043b\u0438\u0447");
  const contra = containsNormalizedPhrase(answerNorm, "\u043f\u0440\u043e\u0442\u0438\u0432\u043e\u043f\u043e\u043a\u0430\u0437") || containsNormalizedPhrase(segmentNorm, "\u043f\u0440\u043e\u0442\u0438\u0432\u043e\u043f\u043e\u043a\u0430\u0437");
  if (contra && answerAbsence && segmentPresence && !segmentAbsence) return true;
  if (contra && answerPresence && segmentAbsence && !segmentPresence) return true;
  return false;
}

/**
 * Выделяет специфичные токены для назначения целевого объекта.
 *
 * @param question Исходный текст вопроса.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function appointmentTargetTokens(question: string): string[] {
  const normalized = normalizeText(question);
  const cues = [
    "\u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435",
    "\u043f\u0440\u043e\u0432\u0435\u0434\u0435\u043d\u0438\u0435",
    "\u043f\u0440\u043e\u0432\u043e\u0434\u0438\u0442\u044c",
    "\u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435",
  ].map((item) => normalizeText(item));
  let cue = "";
  let cueIndex = -1;
  for (const candidate of cues) {
    const index = normalized.indexOf(candidate);
    if (index >= 0 && (cueIndex < 0 || index < cueIndex)) {
      cue = candidate;
      cueIndex = index;
    }
  }
  if (cueIndex < 0) return [];
  const tail = normalized.slice(cueIndex + cue.length).trim();
  const boundaryCues = [
    "\u0441 \u0446\u0435\u043b\u044c\u044e",
    "\u0432 \u0434\u043e\u0437",
    "\u0432 \u043a\u0430\u0447\u0435\u0441\u0442\u0432",
    "\u043f\u0440\u0438 \u043d\u0430\u043b\u0438\u0447",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442",
  ].map((item) => normalizeText(item));
  let end = tail.length;
  for (const boundary of boundaryCues) {
    const index = tail.indexOf(boundary);
    if (index > 0) end = Math.min(end, index);
  }
  return uniqueTokens(tail.slice(0, end))
    .filter((token) => token.length >= 4 && !FOCUS_STOPWORDS.has(token) && !RECOMMENDATION_TARGET_GENERIC.has(token))
    .slice(0, 7);
}

/**
 * Выполняет внутренний этап `targetCoverage`, подготавливающий целевого объекта `coverage` для основного scorer-а.
 *
 * @param targetTokens Нормализованные токены соответствующего текста.
 * @param segmentTokens Нормализованные токены соответствующего текста.
 * @returns Вычисленное числовое значение или специальное граничное значение при отсутствии совпадения.
 * @internal
 */
function targetCoverage(targetTokens: string[], segmentTokens: string[]): number {
  if (!targetTokens.length) return 0;
  return strictSoftCoverage(targetTokens, segmentTokens);
}

/**
 * Выделяет специфичные токены для назначения `context`.
 *
 * @param question Исходный текст вопроса.
 * @param targetTokens Нормализованные токены соответствующего текста.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function appointmentContextTokens(question: string, targetTokens: string[]): string[] {
  const targetSet = new Set(targetTokens);
  return uniqueTokens(question)
    .filter((token) => token.length >= 4 && !targetSet.has(token) && !FOCUS_STOPWORDS.has(token) && !RECOMMENDATION_TARGET_GENERIC.has(token))
    .slice(0, 8);
}

/**
 * Выполняет внутренний этап `contextCoverage`, подготавливающий `context` `coverage` для основного scorer-а.
 *
 * @param contextTokens Нормализованные токены соответствующего текста.
 * @param segmentTokens Нормализованные токены соответствующего текста.
 * @returns Вычисленное числовое значение или специальное граничное значение при отсутствии совпадения.
 * @internal
 */
function contextCoverage(contextTokens: string[], segmentTokens: string[]): number {
  if (contextTokens.length < 2) return 1;
  return strictSoftCoverage(contextTokens, segmentTokens);
}

/**
 * Определяет локальные совпадения для рекомендации сегмента варианта ответа.
 *
 * @param answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param answerTokens Нормализованные токены проверяемого варианта.
 * @param segmentNorm Значение `segmentNorm`, необходимое этому этапу scorer-а.
 * @param segmentTokens Нормализованные токены соответствующего текста.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function recommendationSegmentAnswerHit(
  answer: AnswerOption,
  answerTokens: string[],
  segmentNorm: string,
  segmentTokens: string[],
): RecommendationSegmentAnswerHit {
  const answerNorm = normalizeForSearch(answer.text);
  const strongPhrases = new Set([answerNorm]);
  const withoutParentheses = answerNorm.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (withoutParentheses) strongPhrases.add(withoutParentheses);
  const hyphenSplit = normalizeForSearch(String(answer.text ?? "").replace(/\s*[-\u2010-\u2015]\s*/g, " "));
  if (hyphenSplit) strongPhrases.add(hyphenSplit);
  const strongPhraseHit = [...strongPhrases].filter((phrase) => phrase.length >= 8).some((phrase) => containsNormalizedPhrase(segmentNorm, phrase));
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 18);
  const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(segmentNorm, phrase));
  const answerCoverage = strictSoftCoverage(answerTokens, segmentTokens);
  const numeric = extractNumbers(answer.text).length > 0;
  const numericCoverage = numeric ? numberCoverage(answer.text, segmentNorm) : 0;
  const longText = answerTokens.length >= 5;
  const supportHit =
    strongPhraseHit ||
    (numeric && ((phraseHit && answerCoverage >= 0.74 && numericCoverage >= 0.72) || (answerCoverage >= 0.8 && numericCoverage >= 0.9))) ||
    (!numeric && (longText ? answerCoverage >= 0.9 : phraseHit || answerCoverage >= 0.62));
  const mismatchHit = phraseHit || (answerCoverage >= (numeric ? 0.62 : 0.58) && (!numeric || numericCoverage >= 0.45));
  return { phraseHit, strongPhraseHit, answerCoverage, numericCoverage, supportHit, mismatchHit };
}

/**
 * Выполняет внутренний этап `genericPopulationAnswerText`, подготавливающий общих токенов популяции варианта ответа текста для основного scorer-а.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function genericPopulationAnswerText(answerText: string): boolean {
  const normalized = normalizeForSearch(answerText);
  return (
    normalized.startsWith(normalizeForSearch("\u0432\u0441\u0435\u043c \u043f\u0430\u0446\u0438\u0435\u043d\u0442")) ||
    normalized.startsWith(normalizeForSearch("\u0432\u0441\u0435 \u043f\u0430\u0446\u0438\u0435\u043d\u0442")) ||
    normalized.startsWith(normalizeForSearch("\u0432\u0441\u0435\u043c \u043f\u043e\u0441\u0442\u0440\u0430\u0434")) ||
    normalized.startsWith(normalizeForSearch("\u0432\u0441\u0435 \u043f\u043e\u0441\u0442\u0440\u0430\u0434")) ||
    normalized.startsWith(normalizeForSearch("\u0432\u0441\u0435\u043c \u0431\u043e\u043b\u044c\u043d")) ||
    normalized.startsWith(normalizeForSearch("\u0432\u0441\u0435 \u0431\u043e\u043b\u044c\u043d"))
  );
}

/**
 * Выполняет внутренний этап `populationStem`, подготавливающий популяции основы слова для основного scorer-а.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function populationStem(answerText: string): string | null {
  const stems = ["\u043f\u0430\u0446\u0438\u0435\u043d\u0442", "\u043f\u043e\u0441\u0442\u0440\u0430\u0434", "\u0431\u043e\u043b\u044c\u043d"].map((item) => normalizeForSearch(item));
  return uniqueTokens(answerText).find((token) => stems.some((stem) => token.startsWith(stem.slice(0, Math.min(8, stem.length))))) ?? null;
}

/**
 * Проверяет наличие или совместимость специфичных популяции альтернативы.
 *
 * @param answers Полный набор вариантов, необходимый для контрастного сравнения.
 * @param genericAnswer Значение `genericAnswer`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function hasSpecificPopulationAlternative(answers: AnswerOption[], genericAnswer: AnswerOption): boolean {
  const stem = populationStem(genericAnswer.text);
  if (!stem) return false;
  return (answers ?? []).some((candidate) => {
    if (candidate.id === genericAnswer.id) return false;
    const normalized = normalizeForSearch(candidate.text);
    const candidateTokens = uniqueTokens(candidate.text);
    if (!candidateTokens.some((token) => token.startsWith(stem.slice(0, Math.min(8, stem.length))))) return false;
    return (
      containsNormalizedPhrase(normalized, "\u0441\u0440\u0435\u0434\u043d") ||
      containsNormalizedPhrase(normalized, "\u0442\u044f\u0436\u0435\u043b") ||
      containsNormalizedPhrase(normalized, "\u0441\u0442\u0435\u043f\u0435\u043d") ||
      containsNormalizedPhrase(normalized, "\u043f\u0440\u0438 \u043d\u0430\u043b\u0438\u0447") ||
      containsNormalizedPhrase(normalized, "\u0441 \u043d\u0430\u043b\u0438\u0447")
    );
  });
}

/**
 * Выполняет внутренний этап `followUpFrequencyAnswer`, подготавливающий `follow` `up` частоты варианта ответа для основного scorer-а.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function followUpFrequencyAnswer(answerText: string): boolean {
  const normalized = normalizeForSearch(answerText);
  return (
    extractNumbers(answerText).length > 0 &&
    (containsNormalizedPhrase(normalized, "\u043a\u0430\u0436\u0434") || containsNormalizedPhrase(normalized, "\u0440\u0430\u0437 \u0432")) &&
    (containsNormalizedPhrase(normalized, "\u043c\u0435\u0441\u044f\u0446") ||
      containsNormalizedPhrase(normalized, "\u0433\u043e\u0434") ||
      containsNormalizedPhrase(normalized, "\u043b\u0435\u0442") ||
      containsNormalizedPhrase(normalized, "\u043d\u0435\u0434\u0435\u043b"))
  );
}

/**
 * Ищет поддержку варианта внутри того рекомендательного блока, который относится к препарату/вмешательству
 * из вопроса вида "рекомендовано назначение X". Если вариант уверенно найден только в соседней рекомендации
 * про другой X, возвращается мягкий штраф вместо поддержки.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answers Полный набор вариантов, необходимый для контрастного сравнения.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @returns Поправка score и, при наличии, объясняющее evidence.
 */
export function explicitRecommendationTargetAdjustment(
  {mode, pages, question, answer, answers, answerTokens}: AnswerScoringContext,
): SupportAdjustment {
  if (mode !== "multi") return { support: null, adjustment: 0, evidence: null };
  const targetTokens = appointmentTargetTokens(question);
  if (!targetTokens.length) return { support: null, adjustment: 0, evidence: null };
  const contextTokens = appointmentContextTokens(question, targetTokens);

  let bestSupport = null;
  let bestMismatch = null;
  let targetSegmentCount = 0;

  for (const segment of explicitRecommendationSegments(pages)) {
    const segmentTokens = tokenizeNormalized(segment.normalized);
    const segmentTargetCoverage = targetCoverage(targetTokens, segmentTokens);
    const segmentContextCoverage = contextCoverage(contextTokens, segmentTokens);
    const answerHit = recommendationSegmentAnswerHit(answer, answerTokens, segment.normalized, segmentTokens);
    if (segmentTargetCoverage >= 0.72 && segmentContextCoverage >= 0.45) {
      targetSegmentCount += 1;
      const genericSpecificConflict = genericPopulationAnswerText(answer.text) && hasSpecificPopulationAlternative(answers, answer);
      if (!answerHit.supportHit || genericSpecificConflict) continue;
      const score =
        12.8 +
        segmentTargetCoverage * 4.4 +
        Math.min(1, segmentContextCoverage) * 1.6 +
        answerHit.answerCoverage * 4.2 +
        answerHit.numericCoverage * 1.8 +
        (answerHit.strongPhraseHit ? 2.8 : answerHit.phraseHit ? 1.4 : 0);
      bestSupport = betterEvidence(bestSupport, {
        answerId: answer.id,
        page: segment.page,
        text: segment.text,
        score,
        kind: "explicit_recommendation_target_segment",
      });
      continue;
    }

    if (!answerHit.mismatchHit || followUpFrequencyAnswer(answer.text) || (segmentTargetCoverage > 0.35 && segmentContextCoverage >= 0.45)) continue;
    const mismatchScore = 9.4 + answerHit.answerCoverage * 3.1 + answerHit.numericCoverage * 1.6 + (answerHit.phraseHit ? 2.0 : 0);
    bestMismatch = betterEvidence(bestMismatch, {
      answerId: answer.id,
      page: segment.page,
      text: segment.text,
      score: mismatchScore,
      kind: "explicit_recommendation_target_mismatch",
    });
  }

  if (bestSupport) return { support: bestSupport, adjustment: 0, evidence: null };
  if (targetSegmentCount > 0 && bestMismatch && bestMismatch.score >= 11.2) {
    return { support: null, adjustment: -3.8, evidence: bestMismatch };
  }
  return { support: null, adjustment: 0, evidence: null };
}

/**
 * Ищет вариант ответа внутри одного атомарного пункта рекомендации.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestRecommendationItemSupport(
  {pages, question, answer, answerTokens}: AnswerScoringContext,
): EvidenceItem | null {
  if (!recommendationItemQuestion(question)) return null;
  const questionNorm = normalizeForSearch(question);
  const qTokens = recommendationQuestionTokens(question);
  if (!qTokens.length) return null;
  let best = null;

  for (const segment of recommendationSegments(pages)) {
    const answerNorm = normalizeForSearch(answer.text);
    if (containsNormalizedPhrase(answerNorm, "\u043e\u043f\u0442\u0438\u043c") && !containsNormalizedPhrase(questionNorm, "\u043e\u043f\u0442\u0438\u043c")) continue;
    if (!recommendationSubjectCompatible(questionNorm, segment.normalized)) continue;
    const qCoverage = recommendationQuestionCoverage(questionNorm, qTokens, segment.normalized);
    if (qCoverage < 0.34) continue;
    const answerWindow = recommendationAnswerWindow(questionNorm, segment.normalized);
    if (recommendationPresenceMismatch(answer.text, answerWindow)) continue;
    const tokens = tokenizeNormalized(answerWindow);
    const phraseHit = answerSearchPhrases(answer.text).some((phrase) => containsNormalizedPhrase(answerWindow, phrase));
    const alias = recommendationAliasSupport(answer.text, answerWindow);
    const answerCoverage = Math.max(strictSoftCoverage(answerTokens, tokens), alias);
    if (!phraseHit && answerCoverage < 0.62) continue;
    const score = 15.8 + qCoverage * 4.0 + answerCoverage * 6.2 + (phraseHit ? 2.4 : 0) + alias * 2.0;
    best = betterEvidence(best, {
      answerId: answer.id,
      page: segment.page,
      text: segment.text,
      score,
      kind: "recommendation_item_segment",
    });
  }

  return best;
}

/**
 * Выполняет внутренний этап `broadRecommendationQuestion`, подготавливающий `broad` рекомендации вопроса для основного scorer-а.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function broadRecommendationQuestion(question: string): boolean {
  const normalized = normalizeForSearch(question);
  return (
    containsNormalizedPhrase(normalized, "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434") ||
    containsNormalizedPhrase(normalized, "\u043d\u0430\u0437\u043d\u0430\u0447") ||
    containsNormalizedPhrase(normalized, "\u043f\u0440\u043e\u0432\u043e\u0434") ||
    containsNormalizedPhrase(normalized, "\u043b\u0435\u0447\u0435\u043d") ||
    containsNormalizedPhrase(normalized, "\u0442\u0435\u0440\u0430\u043f") ||
    containsNormalizedPhrase(normalized, "\u043f\u0440\u043e\u0444\u0438\u043b\u0430\u043a\u0442")
  );
}

/**
 * Выполняет внутренний этап `recommendationCueSegment`, подготавливающий рекомендации маркера сегмента для основного scorer-а.
 *
 * @param segmentNorm Значение `segmentNorm`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function recommendationCueSegment(segmentNorm: string): boolean {
  return (
    containsNormalizedPhrase(segmentNorm, "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434") ||
    containsNormalizedPhrase(segmentNorm, "\u043d\u0430\u0437\u043d\u0430\u0447") ||
    containsNormalizedPhrase(segmentNorm, "\u043f\u0440\u043e\u0432\u043e\u0434") ||
    containsNormalizedPhrase(segmentNorm, "\u043f\u0440\u0438\u043c\u0435\u043d")
  );
}

/**
 * Ищет вариант внутри одного рекомендательного пункта, не склеивая соседние рекомендации.
 * Срабатывает только при высокой доле вопросных токенов в том же пункте, где найден вариант.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestRecommendationBlockSupport(
  {mode, pages, topQuestionPages, question, answer, answerTokens}: AnswerScoringContext,
): EvidenceItem | null {
  if (mode !== "multi") return null;
  if (!broadRecommendationQuestion(question)) return null;
  const questionNorm = normalizeForSearch(question);
  if (containsNormalizedPhrase(questionNorm, "\u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435")) return null;
  const qTokens = recommendationQuestionTokens(question);
  if (qTokens.length < 3) return null;
  let best = null;

  for (const segment of recommendationSegments(pages)) {
    if (topQuestionPages?.size && !topQuestionPages.has(segment.page)) continue;
    if (!recommendationCueSegment(segment.normalized)) continue;
    if (recommendationPresenceMismatch(answer.text, segment.normalized)) continue;
    const segmentTokens = tokenizeNormalized(segment.normalized);
    const qCoverage = recommendationQuestionCoverage(questionNorm, qTokens, segment.normalized);
    const qHits = tokenHitCount(qTokens, segmentTokens);
    if (qCoverage < 0.54 || qHits < Math.min(4, qTokens.length)) continue;
    const answerHit = recommendationSegmentAnswerHit(answer, answerTokens, segment.normalized, segmentTokens);
    if (!answerHit.supportHit) continue;
    const score =
      12.4 +
      Math.min(1, qCoverage) * 4.6 +
      Math.min(5, qHits) * 0.7 +
      answerHit.answerCoverage * 4.8 +
      answerHit.numericCoverage * 1.8 +
      (answerHit.strongPhraseHit ? 2.4 : answerHit.phraseHit ? 1.2 : 0);
    best = betterEvidence(best, {
      answerId: answer.id,
      page: segment.page,
      text: segment.text,
      score,
      kind: "recommendation_block_segment",
    });
  }

  return best;
}
