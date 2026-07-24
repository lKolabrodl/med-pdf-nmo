import {
  coverage as coverageBase,
  extractNumbers as extractNumbersBase,
  normalizeForSearch as normalizeForSearchBase,
  normalizeText as normalizeTextBase,
  phraseTokens as phraseTokensBase,
  tokenize as tokenizeBase,
  uniqueTokens as uniqueTokensBase,
} from "../../../normalize.js";
import type {PdfLinePage} from "../../../pdf.js";
import {
  answerSearchPhrases as answerSearchPhrasesBase,
  betterEvidence as betterEvidenceBase,
  cachedLineWindowSegments as cachedLineWindowSegmentsBase,
  containsNormalizedPhrase as containsNormalizedPhraseBase,
  escapeRegExp as escapeRegExpBase,
  evidenceSnippet as evidenceSnippetBase,
  expandNumberToken as expandNumberTokenBase,
  findPhraseOccurrences as findPhraseOccurrencesBase,
  hasSearchBoundaries as hasSearchBoundariesBase,
  nearestCueName as nearestCueNameBase,
  numberCoverage as numberCoverageBase,
  proximityBonus as proximityBonusBase,
  strictSoftCoverage as strictSoftCoverageBase,
  tokenizeNormalized as tokenizeNormalizedBase,
  tokenHitCount as tokenHitCountBase,
} from "../../text-utils.js";
import {
  frequencyAnswer as frequencyAnswerBase,
  frequencySearchPhrases as frequencySearchPhrasesBase,
} from "../frequency/index.js";
import type {EvidenceItem} from "../../types.js";
import type {NumericSegment} from "./types.js";

type CueEntry = readonly [name: string, cues: readonly string[]];
type PhraseSearchOptions = {
  textIsNormalized?: boolean;
};
type TokenizeOptions = {
  keepStopwords?: boolean;
  stem?: boolean;
};

export const coverage = coverageBase as (queryTokens: string[], documentTokens: string[]) => number;
export const extractNumbers = extractNumbersBase as (text: unknown) => string[];
export const normalizeForSearch = normalizeForSearchBase as (text: unknown) => string;
export const normalizeText = normalizeTextBase as (text: unknown) => string;
export const phraseTokens = phraseTokensBase as (text: unknown) => string[];
export const tokenize = tokenizeBase as (text: unknown, options?: TokenizeOptions) => string[];
export const uniqueTokens = uniqueTokensBase as (text: unknown, options?: TokenizeOptions) => string[];
export const answerSearchPhrases = answerSearchPhrasesBase as (answerText: unknown) => string[];
export const betterEvidence = betterEvidenceBase as (left: EvidenceItem | null, right: EvidenceItem) => EvidenceItem;
export const cachedLineWindowSegments = cachedLineWindowSegmentsBase as (page: PdfLinePage) => NumericSegment[];
export const containsNormalizedPhrase = containsNormalizedPhraseBase as (normalizedHaystack: unknown, needle: unknown) => boolean;
export const escapeRegExp = escapeRegExpBase as (value: unknown) => string;
export const evidenceSnippet = evidenceSnippetBase as (pageText: unknown, ...needles: unknown[]) => string;
export const expandNumberToken = expandNumberTokenBase as (token: unknown) => string[];
export const findPhraseOccurrences = findPhraseOccurrencesBase as (text: unknown, phrase: unknown, options?: PhraseSearchOptions) => number[];
export const hasSearchBoundaries = hasSearchBoundariesBase as (text: string, index: number, length: number) => boolean;
export const nearestCueName = nearestCueNameBase as (local: string, entries: readonly CueEntry[]) => string | null;
export const numberCoverage = numberCoverageBase as (answer: unknown, text: unknown) => number;
export const proximityBonus = proximityBonusBase as (distance: number, radius: number) => number;
export const strictSoftCoverage = strictSoftCoverageBase as (queryTokens: string[], documentTokens: string[]) => number;
export const tokenizeNormalized = tokenizeNormalizedBase as (text: unknown) => string[];
export const tokenHitCount = tokenHitCountBase as (queryTokens: string[], documentTokens: string[]) => number;
export const frequencyAnswer = frequencyAnswerBase as (answerText: unknown) => boolean;
export const frequencySearchPhrases = frequencySearchPhrasesBase as (answerText: unknown) => string[];
