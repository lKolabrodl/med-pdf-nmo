import {extractNumbers, normalizeForSearch, uniqueTokens} from "../../../normalize.js";
import {FOCUS_STOPWORDS} from "../../constants.js";
import type {AnswerScoringContext} from "../../contracts.js";
import {betterEvidence, containsNormalizedPhrase, expandNumberToken, rawTokens, softCoverage, tokenizeNormalized} from "../../text-utils.js";
import type {EvidenceItem} from "../../types.js";

type DoseFact = {
  dose: string | null;
  doseRange: [string, string] | null;
  frequency: string | null;
};

type SourceDoseFact = Omit<DoseFact, "dose"> & {
  dose: string;
};

const DOSE_DRUG_GENERIC = new Set(
  [
    "\u0441\u0443\u0442\u043e\u0447\u043d\u0430\u044f",
    "\u0434\u043e\u0437\u0430",
    "\u0434\u043e\u0437\u044b",
    "\u0434\u043e\u0437\u0435",
    "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u043c\u0430\u044f",
    "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u043c\u044b\u0439",
    "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u0442\u0441\u044f",
    "\u043d\u0430\u0437\u043d\u0430\u0447\u0430\u0435\u0442\u0441\u044f",
    "\u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435",
    "\u043f\u0440\u0438",
    "\u043b\u0435\u0447\u0435\u043d\u0438\u0438",
    "\u043b\u0435\u0447\u0435\u043d\u0438\u044f",
    "\u043b\u0435\u0447\u0435\u043d\u0438\u0435",
    "\u043b\u043e\u043a\u0430\u043b\u0438\u0437\u043e\u0432\u0430\u043d\u043d\u044b\u0445",
    "\u043b\u043e\u043a\u0430\u043b\u0438\u0437\u043e\u0432\u0430\u043d\u043d\u044b\u0435",
    "\u0444\u043e\u0440\u043c",
    "\u0444\u043e\u0440\u043c\u044b",
    "\u0438\u043d\u0444\u0435\u043a\u0446\u0438\u0438",
    "\u0438\u043d\u0444\u0435\u043a\u0446\u0438\u044f",
    "\u043c\u0435\u043d\u0438\u043d\u0433\u043e\u043a\u043e\u043a\u043a\u043e\u0432\u043e\u0439",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442\u0430\u043c",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442\u043e\u0432",
    "\u043e\u043f\u044b\u0442\u043e\u043c",
    "\u043f\u0440\u0435\u0434\u0448\u0435\u0441\u0442\u0432\u0443\u044e\u0449\u0435\u0439",
    "\u0442\u0435\u0440\u0430\u043f\u0438\u0438",
    "\u0434\u0430\u043d\u043d\u044b\u043c",
    "\u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442\u043e\u043c",
    "\u0441\u043e\u0441\u0442\u0430\u0432\u043b\u044f\u0435\u0442",
    "\u0441\u0443\u0442\u043a\u0438",
    "\u0441\u0443\u0442",
  ].flatMap((item) => uniqueTokens(item)),
);

const DOSE_ASSIGNMENT_CUES = [
  "\u043d\u0430\u0437\u043d\u0430\u0447",
  "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434",
  "\u043f\u0440\u0438\u043c\u0435\u043d",
  "\u043f\u043e\u043b\u0443\u0447",
  "\u0432\u0432\u043e\u0434",
  "\u0441\u043e\u0441\u0442\u0430\u0432\u043b",
].map((item) => normalizeForSearch(item));

/**
 * Выполняет внутренний этап `doseTokenStartsWithAny`, подготавливающий дозы токена `with` `any` для основного scorer-а.
 *
 * @param token Отдельный нормализуемый или сравниваемый токен.
 * @param cues Значение `cues`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function doseTokenStartsWithAny(token: string, cues: string[]): boolean {
  const normalized = normalizeForSearch(token);
  return cues.some((cue) => normalized.startsWith(cue));
}

/**
 * Выделяет специфичные токены для дозы `content`.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function doseContentTokens(text: string): string[] {
  return uniqueTokens(text).filter((token) => token.length >= 5 && !DOSE_DRUG_GENERIC.has(token) && !FOCUS_STOPWORDS.has(token) && !/^\d/u.test(token));
}

/**
 * Выделяет специфичные токены для вопроса дозы препарата.
 *
 * @param question Исходный текст вопроса.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function questionDoseDrugTokens(question: string): string[] {
  const normalized = normalizeForSearch(question);
  if (!containsNormalizedPhrase(normalized, "\u0434\u043e\u0437")) return [];
  const raw = rawTokens(question);
  const doseIndex = raw.findIndex((token) => doseTokenStartsWithAny(token, [normalizeForSearch("\u0434\u043e\u0437")]));
  const assignIndex = raw.findIndex((token, index) => index < (doseIndex < 0 ? raw.length : doseIndex) && doseTokenStartsWithAny(token, DOSE_ASSIGNMENT_CUES));
  if (assignIndex > 0) {
    const beforeAssign = raw.slice(Math.max(0, assignIndex - 9), assignIndex).join(" ");
    const local = doseContentTokens(beforeAssign).slice(-3);
    if (local.length) return local;
  }
  const tokens = doseContentTokens(question);
  return tokens.slice(0, 3);
}

/**
 * Находит позицию препарата токена в локальном тексте или структуре.
 *
 * @param normalized Текст, заранее приведённый к поисковой нормальной форме.
 * @param drugTokens Нормализованные токены соответствующего текста.
 * @returns Вычисленное числовое значение или специальное граничное значение при отсутствии совпадения.
 * @internal
 */
function drugTokenIndex(normalized: string, drugTokens: string[]): number {
  let best = -1;
  for (const token of drugTokens) {
    const prefix = token.slice(0, Math.min(token.length, 9));
    const index = normalized.indexOf(prefix);
    if (index >= 0) best = best < 0 ? index : Math.min(best, index);
  }
  return best;
}

/**
 * Выполняет внутренний этап `doseSlashNumbers`, подготавливающий дозы `slash` чисел для основного scorer-а.
 *
 * @param sourceText Исходный текст PDF или ограниченного сегмента.
 * @param drugTokens Нормализованные токены соответствующего текста.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function doseSlashNumbers(sourceText: string, drugTokens: string[]): string[] {
  const out: string[] = [];
  const slashPattern = /(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*[\u006d\u043c]\u0433/giu;
  for (const match of sourceText.matchAll(slashPattern)) {
    const rawIndex = match.index ?? 0;
    const beforeText = sourceText.slice(Math.max(0, rawIndex - 150), rawIndex);
    const before = normalizeForSearch(beforeText);
    if (softCoverage(drugTokens, tokenizeNormalized(before)) < 0.8) continue;
    const drugIndex = drugTokenIndex(before, drugTokens);
    if (drugIndex < 0) continue;
    const plusAfter = before.indexOf("+", drugIndex);
    const plusBefore = before.lastIndexOf("+", drugIndex);
    const first = String(match[1]).replace(",", ".");
    const second = String(match[2]).replace(",", ".");
    if (plusAfter >= 0 && plusAfter <= before.length - 1) {
      out.push(first);
    } else if (plusBefore >= 0) {
      out.push(second);
    } else {
      out.push(first, second);
    }
    break;
  }
  return out;
}

/**
 * Выполняет внутренний этап `doseNearDrugNumbers`, подготавливающий дозы `near` препарата чисел для основного scorer-а.
 *
 * @param sourceText Исходный текст PDF или ограниченного сегмента.
 * @param drugTokens Нормализованные токены соответствующего текста.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function doseNearDrugNumbers(sourceText: string, drugTokens: string[]): string[] {
  const normalized = normalizeForSearch(sourceText);
  const drugIndex = drugTokenIndex(normalized, drugTokens);
  if (drugIndex < 0) return [];
  const local = normalized.slice(drugIndex, Math.min(normalized.length, drugIndex + 95));
  if (!containsNormalizedPhrase(local, "\u043c\u0433")) return [];
  if (/\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?\s*[\u006d\u043c][\u0433g]/iu.test(local)) return [];
  const firstNumber = local.match(/\d+(?:[.,]\d+)?/u);
  if (!firstNumber || (firstNumber.index ?? 0) > 55) return [];
  if (local.slice(0, firstNumber.index ?? 0).includes("+")) return [];
  const beforeNumberTokens = tokenizeNormalized(local.slice(0, firstNumber.index ?? 0));
  const genericBeforeDose = new Set(["taб", "taбл", "paз", "p", "д", "mг"]);
  const hasOtherDrugMarker = beforeNumberTokens.some((token) => {
    if (genericBeforeDose.has(token) || /^\d/.test(token)) return false;
    if (drugTokens.some((drugToken) => drugToken.startsWith(token) || token.startsWith(drugToken.slice(0, Math.min(8, drugToken.length))))) return false;
    return token.length >= 3;
  });
  if (hasOtherDrugMarker) return [];
  return extractNumbers(local).slice(0, 2).map((number) => String(number).replace(",", "."));
}

/**
 * Выполняет внутренний этап `doseAssignedToDrugNumbers`, подготавливающий дозы `assigned` `to` препарата чисел для основного scorer-а.
 *
 * @param sourceText Исходный текст PDF или ограниченного сегмента.
 * @param drugTokens Нормализованные токены соответствующего текста.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function doseAssignedToDrugNumbers(sourceText: string, drugTokens: string[]): string[] {
  const normalized = normalizeForSearch(sourceText);
  const out: string[] = [];
  const dosePattern = /(\d+(?:[.,]\d+)?)\s*[\u006d\u043c]\u0433/giu;
  for (const match of normalized.matchAll(dosePattern)) {
    const index = match.index ?? 0;
    if (normalized.slice(Math.max(0, index - 2), index).includes("/")) continue;
    const afterWindow = normalized.slice(index + match[0].length, Math.min(normalized.length, index + match[0].length + 70));
    const boundary = afterWindow.search(/[+.]|(?:^|\s)o\s|\s\d+(?:[.,]\d+)?\s*[\u0440p]\s*\/?\s*\u0434/u);
    const after = boundary >= 0 ? afterWindow.slice(0, boundary) : afterWindow;
    if (softCoverage(drugTokens, tokenizeNormalized(after)) < 0.8) continue;
    out.push(normalizeDoseNumber(match[1]));
  }
  return out;
}

/**
 * Приводит дозы числа к канонической форме для последующего сравнения.
 *
 * @param value Входное значение, которое требуется нормализовать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function normalizeDoseNumber(value: string | number | null | undefined): string {
  return String(value ?? "").replace(",", ".").replace(/\.0$/u, "");
}

/**
 * Извлекает или проверяет варианта ответа дозы `fact` в варианте ответа.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function answerDoseFact(answerText: string): DoseFact {
  const normalized = normalizeForSearch(answerText);
  const doseRangeMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*[\u006d\u043c]\u0433/iu);
  const doseMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*[\u006d\u043c]\u0433/iu);
  const frequencyMatch = normalized.match(/(?:[\u0078\u0445]\s*|(?:\u0440\u0430\u0437|\u0440)\s*)(\d+(?:[.,]\d+)?)(?:\s*[\u0070\u0440]\s*\/\s*\u0434|\s*\u0440|\s*\u0440\u0430\u0437)?/iu);
  return {
    doseRange: doseRangeMatch?.[1] && doseRangeMatch?.[2] ? [normalizeDoseNumber(doseRangeMatch[1]), normalizeDoseNumber(doseRangeMatch[2])] : null,
    dose: doseMatch?.[1] ? normalizeDoseNumber(doseMatch[1]) : null,
    frequency: frequencyMatch?.[1] ? normalizeDoseNumber(frequencyMatch[1]) : null,
  };
}

/**
 * Извлекает из исходного PDF-фрагмента исходного фрагмента дозы `facts`.
 *
 * @param sourceText Исходный текст PDF или ограниченного сегмента.
 * @param drugTokens Нормализованные токены соответствующего текста.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function sourceDoseFacts(sourceText: string, drugTokens: string[]): SourceDoseFact[] {
  const normalized = normalizeForSearch(sourceText);
  const drugIndex = drugTokenIndex(normalized, drugTokens);
  if (drugIndex < 0) return [];
  const assignedNumbers = doseAssignedToDrugNumbers(sourceText, drugTokens);
  if (assignedNumbers.length) {
    return assignedNumbers.map((number) => ({ dose: number, doseRange: null, frequency: null }));
  }
  const local = normalized.slice(drugIndex, Math.min(normalized.length, drugIndex + 125));
  const facts: SourceDoseFact[] = [];
  const slashNumbers = doseSlashNumbers(sourceText, drugTokens);
  if (slashNumbers.length) {
    return slashNumbers.map((number) => ({ dose: normalizeDoseNumber(number), doseRange: null, frequency: null }));
  }
  const dosePattern = /(\d+(?:[.,]\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?\s*[\u006d\u043c]\u0433(?:\s*[\u0078\u0445]\s*(\d+(?:[.,]\d+)?))?/giu;
  for (const match of local.matchAll(dosePattern)) {
    const index = match.index ?? 0;
    if (index > 80) continue;
    const beforeNumber = local.slice(0, index).replace(/\s+$/u, "");
    if (beforeNumber.endsWith("/")) continue;
    facts.push({
      dose: normalizeDoseNumber(match[2] ?? match[1]),
      doseRange: match[2] ? [normalizeDoseNumber(match[1]), normalizeDoseNumber(match[2])] : null,
      frequency: match[3] ? normalizeDoseNumber(match[3]) : null,
    });
    break;
  }
  for (const number of doseNearDrugNumbers(sourceText, drugTokens)) {
    facts.push({ dose: normalizeDoseNumber(number), doseRange: null, frequency: null });
  }
  return facts;
}

/**
 * Выполняет внутренний этап `doseFactMatchesAnswer`, подготавливающий дозы `fact` варианта ответа для основного scorer-а.
 *
 * @param fact Значение `fact`, необходимое этому этапу scorer-а.
 * @param answerFact Значение `answerFact`, необходимое этому этапу scorer-а.
 * @param answerNumbers Значение `answerNumbers`, необходимое этому этапу scorer-а.
 * @param hasFrequencyFacts Значение `hasFrequencyFacts`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function doseFactMatchesAnswer(
  fact: SourceDoseFact,
  answerFact: DoseFact,
  answerNumbers: Set<string>,
  hasFrequencyFacts: boolean = false,
): boolean {
  if (answerFact.doseRange) {
    if (!fact.doseRange) return false;
    if (fact.doseRange[0] !== answerFact.doseRange[0] || fact.doseRange[1] !== answerFact.doseRange[1]) return false;
  }
  if (answerFact.dose && fact.dose !== answerFact.dose) return false;
  if (!answerFact.dose && !answerNumbers.has(fact.dose)) return false;
  if (answerFact.frequency && hasFrequencyFacts && !fact.frequency) return false;
  if (answerFact.frequency && fact.frequency && fact.frequency !== answerFact.frequency) return false;
  return true;
}

/**
 * Ищет совместное упоминание препарата, дозы, единицы и кратности назначения.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.question Исходный текст вопроса.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 */
export function bestDrugDoseSupport(
  {mode, pages, question, answer}: AnswerScoringContext,
): EvidenceItem | null {
  if (mode !== "single") return null;
  const drugTokens = questionDoseDrugTokens(question);
  if (!drugTokens.length) return null;
  const answerNumbers = new Set(extractNumbers(answer.text).flatMap(expandNumberToken).map((number) => String(number).replace(",", ".")));
  if (!answerNumbers.size || !containsNormalizedPhrase(normalizeForSearch(answer.text), "\u043c\u0433")) return null;
  const answerFact = answerDoseFact(answer.text);
  let best: EvidenceItem | null = null;

  for (const page of pages) {
    const lines = page.lines ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      const text = lines.slice(index, Math.min(lines.length, index + 3)).join(" ");
      const normalized = normalizeForSearch(text);
      const sourceTokens = tokenizeNormalized(normalized);
      if (softCoverage(drugTokens, sourceTokens) < 0.8) continue;
      const facts = sourceDoseFacts(text, drugTokens);
      if (!facts.length) continue;
      const hasFrequencyFacts = facts.some((fact) => fact.frequency);
      const hit = facts.some((fact) => doseFactMatchesAnswer(fact, answerFact, answerNumbers, hasFrequencyFacts));
      if (!hit) continue;
      const score = 16.2 + Math.min(2, facts.length) * 0.7 + (answerFact.frequency && facts.some((fact) => fact.frequency === answerFact.frequency) ? 2.1 : 0);
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text,
        score,
        kind: "drug_dose_segment",
      });
    }
  }

  return best;
}
