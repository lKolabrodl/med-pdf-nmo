import { normalizeForSearch } from "../../../normalize.js";

export function ordinalValueToNumber(value) {
  const normalized = normalizeForSearch(value);
  if (/^\d{1,2}$/.test(normalized)) return Number(normalized);
  const roman = new Map([
    ["i", 1],
    ["ii", 2],
    ["iii", 3],
    ["iv", 4],
    ["v", 5],
    ["vi", 6],
    ["vii", 7],
    ["viii", 8],
    ["ix", 9],
    ["x", 10],
  ]);
  return roman.get(normalized) ?? null;
}

export function romanStageVariants(stage) {
  const romanMap = new Map([
    ["1", "i"],
    ["2", "ii"],
    ["3", "iii"],
    ["4", "iv"],
    ["5", "v"],
    ["6", "vi"],
  ]);
  const reverse = new Map([...romanMap.entries()].map(([number, roman]) => [roman, number]));
  const variants = new Set([stage]);
  if (romanMap.has(stage)) variants.add(romanMap.get(stage));
  if (reverse.has(stage)) variants.add(reverse.get(stage));
  return [...variants].map((item) => normalizeForSearch(item));
}
