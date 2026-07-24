import type { PredictorConfig } from "./config.js";
import type { PdfRuntime } from "./runtime.js";
import type { AnswerMode, AnswerOption, AnswerScore, EvidenceItem } from "./types.js";

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
  intent: {
    negative: boolean;
    exception: boolean;
    numeric: boolean;
    listLike: boolean;
  };
  anchorSegments: any[];
  sectionSegments: any[];
  topQuestionMatches: any[];
  topQuestionPages: Set<number>;
  rowSegments: any[];
  boundedListSegments: any[];
  visualTableColumnTargetsByPage: any;
  coordinateTableRowsByPage: any;
  coordinateRelationalRowsByPage: any;
  coordinateTableGroupsByPage: any;
  coordinateMultiCellRowsByPage: any;
  coordinateTableMembershipsByPage: any;
};

export type StructuralResolutionItem = {
  adjustment: number;
  evidence: EvidenceItem | null;
};

export type StructuralResolution = Map<string, StructuralResolutionItem>;

export type AnswerScoringContext = PredictionContext & {
  pages: any[];
  pdfText: any;
  chunks: any[];
  index: any;
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
