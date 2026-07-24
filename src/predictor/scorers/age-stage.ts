import {
  coverage,
  extractNumbers,
  normalizeForSearch,
  uniqueTokens,
} from "../../normalize.js";
import {
  answerSearchPhrases,
  betterEvidence,
  cachedLineWindowSegments,
  containsNormalizedPhrase,
  escapeRegExp,
  expandNumberToken,
  hasSearchBoundaries,
  numberCoverage,
  rawTokens,
  strictSoftCoverage,
  tokenHitCount,
  tokenSequenceIncludes,
  tokenizeNormalized,
} from "../text-utils.js";
import { answerOrdinalRowApplicable } from "./ordinal-row-gate.js";
import { ordinalValueToNumber, romanStageVariants } from "./ordinal-utils.js";

function questionAgeFormCues(question) {
  const normalized = normalizeForSearch(question);
  if (!containsNormalizedPhrase(normalized, "\u0432\u043e\u0437\u0440\u0430\u0441\u0442") || !containsNormalizedPhrase(normalized, "\u0444\u043e\u0440\u043c")) return null;
  if (containsNormalizedPhrase(normalized, "\u043f\u043e\u0434\u0440\u043e\u0441\u0442") || containsNormalizedPhrase(normalized, "\u0432\u0437\u0440\u043e\u0441\u043b")) {
    return ["\u043f\u043e\u0434\u0440\u043e\u0441\u0442", "\u0432\u0437\u0440\u043e\u0441\u043b"].map((item) => normalizeForSearch(item));
  }
  if (containsNormalizedPhrase(normalized, "\u043f\u043e\u0437\u0434") && containsNormalizedPhrase(normalized, "\u043c\u043b\u0430\u0434\u0435\u043d")) {
    return ["\u043f\u043e\u0437\u0434", "\u043c\u043b\u0430\u0434\u0435\u043d"].map((item) => normalizeForSearch(item));
  }
  if (containsNormalizedPhrase(normalized, "\u0440\u0430\u043d") && containsNormalizedPhrase(normalized, "\u043c\u043b\u0430\u0434\u0435\u043d")) {
    return ["\u0440\u0430\u043d", "\u043c\u043b\u0430\u0434\u0435\u043d"].map((item) => normalizeForSearch(item));
  }
  if (containsNormalizedPhrase(normalized, "\u044e\u0432\u0435\u043d")) {
    return ["\u044e\u0432\u0435\u043d"].map((item) => normalizeForSearch(item));
  }
  return null;
}

function ageFormLabelIndex(normalized, cues) {
  if (cues.length === 1) return normalized.indexOf(cues[0]);
  let best = -1;
  const primary = cues[0];
  let start = 0;
  while (start < normalized.length) {
    const index = normalized.indexOf(primary, start);
    if (index < 0) break;
    const positions = [index];
    let ok = true;
    for (const cue of cues.slice(1)) {
      const before = normalized.lastIndexOf(cue, index + 42);
      const after = normalized.indexOf(cue, Math.max(0, index - 8));
      const candidate =
        before >= 0 && Math.abs(before - index) <= 42
          ? before
          : after >= 0 && Math.abs(after - index) <= 42
            ? after
            : -1;
      if (candidate < 0) {
        ok = false;
        break;
      }
      positions.push(candidate);
    }
    if (ok && Math.max(...positions) - Math.min(...positions) <= 48) {
      const labelStart = Math.min(...positions);
      best = best < 0 ? labelStart : Math.min(best, labelStart);
    }
    start = index + primary.length;
  }
  return best;
}

const AGE_FORM_BOUNDARY_CUES = [
  "\u043f\u0435\u0440\u0438\u043d\u0430\u0442",
  "\u0440\u0430\u043d",
  "\u043f\u043e\u0437\u0434",
  "\u044e\u0432\u0435\u043d",
  "\u043f\u043e\u0434\u0440\u043e\u0441\u0442",
  "\u0432\u0437\u0440\u043e\u0441\u043b",
].map((item) => normalizeForSearch(item));

function nextAgeFormBoundary(normalized, labelIndex, cues) {
  let best = -1;
  for (const cue of AGE_FORM_BOUNDARY_CUES) {
    let index = normalized.indexOf(cue, labelIndex + 8);
    while (index >= 0) {
      const isCurrentLabelCue = cues.includes(cue) && Math.abs(index - labelIndex) <= 48;
      if (!isCurrentLabelCue) {
        best = best < 0 ? index : Math.min(best, index);
        break;
      }
      index = normalized.indexOf(cue, index + cue.length);
    }
  }
  return best;
}

function answerComparatorMismatch(answerText, window) {
  const numbers = extractNumbers(answerText);
  if (!numbers.length) return false;
  const firstNumber = expandNumberToken(numbers[0])[0] ?? numbers[0];
  const normalizedAnswer = normalizeForSearch(answerText);
  const startsWithDo = normalizedAnswer.startsWith(normalizeForSearch("\u0434\u043e "));
  const lessAnswer =
    answerText.includes("<") ||
    startsWithDo ||
    containsNormalizedPhrase(normalizedAnswer, "\u043c\u0435\u043d\u0435\u0435") ||
    containsNormalizedPhrase(normalizedAnswer, "\u043c\u0435\u043d\u044c\u0448\u0435") ||
    containsNormalizedPhrase(normalizedAnswer, "\u043c\u043e\u043b\u043e\u0436\u0435");
  if (lessAnswer) {
    return ![
      "\u0434\u043e",
      "\u043c\u0435\u043d\u0435\u0435",
      "\u043c\u0435\u043d\u044c\u0448\u0435",
      "\u043c\u043e\u043b\u043e\u0436\u0435",
      "\u043d\u0438\u0436\u0435",
    ].some((cue) => containsNormalizedPhrase(window, `${cue} ${firstNumber}`));
  }
  const greaterAnswer =
    answerText.includes(">") ||
    containsNormalizedPhrase(normalizedAnswer, "\u0441\u0442\u0430\u0440\u0448\u0435") ||
    containsNormalizedPhrase(normalizedAnswer, "\u0431\u043e\u043b\u0435\u0435") ||
    containsNormalizedPhrase(normalizedAnswer, "\u0432\u044b\u0448\u0435");
  if (greaterAnswer) {
    return ![
      "\u0441\u0442\u0430\u0440\u0448\u0435",
      "\u0431\u043e\u043b\u0435\u0435",
      "\u0432\u044b\u0448\u0435",
      "\u043f\u043e\u0441\u043b\u0435",
    ].some((cue) => containsNormalizedPhrase(window, `${cue} ${firstNumber}`));
  }
  return false;
}

function ageAnswerSupport(window, answer, answerTokens) {
  if (answerComparatorMismatch(answer.text, window)) return null;
  const phraseHit = answerSearchPhrases(answer.text)
    .map((phrase) => normalizeForSearch(phrase))
    .filter((phrase) => phrase.length >= 2)
    .some((phrase) => containsNormalizedPhrase(window, phrase));
  const tokens = answerTokens.filter((token) => token.length >= 2);
  const tokenCoverage = tokens.length ? strictSoftCoverage(tokens, tokenizeNormalized(window)) : 0;
  const numberHit = numberCoverage(answer.text, window);
  if (!phraseHit && tokenCoverage < 0.7 && numberHit < 0.9) return null;
  return { phraseHit, tokenCoverage, numberHit };
}

export function bestAgeFormSupport({ mode, pages, question, answer, answerTokens }) {
  if (mode !== "single") return null;
  const cues = questionAgeFormCues(question);
  if (!cues) return null;
  const normalizedAnswer = normalizeForSearch(answer.text);
  if (!extractNumbers(answer.text).length && !containsNormalizedPhrase(normalizedAnswer, "\u0441\u0442\u0430\u0440\u0448") && !containsNormalizedPhrase(normalizedAnswer, "\u043c\u043e\u043b\u043e\u0436")) return null;
  let best = null;

  for (const page of pages) {
    const lines = page.lines ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      const text = lines.slice(Math.max(0, index - 1), Math.min(lines.length, index + 2)).join(" ");
      const normalized = normalizeForSearch(text);
      const labelIndex = ageFormLabelIndex(normalized, cues);
      if (labelIndex < 0) continue;
      const boundary = nextAgeFormBoundary(normalized, labelIndex, cues);
      const windowEnd = boundary > labelIndex ? boundary : Math.min(normalized.length, labelIndex + 145);
      const window = normalized.slice(labelIndex, windowEnd);
      const support = ageAnswerSupport(window, answer, answerTokens);
      if (!support) continue;
      const score = 15.4 + support.numberHit * 3.8 + support.tokenCoverage * 2.4 + (support.phraseHit ? 2.0 : 0);
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text,
        score,
        kind: "age_form_segment",
      });
    }
  }

  return best;
}

function questionRomanStage(question) {
  const tokens = rawTokens(question);
  const index = tokens.findIndex((token) => token.startsWith("\u0441\u0442\u0430\u0434\u0438"));
  const next = index >= 0 ? tokens[index + 1] : null;
  const previous = index > 0 ? tokens[index - 1] : null;
  if (/^(?:[ivx]+|\d+)$/iu.test(next ?? "")) return next.toLowerCase();
  if (/^(?:[ivx]+|\d+)$/iu.test(previous ?? "")) return previous.toLowerCase();
  return null;
}


function nextRomanStageRowIndex(normalized, start) {
  const pattern = /(?:^|\s)(?:[ivx]{1,5}|\d{1,2})(?:\s|$)/giu;
  pattern.lastIndex = start;
  const match = pattern.exec(normalized);
  return match?.index ?? -1;
}

function romanStageWindow(normalized, stage) {
  const stageCue = normalizeForSearch("\u0441\u0442\u0430\u0434\u0438\u044f");
  for (const variant of romanStageVariants(stage)) {
    const cues = [normalizeForSearch(`\u0441\u0442\u0430\u0434\u0438\u044f ${variant}`), normalizeForSearch(`${variant} \u0441\u0442\u0430\u0434\u0438\u044f`)];
    for (const cue of cues) {
      let index = -1;
      for (let start = 0; start < normalized.length; start += 1) {
        const found = normalized.indexOf(cue, start);
        if (found < 0) break;
        if (hasSearchBoundaries(normalized, found, cue.length)) {
          index = found;
          break;
        }
        start = found + cue.length;
      }
      if (index < 0) continue;
      let end = Math.min(normalized.length, index + 520);
      const nextStage = normalized.indexOf(stageCue, index + cue.length + 20);
      if (nextStage > 0) end = Math.min(end, nextStage);
      return normalized.slice(index, end);
    }
  }

  if (!normalized.includes(stageCue)) return null;
  for (const variant of romanStageVariants(stage)) {
    let start = 0;
    while (start < normalized.length) {
      const index = normalized.indexOf(variant, start);
      if (index < 0) break;
      if (!hasSearchBoundaries(normalized, index, variant.length)) {
        start = index + variant.length;
        continue;
      }
      const before = normalized.slice(Math.max(0, index - 220), index);
      if (!before.includes(stageCue)) {
        start = index + variant.length;
        continue;
      }
      const next = nextRomanStageRowIndex(normalized, index + variant.length + 1);
      const end = next > index ? Math.min(next, index + 420) : Math.min(normalized.length, index + 420);
      return normalized.slice(index, end);
    }
  }

  return null;
}

export function bestRomanStageSupport({ mode, pages, question, answer, answerTokens }) {
  if (mode !== "single") return null;
  const stage = questionRomanStage(question);
  if (!stage) return null;
  const answerPhrases = answerSearchPhrases(answer.text).slice(0, 16);
  let best = null;

  for (const page of pages) {
    for (const source of cachedLineWindowSegments(page)) {
      const window = romanStageWindow(source.normalized, stage);
      if (!window) continue;
      const tokens = tokenizeNormalized(window);
      const answerCoverage = strictSoftCoverage(answerTokens, tokens);
      const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(window, phrase));
      if (!phraseHit && answerCoverage < 0.58) continue;
      const score = 12.8 + (phraseHit ? 2.4 : 0) + answerCoverage * 4.0 + numberCoverage(answer.text, window) * 0.8;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text: source.text,
        score,
        kind: "roman_stage_segment",
      });
    }
  }

  return best;
}

function answerOrdinalLabel(answerText) {
  const normalized = normalizeForSearch(answerText);
  const tokens = normalized.split(/\s+/u).filter(Boolean);
  const kinds = [
    { kind: "stage", cue: normalizeForSearch("\u0441\u0442\u0430\u0434\u0438") },
    { kind: "degree", cue: normalizeForSearch("\u0441\u0442\u0435\u043f\u0435\u043d") },
    { kind: "type", cue: normalizeForSearch("\u0442\u0438\u043f") },
  ];
  const kind = kinds.find((item) => tokens.some((token) => token.startsWith(item.cue)));
  if (!kind) return null;

  const values = new Set<number>();
  for (const match of normalized.matchAll(/(?:^|\s)(\d{1,2}|[ivx]{1,7})(?:\s|$)/giu)) {
    const number = ordinalValueToNumber(match[1]);
    if (number && number > 0 && number <= 10) values.add(number);
  }
  if (values.size !== 1) return null;
  return { kind: kind.kind, cue: kind.cue, number: [...values][0] };
}

function ordinalKindCue(kind) {
  if (kind === "stage") return normalizeForSearch("\u0441\u0442\u0430\u0434\u0438");
  if (kind === "degree") return normalizeForSearch("\u0441\u0442\u0435\u043f\u0435\u043d");
  if (kind === "type") return normalizeForSearch("\u0442\u0438\u043f");
  return normalizeForSearch("\u043a\u043b\u0430\u0441\u0441");
}

function hasOrdinalKindCue(normalized, kind) {
  const cue = ordinalKindCue(kind);
  return new RegExp(`(?:^|\\s)${escapeRegExp(cue)}\\S*(?:\\s|$)`, "iu").test(normalized);
}

function nextAnswerOrdinalIndex(normalized, start, label) {
  const cue = ordinalKindCue(label.kind);
  let best = -1;
  for (let number = 1; number <= 10; number += 1) {
    if (number === label.number) continue;
    for (const variant of romanStageVariants(String(number))) {
      const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(variant)}(?:\\s|-|$)`, "iu");
      const match = normalized.slice(start).match(pattern);
      if (!match?.index && match?.index !== 0) continue;
      const index = start + match.index;
      if (isRomanOneConjunctionMatch(normalized, index, variant)) continue;
      const before = normalized.slice(Math.max(0, index - 180), index);
      const after = normalized.slice(index, Math.min(normalized.length, index + 90));
      if (!hasOrdinalKindCue(before, label.kind) && !hasOrdinalKindCue(after, label.kind)) continue;
      if (best < 0 || index < best) best = index;
    }
  }
  return best;
}

function nearestTokenBefore(normalized, index) {
  const tokens = normalized.slice(0, index).trim().match(/\S+/gu) ?? [];
  return tokens[tokens.length - 1] ?? "";
}

function nearestTokenAfter(normalized, index, length) {
  const tokens = normalized.slice(index + length).trim().match(/\S+/gu) ?? [];
  return tokens[0] ?? "";
}

function isRomanOneConjunctionMatch(normalized, index, variant) {
  if (variant !== "i") return false;
  const before = ordinalValueToNumber(nearestTokenBefore(normalized, index));
  const after = ordinalValueToNumber(nearestTokenAfter(normalized, index, variant.length));
  return Boolean(before && after);
}

function answerOrdinalRowWindows(source, label) {
  const normalized = source.normalized;
  const cue = ordinalKindCue(label.kind);
  const windows = [];
  for (const variant of romanStageVariants(String(label.number))) {
    if (hasOrdinalKindCue(normalized, label.kind)) {
      const directPatterns = [
        new RegExp(`(?:^|\\s)${escapeRegExp(variant)}(?:\\s|$)(?:-?\\s*\\S{0,3}\\s+)?${escapeRegExp(cue)}`, "giu"),
        new RegExp(`${escapeRegExp(cue)}\\s+(?:\\S+\\s+){0,2}${escapeRegExp(variant)}(?:\\s|$)`, "giu"),
      ];
      for (const pattern of directPatterns) {
        for (const match of normalized.matchAll(pattern)) {
          const index = match.index ?? 0;
          if (isRomanOneConjunctionMatch(normalized, index, variant)) continue;
          const afterStart = index + match[0].length;
          const next = nextAnswerOrdinalIndex(normalized, afterStart + 8, label);
          const end = next > 0 ? next : Math.min(normalized.length, afterStart + 520);
          windows.push(normalized.slice(index, end));
        }
      }

      let start = 0;
      while (start < normalized.length) {
        const index = normalized.indexOf(variant, start);
        if (index < 0) break;
        if (!hasSearchBoundaries(normalized, index, variant.length)) {
          start = index + Math.max(1, variant.length);
          continue;
        }
        if (isRomanOneConjunctionMatch(normalized, index, variant)) {
          start = index + Math.max(1, variant.length);
          continue;
        }
        const before = normalized.slice(Math.max(0, index - 220), index);
        const after = normalized.slice(index, Math.min(normalized.length, index + 100));
        if (!hasOrdinalKindCue(before, label.kind) && !hasOrdinalKindCue(after, label.kind)) {
          start = index + Math.max(1, variant.length);
          continue;
        }
        const next = nextAnswerOrdinalIndex(normalized, index + variant.length + 8, label);
        const end = next > 0 ? next : Math.min(normalized.length, index + 520);
        windows.push(normalized.slice(index, end));
        start = index + Math.max(1, variant.length);
      }
    } else {
      const barePattern = new RegExp(`^\\s*${escapeRegExp(variant)}(?:\\s|$)`, "iu");
      const match = normalized.match(barePattern);
      if (match?.[0]) {
        windows.push(normalized.slice(0, Math.min(normalized.length, 520)));
      }
    }
  }
  return windows;
}

function ordinalRangeIncludesValue(normalized, label) {
  if (!hasOrdinalKindCue(normalized, label.kind)) return false;
  const number = label.number;
  const digitPatterns = [
    /(?:^|\s)(\d{1,2})\s*-\s*(\d{1,2})(?:\s|$)/giu,
    /(?:^|\s)(\d{1,2})\s*\/\s*(\d{1,2})(?:\s|$)/giu,
  ];
  for (const pattern of digitPatterns) {
    for (const match of normalized.matchAll(pattern)) {
      const left = Number(match[1]);
      const right = Number(match[2]);
      if (number >= Math.min(left, right) && number <= Math.max(left, right)) return true;
    }
  }
  const romanPattern = /(?:^|\s)(i|ii|iii|iv|v|vi|vii|viii|ix|x)\s*-\s*(i|ii|iii|iv|v|vi|vii|viii|ix|x)(?:\s|$)/giu;
  for (const match of normalized.matchAll(romanPattern)) {
    const left = ordinalValueToNumber(match[1]);
    const right = ordinalValueToNumber(match[2]);
    if (left && right && number >= Math.min(left, right) && number <= Math.max(left, right)) return true;
  }
  return false;
}

const ANSWER_ORDINAL_GENERIC_FOCUS = new Set(
  [
    "\u0441\u043e\u0433\u043b\u0430\u0441\u043d\u043e",
    "\u043a\u043b\u0430\u0441\u0441\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u044f",
    "\u043a\u043b\u0430\u0441\u0441\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u0438",
    "\u0445\u0430\u0440\u0430\u043a\u0442\u0435\u0440\u043d\u043e",
    "\u0445\u0430\u0440\u0430\u043a\u0442\u0435\u0440\u043d\u044b",
    "\u0441\u0442\u0430\u0434\u0438\u044f",
    "\u0441\u0442\u0430\u0434\u0438\u0438",
    "\u0441\u0442\u0435\u043f\u0435\u043d\u044c",
    "\u0441\u0442\u0435\u043f\u0435\u043d\u0438",
    "\u0442\u0438\u043f",
    "\u0442\u0438\u043f\u0430",
    "\u043a\u043b\u0430\u0441\u0441",
    "\u043a\u043b\u0430\u0441\u0441\u0430",
  ].flatMap((item) => uniqueTokens(item)),
);

function specificAnswerOrdinalFocusTokens(focusTokens, answerTokens) {
  const answerSet = new Set(answerTokens ?? []);
  return (focusTokens ?? []).filter(
    (token) => token.length >= 4 && !/^\d/.test(token) && !answerSet.has(token) && !ANSWER_ORDINAL_GENERIC_FOCUS.has(token),
  );
}

function orderedFocusPairHits(focusTokens, documentTokens) {
  if ((focusTokens?.length ?? 0) < 2 || !documentTokens?.length) return 0;
  const seen = new Set<string>();
  let hits = 0;
  for (let index = 0; index < focusTokens.length - 1; index += 1) {
    const left = focusTokens[index];
    const right = focusTokens[index + 1];
    if (!left || !right || left === right) continue;
    const key = `${left}\u0000${right}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (tokenSequenceIncludes(documentTokens, [left, right])) hits += 1;
  }
  return hits;
}

export function bestAnswerOrdinalRowSupport({ mode, pages, topQuestionPages, question, answer, answerTokens, focusTokens }) {
  const label = answerOrdinalLabel(answer.text);
  if (!label) return null;
  if (!answerOrdinalRowApplicable({ question, answerText: answer.text, label })) return null;
  const specificTokens = specificAnswerOrdinalFocusTokens(focusTokens, answerTokens);
  if (specificTokens.length < 2) return null;
  let best = null;

  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    const sources = [...cachedLineWindowSegments(page), { normalized: page.normalized, text: page.text }];
    for (const source of sources) {
      const windows = answerOrdinalRowWindows(source, label);
      if (mode === "multi" && ordinalRangeIncludesValue(source.normalized, label)) {
        windows.push(source.normalized);
      }
      for (const window of windows) {
        const tokens = tokenizeNormalized(window);
        const focusHits = tokenHitCount(specificTokens, tokens);
        if (focusHits < 2) continue;
        const focusCoverage = coverage(specificTokens, tokens);
        const pairHits = orderedFocusPairHits(specificTokens, tokens);
        const answerCoverage = strictSoftCoverage(answerTokens, tokens);
        const score =
          13.4 +
          Math.min(5, focusHits) * 1.45 +
          Math.min(0.7, focusCoverage) * 5.4 +
          Math.min(4, pairHits) * 1.8 +
          answerCoverage * 2.2 +
          (ordinalRangeIncludesValue(window, label) ? 1.0 : 0);
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: source.text,
          score,
          kind: "answer_ordinal_row",
        });
      }
    }
  }

  return best;
}
