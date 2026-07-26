/**
 * Публичный facade координатных table-scorer-ов.
 *
 * Внутренние геометрические helpers остаются в специализированных файлах,
 * чтобы runtime использовал только явно перечисленные точки входа.
 */
export {
  bestCoordinateTableRowSupport,
  buildCoordinateTableRowsByPage,
  hasCoordinateComparisonTableCue,
  hasCoordinateRelationalRowCue,
  hasCoordinateTableCue,
  hasCoordinateTableGroupCue,
} from "./shared.js";
export {
  bestCoordinateRelationalRowSupport,
  buildCoordinateRelationalRowsByPage,
} from "./relational.js";
export {
  bestCoordinateMultiCellRowSupport,
  bestCoordinateTableGroupSupport,
  buildCoordinateMultiCellRowsByPage,
  buildCoordinateTableGroupsByPage,
} from "./groups.js";
export {
  bestCoordinateTableMembershipSupport,
  buildCoordinateTableMembershipsByPage,
} from "./membership.js";
