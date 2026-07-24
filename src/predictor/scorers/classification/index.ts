import {
  coverage,
  extractNumbers,
  normalizeForSearch,
  normalizeText,
  tokenize,
  uniqueTokens,
} from "../../../normalize.js";
import { FOCUS_STOPWORDS, LABEL_CUES } from "../../constants.js";
import {
  answerSearchPhrases,
  betterEvidence,
  containsNormalizedPhrase,
  evidenceSnippet,
  expandNumberToken,
  findPhraseOccurrences,
  numberCoverage,
  pageWindow,
  proximityBonus,
  rawSoftCoverage,
  softCoverage,
  strictSoftCoverage,
  tokenHitCount,
  tokenizeNormalized,
} from "../../text-utils.js";

function questionLabelCues(question) {
  const normalized = normalizeForSearch(question);
  return LABEL_CUES.filter((cue) => normalized.includes(cue));
}

export function bestLabelNumberSupport({ pages, topQuestionPages, question, answer }) {
  const labels = questionLabelCues(question);
  if (/мкб/u.test(normalizeText(question))) return null;
  if (!labels.length || !extractNumbers(answer.text).length) return null;
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 12);
  let best = null;
  for (const page of pages) {
    if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
    const pageNorm = page.normalized;
    const labelHits = [];
    for (const label of labels) {
      let start = 0;
      while (start < pageNorm.length) {
        const index = pageNorm.indexOf(label, start);
        if (index < 0) break;
        const around = pageNorm.slice(Math.max(0, index - 24), index + 48);
        if (!containsNormalizedPhrase(around, "степени тяжести")) labelHits.push(index);
        start = index + Math.max(1, label.length);
      }
    }
    if (!labelHits.length) continue;
    for (const phrase of answerPhrases) {
      const hits = findPhraseOccurrences(pageNorm, phrase, { textIsNormalized: true });
      for (const hit of hits) {
        const forwardDistances = labelHits.map((labelHit) => hit - labelHit).filter((distance) => distance >= 0);
        if (!forwardDistances.length) continue;
        const distance = Math.min(...forwardDistances);
        if (distance > 150) continue;
        const local = pageWindow(page, hit, 180);
        const score = 6.6 + proximityBonus(distance, 150) * 4.4 + numberCoverage(answer.text, local) * 1.4;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: evidenceSnippet(page.text, phrase, question),
          score,
          kind: "label_number_proximity",
        });
      }
    }
  }
  return best;
}

const CLASSIFICATION_CODE_QUESTION_CUES = [
  "\u043a\u043e\u0434",
  "\u043a\u043e\u0434\u0438\u0440",
  "\u043c\u043a\u0431",
].map((item) => normalizeForSearch(item));

const CLASSIFICATION_CODE_GENERIC_TOKENS = new Set(
  [
    "\u043a\u043e\u0434",
    "\u043a\u043e\u0434\u0438\u0440\u0443\u0435\u0442\u0441\u044f",
    "\u043a\u043e\u0434\u0438\u0440\u043e\u0432\u043a\u0430",
    "\u043c\u043a\u0431",
    "\u043c\u0435\u0436\u0434\u0443\u043d\u0430\u0440\u043e\u0434\u043d\u043e\u0439",
    "\u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043a\u043e\u0439",
    "\u043a\u043b\u0430\u0441\u0441\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u0438",
    "\u0431\u043e\u043b\u0435\u0437\u043d\u0435\u0439",
    "\u043f\u0440\u043e\u0431\u043b\u0435\u043c",
    "\u0441\u0432\u044f\u0437\u0430\u043d\u043d\u044b\u0445",
    "\u0437\u0434\u043e\u0440\u043e\u0432\u044c\u0435\u043c",
    "\u043a\u0440\u0438\u0442\u0435\u0440\u0438\u0439",
    "\u043a\u0440\u0438\u0442\u0435\u0440\u0438\u0438",
    "\u0443\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442",
    "\u0441\u0432\u0438\u0434\u0435\u0442\u0435\u043b\u044c\u0441\u0442\u0432\u0443\u0435\u0442",
    "\u043e\u0442\u0440\u0430\u0436\u0430\u0435\u0442",
    "\u043f\u0440\u0438\u0437\u043d\u0430\u043a\u0438",
    "\u0441\u0442\u0430\u0434\u0438\u044f",
  ].flatMap((item) => uniqueTokens(item)),
);

const CYRILLIC_CODE_LETTERS = new Map([
  ["\u0410", "a"],
  ["\u0412", "b"],
  ["\u0421", "c"],
  ["\u0415", "e"],
  ["\u041d", "h"],
  ["\u041a", "k"],
  ["\u041c", "m"],
  ["\u041e", "o"],
  ["\u0420", "p"],
  ["\u0422", "t"],
  ["\u0425", "x"],
  ["\u0430", "a"],
  ["\u0432", "b"],
  ["\u0441", "c"],
  ["\u0435", "e"],
  ["\u043d", "h"],
  ["\u043a", "k"],
  ["\u043c", "m"],
  ["\u043e", "o"],
  ["\u0440", "p"],
  ["\u0442", "t"],
  ["\u0445", "x"],
]);

function canonicalClassificationCode(text) {
  const normalized = String(text ?? "").normalize("NFKC");
  const match = normalized.match(/(?:^|[^\p{L}\p{N}])([A-Za-z\u0410-\u042f\u0430-\u044f])\s*\.?\s*(\d{1,3})(?:\s*[.]\s*(\d{1,2}))?(?![\p{L}\p{N}])/u);
  if (!match) return null;
  const letter = (CYRILLIC_CODE_LETTERS.get(match[1]) ?? match[1]).toLowerCase();
  if (!/[a-z]/.test(letter)) return null;
  const main = match[2].replace(/^0+(?=\d)/, "");
  const sub = match[3]?.replace(/^0+(?=\d)/, "");
  return sub ? `${letter}${main}.${sub}` : `${letter}${main}`;
}

function canonicalClassificationCodes(text) {
  const normalized = String(text ?? "").normalize("NFKC");
  const codes = [];
  const pattern = /(?:^|[^\p{L}\p{N}])([A-Za-z\u0410-\u042f\u0430-\u044f])\s*\.?\s*(\d{1,3})(?:\s*[.]\s*(\d{1,2}))?(?![\p{L}\p{N}])/gu;
  let match;
  while ((match = pattern.exec(normalized))) {
    const code = canonicalClassificationCode(match[0]);
    if (code) codes.push(code);
  }
  const ocrJPattern = /(?:^|[^\p{L}\p{N}])(?:[.\u041b\u043b])\s*\.?\s*(\d{2,3})(?:\s*[.]\s*(\d{1,2}))?(?![\p{L}\p{N}])/gu;
  while ((match = ocrJPattern.exec(normalized))) {
    const main = match[1].length === 3 && match[1].startsWith("1") ? match[1].slice(1) : match[1];
    if (/^\d{2}$/.test(main)) {
      const sub = match[2]?.replace(/^0+(?=\d)/, "");
      codes.push(sub ? `j${main}.${sub}` : `j${main}`);
    }
  }
  return codes;
}

function classificationCodeWindows(page) {
  const lines = page.lines ?? [];
  const windows = [];
  for (let index = 0; index < lines.length; index += 1) {
    const parts = [lines[index], lines[index + 1], lines[index + 2]].filter(Boolean);
    const one = parts[0]?.trim();
    const two = parts.slice(0, 2).join(" ").replace(/\s+/g, " ").trim();
    const three = parts.join(" ").replace(/\s+/g, " ").trim();
    if (one && one.length >= 4) windows.push(one);
    if (two.length >= 12) windows.push(two);
    if (three.length >= 24) windows.push(three);
  }
  return [...new Set(windows)];
}

export function bestClassificationCodeSupport({ pages, topQuestionPages, question, answer, questionTokens, focusTokens }) {
  const code = canonicalClassificationCode(answer.text);
  if (!code) return null;
  const normalizedQuestion = normalizeForSearch(question);
  const isCodeQuestion = CLASSIFICATION_CODE_QUESTION_CUES.some((cue) => normalizedQuestion.includes(cue));
  if (!isCodeQuestion) return null;

  const filteredFocus = focusTokens
    .filter((token) => token.length >= 3 && !CLASSIFICATION_CODE_GENERIC_TOKENS.has(token) && !/^\d/.test(token))
    .slice(0, 12);
  const filteredQuestion = questionTokens
    .filter((token) => token.length >= 3 && !CLASSIFICATION_CODE_GENERIC_TOKENS.has(token) && !/^\d/.test(token))
    .slice(0, 18);
  if (!filteredFocus.length && !filteredQuestion.length) return null;

  let best = null;
  for (const page of pages) {
    if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
    for (const windowText of classificationCodeWindows(page)) {
      const codes = canonicalClassificationCodes(windowText);
      if (!codes.includes(code)) continue;
      const tokens = tokenize(windowText);
      const focusCoverage = filteredFocus.length ? coverage(filteredFocus, tokens) : 0;
      const questionCoverage = filteredQuestion.length ? coverage(filteredQuestion, tokens) : 0;
      if (focusCoverage < 0.22 && questionCoverage < 0.18) continue;
      const codeCountPenalty = Math.max(0, new Set(codes).size - 1) * 0.9;
      const score = 12.8 + focusCoverage * 11 + questionCoverage * 6 + (codes[0] === code ? 1.2 : 0) - codeCountPenalty;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text: evidenceSnippet(page.text, answer.text, question),
        score,
        kind: "classification_code_segment",
      });
    }
  }
  return best;
}

const MKB_CLASS_EXCLUSION_GENERIC_TOKENS = new Set(
  [
    "\u0437\u043b\u043e\u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0435",
    "\u0437\u043b\u043e\u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u0430\u044f",
    "\u043d\u043e\u0432\u043e\u043e\u0431\u0440\u0430\u0437\u043e\u0432\u0430\u043d\u0438\u044f",
    "\u043d\u043e\u0432\u043e\u043e\u0431\u0440\u0430\u0437\u043e\u0432\u0430\u043d\u0438\u0435",
    "\u043a\u043e\u0436\u0438",
    "\u043a\u043e\u0436\u0430",
    "\u0434\u0440\u0443\u0433\u0438\u0435",
    "\u043a\u043b\u0430\u0441\u0441",
    "\u043c\u043a\u0431",
  ].flatMap((item) => uniqueTokens(item)),
);

function mkbClassExclusionQuestion(mode, question) {
  if (mode !== "multi") return false;
  const normalized = normalizeForSearch(question);
  const hasMkb = containsNormalizedPhrase(normalized, "\u043c\u043a\u0431");
  const hasClass = containsNormalizedPhrase(normalized, "\u043a\u043b\u0430\u0441\u0441");
  const asksExcluded =
    containsNormalizedPhrase(normalized, "\u043d\u0435 \u0432\u043a\u043b\u044e\u0447") ||
    containsNormalizedPhrase(normalized, "\u0438\u0441\u043a\u043b\u044e\u0447") ||
    containsNormalizedPhrase(normalized, "\u043d\u0435 \u043e\u0442\u043d\u043e\u0441");
  return hasMkb && hasClass && asksExcluded && Boolean(questionMkbClassCode(question));
}

function questionMkbClassCode(question) {
  return canonicalClassificationCodes(question).find((code) => !code.includes(".")) ?? null;
}

function sameMkbClass(code, classCode) {
  return code === classCode || code.startsWith(`${classCode}.`);
}

function lineHasMkbClass(line, classCode) {
  return canonicalClassificationCodes(line).some((code) => sameMkbClass(code, classCode));
}

function mkbClassSectionLines(pages, topQuestionPages, classCode) {
  let startPageIndex = -1;
  let startLineIndex = -1;
  const candidates = topQuestionPages?.size ? pages.filter((page) => topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1)) : pages;

  for (const page of candidates) {
    const lines = page.lines ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      if (!lineHasMkbClass(lines[index], classCode)) continue;
      startPageIndex = pages.findIndex((candidate) => candidate.page === page.page);
      startLineIndex = index;
      break;
    }
    if (startPageIndex >= 0) break;
  }
  if (startPageIndex < 0) return [];

  const out = [];
  for (let pageIndex = startPageIndex; pageIndex < Math.min(pages.length, startPageIndex + 3); pageIndex += 1) {
    const lines = pages[pageIndex].lines ?? [];
    const from = pageIndex === startPageIndex ? startLineIndex : 0;
    for (let index = from; index < lines.length; index += 1) {
      const line = lines[index];
      if (out.length && /^\s*\d+(?:\.\d+)+\s+/u.test(normalizeText(line)) && !lineHasMkbClass(line, classCode)) return out;
      out.push(line);
      if (out.length >= 90) return out;
    }
  }
  return out;
}

function mkbClassIncludedRows(sectionLines, classCode) {
  const rows = [];
  for (let index = 0; index < sectionLines.length; index += 1) {
    const line = sectionLines[index];
    const codes = canonicalClassificationCodes(line);
    if (!codes.some((code) => code.startsWith(`${classCode}.`))) continue;
    const row = [line];
    for (let next = index + 1; next < Math.min(sectionLines.length, index + 4); next += 1) {
      const nextLine = sectionLines[next];
      const nextCodes = canonicalClassificationCodes(nextLine);
      if (nextCodes.some((code) => sameMkbClass(code, classCode))) break;
      if (containsNormalizedPhrase(normalizeForSearch(nextLine), "\u0438\u0441\u043a\u043b\u044e\u0447")) break;
      row.push(nextLine);
      if (/[.;:]$/u.test(normalizeText(nextLine))) break;
    }
    rows.push(row.join(" ").replace(/\s+/g, " ").trim());
  }
  return rows;
}

function mkbClassAnswerTokens(answerText) {
  return uniqueTokens(answerText).filter((token) => token.length >= 4 && !MKB_CLASS_EXCLUSION_GENERIC_TOKENS.has(token) && !FOCUS_STOPWORDS.has(token));
}

function mkbClassIncludedRowHit(row, answerText) {
  const tokens = mkbClassAnswerTokens(answerText);
  if (!tokens.length) return false;
  const rowTokens = tokenize(row);
  const strict = strictSoftCoverage(tokens, rowTokens);
  const soft = softCoverage(tokens, rowTokens);
  const raw = rawSoftCoverage(tokens, tokenize(row, { keepStopwords: true, stem: false }));
  const threshold = tokens.length <= 1 ? 1 : 0.58;
  return Math.max(strict, soft, raw) >= threshold;
}

export function bestMkbClassExclusionSupport({ pages, topQuestionPages, mode, question, answer }) {
  if (!mkbClassExclusionQuestion(mode, question)) return { support: null, adjustment: 0, evidence: null };
  const classCode = questionMkbClassCode(question);
  if (!classCode) return { support: null, adjustment: 0, evidence: null };
  const sectionLines = mkbClassSectionLines(pages, topQuestionPages, classCode);
  if (sectionLines.length < 3) return { support: null, adjustment: 0, evidence: null };
  const includedRows = mkbClassIncludedRows(sectionLines, classCode);
  if (includedRows.length < 2) return { support: null, adjustment: 0, evidence: null };
  const includedRow = includedRows.find((row) => mkbClassIncludedRowHit(row, answer.text));
  if (includedRow) {
    return {
      support: null,
      adjustment: -9.4,
      evidence: {
        answerId: answer.id,
        page: topQuestionPages?.values().next().value ?? 0,
        text: includedRow,
        score: 17.2,
        kind: "mkb_class_included_mismatch",
      },
    };
  }
  const sectionText = sectionLines.join(" ").replace(/\s+/g, " ").trim();
  return {
    support: {
      answerId: answer.id,
      page: topQuestionPages?.values().next().value ?? 0,
      text: sectionText.slice(0, 900),
      score: 15.8,
      kind: "mkb_class_exclusion_absent",
    },
    adjustment: 0,
    evidence: null,
  };
}

function canonicalShortLabel(value) {
  const compact = String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.\s_\-–—]+/g, "")
    .replace(/[тТ]/g, "t")
    .replace(/[мМ]/g, "m")
    .replace(/[хХ]/g, "x")
    .replace(/[оОoO]/g, "0")
    .replace(/[аА]/g, "a")
    .replace(/[вВ]/g, "b");
  return compact.replace(/[^a-z0-9]/g, "");
}

function questionShortLabels(question) {
  const text = String(question ?? "").normalize("NFKC");
  const labels = new Set<string>();
  const patterns = [
    /(?<![\p{L}\p{N}])[TТ]\s*(?:is|[0-4xхoо])\s*[abаАвВ]?(?![\p{L}\p{N}])/giu,
    /(?<![\p{L}\p{N}])[NН]\s*(?:[0-3xхoо])\s*[abаАвВ]?(?![\p{L}\p{N}])/giu,
    /(?<![\p{L}\p{N}])[MМ]\s*(?:[0-1xхoо])\s*[abаАвВ]?(?![\p{L}\p{N}])/giu,
    /(?<![\p{L}\p{N}])(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\s*[abаАвВ]?(?![\p{L}\p{N}])/giu,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const label = canonicalShortLabel(match[0]);
      if (label.length >= 2 && label.length <= 5) labels.add(label);
    }
  }
  return [...labels];
}

function lineShortLabels(text) {
  const raw = String(text ?? "").normalize("NFKC");
  const labels = new Set<string>(questionShortLabels(raw));
  const compact = canonicalShortLabel(raw);
  if (/^[tnm](?:is|[0-4x])(?:[ab])?$/.test(compact)) labels.add(compact);
  if (/^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)(?:[ab])?$/.test(compact)) labels.add(compact);
  return [...labels];
}

function visualRowText(lines, index) {
  const start = Math.max(0, index - 2);
  const end = Math.min(lines.length, index + 4);
  return lines
    .slice(start, end)
    .map((line) => line.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const VISUAL_TABLE_COLUMN_GENERIC_FOCUS = new Set(
  uniqueTokens(
    [
      "признаки критерии относятся следующие показатель показатели таблица согласно классификация",
      "значение значения характерны является являются включает включают",
    ].join(" "),
  ),
);

const VISUAL_TABLE_METRIC_STOP = new Set(uniqueTokens("мм мг мл г л ч мин сутки день дней раз более менее выше ниже или норма"));
const VISUAL_TABLE_COLUMN_CUE_TOKENS = new Set(
  uniqueTokens("легкая легкой средняя средней среднетяжелая среднетяжелой тяжелая тяжелой степень степени стадия стадии класс класса категория категории группа тип форма"),
);

export function hasVisualTableColumnCue(question, focusTokens) {
  const tokens = [...new Set([...(focusTokens ?? []), ...uniqueTokens(question)])];
  return tokens.some((token) => VISUAL_TABLE_COLUMN_CUE_TOKENS.has(token));
}

function visualTableColumnFocusTokens(focusTokens, question) {
  const out = [];
  for (const token of [...(focusTokens ?? []), ...uniqueTokens(question)]) {
    if (!token || token.length < 4) continue;
    if (FOCUS_STOPWORDS.has(token) || VISUAL_TABLE_COLUMN_GENERIC_FOCUS.has(token)) continue;
    if (!out.includes(token)) out.push(token);
  }
  return out.slice(0, 10);
}

function lineXSpread(line) {
  const xs = (line?.items ?? []).map((item) => item.x ?? 0);
  if (xs.length < 2) return 0;
  return Math.max(...xs) - Math.min(...xs);
}

function visualTableColumnTargets(page, question, focusTokens) {
  const focus = visualTableColumnFocusTokens(focusTokens, question);
  if (!focus.length) return [];
  const targets = [];
  const lines = page?.lineItems ?? [];
  for (const line of lines) {
    if ((line.items?.length ?? 0) < 3 || lineXSpread(line) < 140) continue;
    if (String(line.text ?? "").length > 220) continue;
    const lineNorm = normalizeForSearch(line.text);
    if (containsNormalizedPhrase(lineNorm, "рекоменду") || /pekom/iu.test(lineNorm)) continue;
    for (const item of line.items ?? []) {
      if (String(item.text ?? "").length > 90) continue;
      const itemTokens = uniqueTokens(item.text);
      const hits = tokenHitCount(focus, itemTokens);
      const required = focus.length >= 2 ? 2 : 1;
      if (hits < required) continue;
      targets.push({
        x: item.x ?? 0,
        text: line.text,
        page: page.page,
      });
    }
  }
  return targets;
}

function visualTableTargetsNearPage(pages, page, question, focusTokens) {
  const out = [];
  for (const candidate of pages) {
    if (candidate.page !== page.page && candidate.page !== page.page - 1) continue;
    out.push(...visualTableColumnTargets(candidate, question, focusTokens));
  }
  return out;
}

export function buildVisualTableColumnTargetsByPage(pages, question, focusTokens, topQuestionPages) {
  const byPage = new Map();
  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    const targets = visualTableTargetsNearPage(pages, page, question, focusTokens);
    if (targets.length) byPage.set(page.page, targets);
  }
  return byPage;
}

function answerMetricTokens(answerText) {
  return uniqueTokens(answerText).filter((token) => {
    if (!token || token.length < 3) return false;
    if (/^\d/u.test(token)) return false;
    if (VISUAL_TABLE_METRIC_STOP.has(token) || FOCUS_STOPWORDS.has(token)) return false;
    return true;
  });
}

function comparatorSigns(text) {
  const signs = new Set<string>();
  const raw = String(text ?? "");
  if (/[<≤]/u.test(raw)) signs.add("<");
  if (/[>≥]/u.test(raw)) signs.add(">");
  return signs;
}

function visualValueMatchesAnswer(itemText, answerText) {
  const numericCoverage = numberCoverage(answerText, normalizeForSearch(itemText));
  if (numericCoverage <= 0) return false;
  const expandedAnswerNumbers = [...new Set(extractNumbers(answerText).flatMap(expandNumberToken))];
  if (expandedAnswerNumbers.length > 1 && numericCoverage < 0.99) return false;
  const answerSigns = comparatorSigns(answerText);
  if (!answerSigns.size) return true;
  const itemSigns = comparatorSigns(itemText);
  return [...answerSigns].some((sign) => itemSigns.has(sign));
}

function targetCellText(line, targetX) {
  return (line.items ?? [])
    .filter((item) => Math.abs((item.x ?? 0) - targetX) <= 52)
    .map((item) => item.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function nearbyMetricText(lines, index, targetX) {
  const baseY = lines[index]?.y ?? 0;
  const parts = [];
  for (let offset = -2; offset <= 2; offset += 1) {
    const line = lines[index + offset];
    if (!line) continue;
    if (Math.abs((line.y ?? baseY) - baseY) > 28) continue;
    for (const item of line.items ?? []) {
      if ((item.x ?? 0) < targetX - 45) parts.push(item.text);
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function bestVisualTableColumnSupport({ mode, pages, topQuestionPages, question, answer, focusTokens, visualTableColumnTargetsByPage }) {
  if (mode !== "multi" || !extractNumbers(answer.text).length) return null;
  if (!visualTableColumnTargetsByPage) return null;
  const metricTokens = answerMetricTokens(answer.text);
  if (!metricTokens.length) return null;
  let best = null;

  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    const targets = visualTableColumnTargetsByPage.get(page.page) ?? [];
    if (!targets.length) continue;
    const lines = page.lineItems ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      for (const target of targets) {
        for (const item of line.items ?? []) {
          const xDistance = Math.abs((item.x ?? 0) - target.x);
          if (xDistance > 48) continue;
          const cellText = targetCellText(line, target.x) || item.text;
          if (!visualValueMatchesAnswer(cellText, answer.text)) continue;
          const metricText = nearbyMetricText(lines, index, target.x);
          const metricDocTokens = uniqueTokens(metricText);
          const metricHits = tokenHitCount(metricTokens, metricDocTokens);
          const metricCoverage = coverage(metricTokens, metricDocTokens);
          if (metricHits < 1 && metricCoverage < 0.34) continue;
          const score =
            15.2 +
            proximityBonus(xDistance, 48) * 3.0 +
            Math.min(3, metricHits) * 1.8 +
            Math.min(0.8, metricCoverage) * 4.2 +
            numberCoverage(answer.text, normalizeForSearch(cellText)) * 2.2;
          best = betterEvidence(best, {
            answerId: answer.id,
            page: page.page,
            text: `${target.text} ${metricText} ${cellText}`.replace(/\s+/g, " ").trim(),
            score,
            kind: "visual_table_column",
          });
        }
      }
    }
  }

  return best;
}

function lineStartX(line) {
  return line?.items?.[0]?.x ?? 0;
}

function linePrefixShortLabels(line) {
  const prefix = (line?.items ?? [])
    .slice(0, 3)
    .map((item) => item.text)
    .join(" ");
  return lineShortLabels(prefix || String(line?.text ?? "").slice(0, 24));
}

function lineStartsWithShortLabelStem(line) {
  const first = canonicalShortLabel(line?.items?.[0]?.text ?? "");
  return /^[tnm]$/.test(first) || /^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)$/.test(first);
}

function splitShortLabelSuffix(line) {
  const compact = canonicalShortLabel(line?.items?.[0]?.text ?? line?.text ?? "");
  if (/^(?:is|[0-4x]|[0-4][ab]?)$/.test(compact)) return compact;
  if (/^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)[ab]?$/.test(compact)) return compact;
  return null;
}

function lineExactShortLabels(lines, index) {
  const labels = new Set(linePrefixShortLabels(lines[index]));
  if (lineStartsWithShortLabelStem(lines[index]) && index + 1 < lines.length) {
    const suffix = splitShortLabelSuffix(lines[index + 1]);
    if (suffix && Math.abs(lineStartX(lines[index + 1]) - lineStartX(lines[index])) <= 18) {
      const stem = lines[index]?.items?.[0]?.text ?? "";
      for (const label of lineShortLabels(`${stem} ${suffix}`)) labels.add(label);
    }
  }
  return [...labels];
}

function visualExactLabelRowText(lines, index) {
  const row = [];
  const first = lines[index];
  if (!first?.text) return "";
  const startX = lineStartX(first);
  let previousY = first.y ?? 0;

  for (let current = index; current < lines.length && row.length < 8; current += 1) {
    const line = lines[current];
    const text = String(line?.text ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;

    if (current > index) {
      const gap = Math.abs((line?.y ?? previousY) - previousY);
      if (gap > 32) break;
      const startsNewLabel =
        (linePrefixShortLabels(line).length > 0 || lineStartsWithShortLabelStem(line)) && Math.abs(lineStartX(line) - startX) <= 18;
      if (startsNewLabel) break;
      if (lineStartX(line) < startX + 18 && row.length > 1) break;
    }

    previousY = line?.y ?? previousY;
    if (/^\d{1,2}$/.test(text) && lineStartX(line) > startX + 120) continue;
    row.push(text);
  }

  return row.join(" ").replace(/\s+/g, " ").trim();
}

export function bestExactShortLabelRowSupport({ pages, topQuestionPages, question, answer, answerTokens, focusTokens }) {
  const labels = questionShortLabels(question);
  if (!labels.length || !answerTokens.length) return null;
  const answerPhrases = answerSearchPhrases(answer.text);
  const usefulFocusTokens = (focusTokens?.length ? focusTokens : uniqueTokens(question)).filter((token) => token.length > 2);
  const numericAnswer = extractNumbers(answer.text).length > 0;
  const minSupport = numericAnswer ? 0.48 : answerTokens.length <= 2 ? 0.84 : 0.4;
  let best = null;

  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    const lines = page.lineItems ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      const localLabels = lineExactShortLabels(lines, index);
      if (!labels.some((label) => localLabels.includes(label))) continue;

      const text = visualExactLabelRowText(lines, index);
      const normalized = normalizeForSearch(text);
      const tokens = tokenizeNormalized(normalized);
      const answerCoverage = strictSoftCoverage(answerTokens, tokens);
      const numericCoverage = numberCoverage(answer.text, normalized);
      const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(normalized, phrase));
      const answerSupport = Math.max(answerCoverage, numericCoverage, phraseHit ? 1 : 0);
      if (answerSupport < minSupport) continue;

      const focusCoverage = usefulFocusTokens.length ? coverage(usefulFocusTokens, tokens) : 0;
      const score =
        15.8 +
        answerSupport * 8.6 +
        Math.min(0.42, focusCoverage) * 3.1 +
        numericCoverage * 1.6 +
        (phraseHit ? 1.8 : 0);
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text,
        score,
        kind: "short_label_exact_row",
      });
    }
  }

  return best;
}

export function bestShortLabelRowSupport({ pages, topQuestionPages, question, answer, answerTokens, focusTokens }) {
  const labels = questionShortLabels(question);
  if (!labels.length || !answerTokens.length) return null;
  const answerPhrases = answerSearchPhrases(answer.text);
  const usefulFocusTokens = (focusTokens?.length ? focusTokens : uniqueTokens(question)).filter((token) => token.length > 2);
  const numericAnswer = extractNumbers(answer.text).length > 0;
  const minSupport = numericAnswer ? 0.55 : answerTokens.length <= 2 ? 0.86 : 0.34;
  let best = null;

  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    const lines = page.lineItems ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      const localLabels = new Set<string>(lineShortLabels(lines[index]?.text));
      if (index + 1 < lines.length) {
        for (const label of lineShortLabels(`${lines[index].text} ${lines[index + 1].text}`)) localLabels.add(label);
      }
      if (!labels.some((label) => localLabels.has(label))) continue;

      const text = visualRowText(lines, index);
      const normalized = normalizeForSearch(text);
      const tokens = tokenizeNormalized(normalized);
      const answerCoverage = strictSoftCoverage(answerTokens, tokens);
      const numericCoverage = numberCoverage(answer.text, normalized);
      const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(normalized, phrase));
      const answerSupport = Math.max(answerCoverage, numericCoverage, phraseHit ? 1 : 0);
      if (answerSupport < minSupport) continue;

      const focusCoverage = usefulFocusTokens.length ? coverage(usefulFocusTokens, tokens) : 0;
      const score =
        10.4 +
        answerSupport * 7.2 +
        Math.min(0.35, focusCoverage) * 3.0 +
        numericCoverage * 1.2 +
        (phraseHit ? 1.2 : 0);
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text,
        score,
        kind: "short_label_visual_row",
      });
    }
  }

  return best;
}
