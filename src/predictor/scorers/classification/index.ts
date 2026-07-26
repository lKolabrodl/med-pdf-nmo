import {
  coverage,
  extractNumbers,
  normalizeForSearch,
  normalizeText,
  tokenize,
  uniqueTokens,
} from "../../../normalize.js";
import { FOCUS_STOPWORDS, LABEL_CUES } from "../../constants.js";
import {
  answerSearchPhrases,
  betterEvidence,
  containsNormalizedPhrase,
  evidenceSnippet,
  expandNumberToken,
  findPhraseOccurrences,
  numberCoverage,
  pageWindow,
  proximityBonus,
  rawSoftCoverage,
  softCoverage,
  strictSoftCoverage,
  tokenHitCount,
  tokenizeNormalized,
} from "../../text-utils.js";
import type {PdfPage, PdfTextLine} from "../../../pdf.js";
import type {AnswerScoringContext} from "../../contracts.js";
import type {AnswerMode, EvidenceItem} from "../../types.js";

type MkbClassExclusionSupport = {
  support: EvidenceItem | null;
  adjustment: number;
  evidence: EvidenceItem | null;
};

type VisualTableColumnTarget = {
  x: number;
  text: string;
  page: number;
};

type VisualTableColumnTargetsByPage = Map<number, VisualTableColumnTarget[]>;

/**
 * Выделяет текстовые маркеры для вопроса метки.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function questionLabelCues(question: string): string[] {
  const normalized = normalizeForSearch(question);
  return LABEL_CUES.filter((cue) => normalized.includes(cue));
}

/**
 * Ищет числовой вариант рядом с текстовой меткой, извлечённой из вопроса.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestLabelNumberSupport({pages, topQuestionPages, question, answer}: AnswerScoringContext): EvidenceItem | null {
  const labels = questionLabelCues(question);
  if (/мкб/u.test(normalizeText(question))) return null;
  if (!labels.length || !extractNumbers(answer.text).length) return null;
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 12);
  let best = null;
  for (const page of pages) {
    if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
    const pageNorm = page.normalized;
    const labelHits: number[] = [];
    for (const label of labels) {
      let start = 0;
      while (start < pageNorm.length) {
        const index = pageNorm.indexOf(label, start);
        if (index < 0) break;
        const around = pageNorm.slice(Math.max(0, index - 24), index + 48);
        if (!containsNormalizedPhrase(around, "степени тяжести")) labelHits.push(index);
        start = index + Math.max(1, label.length);
      }
    }
    if (!labelHits.length) continue;
    for (const phrase of answerPhrases) {
      const hits = findPhraseOccurrences(pageNorm, phrase, { textIsNormalized: true });
      for (const hit of hits) {
        const forwardDistances = labelHits.map((labelHit) => hit - labelHit).filter((distance) => distance >= 0);
        if (!forwardDistances.length) continue;
        const distance = Math.min(...forwardDistances);
        if (distance > 150) continue;
        const local = pageWindow(page, hit, 180);
        const score = 6.6 + proximityBonus(distance, 150) * 4.4 + numberCoverage(answer.text, local) * 1.4;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: evidenceSnippet(page.text, phrase, question),
          score,
          kind: "label_number_proximity",
        });
      }
    }
  }
  return best;
}

const CLASSIFICATION_CODE_QUESTION_CUES = [
  "\u043a\u043e\u0434",
  "\u043a\u043e\u0434\u0438\u0440",
  "\u043c\u043a\u0431",
].map((item) => normalizeForSearch(item));

const CLASSIFICATION_CODE_GENERIC_TOKENS = new Set(
  [
    "\u043a\u043e\u0434",
    "\u043a\u043e\u0434\u0438\u0440\u0443\u0435\u0442\u0441\u044f",
    "\u043a\u043e\u0434\u0438\u0440\u043e\u0432\u043a\u0430",
    "\u043c\u043a\u0431",
    "\u043c\u0435\u0436\u0434\u0443\u043d\u0430\u0440\u043e\u0434\u043d\u043e\u0439",
    "\u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043a\u043e\u0439",
    "\u043a\u043b\u0430\u0441\u0441\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u0438",
    "\u0431\u043e\u043b\u0435\u0437\u043d\u0435\u0439",
    "\u043f\u0440\u043e\u0431\u043b\u0435\u043c",
    "\u0441\u0432\u044f\u0437\u0430\u043d\u043d\u044b\u0445",
    "\u0437\u0434\u043e\u0440\u043e\u0432\u044c\u0435\u043c",
    "\u043a\u0440\u0438\u0442\u0435\u0440\u0438\u0439",
    "\u043a\u0440\u0438\u0442\u0435\u0440\u0438\u0438",
    "\u0443\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442",
    "\u0441\u0432\u0438\u0434\u0435\u0442\u0435\u043b\u044c\u0441\u0442\u0432\u0443\u0435\u0442",
    "\u043e\u0442\u0440\u0430\u0436\u0430\u0435\u0442",
    "\u043f\u0440\u0438\u0437\u043d\u0430\u043a\u0438",
    "\u0441\u0442\u0430\u0434\u0438\u044f",
  ].flatMap((item) => uniqueTokens(item)),
);

const CYRILLIC_CODE_LETTERS = new Map([
  ["\u0410", "a"],
  ["\u0412", "b"],
  ["\u0421", "c"],
  ["\u0415", "e"],
  ["\u041d", "h"],
  ["\u041a", "k"],
  ["\u041c", "m"],
  ["\u041e", "o"],
  ["\u0420", "p"],
  ["\u0422", "t"],
  ["\u0425", "x"],
  ["\u0430", "a"],
  ["\u0432", "b"],
  ["\u0441", "c"],
  ["\u0435", "e"],
  ["\u043d", "h"],
  ["\u043a", "k"],
  ["\u043c", "m"],
  ["\u043e", "o"],
  ["\u0440", "p"],
  ["\u0442", "t"],
  ["\u0445", "x"],
]);

/**
 * Возвращает каноническое представление классификации кода.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function canonicalClassificationCode(text: string): string | null {
  const normalized = String(text ?? "").normalize("NFKC");
  const match = normalized.match(/(?:^|[^\p{L}\p{N}])([A-Za-z\u0410-\u042f\u0430-\u044f])\s*\.?\s*(\d{1,3})(?:\s*[.]\s*(\d{1,2}))?(?![\p{L}\p{N}])/u);
  if (!match) return null;
  const letter = (CYRILLIC_CODE_LETTERS.get(match[1]) ?? match[1]).toLowerCase();
  if (!/[a-z]/.test(letter)) return null;
  const main = match[2].replace(/^0+(?=\d)/, "");
  const sub = match[3]?.replace(/^0+(?=\d)/, "");
  return sub ? `${letter}${main}.${sub}` : `${letter}${main}`;
}

/**
 * Возвращает каноническое представление классификации кодов.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function canonicalClassificationCodes(text: string): string[] {
  const normalized = String(text ?? "").normalize("NFKC");
  const codes: string[] = [];
  const pattern = /(?:^|[^\p{L}\p{N}])([A-Za-z\u0410-\u042f\u0430-\u044f])\s*\.?\s*(\d{1,3})(?:\s*[.]\s*(\d{1,2}))?(?![\p{L}\p{N}])/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(normalized))) {
    const code = canonicalClassificationCode(match[0]);
    if (code) codes.push(code);
  }
  const ocrJPattern = /(?:^|[^\p{L}\p{N}])(?:[.\u041b\u043b])\s*\.?\s*(\d{2,3})(?:\s*[.]\s*(\d{1,2}))?(?![\p{L}\p{N}])/gu;
  while ((match = ocrJPattern.exec(normalized))) {
    const main = match[1].length === 3 && match[1].startsWith("1") ? match[1].slice(1) : match[1];
    if (/^\d{2}$/.test(main)) {
      const sub = match[2]?.replace(/^0+(?=\d)/, "");
      codes.push(sub ? `j${main}.${sub}` : `j${main}`);
    }
  }
  return codes;
}

/**
 * Строит ограниченные локальные окна для классификации кода.
 *
 * @param page Текущая страница PDF или её номер.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function classificationCodeWindows(page: PdfPage): string[] {
  const lines = page.lines ?? [];
  const windows: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const parts = [lines[index], lines[index + 1], lines[index + 2]].filter(Boolean);
    const one = parts[0]?.trim();
    const two = parts.slice(0, 2).join(" ").replace(/\s+/g, " ").trim();
    const three = parts.join(" ").replace(/\s+/g, " ").trim();
    if (one && one.length >= 4) windows.push(one);
    if (two.length >= 12) windows.push(two);
    if (three.length >= 24) windows.push(three);
  }
  return [...new Set(windows)];
}

/**
 * Ищет точный код классификации в релевантном строковом контексте.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.questionTokens Нормализованные токены вопроса.
 * @param context.focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestClassificationCodeSupport(
  {pages, topQuestionPages, question, answer, questionTokens, focusTokens}: AnswerScoringContext,
): EvidenceItem | null {
  const code = canonicalClassificationCode(answer.text);
  if (!code) return null;
  const normalizedQuestion = normalizeForSearch(question);
  const isCodeQuestion = CLASSIFICATION_CODE_QUESTION_CUES.some((cue) => normalizedQuestion.includes(cue));
  if (!isCodeQuestion) return null;

  const filteredFocus = focusTokens
    .filter((token) => token.length >= 3 && !CLASSIFICATION_CODE_GENERIC_TOKENS.has(token) && !/^\d/.test(token))
    .slice(0, 12);
  const filteredQuestion = questionTokens
    .filter((token) => token.length >= 3 && !CLASSIFICATION_CODE_GENERIC_TOKENS.has(token) && !/^\d/.test(token))
    .slice(0, 18);
  if (!filteredFocus.length && !filteredQuestion.length) return null;

  let best = null;
  for (const page of pages) {
    if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
    for (const windowText of classificationCodeWindows(page)) {
      const codes = canonicalClassificationCodes(windowText);
      if (!codes.includes(code)) continue;
      const tokens = tokenize(windowText);
      const focusCoverage = filteredFocus.length ? coverage(filteredFocus, tokens) : 0;
      const questionCoverage = filteredQuestion.length ? coverage(filteredQuestion, tokens) : 0;
      if (focusCoverage < 0.22 && questionCoverage < 0.18) continue;
      const codeCountPenalty = Math.max(0, new Set(codes).size - 1) * 0.9;
      const score = 12.8 + focusCoverage * 11 + questionCoverage * 6 + (codes[0] === code ? 1.2 : 0) - codeCountPenalty;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text: evidenceSnippet(page.text, answer.text, question),
        score,
        kind: "classification_code_segment",
      });
    }
  }
  return best;
}

const MKB_CLASS_EXCLUSION_GENERIC_TOKENS = new Set(
  [
    "\u0437\u043b\u043e\u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0435",
    "\u0437\u043b\u043e\u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u0430\u044f",
    "\u043d\u043e\u0432\u043e\u043e\u0431\u0440\u0430\u0437\u043e\u0432\u0430\u043d\u0438\u044f",
    "\u043d\u043e\u0432\u043e\u043e\u0431\u0440\u0430\u0437\u043e\u0432\u0430\u043d\u0438\u0435",
    "\u043a\u043e\u0436\u0438",
    "\u043a\u043e\u0436\u0430",
    "\u0434\u0440\u0443\u0433\u0438\u0435",
    "\u043a\u043b\u0430\u0441\u0441",
    "\u043c\u043a\u0431",
  ].flatMap((item) => uniqueTokens(item)),
);

/**
 * Выполняет внутренний этап `mkbClassExclusionQuestion`, подготавливающий `mkb` класса `exclusion` вопроса для основного scorer-а.
 *
 * @param mode Режим выбора ответа: `single` или `multi`.
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function mkbClassExclusionQuestion(mode: AnswerMode, question: string): boolean {
  if (mode !== "multi") return false;
  const normalized = normalizeForSearch(question);
  const hasMkb = containsNormalizedPhrase(normalized, "\u043c\u043a\u0431");
  const hasClass = containsNormalizedPhrase(normalized, "\u043a\u043b\u0430\u0441\u0441");
  const asksExcluded =
    containsNormalizedPhrase(normalized, "\u043d\u0435 \u0432\u043a\u043b\u044e\u0447") ||
    containsNormalizedPhrase(normalized, "\u0438\u0441\u043a\u043b\u044e\u0447") ||
    containsNormalizedPhrase(normalized, "\u043d\u0435 \u043e\u0442\u043d\u043e\u0441");
  return hasMkb && hasClass && asksExcluded && Boolean(questionMkbClassCode(question));
}

/**
 * Извлекает из вопроса код класса МКБ без уточняющей подклассовой части.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function questionMkbClassCode(question: string): string | null {
  return canonicalClassificationCodes(question).find((code) => !code.includes(".")) ?? null;
}

/**
 * Выполняет внутренний этап `sameMkbClass`, подготавливающий `same` `mkb` класса для основного scorer-а.
 *
 * @param code Значение `code`, необходимое этому этапу scorer-а.
 * @param classCode Значение `classCode`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function sameMkbClass(code: string, classCode: string): boolean {
  return code === classCode || code.startsWith(`${classCode}.`);
}

/**
 * Выполняет внутренний этап `lineHasMkbClass`, подготавливающий строки `mkb` класса для основного scorer-а.
 *
 * @param line Значение `line`, необходимое этому этапу scorer-а.
 * @param classCode Значение `classCode`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function lineHasMkbClass(line: string, classCode: string): boolean {
  return canonicalClassificationCodes(line).some((code) => sameMkbClass(code, classCode));
}

/**
 * Выполняет внутренний этап `mkbClassSectionLines`, подготавливающий `mkb` класса секции строк для основного scorer-а.
 *
 * @param pages Извлечённые страницы PDF, доступные scorer-у.
 * @param topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param classCode Значение `classCode`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function mkbClassSectionLines(pages: PdfPage[], topQuestionPages: Set<number>, classCode: string): string[] {
  let startPageIndex = -1;
  let startLineIndex = -1;
  const candidates = topQuestionPages?.size ? pages.filter((page) => topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1)) : pages;

  for (const page of candidates) {
    const lines = page.lines ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      if (!lineHasMkbClass(lines[index], classCode)) continue;
      startPageIndex = pages.findIndex((candidate) => candidate.page === page.page);
      startLineIndex = index;
      break;
    }
    if (startPageIndex >= 0) break;
  }
  if (startPageIndex < 0) return [];

  const out: string[] = [];
  for (let pageIndex = startPageIndex; pageIndex < Math.min(pages.length, startPageIndex + 3); pageIndex += 1) {
    const lines = pages[pageIndex].lines ?? [];
    const from = pageIndex === startPageIndex ? startLineIndex : 0;
    for (let index = from; index < lines.length; index += 1) {
      const line = lines[index];
      if (out.length && /^\s*\d+(?:\.\d+)+\s+/u.test(normalizeText(line)) && !lineHasMkbClass(line, classCode)) return out;
      out.push(line);
      if (out.length >= 90) return out;
    }
  }
  return out;
}

/**
 * Восстанавливает строки для `mkb` класса включённых строк.
 *
 * @param sectionLines Физические или логические строки PDF.
 * @param classCode Значение `classCode`, необходимое этому этапу scorer-а.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function mkbClassIncludedRows(sectionLines: string[], classCode: string): string[] {
  const rows: string[] = [];
  for (let index = 0; index < sectionLines.length; index += 1) {
    const line = sectionLines[index];
    const codes = canonicalClassificationCodes(line);
    if (!codes.some((code) => code.startsWith(`${classCode}.`))) continue;
    const row = [line];
    for (let next = index + 1; next < Math.min(sectionLines.length, index + 4); next += 1) {
      const nextLine = sectionLines[next];
      const nextCodes = canonicalClassificationCodes(nextLine);
      if (nextCodes.some((code) => sameMkbClass(code, classCode))) break;
      if (containsNormalizedPhrase(normalizeForSearch(nextLine), "\u0438\u0441\u043a\u043b\u044e\u0447")) break;
      row.push(nextLine);
      if (/[.;:]$/u.test(normalizeText(nextLine))) break;
    }
    rows.push(row.join(" ").replace(/\s+/g, " ").trim());
  }
  return rows;
}

/**
 * Выделяет специфичные токены для `mkb` класса варианта ответа.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function mkbClassAnswerTokens(answerText: string): string[] {
  return uniqueTokens(answerText).filter((token) => token.length >= 4 && !MKB_CLASS_EXCLUSION_GENERIC_TOKENS.has(token) && !FOCUS_STOPWORDS.has(token));
}

/**
 * Определяет локальные совпадения для `mkb` класса включённых строк строки.
 *
 * @param row Значение `row`, необходимое этому этапу scorer-а.
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function mkbClassIncludedRowHit(row: string, answerText: string): boolean {
  const tokens = mkbClassAnswerTokens(answerText);
  if (!tokens.length) return false;
  const rowTokens = tokenize(row);
  const strict = strictSoftCoverage(tokens, rowTokens);
  const soft = softCoverage(tokens, rowTokens);
  const raw = rawSoftCoverage(tokens, tokenize(row, { keepStopwords: true, stem: false }));
  const threshold = tokens.length <= 1 ? 1 : 0.58;
  return Math.max(strict, soft, raw) >= threshold;
}

/**
 * Проверяет включение или исключение варианта из названного класса МКБ.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestMkbClassExclusionSupport(
  {pages, topQuestionPages, mode, question, answer}: AnswerScoringContext,
): MkbClassExclusionSupport {
  if (!mkbClassExclusionQuestion(mode, question)) return { support: null, adjustment: 0, evidence: null };
  const classCode = questionMkbClassCode(question);
  if (!classCode) return { support: null, adjustment: 0, evidence: null };
  const sectionLines = mkbClassSectionLines(pages, topQuestionPages, classCode);
  if (sectionLines.length < 3) return { support: null, adjustment: 0, evidence: null };
  const includedRows = mkbClassIncludedRows(sectionLines, classCode);
  if (includedRows.length < 2) return { support: null, adjustment: 0, evidence: null };
  const includedRow = includedRows.find((row) => mkbClassIncludedRowHit(row, answer.text));
  if (includedRow) {
    return {
      support: null,
      adjustment: -9.4,
      evidence: {
        answerId: answer.id,
        page: topQuestionPages?.values().next().value ?? 0,
        text: includedRow,
        score: 17.2,
        kind: "mkb_class_included_mismatch",
      },
    };
  }
  const sectionText = sectionLines.join(" ").replace(/\s+/g, " ").trim();
  return {
    support: {
      answerId: answer.id,
      page: topQuestionPages?.values().next().value ?? 0,
      text: sectionText.slice(0, 900),
      score: 15.8,
      kind: "mkb_class_exclusion_absent",
    },
    adjustment: 0,
    evidence: null,
  };
}

/**
 * Возвращает каноническое представление короткой формы метки.
 *
 * @param value Входное значение, которое требуется нормализовать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function canonicalShortLabel(value: string): string {
  const compact = String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.\s_\-–—]+/g, "")
    .replace(/[тТ]/g, "t")
    .replace(/[мМ]/g, "m")
    .replace(/[хХ]/g, "x")
    .replace(/[оОoO]/g, "0")
    .replace(/[аА]/g, "a")
    .replace(/[вВ]/g, "b");
  return compact.replace(/[^a-z0-9]/g, "");
}

/**
 * Извлекает из вопроса короткие формы меток классификационной строки.
 *
 * @param question Исходный текст вопроса.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function questionShortLabels(question: string): string[] {
  const text = String(question ?? "").normalize("NFKC");
  const labels = new Set<string>();
  const patterns = [
    /(?<![\p{L}\p{N}])[TТ]\s*(?:is|[0-4xхoо])\s*[abаАвВ]?(?![\p{L}\p{N}])/giu,
    /(?<![\p{L}\p{N}])[NН]\s*(?:[0-3xхoо])\s*[abаАвВ]?(?![\p{L}\p{N}])/giu,
    /(?<![\p{L}\p{N}])[MМ]\s*(?:[0-1xхoо])\s*[abаАвВ]?(?![\p{L}\p{N}])/giu,
    /(?<![\p{L}\p{N}])(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\s*[abаАвВ]?(?![\p{L}\p{N}])/giu,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const label = canonicalShortLabel(match[0]);
      if (label.length >= 2 && label.length <= 5) labels.add(label);
    }
  }
  return [...labels];
}

/**
 * Выполняет внутренний этап `lineShortLabels`, подготавливающий строки короткой формы меток для основного scorer-а.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function lineShortLabels(text: string): string[] {
  const raw = String(text ?? "").normalize("NFKC");
  const labels = new Set<string>(questionShortLabels(raw));
  const compact = canonicalShortLabel(raw);
  if (/^[tnm](?:is|[0-4x])(?:[ab])?$/.test(compact)) labels.add(compact);
  if (/^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)(?:[ab])?$/.test(compact)) labels.add(compact);
  return [...labels];
}

/**
 * Выполняет внутренний этап `visualRowText`, подготавливающий визуальной таблицы строки текста для основного scorer-а.
 *
 * @param lines Физические строки извлечённой страницы PDF.
 * @param index Позиция текущего элемента или совпадения.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function visualRowText(lines: PdfTextLine[], index: number): string {
  const start = Math.max(0, index - 2);
  const end = Math.min(lines.length, index + 4);
  return lines
    .slice(start, end)
    .map((line) => line.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const VISUAL_TABLE_COLUMN_GENERIC_FOCUS = new Set(
  uniqueTokens(
    [
      "признаки критерии относятся следующие показатель показатели таблица согласно классификация",
      "значение значения характерны является являются включает включают",
    ].join(" "),
  ),
);

const VISUAL_TABLE_METRIC_STOP = new Set(uniqueTokens("мм мг мл г л ч мин сутки день дней раз более менее выше ниже или норма"));
const VISUAL_TABLE_COLUMN_CUE_TOKENS = new Set(
  uniqueTokens("легкая легкой средняя средней среднетяжелая среднетяжелой тяжелая тяжелой степень степени стадия стадии класс класса категория категории группа тип форма"),
);

/**
 * Проверяет, требует ли вопрос чтения именованной колонки визуальной таблицы.
 *
 * @param question Исходный текст вопроса.
 * @param focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 */
export function hasVisualTableColumnCue(question: string, focusTokens: string[]): boolean {
  const tokens = [...new Set([...(focusTokens ?? []), ...uniqueTokens(question)])];
  return tokens.some((token) => VISUAL_TABLE_COLUMN_CUE_TOKENS.has(token));
}

/**
 * Выделяет специфичные токены вопроса для выбора колонки визуальной таблицы.
 *
 * @param focusTokens Специфичные токены вопроса без общих служебных слов.
 * @param question Исходный текст вопроса.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function visualTableColumnFocusTokens(focusTokens: string[], question: string): string[] {
  const out: string[] = [];
  for (const token of [...(focusTokens ?? []), ...uniqueTokens(question)]) {
    if (!token || token.length < 4) continue;
    if (FOCUS_STOPWORDS.has(token) || VISUAL_TABLE_COLUMN_GENERIC_FOCUS.has(token)) continue;
    if (!out.includes(token)) out.push(token);
  }
  return out.slice(0, 10);
}

/**
 * Выполняет внутренний этап `lineXSpread`, подготавливающий строки `xspread` для основного scorer-а.
 *
 * @param line Значение `line`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function lineXSpread(line: PdfTextLine): number {
  const xs = (line?.items ?? []).map((item) => item.x ?? 0);
  if (xs.length < 2) return 0;
  return Math.max(...xs) - Math.min(...xs);
}

/**
 * Находит целевые колонки визуальной таблицы по заголовкам и фокусу вопроса.
 *
 * @param page Текущая страница PDF или её номер.
 * @param question Исходный текст вопроса.
 * @param focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function visualTableColumnTargets(page: PdfPage, question: string, focusTokens: string[]): VisualTableColumnTarget[] {
  const focus = visualTableColumnFocusTokens(focusTokens, question);
  if (!focus.length) return [];
  const targets: VisualTableColumnTarget[] = [];
  const lines = page?.lineItems ?? [];
  for (const line of lines) {
    if ((line.items?.length ?? 0) < 3 || lineXSpread(line) < 140) continue;
    if (String(line.text ?? "").length > 220) continue;
    const lineNorm = normalizeForSearch(line.text);
    if (containsNormalizedPhrase(lineNorm, "рекоменду") || /pekom/iu.test(lineNorm)) continue;
    for (const item of line.items ?? []) {
      if (String(item.text ?? "").length > 90) continue;
      const itemTokens = uniqueTokens(item.text);
      const hits = tokenHitCount(focus, itemTokens);
      const required = focus.length >= 2 ? 2 : 1;
      if (hits < required) continue;
      targets.push({
        x: item.x ?? 0,
        text: line.text,
        page: page.page,
      });
    }
  }
  return targets;
}

/**
 * Возвращает целевые колонки визуальной таблицы на указанной или соседней странице.
 *
 * @param pages Извлечённые страницы PDF, доступные scorer-у.
 * @param page Текущая страница PDF или её номер.
 * @param question Исходный текст вопроса.
 * @param focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function visualTableTargetsNearPage(
  pages: PdfPage[],
  page: PdfPage,
  question: string,
  focusTokens: string[],
): VisualTableColumnTarget[] {
  const out: VisualTableColumnTarget[] = [];
  for (const candidate of pages) {
    if (candidate.page !== page.page && candidate.page !== page.page - 1) continue;
    out.push(...visualTableColumnTargets(candidate, question, focusTokens));
  }
  return out;
}

/**
 * Строит по координатам PDF целевые ячейки колонки для каждой страницы.
 *
 * @param pages Извлечённые страницы PDF, доступные scorer-у.
 * @param question Исходный текст вопроса.
 * @param focusTokens Специфичные токены вопроса без общих служебных слов.
 * @param topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 */
export function buildVisualTableColumnTargetsByPage(
  pages: PdfPage[],
  question: string,
  focusTokens: string[],
  topQuestionPages: Set<number>,
): VisualTableColumnTargetsByPage {
  const byPage: VisualTableColumnTargetsByPage = new Map();
  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    const targets = visualTableTargetsNearPage(pages, page, question, focusTokens);
    if (targets.length) byPage.set(page.page, targets);
  }
  return byPage;
}

/**
 * Выделяет специфичные токены для варианта ответа метрики.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function answerMetricTokens(answerText: string): string[] {
  return uniqueTokens(answerText).filter((token) => {
    if (!token || token.length < 3) return false;
    if (/^\d/u.test(token)) return false;
    if (VISUAL_TABLE_METRIC_STOP.has(token) || FOCUS_STOPWORDS.has(token)) return false;
    return true;
  });
}

/**
 * Выполняет внутренний этап `comparatorSigns`, подготавливающий компаратора `signs` для основного scorer-а.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function comparatorSigns(text: string): Set<string> {
  const signs = new Set<string>();
  const raw = String(text ?? "");
  if (/[<≤]/u.test(raw)) signs.add("<");
  if (/[>≥]/u.test(raw)) signs.add(">");
  return signs;
}

/**
 * Выполняет внутренний этап `visualValueMatchesAnswer`, подготавливающий визуальной таблицы значения варианта ответа для основного scorer-а.
 *
 * @param itemText Исходный текст соответствующего объекта.
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function visualValueMatchesAnswer(itemText: string, answerText: string): boolean {
  const numericCoverage = numberCoverage(answerText, normalizeForSearch(itemText));
  if (numericCoverage <= 0) return false;
  const expandedAnswerNumbers = [...new Set(extractNumbers(answerText).flatMap(expandNumberToken))];
  if (expandedAnswerNumbers.length > 1 && numericCoverage < 0.99) return false;
  const answerSigns = comparatorSigns(answerText);
  if (!answerSigns.size) return true;
  const itemSigns = comparatorSigns(itemText);
  return [...answerSigns].some((sign) => itemSigns.has(sign));
}

/**
 * Выполняет внутренний этап `targetCellText`, подготавливающий целевого объекта ячейки текста для основного scorer-а.
 *
 * @param line Значение `line`, необходимое этому этапу scorer-а.
 * @param targetX Значение `targetX`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function targetCellText(line: PdfTextLine, targetX: number): string {
  return (line.items ?? [])
    .filter((item) => Math.abs((item.x ?? 0) - targetX) <= 52)
    .map((item) => item.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Выполняет внутренний этап `nearbyMetricText`, подготавливающий соседнего контекста метрики текста для основного scorer-а.
 *
 * @param lines Физические строки извлечённой страницы PDF.
 * @param index Позиция текущего элемента или совпадения.
 * @param targetX Значение `targetX`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function nearbyMetricText(lines: PdfTextLine[], index: number, targetX: number): string {
  const baseY = lines[index]?.y ?? 0;
  const parts: string[] = [];
  for (let offset = -2; offset <= 2; offset += 1) {
    const line = lines[index + offset];
    if (!line) continue;
    if (Math.abs((line.y ?? baseY) - baseY) > 28) continue;
    for (const item of line.items ?? []) {
      if ((item.x ?? 0) < targetX - 45) parts.push(item.text);
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Сопоставляет ответ с ячейкой заранее выбранной визуальной колонки.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.focusTokens Специфичные токены вопроса без общих служебных слов.
 * @param context.visualTableColumnTargetsByPage Подготовленные структуры, сгруппированные по номеру страницы.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestVisualTableColumnSupport(
  {mode, pages, topQuestionPages, question, answer, visualTableColumnTargetsByPage}: AnswerScoringContext,
): EvidenceItem | null {
  if (mode !== "multi" || !extractNumbers(answer.text).length) return null;
  if (!visualTableColumnTargetsByPage) return null;
  const metricTokens = answerMetricTokens(answer.text);
  if (!metricTokens.length) return null;
  let best = null;

  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    const targets = (visualTableColumnTargetsByPage as VisualTableColumnTargetsByPage).get(page.page) ?? [];
    if (!targets.length) continue;
    const lines = page.lineItems ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      for (const target of targets) {
        for (const item of line.items ?? []) {
          const xDistance = Math.abs((item.x ?? 0) - target.x);
          if (xDistance > 48) continue;
          const cellText = targetCellText(line, target.x) || item.text;
          if (!visualValueMatchesAnswer(cellText, answer.text)) continue;
          const metricText = nearbyMetricText(lines, index, target.x);
          const metricDocTokens = uniqueTokens(metricText);
          const metricHits = tokenHitCount(metricTokens, metricDocTokens);
          const metricCoverage = coverage(metricTokens, metricDocTokens);
          if (metricHits < 1 && metricCoverage < 0.34) continue;
          const score =
            15.2 +
            proximityBonus(xDistance, 48) * 3.0 +
            Math.min(3, metricHits) * 1.8 +
            Math.min(0.8, metricCoverage) * 4.2 +
            numberCoverage(answer.text, normalizeForSearch(cellText)) * 2.2;
          best = betterEvidence(best, {
            answerId: answer.id,
            page: page.page,
            text: `${target.text} ${metricText} ${cellText}`.replace(/\s+/g, " ").trim(),
            score,
            kind: "visual_table_column",
          });
        }
      }
    }
  }

  return best;
}

/**
 * Выполняет внутренний этап `lineStartX`, подготавливающий строки `start` `x` для основного scorer-а.
 *
 * @param line Значение `line`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function lineStartX(line: PdfTextLine): number {
  return line?.items?.[0]?.x ?? 0;
}

/**
 * Выполняет внутренний этап `linePrefixShortLabels`, подготавливающий строки префикса короткой формы меток для основного scorer-а.
 *
 * @param line Значение `line`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function linePrefixShortLabels(line: PdfTextLine): string[] {
  const prefix = (line?.items ?? [])
    .slice(0, 3)
    .map((item) => item.text)
    .join(" ");
  return lineShortLabels(prefix || String(line?.text ?? "").slice(0, 24));
}

/**
 * Выполняет внутренний этап `lineStartsWithShortLabelStem`, подготавливающий строки `with` короткой формы метки основы слова для основного scorer-а.
 *
 * @param line Значение `line`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function lineStartsWithShortLabelStem(line: PdfTextLine): boolean {
  const first = canonicalShortLabel(line?.items?.[0]?.text ?? "");
  return /^[tnm]$/.test(first) || /^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)$/.test(first);
}

/**
 * Выполняет внутренний этап `splitShortLabelSuffix`, подготавливающий `split` короткой формы метки суффикса для основного scorer-а.
 *
 * @param line Значение `line`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function splitShortLabelSuffix(line: PdfTextLine): string | null {
  const compact = canonicalShortLabel(line?.items?.[0]?.text ?? line?.text ?? "");
  if (/^(?:is|[0-4x]|[0-4][ab]?)$/.test(compact)) return compact;
  if (/^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)[ab]?$/.test(compact)) return compact;
  return null;
}

/**
 * Выполняет внутренний этап `lineExactShortLabels`, подготавливающий строки точного совпадения короткой формы меток для основного scorer-а.
 *
 * @param lines Физические строки извлечённой страницы PDF.
 * @param index Позиция текущего элемента или совпадения.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function lineExactShortLabels(lines: PdfTextLine[], index: number): string[] {
  const labels = new Set(linePrefixShortLabels(lines[index]));
  if (lineStartsWithShortLabelStem(lines[index]) && index + 1 < lines.length) {
    const suffix = splitShortLabelSuffix(lines[index + 1]);
    if (suffix && Math.abs(lineStartX(lines[index + 1]) - lineStartX(lines[index])) <= 18) {
      const stem = lines[index]?.items?.[0]?.text ?? "";
      for (const label of lineShortLabels(`${stem} ${suffix}`)) labels.add(label);
    }
  }
  return [...labels];
}

/**
 * Выполняет внутренний этап `visualExactLabelRowText`, подготавливающий визуальной таблицы точного совпадения метки строки текста для основного scorer-а.
 *
 * @param lines Физические строки извлечённой страницы PDF.
 * @param index Позиция текущего элемента или совпадения.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function visualExactLabelRowText(lines: PdfTextLine[], index: number): string {
  const row: string[] = [];
  const first = lines[index];
  if (!first?.text) return "";
  const startX = lineStartX(first);
  let previousY = first.y ?? 0;

  for (let current = index; current < lines.length && row.length < 8; current += 1) {
    const line = lines[current];
    const text = String(line?.text ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;

    if (current > index) {
      const gap = Math.abs((line?.y ?? previousY) - previousY);
      if (gap > 32) break;
      const startsNewLabel =
        (linePrefixShortLabels(line).length > 0 || lineStartsWithShortLabelStem(line)) && Math.abs(lineStartX(line) - startX) <= 18;
      if (startsNewLabel) break;
      if (lineStartX(line) < startX + 18 && row.length > 1) break;
    }

    previousY = line?.y ?? previousY;
    if (/^\d{1,2}$/.test(text) && lineStartX(line) > startX + 120) continue;
    row.push(text);
  }

  return row.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Ищет точное совпадение короткой метки в ограниченной визуальной строке.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @param context.focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestExactShortLabelRowSupport(
  {pages, topQuestionPages, question, answer, answerTokens, focusTokens}: AnswerScoringContext,
): EvidenceItem | null {
  const labels = questionShortLabels(question);
  if (!labels.length || !answerTokens.length) return null;
  const answerPhrases = answerSearchPhrases(answer.text);
  const usefulFocusTokens = (focusTokens?.length ? focusTokens : uniqueTokens(question)).filter((token) => token.length > 2);
  const numericAnswer = extractNumbers(answer.text).length > 0;
  const minSupport = numericAnswer ? 0.48 : answerTokens.length <= 2 ? 0.84 : 0.4;
  let best = null;

  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    const lines = page.lineItems ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      const localLabels = lineExactShortLabels(lines, index);
      if (!labels.some((label) => localLabels.includes(label))) continue;

      const text = visualExactLabelRowText(lines, index);
      const normalized = normalizeForSearch(text);
      const tokens = tokenizeNormalized(normalized);
      const answerCoverage = strictSoftCoverage(answerTokens, tokens);
      const numericCoverage = numberCoverage(answer.text, normalized);
      const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(normalized, phrase));
      const answerSupport = Math.max(answerCoverage, numericCoverage, phraseHit ? 1 : 0);
      if (answerSupport < minSupport) continue;

      const focusCoverage = usefulFocusTokens.length ? coverage(usefulFocusTokens, tokens) : 0;
      const score =
        15.8 +
        answerSupport * 8.6 +
        Math.min(0.42, focusCoverage) * 3.1 +
        numericCoverage * 1.6 +
        (phraseHit ? 1.8 : 0);
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text,
        score,
        kind: "short_label_exact_row",
      });
    }
  }

  return best;
}

/**
 * Ищет мягкое совпадение короткой метки в строке с табличным контекстом.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param context.answerTokens Нормализованные токены проверяемого варианта.
 * @param context.focusTokens Специфичные токены вопроса без общих служебных слов.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestShortLabelRowSupport(
  {pages, topQuestionPages, question, answer, answerTokens, focusTokens}: AnswerScoringContext,
): EvidenceItem | null {
  const labels = questionShortLabels(question);
  if (!labels.length || !answerTokens.length) return null;
  const answerPhrases = answerSearchPhrases(answer.text);
  const usefulFocusTokens = (focusTokens?.length ? focusTokens : uniqueTokens(question)).filter((token) => token.length > 2);
  const numericAnswer = extractNumbers(answer.text).length > 0;
  const minSupport = numericAnswer ? 0.55 : answerTokens.length <= 2 ? 0.86 : 0.34;
  let best = null;

  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    const lines = page.lineItems ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      const localLabels = new Set<string>(lineShortLabels(lines[index]?.text));
      if (index + 1 < lines.length) {
        for (const label of lineShortLabels(`${lines[index].text} ${lines[index + 1].text}`)) localLabels.add(label);
      }
      if (!labels.some((label) => localLabels.has(label))) continue;

      const text = visualRowText(lines, index);
      const normalized = normalizeForSearch(text);
      const tokens = tokenizeNormalized(normalized);
      const answerCoverage = strictSoftCoverage(answerTokens, tokens);
      const numericCoverage = numberCoverage(answer.text, normalized);
      const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(normalized, phrase));
      const answerSupport = Math.max(answerCoverage, numericCoverage, phraseHit ? 1 : 0);
      if (answerSupport < minSupport) continue;

      const focusCoverage = usefulFocusTokens.length ? coverage(usefulFocusTokens, tokens) : 0;
      const score =
        10.4 +
        answerSupport * 7.2 +
        Math.min(0.35, focusCoverage) * 3.0 +
        numericCoverage * 1.2 +
        (phraseHit ? 1.2 : 0);
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text,
        score,
        kind: "short_label_visual_row",
      });
    }
  }

  return best;
}
