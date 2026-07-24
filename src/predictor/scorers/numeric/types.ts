import type {PdfLinePage, PdfPage} from "../../../pdf.js";
import type {AnswerMode, AnswerOption, EvidenceItem} from "../../types.js";

type NumericQuestionContext = {
  mode: AnswerMode;
  question: string;
  answer: AnswerOption;
};

type NumericPageContext = {
  pages: PdfPage[];
  topQuestionPages?: ReadonlySet<number>;
};

type NumericTokenContext = {
  answerTokens: string[];
  focusTokens: string[];
};

export type ClozeGapInput = NumericQuestionContext & NumericPageContext & NumericTokenContext;

export type ConditionPairInput = NumericPageContext & {
  answer: AnswerOption;
};

export type ExactNumericOptionInput = NumericQuestionContext & NumericPageContext & NumericTokenContext & {
  answers: AnswerOption[];
  questionTokens: string[];
};

export type SubjectBoundNumericClauseInput = NumericQuestionContext & {
  pages: PdfLinePage[];
  topQuestionPages?: ReadonlySet<number>;
  answers: AnswerOption[];
};

export type NumericConditionInput = NumericQuestionContext & NumericPageContext & NumericTokenContext;

export type CountRelationInput = NumericQuestionContext & NumericPageContext & {
  answerTokens: string[];
};

export type ScoreAdjustment = {
  adjustment: number;
  evidence: EvidenceItem | null;
};

export type NumericEvidence = EvidenceItem | null;

export type NumericSegment = {
  text: string;
  normalized: string;
  tokens: string[];
};
