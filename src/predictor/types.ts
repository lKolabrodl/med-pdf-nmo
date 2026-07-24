import type { PredictorConfig } from "./config.js";
import type { PdfJsModule } from "../pdf.js";

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

/** Answer score после калибровки, переданный в selection/result layers. */
export type CalibratedAnswerScore = AnswerScore & {
  score: number;
  relative: number;
};

/** Character range inside a presentation source excerpt. */
export type SourceHighlight = {
  start: number;
  end: number;
  role: "question" | "answer";
};

/** A paragraph-sized, display-ready fragment from the original PDF text. */
export type SourceExcerpt = {
  page: number;
  text: string;
  /** Zero-based physical line range inside the extracted PDF page. */
  lineStart: number;
  lineEnd: number;
  blockKind: "paragraph" | "recommendation" | "list_item" | "table_row";
  stance: "support" | "contradiction" | "context" | "mixed";
  highlights: SourceHighlight[];
  origin: "question_match" | "selected_answer_context" | "scoring_evidence" | "search_fallback";
  /** How confidently the short scorer anchor was localized on the source page. */
  localizationMatch: "exact" | "normalized" | "approximate";
  /** Whether the displayed question/answer text itself is present in this excerpt. */
  contentMatch: "exact" | "partial" | "none";
  evidenceKinds: string[];
  score: number;
  truncated: boolean;
};

/** Presentation sources for one answer variant, preserved in input order. */
export type AnswerSources = {
  id: string;
  variant: string;
  selected: boolean;
  excerpts: SourceExcerpt[];
};

/** Full extracted text of one PDF page referenced by a source excerpt. */
export type SourcePage = {
  page: number;
  text: string;
};

/** UI-oriented provenance, deliberately separate from scorer evidence. */
export type PredictionSources = {
  question: SourceExcerpt | null;
  answers: AnswerSources[];
  pages: SourcePage[];
};

/** Primary, display-ready citation for the prediction. */
export type PredictionSource = {
  page: number;
  text: string;
};

export type PredictorMeta = {
  pageCount: number;
  chunks: number;
  ocrNeeded: boolean;
  intent: {
    negative: boolean;
    exception: boolean;
    numeric: boolean;
    listLike: boolean;
  };
};

export type AnswerEvidenceDiagnostics = {
  evidenceCount: number;
  uniqueEvidencePages: number;
  bestEvidenceScore: number;
  kindCounts: Record<string, number>;
  kindBestScores: Record<string, number>;
  refs: Array<{
    page: number;
    kind: string;
    score: number;
  }>;
};

/** Stable low-level result returned by predict(). */
export type PredictorResult = {
  selected: string[];
  mode: AnswerMode;
  confidence: number;
  scores: Record<string, number>;
  rawScores: Record<string, number>;
  evidence: EvidenceItem[];
  source: PredictionSource | null;
  sources: PredictionSources;
  diagnostics?: {
    answerEvidence: Record<string, AnswerEvidenceDiagnostics>;
  };
  meta: PredictorMeta;
};

/** Low-level input accepted by predict(). */
export type PredictorInput = {
  pdfData?: unknown;
  pdfBuffer?: unknown;
  pdf?: unknown;
  file?: unknown;
  blob?: unknown;
  pdfUrl?: string;
  url?: string;
  pdfPath?: string;
  cacheKey?: string;
  question?: string;
  answers?: Array<AnswerOption | string>;
  variants?: Array<AnswerOption | string>;
  mode?: AnswerMode | string;
};

/** Low-level runtime and presentation options accepted by predict(). */
export type PredictorOptions = Partial<PredictorConfig> & {
  pdfjsLib?: PdfJsModule;
  pdfVerbosity?: number;
  diagnostics?: boolean;
  includeSources?: boolean;
  sourcePassageMaxChars?: number;
  sourcePassagesPerAnswer?: number;
};
