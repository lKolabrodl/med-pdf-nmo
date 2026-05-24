import { extractNumbers, normalizeForSearch, uniqueTokens } from "../../normalize.js";
import { FOCUS_STOPWORDS } from "../constants.js";
import { betterEvidence, containsNormalizedPhrase, expandNumberToken, rawTokens, softCoverage, tokenizeNormalized } from "../text-utils.js";

const DOSE_DRUG_GENERIC = new Set(
  [
    "\u0441\u0443\u0442\u043e\u0447\u043d\u0430\u044f",
    "\u0434\u043e\u0437\u0430",
    "\u0434\u043e\u0437\u044b",
    "\u0434\u043e\u0437\u0435",
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

function doseTokenStartsWithAny(token, cues) {
  const normalized = normalizeForSearch(token);
  return cues.some((cue) => normalized.startsWith(cue));
}

function doseContentTokens(text) {
  return uniqueTokens(text).filter((token) => token.length >= 5 && !DOSE_DRUG_GENERIC.has(token) && !FOCUS_STOPWORDS.has(token) && !/^\d/u.test(token));
}

function questionDoseDrugTokens(question) {
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

function drugTokenIndex(normalized, drugTokens) {
  let best = -1;
  for (const token of drugTokens) {
    const prefix = token.slice(0, Math.min(token.length, 9));
    const index = normalized.indexOf(prefix);
    if (index >= 0) best = best < 0 ? index : Math.min(best, index);
  }
  return best;
}

function doseSlashNumbers(sourceText, drugTokens) {
  const out = [];
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

function doseNearDrugNumbers(sourceText, drugTokens) {
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

function normalizeDoseNumber(value) {
  return String(value ?? "").replace(",", ".").replace(/\.0$/u, "");
}

function answerDoseFact(answerText) {
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

function sourceDoseFacts(sourceText, drugTokens) {
  const normalized = normalizeForSearch(sourceText);
  const drugIndex = drugTokenIndex(normalized, drugTokens);
  if (drugIndex < 0) return [];
  const local = normalized.slice(drugIndex, Math.min(normalized.length, drugIndex + 125));
  const facts = [];
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
  for (const number of [...doseSlashNumbers(sourceText, drugTokens), ...doseNearDrugNumbers(sourceText, drugTokens)]) {
    facts.push({ dose: normalizeDoseNumber(number), doseRange: null, frequency: null });
  }
  return facts;
}

function doseFactMatchesAnswer(fact, answerFact, answerNumbers, hasFrequencyFacts = false) {
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

export function bestDrugDoseSupport({ mode, pages, question, answer }) {
  if (mode !== "single") return null;
  const drugTokens = questionDoseDrugTokens(question);
  if (!drugTokens.length) return null;
  const answerNumbers = new Set(extractNumbers(answer.text).flatMap(expandNumberToken).map((number) => String(number).replace(",", ".")));
  if (!answerNumbers.size || !containsNormalizedPhrase(normalizeForSearch(answer.text), "\u043c\u0433")) return null;
  const answerFact = answerDoseFact(answer.text);
  let best = null;

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
