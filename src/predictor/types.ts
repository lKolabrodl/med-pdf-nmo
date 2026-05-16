/** Поддерживаемые режимы вопроса. */
export type AnswerMode = "single" | "multi";

/** Нормализованный вариант ответа внутри predictor. */
export type AnswerOption = {
  id: string;
  text: string;
};

/** Evidence-фрагмент, объясняющий поддержку конкретного варианта. */
export type EvidenceItem = {
  answerId: string;
  page: number;
  text: string;
  score: number;
  kind: string;
};

/** Внутренний score варианта до и после калибровки. */
export type AnswerScore = {
  answer: AnswerOption;
  raw: number;
  evidence: EvidenceItem[];
  score?: number;
  relative?: number;
};
