import { normalizeForSearch, uniqueTokens } from "../../normalize.js";
import { FOCUS_STOPWORDS } from "../constants.js";
import { answerSearchPhrases, containsNormalizedPhrase, strictSoftCoverage, tokenHitCount } from "../text-utils.js";

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

export type HierarchicalListResolution = Map<
  string,
  {
    adjustment: number;
    evidence: { answerId: string; page: number; text: string; score: number; kind: string } | null;
  }
>;

const ROMAN_PARENT = /^\s*[ivx]{1,8}\.\s+(.{4,240}?)(?::\s*)?$/iu;
const NUMBERED_CHILD = /^\s*\d{1,2}[.)]\s+(.+)$/u;
const GENERIC = new Set(
  uniqueTokens(
    "грыжа заболевание состояние пациент форма формы тип типа виды вид группа классификация вариант варианты пищеводное отверстие диафрагма",
  ),
);

function flattenLines(pages: any[]) {
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

function parentLabel(text: string) {
  const match = ROMAN_PARENT.exec(String(text ?? ""));
  return match?.[1]?.replace(/\s+/gu, " ").trim() ?? null;
}

function childStart(text: string) {
  const match = NUMBERED_CHILD.exec(String(text ?? ""));
  return match?.[1]?.replace(/\s+/gu, " ").trim() ?? null;
}

function childBoundary(text: string) {
  const clean = normalizeForSearch(text);
  return (
    /^\s*[-\u2010-\u2015\u2022\u25aa\u25e6*]\s+/u.test(String(text ?? "")) ||
    /^(?:ууд|уур|комментари|примечани)(?:\s|[-\u2013\u2014:])/u.test(clean) ||
    /^\s*\d+(?:\.\d+)+\.?\s+\S/u.test(String(text ?? ""))
  );
}

/** Reconstructs consecutive `I. parent -> 1) child` physical-line trees. */
export function buildHierarchicalListClusters(pages: any[]): HierarchyParent[][] {
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

function informative(tokens: string[]) {
  return tokens.filter((token) => token.length >= 3 && !FOCUS_STOPWORDS.has(token) && !GENERIC.has(token) && !/^\d+$/u.test(token));
}

function commonLabelTokens(cluster: HierarchyParent[]) {
  const common = new Set(informative(cluster[0].labelTokens));
  for (const parent of cluster.slice(1)) {
    const tokens = new Set(informative(parent.labelTokens));
    for (const token of [...common]) if (!tokens.has(token)) common.delete(token);
  }
  return common;
}

function parentQuestionMatch(question: string, parent: HierarchyParent, common: Set<string>) {
  const questionTokens = uniqueTokens(question);
  const distinctive = informative(parent.labelTokens).filter((token) => !common.has(token));
  if (!distinctive.length) return 0;
  const hits = tokenHitCount(distinctive, questionTokens);
  const coverage = strictSoftCoverage(distinctive, questionTokens);
  const phrase = containsNormalizedPhrase(normalizeForSearch(question), normalizeForSearch(parent.label));
  if (!phrase && (hits < 1 || coverage < 0.5)) return 0;
  return Math.max(phrase ? 1 : 0, coverage) + Math.min(0.35, hits * 0.08);
}

function baseChildText(text: string) {
  return text.replace(/\s*\([^)]*\)\s*[;.]?\s*$/u, "").trim();
}

function childTokenFrequency(cluster: HierarchyParent[]) {
  const frequency = new Map<string, number>();
  const children = cluster.flatMap((parent) => parent.children);
  for (const child of children) {
    for (const token of new Set(informative(uniqueTokens(baseChildText(child.text))))) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  return { frequency, total: children.length };
}

function distinctiveChildTokens(text: string, frequency: Map<string, number>, total: number) {
  const tokens = informative(uniqueTokens(baseChildText(text)));
  const distinctive = tokens.filter((token) => (frequency.get(token) ?? 0) < Math.max(2, Math.ceil(total * 0.55)));
  return distinctive.length ? distinctive : tokens;
}

function childAnswerMatch(
  answer: AnswerOption,
  child: HierarchyChild,
  frequency: Map<string, number>,
  total: number,
) {
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
  return {
    matched: phrase || (childCoverage >= 0.72 && answerCoverage >= 0.6),
    quality: Math.max(phrase ? 1 : 0, quality) + exactQuality * 0.28,
  };
}

function bestChildMatch(
  answer: AnswerOption,
  children: HierarchyChild[],
  frequency: Map<string, number>,
  total: number,
) {
  return children
    .map((child) => ({ child, ...childAnswerMatch(answer, child, frequency, total) }))
    .filter((item) => item.matched)
    .sort((left, right) => right.quality - left.quality)[0] ?? null;
}

export function resolveHierarchicalList({
  mode,
  pages,
  question,
  answers,
}: {
  mode: string;
  pages: any[];
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
