import {normalizeForSearch} from "../../../normalize.js";

/**
 * Преобразует арабское или римское порядковое значение I–X в число.
 *
 * @param value Входное значение, которое требуется нормализовать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 */
export function ordinalValueToNumber(value: string | number): number | null {
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

/**
 * Возвращает нормализованные арабскую и римскую формы стадии.
 *
 * @param stage Значение `stage`, необходимое этому этапу scorer-а.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 */
export function romanStageVariants(stage: string): string[] {
  const romanMap = new Map([
    ["1", "i"],
    ["2", "ii"],
    ["3", "iii"],
    ["4", "iv"],
    ["5", "v"],
    ["6", "vi"],
  ]);
  const reverse = new Map([...romanMap.entries()].map(([number, roman]) => [roman, number]));
  const variants = new Set<string>([stage]);
  if (romanMap.has(stage)) variants.add(romanMap.get(stage)!);
  if (reverse.has(stage)) variants.add(reverse.get(stage)!);
  return [...variants].map((item) => normalizeForSearch(item));
}
