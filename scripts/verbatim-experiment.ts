import { readFile } from "node:fs/promises";
import { loadDataset, groupSplit } from "./cases.js";
import { extractPdfText } from "../src/pdf.js";
import { DEFAULT_CONFIG } from "../src/predictor/config.js";
import { createPredictorEngine } from "../src/predictor.js";
import type { AnswerOption } from "../src/predictor/types.js";
import {
  continuationAnchor as anchor, literalTokens as literal, QuotedContinuationProcessor,
} from "../src/predictor/scorers/quoted-continuation/index.js";

function continuation(pages: string[], question: string, answers: AnswerOption[]) {
  const tail = anchor(question);
  if (!tail) return null;
  const matches = answers.filter(answer => {
    const phrase = literal(answer.text);
    return phrase && [" ", " : ", " - "].some(join =>
      pages.some(page => page.includes(` ${tail}${join}${phrase} `)));
  });
  return matches.length === 1 ? [matches[0].id] : null;
}

function minimalPair(pages: string[], answers: AnswerOption[]) {
  if (answers.length < 2) return null;
  const options = answers.map(answer => literal(answer.text).split(" "));
  const template = options[0];
  if (template.filter(word => /^\p{L}+$/u.test(word)).length < 6) return null;
  const varying = template.filter((word, i) => options.some(option => option[i] !== word));
  if (options.some(option => option.length !== template.length) || !varying.length || varying.length > 2) return null;
  const matches = answers.filter((_, i) => pages.some(page => page.includes(` ${options[i].join(" ")} `)));
  return matches.length === 1 ? [matches[0].id] : null;
}

function closedEnumeration(pages: string[], question: string, answers: AnswerOption[]) {
  const tail = anchor(question);
  if (!tail) return null;
  const marker = ` ${tail} : `;
  const options = answers.map(answer => ({ id: answer.id, phrase: literal(answer.text) }));
  const sets = new Map<string, string[]>();
  for (const page of pages) {
    let offset = page.indexOf(marker);
    while (offset >= 0) {
      let rest = page.slice(offset + marker.length);
      const ids = new Set<string>();
      while (true) {
        const matches = options.filter(({ phrase }) => phrase && rest.startsWith(phrase + " "));
        if (matches.length !== 1 || ids.has(matches[0].id)) break;
        ids.add(matches[0].id);
        rest = rest.slice(matches[0].phrase.length + 1);
        if (/^[.!?](?: |$)/u.test(rest)) {
          const selected = [...ids].sort();
          if (selected.length >= 2) sets.set(JSON.stringify(selected), selected);
          break;
        }
        const separator = /^(?:, (?:и )?|; |и )/u.exec(rest);
        if (!separator) break;
        rest = rest.slice(separator[0].length);
      }
      offset = page.indexOf(marker, offset + marker.length);
    }
  }
  return sets.size === 1 ? [...sets.values()][0] : null;
}

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every(id => b.includes(id));
}

const splitName = process.argv[2] ?? "dev";
const enabled = (process.argv[3] ?? "continuation,minimalPair,closedEnumeration").split(",");
const candidates = ["continuation", "minimalPair", "closedEnumeration", "uniqueContinuation"];
if (enabled.some(name => !candidates.includes(name))) throw new Error("Unknown candidate");
if (!["train", "dev", "holdout", "external"].includes(splitName)) throw new Error("Unknown split");
const { groups, cases } = await loadDataset();
const splits = groupSplit(groups);
const summary = Object.fromEntries(enabled.map(name => [name, { hits: 0, changed: 0, fixed: 0, broken: 0 }]));
for (const group of splits[splitName] as Set<string>) {
  const keyed = cases.filter(item => item.pdfGroup === group && item.expectedIds.length);
  if (!keyed.length) continue;
  const pdfData = await readFile(keyed[0].pdfPath);
  const document = await extractPdfText(pdfData, DEFAULT_CONFIG);
  const pages = document.pages.map(page => ` ${literal(page.text)} `);
  const engine = createPredictorEngine();
  const resolver = new QuotedContinuationProcessor();
  const hits = [];
  for (const item of keyed) {
    const rules: Record<string, () => string[] | null> = item.mode === "multi"
      ? { closedEnumeration: () => closedEnumeration(pages, item.question, item.answers) }
      : {
        continuation: () => continuation(pages, item.question, item.answers),
        minimalPair: () => minimalPair(pages, item.answers),
        uniqueContinuation: () => {
          const quote = resolver.resolve(document.pages, item.question, item.answers);
          return quote ? [quote.answerId] : null;
        },
      };
    const active = enabled.flatMap(name => {
      const selected = rules[name]?.();
      return selected ? [{ name, selected }] : [];
    });
    if (!active.length) continue;
    const input = { pdfData, cacheKey: group, mode: item.mode, question: item.question, answers: item.answers };
    const control = await engine.predict(input, { includeSources: false, quotedContinuation: false });
    for (const { name, selected } of active) {
      const changed = !sameSet(selected, control.selected);
      const before = sameSet(control.selected, item.expectedIds);
      const after = sameSet(selected, item.expectedIds);
      hits.push({ name, id: item.id, changed, before, after });
      const stats = summary[name];
      stats.hits++;
      if (changed) stats.changed++;
      if (!before && after) stats.fixed++;
      if (before && !after) stats.broken++;
    }
  }
  engine.clearCache();
  console.log(JSON.stringify({ split: splitName, group, total: keyed.length, hits }));
}
console.error(JSON.stringify({ split: splitName, summary }));
