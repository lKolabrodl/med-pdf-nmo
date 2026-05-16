import { coverage, normalizeForSearch, normalizeText, tokenize, uniqueTokens } from "../../normalize.js";
import { SECTION_GENERIC_TOKENS } from "../constants.js";
import {
  answerHasQuestionNumbers,
  answerSearchPhrases,
  betterEvidence,
  escapeRegExp,
  evidenceSnippet,
  findPhraseOccurrences,
  numberCoverage,
  pageWindow,
  proximityBonus,
  rawSoftCoverage,
  rawTokens,
  softCoverage,
  strictSoftCoverage,
  tokenSequenceIncludes,
} from "../text-utils.js";

const ROW_LABEL_RE =
  /(локализован[а-яa-z0-9-]*|генерализован[а-яa-z0-9-]*|редк[а-яa-z0-9-]*|перинатальн[а-яa-z0-9-]*|ранн[а-яa-z0-9-]*\s+младенческ[а-яa-z0-9-]*|поздн[а-яa-z0-9-]*\s+младенческ[а-яa-z0-9-]*|ювенильн[а-яa-z0-9-]*|подростков[а-яa-z0-9-]*|взросл[а-яa-z0-9-]*|положительн[а-яa-z0-9-]*|сомнительн[а-яa-z0-9-]*|отрицательн[а-яa-z0-9-]*|планов[а-яa-z0-9-]*|экстренн[а-яa-z0-9-]*|неотложн[а-яa-z0-9-]*|перв[а-яa-z0-9-]*\s+лини[ияею]|втор[а-яa-z0-9-]*\s+лини[ияею]|треть[а-яa-z0-9-]*\s+лини[ияею]|не\s+имеющ[а-яa-z0-9-]*\s+фактор[а-яa-z0-9-]*\s+риска|при\s+наличи[а-яa-z0-9-]*\s+фактор[а-яa-z0-9-]*\s+риска)/giu;

function questionAnchorPhrases(question) {
  const raw = normalizeText(question);
  const normalized = normalizeForSearch(question);
  const phrases = new Set([raw, normalized]);
  const match = raw.match(/^к\s+(.+?)\s+относятся/u);
  if (match) {
    const middleTokens = rawTokens(match[1]).filter(
      (token) => !["группе", "группа", "компонентам", "компоненты", "препараты", "препаратам", "средства", "методы"].includes(token),
    );
    if (middleTokens.length) {
      phrases.add(`к ${middleTokens[0]} относятся`);
      phrases.add(`к ${middleTokens[0]} причинам относятся`);
      phrases.add(`к ${middleTokens[0]} компонентам относятся`);
      phrases.add(`${middleTokens.slice(0, 3).join(" ")} относятся`);
      phrases.add(middleTokens.slice(0, 4).join(" "));
    }
  }

  const groupMatch = raw.match(/(?:к\s+группе|группы)\s+(.+?)\s+относятся/u);
  if (groupMatch) {
    const tokens = rawTokens(groupMatch[1]);
    if (tokens.length) phrases.add(tokens.slice(0, 4).join(" "));
  }

  return [...phrases].filter((phrase) => phrase.length >= 4);
}

export function findAnchorSegments(pages, question) {
  const anchors = questionAnchorPhrases(question);
  const segments = [];
  for (const page of pages) {
    for (const anchor of anchors) {
      const normalizedAnchor = normalizeForSearch(anchor);
      let start = 0;
      while (start < page.normalized.length) {
        const index = page.normalized.indexOf(normalizedAnchor, start);
        if (index < 0) break;
        const after = page.normalized.slice(index);
        let end = Math.min(after.length, 750);
        end = Math.min(end, findAnchorBoundary(after));
        const text = after.slice(0, end);
        segments.push({
          page: page.page,
          normalized: text,
          text: evidenceSnippet(page.text, anchor),
          anchor,
        });
        start = index + Math.max(1, normalizedAnchor.length);
      }
    }
  }
  return segments.slice(0, 12);
}

function questionSectionAnchor(question) {
  const raw = normalizeText(question);
  const match = raw.match(/по\s+([а-яa-z0-9 -]{4,64}?)(?:\s+выдел|\s+отно|\s+явля|\s+различ|\s+классифиц|$)/u);
  if (!match?.[1]) return null;
  return `по ${match[1].trim()}`;
}

export function findSectionSegments(pages, question) {
  const anchor = questionSectionAnchor(question);
  if (!anchor) return [];
  const anchorNorm = normalizeForSearch(anchor);
  const segments = [];
  for (const page of pages) {
    const lines = page.lines ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      const lineNorm = normalizeForSearch(lines[index]);
      if (!lineNorm.includes(anchorNorm)) continue;
      const out = [lines[index]];
      for (let next = index + 1; next < Math.min(lines.length, index + 12); next += 1) {
        const nextNorm = normalizeForSearch(lines[next]);
        if (next > index + 1 && /^по\s+/iu.test(normalizeText(lines[next]))) break;
        if (nextNorm.length < 2) break;
        out.push(lines[next]);
      }
      const text = out.join(" ");
      segments.push({
        page: page.page,
        text,
        normalized: normalizeForSearch(text),
        anchor,
      });
    }
  }
  return segments.slice(0, 8);
}

function findAnchorBoundary(normalizedAfter) {
  let boundary = Math.min(normalizedAfter.length, 750);
  for (let pos = normalizedAfter.indexOf(" k ", 50); pos >= 0; pos = normalizedAfter.indexOf(" k ", pos + 3)) {
    const local = normalizedAfter.slice(pos, pos + 170);
    if (local.includes("othoc")) {
      boundary = Math.min(boundary, pos);
      break;
    }
  }
  for (const keyword of ["уровень", "примечание", "таблица", "раздел", "комментарии"]) {
    const folded = normalizeForSearch(keyword);
    const pos = normalizedAfter.indexOf(` ${folded}`, 80);
    if (pos > 80) boundary = Math.min(boundary, pos);
  }
  return Math.max(80, boundary);
}

export function bestPhraseSupport({ pages, question, answer, questionTokens, answerTokens, intent }) {
  const answerPhrases = answerSearchPhrases(answer.text);
  const joinedPhrases = answerPhrases.map((phrase) => `${question} ${phrase}`);
  const normalizedQuestion = normalizeForSearch(question);
  let best = null;

  for (const page of pages) {
    const pageNorm = page.normalized;
    for (const joined of joinedPhrases) {
      const directHits = findPhraseOccurrences(pageNorm, joined, { textIsNormalized: true });
      for (const hit of directHits) {
        const window = pageWindow(page, hit, 700);
        const winTokens = tokenize(window);
        const score =
          8.5 +
          coverage(questionTokens, winTokens) * 2.2 +
          coverage(answerTokens, winTokens) * 1.2 +
          numberCoverage(answer.text, window) * 0.9 +
          (intent.numeric ? 0.45 : 0);
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: evidenceSnippet(page.text, joined),
          score,
          kind: "question_answer_phrase",
        });
      }
    }

    if (!normalizedQuestion) continue;
    let qStart = 0;
    while (qStart < pageNorm.length) {
      const qIndex = pageNorm.indexOf(normalizedQuestion, qStart);
      if (qIndex < 0) break;
      const afterStart = qIndex + normalizedQuestion.length;
      const after = pageNorm.slice(afterStart, afterStart + 1200);
      for (const answerPhrase of answerPhrases) {
        const normalizedAnswer = normalizeForSearch(answerPhrase);
        const answerIndex = after.indexOf(normalizedAnswer);
        if (answerIndex >= 0) {
          const distance = answerIndex;
          const local = after.slice(Math.max(0, answerIndex - 220), answerIndex + normalizedAnswer.length + 260);
          const score =
            6.4 +
            proximityBonus(distance, 1200) * 2.3 +
            coverage(answerTokens, tokenize(local)) * 0.8 +
            numberCoverage(answer.text, local) * 0.7;
          best = betterEvidence(best, {
            answerId: answer.id,
            page: page.page,
            text: evidenceSnippet(page.text, question, answer.text),
            score,
            kind: "answer_after_question",
          });
        }
      }
      qStart = qIndex + normalizedQuestion.length;
      if (qStart > pageNorm.length) break;
    }

    for (const answerPhrase of answerPhrases) {
      const normalizedAnswer = normalizeForSearch(answerPhrase);
      const answerHits = findPhraseOccurrences(pageNorm, answerPhrase, { textIsNormalized: true });
      for (const hit of answerHits) {
        const before = pageNorm.slice(Math.max(0, hit - 450), hit);
        const after = pageNorm.slice(hit + normalizedAnswer.length, hit + normalizedAnswer.length + 450);
        const window = `${before} ${normalizedAnswer} ${after}`;
        const winTokens = tokenize(window);
        const beforeCoverage = coverage(questionTokens, tokenize(before));
        const afterCoverage = coverage(questionTokens, tokenize(after));
        const localCoverage = Math.max(beforeCoverage, afterCoverage);
        const broadCoverage = coverage(questionTokens, winTokens);
        if (Math.max(localCoverage, broadCoverage) <= 0.1) continue;
        const qPrefix = normalizedQuestion.slice(0, Math.min(normalizedQuestion.length, 140));
        const prefixBonus = qPrefix && before.includes(qPrefix.slice(0, Math.min(70, qPrefix.length))) ? 1.0 : 0;
        const directionalBonus = localCoverage > 0.24 ? 2.4 + localCoverage * 4.2 : 0;
        const score =
          0.8 +
          broadCoverage * 2.7 +
          coverage(answerTokens, winTokens) * 1.2 +
          numberCoverage(answer.text, window) * 1.2 +
          directionalBonus +
          prefixBonus +
          (intent.numeric && answerHasQuestionNumbers(answer.text, question) ? 0.35 : 0);
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: evidenceSnippet(page.text, answer.text),
          score,
          kind: localCoverage > broadCoverage ? "answer_directional_window" : "answer_window",
        });
      }
    }
  }

  return best;
}

export function bestAnchorSupport({ anchorSegments, answer, answerTokens }) {
  if (!anchorSegments?.length) return null;
  const answerPhrases = answerSearchPhrases(answer.text);
  let best = null;
  for (const segment of anchorSegments) {
    let phraseHit = false;
    for (const phrase of answerPhrases) {
      const normalizedPhrase = normalizeForSearch(phrase);
      if (normalizedPhrase && segment.normalized.includes(normalizedPhrase)) {
        phraseHit = true;
        break;
      }
    }
    const segmentTokens = tokenize(segment.normalized);
    const answerCoverage = coverage(answerTokens, segmentTokens);
    const numericCoverage = numberCoverage(answer.text, segment.normalized);
    const support = Math.max(phraseHit ? 1 : 0, answerCoverage, numericCoverage);
    if (support <= 0.15) continue;
    const score = 7.4 + support * 3.2 + (phraseHit ? 1.4 : 0) + numericCoverage * 0.8;
    best = betterEvidence(best, {
      answerId: answer.id,
      page: segment.page,
      text: segment.text,
      score,
      kind: "question_anchor_segment",
    });
  }
  return best;
}

export function bestSectionSupport({ sectionSegments, answer, answerTokens }) {
  if (!sectionSegments?.length) return null;
  const answerPhrases = answerSearchPhrases(answer.text);
  const distinctiveTokens = answerTokens.filter((token) => !SECTION_GENERIC_TOKENS.has(token));
  let best = null;
  for (const segment of sectionSegments) {
    let phraseHit = false;
    for (const phrase of answerPhrases) {
      const normalizedPhrase = normalizeForSearch(phrase);
      if (normalizedPhrase && segment.normalized.includes(normalizedPhrase)) {
        phraseHit = true;
        break;
      }
    }
    const segmentTokens = tokenize(segment.text);
    const answerCoverage = softCoverage(distinctiveTokens.length ? distinctiveTokens : answerTokens, segmentTokens);
    const numericCoverage = numberCoverage(answer.text, segment.normalized);
    const support = Math.max(phraseHit ? 1 : 0, answerCoverage, numericCoverage);
    if (!phraseHit && support <= 0.25) continue;
    const score = 8.2 + support * 4.0 + (phraseHit ? 2.0 : 0) + numericCoverage * 0.8;
    best = betterEvidence(best, {
      answerId: answer.id,
      page: segment.page,
      text: segment.text,
      score,
      kind: "section_list_segment",
    });
  }
  return best;
}

function questionRowCues(question) {
  const raw = normalizeText(question);
  const cues = new Set();
  const add = (value) => {
    const cleaned = normalizeText(value).replace(/\s+/g, " ").trim();
    if (cleaned.length >= 3) cues.add(cleaned);
  };

  const patterns = [
    /по\s+мкб\s*-?\s*10\s+(.+?)\s+кодируется/u,
    /возраст\s+манифестации\s+(.+?)\s+форм/u,
    /проба.+?считается\s+"?([а-яa-z-]+)"?/u,
    /согласно.+?(стади[яи]\s+(?:[ivx]+|\d+))/u,
    /(стади[яи]\s+(?:[ivx]+|\d+))/u,
    /препарат[а-яa-z0-9-]*\s+((?:перв|втор|треть)[а-яa-z0-9-]*\s+лини[ияею])/u,
    /показани[а-яa-z0-9-]*\s+для\s+(.+?)\s+госпитализац/u,
    /при\s+лечении\s+(.+?)\s+(?:назнач|примен)/u,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) add(match[1]);
  }

  for (const match of raw.matchAll(ROW_LABEL_RE)) add(match[0]);
  return [...cues].slice(0, 8);
}

function rowCueMatch(line, cues) {
  const lineRawTokens = rawTokens(line);
  const lineTokens = tokenize(line);
  let best = 0;
  for (const cue of cues) {
    const cueTokens = rawTokens(cue);
    const cueStemTokens = uniqueTokens(cue);
    if (!cueTokens.length) continue;
    if (tokenSequenceIncludes(lineRawTokens, cueTokens) || rawSoftCoverage(cueTokens, lineRawTokens) >= 0.8 || coverage(cueStemTokens, lineTokens) >= 0.8) {
      best = Math.max(best, cueTokens.length >= 2 ? 1.15 : 1.0);
    }
  }
  return best;
}

function rowBoundary(line) {
  const raw = normalizeText(line);
  return /^(?:[ivx]+\.\s+|[0-9]+(?:\.[0-9]+)*\s+|уровень\b|комментарии\b|примечание\b)/iu.test(raw);
}

function rowSegmentText(lines, startIndex) {
  const current = normalizeText(lines[startIndex]);
  const extendsForward = /[:：]$/u.test(current) || /^стади[яи]\s+[ivx0-9]+/iu.test(current);
  if (!extendsForward) return lines[startIndex];
  const out = [lines[startIndex]];
  for (let index = startIndex + 1; index < Math.min(lines.length, startIndex + 6); index += 1) {
    const next = lines[index];
    const nextRaw = normalizeText(next);
    if (index > startIndex + 1 && rowBoundary(next)) break;
    if (/^стади[яи]\s+[ivx0-9]+/iu.test(nextRaw)) break;
    if (/^по\s+мкб/iu.test(nextRaw)) break;
    if (!nextRaw) break;
    out.push(next);
    if (/[.;]$/u.test(nextRaw) && out.length >= 2) break;
  }
  return out.join(" ");
}

export function findRowSegments(pages, question, topQuestionPages) {
  const cues = questionRowCues(question);
  if (!cues.length) return [];
  const mcbCodeQuestion = /мкб/u.test(normalizeText(question)) && /кодир/u.test(normalizeText(question));
  const segments = [];
  const seen = new Set();
  for (const page of pages) {
    const lines = page.lines ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      if (mcbCodeQuestion && !/^\s*[a-zа-я]?\s*0?\d{2}(?:[.\s]\d)?/iu.test(normalizeText(lines[index]))) continue;
      const cueScore = rowCueMatch(lines[index], cues);
      if (cueScore <= 0) continue;
      const text = rowSegmentText(lines, index);
      const key = `${page.page}:${normalizeForSearch(text).slice(0, 180)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      segments.push({
        page: page.page,
        text,
        normalized: normalizeForSearch(text),
        cueScore,
        cues: cues.filter((cue) => rowCueMatch(lines[index], [cue]) > 0),
      });
    }
  }
  return segments.sort((a, b) => b.cueScore - a.cueScore).slice(0, 12);
}

function rowCueSpecificityPenalty(segment) {
  const raw = normalizeText(segment.text);
  let penalty = 0;
  for (const cue of segment.cues ?? []) {
    const cueRaw = normalizeText(cue);
    if (!cueRaw || rawTokens(cueRaw).length < 2) continue;
    const cueTokens = rawTokens(cueRaw);
    const firstPrefix = cueTokens[0]?.slice(0, Math.min(8, cueTokens[0].length));
    const restPattern = cueTokens
      .slice(1)
      .map((token) => `${escapeRegExp(token.slice(0, Math.min(8, token.length)))}[а-яa-z0-9-]*`)
      .join("\\s+");
    if (firstPrefix && restPattern) {
      const combinedPattern = new RegExp(`${escapeRegExp(firstPrefix)}[а-яa-z0-9-]*.+\\sс\\s+${escapeRegExp(firstPrefix)}[а-яa-z0-9-]*\\s+${restPattern}`, "iu");
      if (combinedPattern.test(raw)) penalty += 3.0;
    }
    const index = raw.indexOf(cueRaw);
    if (index < 0) continue;
    const before = raw
      .slice(0, index)
      .replace(/^[a-zа-я]?\s*\d{2}(?:[.\s]\d)?\s*/iu, "")
      .trim();
    if (before.length > 3) penalty += 1.8;
    const after = raw.slice(index + cueRaw.length, index + cueRaw.length + 16);
    if (!cueRaw.includes(" с ") && /^\s+с\s+/u.test(after)) penalty += 2.6;
  }
  return penalty;
}

function answerCodeVariants(answerText) {
  const normalized = normalizeForSearch(answerText);
  const variants = new Set();
  for (const match of normalized.matchAll(/\b([a-zа-я])?0?(\d{2}[.]\d)\b/giu)) {
    const code = match[2];
    variants.add(code);
    variants.add(`0${code}`);
    variants.add(`d${code}`);
  }
  return [...variants];
}

function rowAnswerPhrases(answerText) {
  return [...new Set([...answerSearchPhrases(answerText), ...answerCodeVariants(answerText)])].slice(0, 18);
}

export function bestRowLabelSupport({ rowSegments, answer, answerTokens }) {
  if (!rowSegments?.length) return null;
  const answerPhrases = rowAnswerPhrases(answer.text);
  let best = null;
  for (const segment of rowSegments) {
    let phraseHit = false;
    let phraseIndex = -1;
    for (const phrase of answerPhrases) {
      const normalizedPhrase = normalizeForSearch(phrase);
      if (!normalizedPhrase) continue;
      const index = segment.normalized.indexOf(normalizedPhrase);
      if (index >= 0) {
        phraseHit = true;
        phraseIndex = phraseIndex < 0 ? index : Math.min(phraseIndex, index);
      }
    }
    const segmentTokens = tokenize(segment.text);
    const answerCoverage = strictSoftCoverage(answerTokens, segmentTokens);
    const numericCoverage = numberCoverage(answer.text, segment.normalized);
    const answerHasNegation = /(?:^|\s)(?:не|без|отсутств)/u.test(normalizeText(answer.text));
    const segmentHasNegation = /(?:^|\s)(?:не|без|отсутств)/u.test(normalizeText(segment.text));
    const support = Math.max(phraseHit ? 1 : 0, answerCoverage, numericCoverage);
    const coverageSupport =
      ((answerTokens.length >= 3 && answerCoverage >= 0.66) || (answerTokens.length >= 2 && answerCoverage >= 0.95)) &&
      (!answerHasNegation || segmentHasNegation);
    if (answerHasNegation && !segmentHasNegation && numericCoverage < 0.65) continue;
    if (!phraseHit && numericCoverage < 0.65 && !coverageSupport) continue;
    const earlyBonus = phraseIndex >= 0 && phraseIndex <= 180 ? 0.65 : 0;
    const score =
      8.0 +
      support * 3.8 +
      segment.cueScore * 1.5 +
      (phraseHit ? 1.7 : 0) +
      numericCoverage * 0.8 +
      earlyBonus -
      rowCueSpecificityPenalty(segment);
    best = betterEvidence(best, {
      answerId: answer.id,
      page: segment.page,
      text: segment.text,
      score,
      kind: "row_label_segment",
    });
  }
  return best;
}
