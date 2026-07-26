import { normalizeForSearch, uniqueTokens } from "../../../normalize.js";
import type { PdfLinePage } from "../../../pdf.js";
import { FOCUS_STOPWORDS } from "../../constants.js";
import { answerSearchPhrases, containsNormalizedPhrase, strictSoftCoverage, tokenHitCount } from "../../text-utils.js";

type AnswerOption = { id: string; text: string };
type FlatLine = { page: number; flatIndex: number; text: string };
type HierarchyChild = { page: number; flatIndex: number; text: string; tokens: string[] };
type HierarchyParent = {
  page: number;
  flatIndex: number;
  nextParentIndex: number;
  label: string;
  labelTokens: string[];
  children: HierarchyChild[];
};
type ChildTokenFrequency = {frequency: Map<string, number>; total: number};
type ChildAnswerMatch = {matched: boolean; quality: number};
type BestChildMatch = ChildAnswerMatch & {child: HierarchyChild};

/** Поправка и evidence для каждого ответа, разрешённого по иерархии списка. */
export type HierarchicalListResolution = Map<
  string,
  {
    adjustment: number;
    evidence: { answerId: string; page: number; text: string; score: number; kind: string } | null;
  }
>;

const ROMAN_PARENT = /^\s*[ivx]{1,8}\.\s*(.{4,240}?)(?::\s*)?$/iu;
const NUMBERED_CHILD = /^\s*\d{1,2}(?:(?:\.\d{1,2})+\.?|[.)])\s+(.+)$/u;
const GENERIC = new Set(
  uniqueTokens(
    "грыжа заболевание состояние пациент форма формы тип типа виды вид группа классификация вариант варианты пищеводное отверстие диафрагма",
  ),
);

/**
 * Выполняет внутренний этап `flattenLines`, подготавливающий `flatten` строк для основного scorer-а.
 *
 * @param pages Извлечённые страницы PDF, доступные scorer-у.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function flattenLines(pages: PdfLinePage[]): FlatLine[] {
  const out: FlatLine[] = [];
  let flatIndex = 0;
  for (const page of pages ?? []) {
    for (const line of page.lines ?? []) {
      out.push({ page: page.page, flatIndex, text: String(line ?? "") });
      flatIndex += 1;
    }
  }
  return out;
}

/**
 * Выполняет внутренний этап `parentLabel`, подготавливающий родительского пункта метки для основного scorer-а.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function parentLabel(text: string): string | null {
  const match = ROMAN_PARENT.exec(String(text ?? ""));
  return match?.[1]?.replace(/\s+/gu, " ").trim() ?? null;
}

/**
 * Выполняет внутренний этап `childStart`, подготавливающий дочернего пункта `start` для основного scorer-а.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function childStart(text: string): string | null {
  const match = NUMBERED_CHILD.exec(String(text ?? ""));
  return match?.[1]?.replace(/\s+/gu, " ").trim() ?? null;
}

/**
 * Находит структурную границу для дочернего пункта.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function childBoundary(text: string): boolean {
  const clean = normalizeForSearch(text);
  return (
    /^\s*[-\u2010-\u2015\u2022\u25aa\u25e6*]\s+/u.test(String(text ?? "")) ||
    /^(?:ууд|уур|комментари|примечани)(?:\s|[-\u2013\u2014:])/u.test(clean) ||
    /^\s*\d+(?:\.\d+)+\.?\s+\S/u.test(String(text ?? ""))
  );
}

/**
 * Reconstructs consecutive `I. parent -> 1) child` physical-line trees.
 *
 * @param pages Извлечённые страницы PDF, доступные scorer-у.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 */
export function buildHierarchicalListClusters(
  pages: PdfLinePage[],
): HierarchyParent[][] {
  const lines = flattenLines(pages);
  const parents: HierarchyParent[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const label = parentLabel(lines[index].text);
    if (!label) continue;
    const children: HierarchyChild[] = [];
    let nextParentIndex = Number.POSITIVE_INFINITY;
    for (let cursor = index + 1; cursor < lines.length && cursor <= index + 52; cursor += 1) {
      const line = lines[cursor];
      if (parentLabel(line.text)) {
        nextParentIndex = line.flatIndex;
        break;
      }
      const start = childStart(line.text);
      if (start) {
        children.push({ page: line.page, flatIndex: line.flatIndex, text: start, tokens: uniqueTokens(start) });
        continue;
      }
      if (!children.length) {
        if (cursor > index + 3 || childBoundary(line.text)) break;
        continue;
      }
      if (childBoundary(line.text)) break;
      const current = children[children.length - 1];
      if (line.page > current.page + 1 || line.flatIndex - current.flatIndex > 6 || current.text.length >= 650) break;
      const continuation = line.text.replace(/\s+/gu, " ").trim();
      if (!continuation) continue;
      current.text = `${current.text} ${continuation}`.replace(/\s+/gu, " ").trim();
      current.tokens = uniqueTokens(current.text);
    }
    if (children.length < 2) continue;
    parents.push({
      page: lines[index].page,
      flatIndex: lines[index].flatIndex,
      nextParentIndex,
      label,
      labelTokens: uniqueTokens(label),
      children,
    });
  }

  const clusters: HierarchyParent[][] = [];
  for (const parent of parents) {
    const current = clusters[clusters.length - 1];
    const previous = current?.[current.length - 1];
    if (previous && previous.nextParentIndex === parent.flatIndex) current.push(parent);
    else clusters.push([parent]);
  }
  return clusters.filter((cluster) => cluster.length >= 2);
}

/**
 * Выполняет внутренний этап `informative`, подготавливающий информативных токенов для основного scorer-а.
 *
 * @param tokens Набор токенов для локального сопоставления.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function informative(tokens: string[]): string[] {
  return tokens.filter((token) => token.length >= 3 && !FOCUS_STOPWORDS.has(token) && !GENERIC.has(token) && !/^\d+$/u.test(token));
}

/**
 * Выделяет специфичные токены для общих метки.
 *
 * @param cluster Значение `cluster`, необходимое этому этапу scorer-а.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function commonLabelTokens(cluster: HierarchyParent[]): Set<string> {
  const common = new Set(informative(cluster[0].labelTokens));
  for (const parent of cluster.slice(1)) {
    const tokens = new Set(informative(parent.labelTokens));
    for (const token of [...common]) if (!tokens.has(token)) common.delete(token);
  }
  return common;
}

/**
 * Проверяет совпадение родительского пункта вопроса.
 *
 * @param question Исходный текст вопроса.
 * @param parent Значение `parent`, необходимое этому этапу scorer-а.
 * @param common Значение `common`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function parentQuestionMatch(question: string, parent: HierarchyParent, common: Set<string>): number {
  const questionNegated = /(?:^|\s)не\s+\S/iu.test(String(question ?? "").toLowerCase());
  const labelNegated = /(?:^|\s)не\s+\S/iu.test(String(parent.label ?? "").toLowerCase());
  if (questionNegated !== labelNegated) return 0;
  const questionTokens = uniqueTokens(question);
  const parentTokens = informative(parent.labelTokens);
  const uncommon = parentTokens.filter((token) => !common.has(token));
  // Иногда sibling-заголовки лексически различаются только отрицанием.
  // Полярность уже проверена выше, поэтому в таком случае сравниваем полную
  // метку, а не отказываемся от структурного контраста.
  const distinctive = uncommon.length ? uncommon : parentTokens;
  if (!distinctive.length) return 0;
  const hits = tokenHitCount(distinctive, questionTokens);
  const coverage = strictSoftCoverage(distinctive, questionTokens);
  const phrase = containsNormalizedPhrase(normalizeForSearch(question), normalizeForSearch(parent.label));
  if (!phrase && (hits < 1 || coverage < 0.5)) return 0;
  return Math.max(phrase ? 1 : 0, coverage) + Math.min(0.35, hits * 0.08);
}

/**
 * Выполняет внутренний этап `baseChildText`, подготавливающий `base` дочернего пункта текста для основного scorer-а.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function baseChildText(text: string): string {
  return text.replace(/\s*\([^)]*\)\s*[;.]?\s*$/u, "").trim();
}

/**
 * Выполняет внутренний этап `childTokenFrequency`, подготавливающий дочернего пункта токена частоты для основного scorer-а.
 *
 * @param cluster Значение `cluster`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function childTokenFrequency(cluster: HierarchyParent[]): ChildTokenFrequency {
  const frequency = new Map<string, number>();
  const children = cluster.flatMap((parent) => parent.children);
  for (const child of children) {
    for (const token of new Set(informative(uniqueTokens(baseChildText(child.text))))) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  return { frequency, total: children.length };
}

/**
 * Выделяет специфичные токены для различающих дочернего пункта.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @param frequency Значение `frequency`, необходимое этому этапу scorer-а.
 * @param total Значение `total`, необходимое этому этапу scorer-а.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function distinctiveChildTokens(text: string, frequency: Map<string, number>, total: number): string[] {
  const tokens = informative(uniqueTokens(baseChildText(text)));
  const distinctive = tokens.filter((token) => (frequency.get(token) ?? 0) < Math.max(2, Math.ceil(total * 0.55)));
  return distinctive.length ? distinctive : tokens;
}

/**
 * Проверяет совпадение дочернего пункта варианта ответа.
 *
 * @param answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param child Значение `child`, необходимое этому этапу scorer-а.
 * @param frequency Значение `frequency`, необходимое этому этапу scorer-а.
 * @param total Значение `total`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function childAnswerMatch(
  answer: AnswerOption,
  child: HierarchyChild,
  frequency: Map<string, number>,
  total: number,
): ChildAnswerMatch {
  const childText = baseChildText(child.text);
  const childTokens = distinctiveChildTokens(childText, frequency, total);
  const answerTokens = distinctiveChildTokens(answer.text, frequency, total);
  const phrase = answerSearchPhrases(answer.text).some((candidate) => containsNormalizedPhrase(normalizeForSearch(childText), candidate));
  if (!childTokens.length || !answerTokens.length) return { matched: phrase, quality: phrase ? 1 : 0 };
  const allAnswerTokens = uniqueTokens(answer.text);
  const allChildTokens = uniqueTokens(childText);
  const childCoverage = strictSoftCoverage(childTokens, allAnswerTokens);
  const answerCoverage = strictSoftCoverage(answerTokens, allChildTokens);
  const exactChildCoverage = childTokens.filter((token) => allAnswerTokens.includes(token)).length / childTokens.length;
  const exactAnswerCoverage = answerTokens.filter((token) => allChildTokens.includes(token)).length / answerTokens.length;
  const exactQuality = Math.min(exactChildCoverage, exactAnswerCoverage);
  const quality = Math.min(childCoverage, answerCoverage);
  const answerContainedByChild =
    answerTokens.length >= 2 &&
    answerCoverage >= 0.78 &&
    exactAnswerCoverage >= 0.5;
  return {
    matched: phrase || answerContainedByChild || (childCoverage >= 0.72 && answerCoverage >= 0.6),
    quality: Math.max(phrase ? 1 : 0, answerContainedByChild ? answerCoverage * 0.94 : 0, quality) + exactQuality * 0.28,
  };
}

/**
 * Проверяет совпадение дочернего пункта.
 *
 * @param answer Проверяемый вариант ответа с идентификатором и текстом.
 * @param children Значение `children`, необходимое этому этапу scorer-а.
 * @param frequency Значение `frequency`, необходимое этому этапу scorer-а.
 * @param total Значение `total`, необходимое этому этапу scorer-а.
 * @returns Лучшее evidence или `null`, если применимый локальный сигнал не найден.
 * @internal
 */
function bestChildMatch(
  answer: AnswerOption,
  children: HierarchyChild[],
  frequency: Map<string, number>,
  total: number,
): BestChildMatch | null {
  return children
    .map((child) => ({ child, ...childAnswerMatch(answer, child, frequency, total) }))
    .filter((item) => item.matched)
    .sort((left, right) => right.quality - left.quality)[0] ?? null;
}

/**
 * Выбирает дочерние элементы родительского пункта, названного в multi-вопросе.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.question Исходный текст вопроса.
 * @param context.answers Полный набор вариантов, необходимый для контрастного сравнения.
 * @returns Структурное разрешение; пустое значение означает, что scorer воздержался.
 */
export function resolveHierarchicalList({
  mode,
  pages,
  question,
  answers,
}: {
  mode: string;
  pages: PdfLinePage[];
  question: string;
  answers: AnswerOption[];
}): HierarchicalListResolution {
  if (mode !== "multi") return new Map();
  const candidates = [];
  for (const cluster of buildHierarchicalListClusters(pages)) {
    const common = commonLabelTokens(cluster);
    const { frequency, total } = childTokenFrequency(cluster);
    for (const target of cluster) {
      const labelMatch = parentQuestionMatch(question, target, common);
      if (labelMatch <= 0) continue;
      const targetMatches = new Map<string, ReturnType<typeof bestChildMatch>>();
      const siblingMatches = new Map<string, ReturnType<typeof bestChildMatch>>();
      for (const answer of answers) {
        const targetMatch = bestChildMatch(answer, target.children, frequency, total);
        if (targetMatch) targetMatches.set(answer.id, targetMatch);
        const siblingMatch = bestChildMatch(
          answer,
          cluster.filter((parent) => parent !== target).flatMap((parent) => parent.children),
          frequency,
          total,
        );
        if (siblingMatch) siblingMatches.set(answer.id, siblingMatch);
      }
      const targetOnly = [...targetMatches.entries()].filter(
        ([id, match]) => !siblingMatches.has(id) || (match?.quality ?? 0) - (siblingMatches.get(id)?.quality ?? 0) >= 0.12,
      );
      const matchedChildren = new Set(targetOnly.map(([, match]) => match?.child.flatIndex));
      const siblingOnly = [...siblingMatches.keys()].filter((id) => !targetOnly.some(([targetId]) => targetId === id));
      const completeTarget = matchedChildren.size === target.children.length;
      if (targetOnly.length < 2 || targetOnly.length >= answers.length || (!completeTarget && siblingOnly.length < 1)) continue;
      const averageQuality = targetOnly.reduce((sum, [, match]) => sum + (match?.quality ?? 0), 0) / targetOnly.length;
      candidates.push({
        target,
        targetOnly,
        siblingOnly,
        strength: labelMatch * 2 + averageQuality + (completeTarget ? 0.8 : 0) + Math.min(0.4, siblingOnly.length * 0.08),
      });
    }
  }

  candidates.sort((left, right) => right.strength - left.strength);
  if (!candidates[0] || (candidates[1] && candidates[0].strength - candidates[1].strength < 0.15)) return new Map();
  const best = candidates[0];
  const resolution: HierarchicalListResolution = new Map();
  for (const [answerId, match] of best.targetOnly) {
    resolution.set(answerId, {
      adjustment: 0,
      evidence: {
        answerId,
        page: match!.child.page,
        text: `${best.target.label}: ${match!.child.text}`,
        score: 20.8 + (match?.quality ?? 0) * 4.2,
        kind: "hierarchical_list_member",
      },
    });
  }
  for (const answerId of best.siblingOnly) {
    if (!resolution.has(answerId)) resolution.set(answerId, { adjustment: -7.5, evidence: null });
  }
  return resolution;
}
