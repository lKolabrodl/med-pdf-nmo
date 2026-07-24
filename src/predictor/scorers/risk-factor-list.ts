import { normalizeForSearch, uniqueTokens } from "../../normalize.js";
import { FOCUS_STOPWORDS } from "../constants.js";
import { answerSearchPhrases, containsNormalizedPhrase, strictSoftCoverage, tokenizeNormalized } from "../text-utils.js";

type AnswerOption = { id: string; text: string };

export type RiskFactorListResolution = Map<
  string,
  {
    adjustment: number;
    evidence: { answerId: string; page: number; text: string; score: number; kind: string };
  }
>;

type RiskListItem = { text: string; page: number };

function rawRussianText(text: string) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/ё/gu, "е")
    .replace(/\s+/gu, " ")
    .trim();
}

function riskQuestionTarget(question: string) {
  const clean = rawRussianText(question);
  const match = clean.match(/фактор(?:ами|ов|ы)?\s+риска\s+развития\s+(.+)/u);
  if (!match) return null;
  const target = match[1]
    .replace(/\s+(?:выделяют|являются|считаются|относят|относятся|указывают|служат|включают)(?:\s|$).*$/u, "")
    .replace(/[?.!,;:]+$/gu, "")
    .trim();
  return target.length >= 4 ? target : null;
}

function questionTargetTokens(question: string, abbreviations: any[]) {
  const target = riskQuestionTarget(question);
  if (!target) return [];
  const targetTokens = uniqueTokens(target).filter((token) => token.length >= 3 && !FOCUS_STOPWORDS.has(token));
  const expanded = new Set(targetTokens);
  for (const entry of abbreviations ?? []) {
    const abbreviationTokens = uniqueTokens(entry?.abbr ?? "");
    const expansionTokens = uniqueTokens(entry?.expansion ?? "");
    if (!abbreviationTokens.length || !expansionTokens.length) continue;
    if (strictSoftCoverage(targetTokens, expansionTokens) < 0.62) continue;
    for (const token of abbreviationTokens) expanded.add(token);
  }
  return [...expanded];
}

function riskHeaderTarget(line: string) {
  const clean = rawRussianText(line).replace(/^[•*\-–—]\s*/u, "");
  const patterns = [
    /^факторами\s+риска\s+развития\s+(.+?)\s+(?:являются|считаются|служат)\s*:?\s*$/u,
    /^к\s+факторам\s+риска\s+развития\s+(.+?)\s+(?:относят|относятся)\s*:?\s*$/u,
    /^факторы\s+риска\s+развития\s+(.+?)\s+(?:включают|представлены)\s*:?\s*$/u,
  ];
  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function startsListItem(line: string) {
  return /^\s*[•*\-–—]\s+/u.test(String(line ?? ""));
}

function likelyNewParagraph(line: string, previous: string) {
  const raw = String(line ?? "").trim();
  const previousRaw = String(previous ?? "").trim();
  return /[.;]\s*$/u.test(previousRaw) && /^[А-ЯЁA-Z][а-яёa-z]/u.test(raw);
}

function collectRiskItems(lines: string[], headerIndex: number, page: number) {
  const items: RiskListItem[] = [];
  let current: string[] = [];
  for (let index = headerIndex + 1; index < Math.min(lines.length, headerIndex + 36); index += 1) {
    const line = String(lines[index] ?? "").trim();
    if (!line || /^\d+$/u.test(line)) continue;
    if (riskHeaderTarget(line)) break;
    if (startsListItem(line)) {
      if (current.length) items.push({ text: current.join(" "), page });
      current = [line.replace(/^\s*[•*\-–—]\s+/u, "")];
      continue;
    }
    if (!current.length) break;
    if (likelyNewParagraph(line, current[current.length - 1])) break;
    current.push(line);
  }
  if (current.length) items.push({ text: current.join(" "), page });
  return items;
}

function answerMatchesItem(answer: AnswerOption, itemText: string) {
  const normalized = normalizeForSearch(itemText);
  const answerTokens = uniqueTokens(answer.text).filter((token) => token.length >= 3);
  const phraseHit = answerSearchPhrases(answer.text)
    .map((phrase) => normalizeForSearch(phrase))
    .filter((phrase) => phrase.length >= 5)
    .some((phrase) => containsNormalizedPhrase(normalized, phrase));
  const tokenCoverage = answerTokens.length ? strictSoftCoverage(answerTokens, tokenizeNormalized(normalized)) : 0;
  return { matched: phraseHit || tokenCoverage >= 0.72, tokenCoverage };
}

/**
 * Восстанавливает ориентированное отношение "факторы риска -> заболевание"
 * из явного заголовка и его маркированных дочерних пунктов. Обратные фразы
 * вида "заболевание является фактором риска ..." в этот блок не попадают.
 */
export function resolveRiskFactorList({
  mode,
  pdfText,
  pages,
  topQuestionPages,
  question,
  answers,
}: {
  mode: string;
  pdfText: any;
  pages: any[];
  topQuestionPages?: Set<unknown>;
  question: string;
  answers: AnswerOption[];
}): RiskFactorListResolution {
  if (mode !== "multi") return new Map();
  const targetTokens = questionTargetTokens(question, pdfText?.abbreviations ?? []);
  if (!targetTokens.length) return new Map();

  const matchedByAnswer = new Map<
    string,
    { answer: AnswerOption; item: RiskListItem; tokenCoverage: number; header: string }
  >();
  let relevantHeaderCount = 0;

  for (const page of pages ?? []) {
    if (
      topQuestionPages?.size &&
      !topQuestionPages.has(page.page) &&
      !topQuestionPages.has(page.page - 1) &&
      !topQuestionPages.has(page.page + 1)
    ) {
      continue;
    }
    const lines = page.lines ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      const headerTarget = riskHeaderTarget(lines[index]);
      if (!headerTarget) continue;
      const headerTokens = uniqueTokens(headerTarget);
      if (!headerTokens.length || strictSoftCoverage(headerTokens, targetTokens) < 0.72) continue;
      const items = collectRiskItems(lines, index, page.page);
      if (items.length < 2) continue;
      relevantHeaderCount += 1;
      for (const answer of answers) {
        for (const item of items) {
          const hit = answerMatchesItem(answer, item.text);
          if (!hit.matched) continue;
          const previous = matchedByAnswer.get(answer.id);
          if (!previous || hit.tokenCoverage > previous.tokenCoverage) {
            matchedByAnswer.set(answer.id, {
              answer,
              item,
              tokenCoverage: hit.tokenCoverage,
              header: String(lines[index]).trim(),
            });
          }
        }
      }
    }
  }

  if (relevantHeaderCount !== 1 || matchedByAnswer.size < 2 || matchedByAnswer.size >= answers.length) return new Map();
  return new Map(
    [...matchedByAnswer.values()].map((item) => [
      item.answer.id,
      {
        adjustment: 0,
        evidence: {
          answerId: item.answer.id,
          page: item.item.page,
          text: `${item.header} ${item.item.text}`,
          score: 25.8 + Math.min(1.8, item.tokenCoverage * 1.8),
          kind: "risk_factor_list_member",
        },
      },
    ]),
  );
}
