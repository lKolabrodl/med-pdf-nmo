import { coverage, extractNumbers, normalizeForSearch, tokenize, uniqueTokens } from "../../../normalize.js";
import { FOCUS_STOPWORDS } from "../../constants.js";
import type { AnswerOption, EvidenceItem } from "../../types.js";
import {
  answerSearchPhrases,
  betterEvidence,
  containsNormalizedPhrase,
  evidenceSnippet,
  expandNumberToken,
  numberCoverage,
  strictSoftCoverage,
  tokenizeNormalized,
  tokenHitCount,
} from "../../text-utils.js";
import { cyrillicOcrCoverage } from "../ocr-fuzzy/index.js";
import type {
  CoordinateEvidence,
  CoordinatePdfPage,
  CoordinateTableMembership,
  CoordinateTableMembershipsByPage,
  CoordinateTableMembershipSupportInput,
} from "./types.js";
import {
  COORDINATE_TABLE_MEMBERSHIP_GENERIC_TOKENS,
  coordinateTableFocusTokens,
  coordinateTextHasExplicitTableCaption,
} from "./shared.js";

function coordinateTableMembershipBlocks(
  page: CoordinatePdfPage,
): CoordinateTableMembership[] {
  const lines = page.lines ?? [];
  const blocks: CoordinateTableMembership[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const captionIndex =
      coordinateTextHasExplicitTableCaption(line) && String(line ?? "").length >= 12
        ? index
        : index > 0 && coordinateTextHasExplicitTableCaption(`${lines[index - 1]} ${line}`)
          ? index - 1
          : -1;
    if (captionIndex < 0) continue;

    const headerStart = Math.max(0, captionIndex - 1);
    const parts = [];
    for (let cursor = headerStart; cursor < lines.length && cursor <= captionIndex + 72; cursor += 1) {
      const text = String(lines[cursor] ?? "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      if (cursor > captionIndex + 2 && coordinateTextHasExplicitTableCaption(text)) break;
      parts.push(text);
    }

    const text = parts.join(" ").replace(/\s+/g, " ").trim();
    if (text.length < 80) continue;
    const headerText = parts.slice(0, Math.min(parts.length, 4)).join(" ");
    blocks.push({
      page: page.page,
      headerText,
      text,
      normalized: normalizeForSearch(text),
      headerTokens: uniqueTokens(headerText),
      tokens: tokenize(text),
    });
  }

  return blocks;
}

/**
 * Строит membership-блоки явных таблиц. В отличие от row-scorer'ов, этот слой
 * отвечает на вопрос "входит ли вариант в релевантную таблицу целиком".
 */
export function buildCoordinateTableMembershipsByPage(
  pages: CoordinatePdfPage[],
  topQuestionPages?: Set<number>,
): CoordinateTableMembershipsByPage {
  const byPage: CoordinateTableMembershipsByPage = new Map();
  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    const blocks = coordinateTableMembershipBlocks(page);
    if (blocks.length) byPage.set(page.page, blocks);
  }
  return byPage;
}

function coordinateTableMembershipFocus(
  question: string,
  focusTokens: string[],
  answerTokens: string[],
): string[] {
  return coordinateTableFocusTokens(question, focusTokens, answerTokens).filter(
    (token) => (token.length >= 4 || /^\d/u.test(token)) && !COORDINATE_TABLE_MEMBERSHIP_GENERIC_TOKENS.has(token),
  );
}

function coordinateTableMembershipAnswerHit(
  block: CoordinateTableMembership,
  answerText: string,
): boolean {
  return answerSearchPhrases(answerText).some((phrase) => {
    const normalizedPhrase = normalizeForSearch(phrase);
    return normalizedPhrase.length >= 3 && containsNormalizedPhrase(block.normalized, normalizedPhrase);
  });
}

function coordinateTableMembershipHasOpposingActionDuration(
  answers: AnswerOption[],
): boolean {
  const normalized = (answers ?? []).map((answer) => normalizeForSearch(answer.text));
  const hasShort = normalized.some((text) => containsNormalizedPhrase(text, "короткодейств"));
  const hasLong = normalized.some((text) => containsNormalizedPhrase(text, "длительнодейств"));
  return hasShort && hasLong;
}

/**
 * Ищет multi-вариант внутри тела явной таблицы, caption/заголовок которой
 * совпадает с фокусом вопроса. Это помогает полным table-list вопросам, где
 * несколько правильных ответов находятся в разных строках одной таблицы.
 */
export function bestCoordinateTableMembershipSupport({
  mode,
  question,
  answer,
  answers,
  answerTokens,
  focusTokens,
  intent,
  coordinateTableMembershipsByPage,
}: CoordinateTableMembershipSupportInput): CoordinateEvidence {
  if (mode !== "multi" || intent?.negative || intent?.exception || !coordinateTableMembershipsByPage?.size) return null;
  if (coordinateTableMembershipHasOpposingActionDuration(answers)) return null;
  const normalizedQuestion = normalizeForSearch(question);
  if (
    containsNormalizedPhrase(normalizedQuestion, "местно") ||
    containsNormalizedPhrase(normalizedQuestion, "в виде") ||
    containsNormalizedPhrase(normalizedQuestion, "маз") ||
    containsNormalizedPhrase(normalizedQuestion, "суппозитор")
  ) {
    return null;
  }
  const tableFocus = coordinateTableMembershipFocus(question, focusTokens, answerTokens);
  if (tableFocus.length < 2) return null;
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 10);
  let best: EvidenceItem | null = null;

  for (const blocks of coordinateTableMembershipsByPage.values()) {
    for (const block of blocks) {
      const headerCoverage = coverage(tableFocus, block.headerTokens);
      const headerHits = tokenHitCount(tableFocus, block.headerTokens);
      const blockCoverage = coverage(tableFocus, block.tokens);
      const relevantHeader = headerHits >= 2 || headerCoverage >= 0.22 || (headerHits >= 1 && blockCoverage >= 0.34);
      if (!relevantHeader) continue;
      const answerHitCount = (answers ?? []).filter((candidate) => coordinateTableMembershipAnswerHit(block, candidate.text)).length;
      if ((answers?.length ?? 0) >= 3 && (answers?.length ?? 0) <= 4 && answerHitCount >= (answers?.length ?? 0)) continue;

      const phraseHit = answerPhrases.some((phrase) => coordinateTableMembershipAnswerHit(block, phrase));
      const lexicalSupport = answerTokens.length ? strictSoftCoverage(answerTokens, block.tokens) : 0;
      if (!phraseHit && lexicalSupport < 0.94) continue;

      const score =
        11.8 +
        Math.min(0.6, headerCoverage) * 6.0 +
        Math.min(4, headerHits) * 0.85 +
        Math.min(0.45, blockCoverage) * 2.2 +
        (phraseHit ? 3.4 : 0) +
        lexicalSupport * 1.2;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: block.page,
        text: block.text.slice(0, 1200),
        score,
        kind: "coordinate_table_membership",
      });
    }
  }

  return best;
}
