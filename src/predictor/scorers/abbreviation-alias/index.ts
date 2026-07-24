import { coverage, normalizeForSearch, uniqueTokens } from "../../../normalize.js";
import {
  betterEvidence,
  evidenceSnippet,
  hasSearchBoundaries,
  pageWindow,
  strictSoftCoverage,
  tokenHitCount,
  tokenizeNormalized,
} from "../../text-utils.js";

type AbbreviationAlias = {
  abbr: string;
  expansion: string;
  page?: number;
};

function abbreviationForms(abbr: string) {
  const normalized = normalizeForSearch(abbr);
  const compact = normalized.replace(/\s+/g, "");
  const dashless = normalized.replace(/\s*-\s*/g, "").replace(/\s+/g, "");
  return [...new Set([normalized, compact, dashless])].filter((form) => form.length >= 2);
}

function answerExpansionSupport(answerText: string, answerTokens: string[], expansion: string) {
  const answerNorm = normalizeForSearch(answerText);
  const expansionNorm = normalizeForSearch(expansion);
  if (!answerNorm || !expansionNorm) return 0;
  const direct = expansionNorm.includes(answerNorm) ? 1 : 0;
  if (direct) return direct;
  const expansionTokens = uniqueTokens(expansion);
  if (answerTokens.length < 3) return 0;
  return Math.max(coverage(answerTokens, expansionTokens), strictSoftCoverage(answerTokens, expansionTokens));
}

function aliasMatchesAnswer(alias: AbbreviationAlias, answerText: string, answerTokens: string[]) {
  const compactAbbr = normalizeForSearch(alias.abbr).replace(/[^a-zа-я0-9]+/giu, "");
  if (compactAbbr.length <= 2) return 0;
  if (answerTokens.length < 2) return 0;
  const support = answerExpansionSupport(answerText, answerTokens, alias.expansion);
  const required = answerTokens.length >= 3 ? 0.7 : 0.86;
  return support >= required ? support : 0;
}

/**
 * Ищет локальную поддержку ответа через document-specific список сокращений.
 *
 * Список сокращений используется только как словарь: если ответ совпадает с расшифровкой,
 * scorer ищет само сокращение в содержательном фрагменте рядом с токенами вопроса.
 */
export function bestAbbreviationAliasSupport(context) {
  if (context.mode !== "multi") return null;
  const aliases = (context.pdfText?.abbreviations ?? []) as AbbreviationAlias[];
  if (!aliases.length) return null;

  const { pages, question, questionTokens, focusTokens, answer, answerTokens, topQuestionPages } = context;
  const matchingAliases = aliases
    .map((alias) => ({ alias, support: aliasMatchesAnswer(alias, answer.text, answerTokens) }))
    .filter((item) => item.support > 0);
  if (!matchingAliases.length) return null;

  let best = null;
  for (const { alias, support } of matchingAliases) {
    const forms = abbreviationForms(alias.abbr);
    if (!forms.length) continue;

    for (const page of pages) {
      if (page.page === alias.page) continue;
      const pageNorm = page.normalized;
      for (const form of forms) {
        let start = 0;
        while (start < pageNorm.length) {
          const index = pageNorm.indexOf(form, start);
          if (index < 0) break;
          start = index + Math.max(1, form.length);
          if (!hasSearchBoundaries(pageNorm, index, form.length)) continue;

          const local = pageWindow(page, index, 700);
          const localTokens = tokenizeNormalized(local);
          const questionCoverage = coverage(questionTokens, localTokens);
          const focusHitCount = tokenHitCount(focusTokens ?? [], localTokens);
          if (questionCoverage < 0.22 && focusHitCount < 2) continue;

          const topPageBonus = topQuestionPages?.has(page.page) ? 0.8 : 0;
          const score = 9.6 + support * 2.1 + questionCoverage * 2.8 + Math.min(2, focusHitCount) * 0.45 + topPageBonus;
          best = betterEvidence(best, {
            answerId: answer.id,
            page: page.page,
            text: `${evidenceSnippet(page.text, question, alias.abbr)} [${alias.abbr} = ${alias.expansion}]`,
            score,
            kind: "abbreviation_alias_window",
          });
        }
      }
    }
  }

  return best;
}
