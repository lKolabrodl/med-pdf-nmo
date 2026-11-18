import type { PdfPage } from "../../../pdf.js";
import type { ScoreAdjustmentContext, ScoreAdjustmentProcessor } from "../../contracts.js";
import { calibrateScores, selectAnswers } from "../../selection.js";
import type { AnswerOption, AnswerScore } from "../../types.js";

/**
 * Tokenize a quotation without dropping stop words, decimal separators or comparison signs.
 * @param text Source text from the question, answer or PDF page.
 * @returns A space-delimited token sequence for boundary-aware matching.
 */
export function literalTokens(text: string): string {
  const normalized = text.normalize("NFKC").toLowerCase().replace(/ё/g, "е").replace(/[‐‑‒–—−]/gu, "-");
  const tokens = normalized.match(/\d+(?:[.,]\d+)?|[\p{L}\p{M}]+|[^\s]/gu);
  return tokens?.join(" ") ?? "";
}

/**
 * Extract the final five consecutive words from a completion-style prompt.
 * @param question Question text, possibly with trailing punctuation.
 * @returns The literal suffix, or null for an incomplete or ineligible prompt.
 */
export function continuationAnchor(question: string): string | null {
  if (/_{2,}/u.test(question)) return null;
  const words = literalTokens(question).replace(/(?: [?:.\-])+$/u, "").split(" ").slice(-5);
  return words.length === 5 && words.every(word => /^\p{L}+$/u.test(word)) ? words.join(" ") : null;
}

export class QuotedContinuationProcessor implements ScoreAdjustmentProcessor {
  readonly id = "quoted-continuation";
  private readonly pageTexts = new WeakMap<PdfPage, string>();

  resolve(pages: PdfPage[], question: string, answers: AnswerOption[]) {
    const anchor = continuationAnchor(question);
    if (!anchor) return null;
    const marker = ` ${anchor} `;
    let occurrence: { page: number; rest: string } | undefined;
    for (const page of pages) {
      let text = this.pageTexts.get(page);
      if (text === undefined) {
        text = ` ${literalTokens(page.text)} `;
        this.pageTexts.set(page, text);
      }
      const start = text.indexOf(marker);
      if (start < 0) continue;
      if (occurrence || text.indexOf(marker, start + 1) >= 0) return null;
      occurrence = { page: page.page, rest: text.slice(start + marker.length) };
    }
    if (!occurrence) return null;

    const { page, rest } = occurrence;
    // A dash directly before a number can be its sign. The token stream no
    // longer distinguishes a typographic separator from a negative value.
    if (/^- \d/u.test(rest)) return null;
    const matches = answers.flatMap(answer => {
      const phrase = literalTokens(answer.text);
      if (!phrase) return [];
      const join = ["", ": ", "- "].find(prefix => rest.startsWith(`${prefix}${phrase} `));
      return join === undefined ? [] : [{ answerId: answer.id, page, text: `${anchor} ${join}${phrase}` }];
    });
    return matches.length === 1 ? matches[0] : null;
  }

  apply(scores: AnswerScore[], context: ScoreAdjustmentContext): AnswerScore[] {
    const { config, mode, question, answers, runtime } = context;
    if (!config.quotedContinuation || mode !== "single" || scores.length < 2) return scores;
    const quote = this.resolve(runtime.pdfText.pages, question, answers);
    if (!quote || selectAnswers(calibrateScores(scores), mode, config)[0] === quote.answerId) return scores;
    const maxRaw = Math.max(...scores.map(item => item.raw));
    const raw = maxRaw + Math.max(0, config.singleTieMaxRawGap) + 0.01;
    return scores.map(item => item.answer.id === quote.answerId
      ? { ...item, raw, evidence: [{ ...quote, kind: "quoted_continuation", score: raw }, ...item.evidence] }
      : item);
  }
}
