import type {
  AnswerMode,
  AnswerOption,
  EvidenceItem,
} from "../../types.js";

export type CoordinateTextItem = {
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
};

export type CoordinateTextLine = {
  text: string;
  y: number;
  items: CoordinateTextItem[];
};

export type CoordinateCell = {
  text: string;
  x?: number;
  endX?: number;
  y?: number;
  itemCount?: number;
  index?: number;
  normalized?: string;
  tokens?: string[];
  aliasText?: string;
};

export type CoordinateTableRow = {
  page: number;
  index: number;
  y: number;
  headerText: string;
  text: string;
  sourceText: string;
  cells: CoordinateCell[];
};

export type CoordinateRelationalRow = CoordinateTableRow & {
  endIndex: number;
  anchors: number[];
  columnHeaders?: CoordinateCell[];
};

export type CoordinateTableGroup = {
  page: number;
  index: number;
  y: number;
  headerText: string;
  labelText: string;
  valueText: string;
  text: string;
  sourceText: string;
  labelX: number;
  valueX?: number;
  labelTokens: string[];
  valueTokens: string[];
};

export type CoordinateMultiCellRow = CoordinateTableGroup;

export type CoordinateTableMembership = {
  page: number;
  headerText: string;
  text: string;
  normalized: string;
  headerTokens: string[];
  tokens: string[];
};

export type CoordinateTableRowsByPage = Map<number, CoordinateTableRow[]>;
export type CoordinateRelationalRowsByPage = Map<
  number,
  CoordinateRelationalRow[]
>;
export type CoordinateTableGroupsByPage = Map<number, CoordinateTableGroup[]>;
export type CoordinateMultiCellRowsByPage = Map<
  number,
  CoordinateMultiCellRow[]
>;
export type CoordinateTableMembershipsByPage = Map<
  number,
  CoordinateTableMembership[]
>;

export type CoordinatePdfPage = {
  page: number;
  lines: string[];
  lineItems?: CoordinateTextLine[];
  text?: string;
  normalized?: string;
  charLength?: number;
  __coordinateTableRows?: CoordinateTableRow[];
  __coordinateRelationalRows?: CoordinateRelationalRow[];
  __coordinateRelationalHeaders?: CoordinateRelationalRow[];
  __coordinateTableGroups?: CoordinateTableGroup[];
  __coordinateMultiCellRows?: CoordinateMultiCellRow[];
};

export type CoordinateCellAnswerSupport = {
  support: number;
  numericCoverage: number;
  phraseHit: boolean;
  tokens: string[];
  normalized: string;
};

export type CoordinateAnswerSupportInput<TMap> = {
  mode: AnswerMode;
  question: string;
  answer: AnswerOption;
  answerTokens: string[];
  focusTokens: string[];
} & TMap;

export type CoordinateTableRowSupportInput = CoordinateAnswerSupportInput<{
  coordinateTableRowsByPage: CoordinateTableRowsByPage | null;
}>;

export type CoordinateRelationalRowSupportInput =
  CoordinateAnswerSupportInput<{
    coordinateRelationalRowsByPage: CoordinateRelationalRowsByPage | null;
  }>;

export type CoordinateTableGroupSupportInput = CoordinateAnswerSupportInput<{
  coordinateTableGroupsByPage: CoordinateTableGroupsByPage | null;
}>;

export type CoordinateMultiCellRowSupportInput =
  CoordinateAnswerSupportInput<{
    coordinateMultiCellRowsByPage: CoordinateMultiCellRowsByPage | null;
  }>;

export type CoordinateTableMembershipSupportInput =
  CoordinateAnswerSupportInput<{
    answers: AnswerOption[];
    intent: {
      negative: boolean;
      exception: boolean;
    };
    coordinateTableMembershipsByPage:
      | CoordinateTableMembershipsByPage
      | null;
  }>;

export type CoordinateEvidence = EvidenceItem | null;
