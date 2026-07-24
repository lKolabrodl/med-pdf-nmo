import type { BM25Index, BM25SearchResult } from "../bm25.js";
import type { PdfChunk } from "../chunk.js";
import type { ExtractedPdfText, PdfPage } from "../pdf.js";
import type { PredictorConfig } from "./config.js";
import type { PdfRuntime } from "./runtime.js";
import type {
  CoordinateMultiCellRowsByPage,
  CoordinateRelationalRowsByPage,
  CoordinateTableGroupsByPage,
  CoordinateTableMembershipsByPage,
  CoordinateTableRowsByPage,
} from "./scorers/coordinate-table/types.js";
import type { AnswerMode, AnswerOption, AnswerScore, EvidenceItem } from "./types.js";

export type QuestionIntent = {
  negative: boolean;
  exception: boolean;
  numeric: boolean;
  listLike: boolean;
};

export type ContextSegment = {
  page: number;
  text: string;
  normalized?: string;
  [key: string]: unknown;
};

export type TableContextByPage = Map<number, unknown[]> | null;

/**
 * Общий неизменяемый контекст одного вопроса. Тяжелые структуры PDF строятся
 * один раз и затем переиспользуются всеми scorer-ами вариантов ответа.
 */
export type PredictionContext = {
  runtime: PdfRuntime;
  config: PredictorConfig;
  mode: AnswerMode;
  question: string;
  answers: AnswerOption[];
  questionTokens: string[];
  focusTokens: string[];
  intent: QuestionIntent;
  anchorSegments: ContextSegment[];
  sectionSegments: ContextSegment[];
  topQuestionMatches: BM25SearchResult<PdfChunk>[];
  topQuestionPages: Set<number>;
  rowSegments: ContextSegment[];
  boundedListSegments: ContextSegment[];
  visualTableColumnTargetsByPage: TableContextByPage;
  coordinateTableRowsByPage: CoordinateTableRowsByPage | null;
  coordinateRelationalRowsByPage: CoordinateRelationalRowsByPage | null;
  coordinateTableGroupsByPage: CoordinateTableGroupsByPage | null;
  coordinateMultiCellRowsByPage: CoordinateMultiCellRowsByPage | null;
  coordinateTableMembershipsByPage:
    | CoordinateTableMembershipsByPage
    | null;
};

export type StructuralResolutionItem = {
  adjustment: number;
  evidence: EvidenceItem | null;
};

export type StructuralResolution = Map<string, StructuralResolutionItem>;

export type AnswerScoringContext = PredictionContext & {
  pages: PdfPage[];
  pdfText: ExtractedPdfText;
  chunks: PdfChunk[];
  index: BM25Index<PdfChunk>;
  answer: AnswerOption;
  answerTokens: string[];
  siblingListResolution: StructuralResolution;
};

export type AnswerScoreResult = {
  raw: number;
  evidence: EvidenceItem[];
};

export type ScoreAdjustmentContext = PredictionContext;

export type ScoreAdjustmentProcessor = {
  readonly id: string;
  apply(scores: AnswerScore[], context: ScoreAdjustmentContext): AnswerScore[];
};
