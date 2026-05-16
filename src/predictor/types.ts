export type AnswerMode = "single" | "multi";

export type AnswerOption = {
  id: string;
  text: string;
};

export type EvidenceItem = {
  answerId: string;
  page: number;
  text: string;
  score: number;
  kind: string;
};

export type AnswerScore = {
  answer: AnswerOption;
  raw: number;
  evidence: EvidenceItem[];
  score?: number;
  relative?: number;
};
