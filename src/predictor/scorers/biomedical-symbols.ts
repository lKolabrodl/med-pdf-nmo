import { coverage, normalizeForSearch, tokenize, uniqueTokens } from "../../normalize.js";
import {
  betterEvidence,
  cachedPageTokens,
  containsNormalizedPhrase,
  evidenceSnippet,
  tokenizeNormalized,
  tokenHitCount,
} from "../text-utils.js";

const OCR_LATIN_MAP = new Map(
  Object.entries({
    А: "a",
    В: "b",
    Е: "e",
    К: "k",
    М: "m",
    Н: "h",
    О: "o",
    Р: "p",
    С: "c",
    Т: "t",
    У: "y",
    Х: "x",
    а: "a",
    в: "b",
    е: "e",
    к: "k",
    м: "m",
    н: "h",
    о: "o",
    р: "p",
    с: "c",
    т: "t",
    у: "y",
    х: "x",
    Б: "b",
    Г: "r",
    Д: "d",
    З: "z",
    И: "n",
    Й: "n",
    Л: "l",
    П: "n",
    Ф: "f",
    Ц: "c",
    Ч: "y",
    Ш: "w",
    Щ: "w",
    Ы: "h",
    Ь: "b",
    Ъ: "b",
    Ю: "io",
    Я: "r",
    б: "b",
    г: "r",
    д: "d",
    з: "z",
    и: "n",
    й: "n",
    л: "l",
    п: "n",
    ф: "f",
    ц: "c",
    ч: "y",
    ш: "w",
    щ: "w",
    ы: "h",
    ь: "b",
    ъ: "b",
    ю: "io",
    я: "r",
    "§": "g",
    "%": "g",
  }),
);

/**
 * Возвращает короткие латинские/буквенно-цифровые токены из варианта ответа:
 * гены, маркеры, коды и похожие biomedical-обозначения.
 */
export function latinAnswerTokens(text) {
  return String(text ?? "").match(/[A-Za-z][A-Za-z0-9-]{1,}/g) ?? [];
}

/**
 * Генерирует безопасные варианты написания латинского токена без медицинских
 * знаний: чистая форма и несколько частых OCR/типографских сокращений.
 */
function latinTokenVariants(token) {
  const normalized = token.toLowerCase().replace(/[^a-z0-9]/g, "");
  const variants = new Set([normalized]);
  const th = normalized.match(/^th(\d+)$/);
  if (th) {
    if (th[1] === "1") variants.add("th");
    variants.add(`th${th[1].slice(-1)}`);
  }
  return [...variants].filter(Boolean);
}

/**
 * Расширяет латинский gene-token набором OCR-подмен, которые часто возникают
 * при смешении кириллицы, латиницы и цифр в PDF.
 */
function geneTokenVariants(token) {
  const normalized = token.toLowerCase().replace(/[^a-z0-9]/g, "");
  const variants = new Set(latinTokenVariants(normalized));
  if (!normalized || normalized.length > 10) return [...variants].filter(Boolean);

  const alternatives = {
    f: ["f", "p"],
    g: ["g", "o", "q"],
    r: ["r", "k"],
    o: ["o", "0"],
    d: ["d", "0"],
    z: ["z", "3"],
    3: ["3", "z"],
    b: ["b", "8"],
    s: ["s", "5"],
    l: ["l", "1", "i"],
    i: ["i", "1", "l"],
  };
  let generated = [""];
  for (const char of normalized) {
    const choices = alternatives[char] ?? [char];
    const next = [];
    for (const prefix of generated) {
      for (const choice of choices) {
        next.push(`${prefix}${choice}`);
        if (next.length >= 96) break;
      }
      if (next.length >= 96) break;
    }
    generated = next;
  }
  for (const variant of generated) variants.add(variant);
  return [...variants].filter(Boolean);
}

/**
 * Переводит визуально похожие кириллические символы в латинские аналоги и
 * оставляет только буквы/цифры, чтобы сравнивать OCR-искаженные коды.
 */
function relaxedLatinText(text) {
  let out = "";
  for (const char of String(text ?? "").normalize("NFKC")) {
    out += OCR_LATIN_MAP.get(char) ?? char;
  }
  return out.toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

/**
 * Возвращает нормализованные латинские токены страницы и дополнительно склеивает
 * случаи вида `N 0 0 2`, которые PDF extractor часто разрывает по символам.
 */
function relaxedLatinTokens(text) {
  const rawTokens = relaxedLatinText(text).match(/[a-z0-9]+/g) ?? [];
  const joined = [];
  for (let index = 0; index < rawTokens.length - 1; index += 1) {
    if (/^[a-z]+$/.test(rawTokens[index]) && /^\d+$/.test(rawTokens[index + 1])) joined.push(`${rawTokens[index]}${rawTokens[index + 1]}`);
    if (/^[a-z]{1,5}$/.test(rawTokens[index])) {
      let digits = "";
      for (let cursor = index + 1; cursor < rawTokens.length && cursor <= index + 5; cursor += 1) {
        if (!/^\d$/.test(rawTokens[cursor])) break;
        digits += rawTokens[cursor];
        if (digits.length >= 2) joined.push(`${rawTokens[index]}${digits}`);
      }
    }
  }
  const tokens = rawTokens.filter((token) => token.length >= 2);
  return [...tokens, ...joined];
}

/** Кеширует relaxed Latin tokens на странице, чтобы scorer'ы не пересчитывали OCR-формы. */
function cachedLatinTokens(page) {
  if (!page.__latinTokens) Object.defineProperty(page, "__latinTokens", { value: relaxedLatinTokens(page.text), enumerable: false });
  return page.__latinTokens;
}

/**
 * Считает мягкое сходство двух коротких латинских токенов по биграммам.
 * Для очень коротких токенов намеренно используется только строгий prefix-match.
 */
function diceSimilarity(left, right) {
  const a = String(left ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const b = String(right ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length <= 3 || b.length <= 3) {
    if (/\d/.test(a) || /\d/.test(b)) return 0;
    return a.startsWith(b) || b.startsWith(a) ? 0.72 : 0;
  }
  const counts = new Map();
  for (let index = 0; index < a.length - 1; index += 1) {
    const gram = a.slice(index, index + 2);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  let hit = 0;
  for (let index = 0; index < b.length - 1; index += 1) {
    const gram = b.slice(index, index + 2);
    const count = counts.get(gram) ?? 0;
    if (count > 0) {
      hit += 1;
      counts.set(gram, count - 1);
    }
  }
  return (2 * hit) / Math.max(1, a.length + b.length - 2);
}

/**
 * Ищет OCR-поддержку латинского варианта ответа на релевантных страницах.
 * Это общий fallback для коротких biomedical-кодов, а не медицинский словарь.
 */
export function bestLatinFuzzySupport({ pages, topQuestionPages, questionTokens, answer }) {
  const latinTokens = latinAnswerTokens(answer.text);
  if (!latinTokens.length) return null;
  let best = null;

  for (const page of pages) {
    if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
    const questionCoverage = coverage(questionTokens, cachedPageTokens(page));
    if (questionCoverage < 0.12) continue;
    const pageTokens = cachedLatinTokens(page);
    if (!pageTokens.length) continue;
    let total = 0;
    let strong = 0;
    for (const token of latinTokens) {
      let tokenBest = 0;
      for (const variant of latinTokenVariants(token)) {
        for (const pageToken of pageTokens) {
          tokenBest = Math.max(tokenBest, diceSimilarity(variant, pageToken));
        }
      }
      if (tokenBest >= 0.58) strong += 1;
      total += tokenBest;
    }
    const average = total / latinTokens.length;
    if (average < 0.32 && strong < latinTokens.length) continue;
    const score = 4.2 + average * 5.0 + strong * 0.9 + questionCoverage * 2.0;
    best = betterEvidence(best, {
      answerId: answer.id,
      page: page.page,
      text: evidenceSnippet(page.text, latinTokens[0]),
      score,
      kind: "latin_fuzzy_ocr",
    });
  }
  return best;
}

const GENE_QUESTION_GENERIC_TOKENS = new Set(
  [
    "\u0433\u0435\u043d",
    "\u0433\u0435\u043d\u0430",
    "\u0433\u0435\u043d\u0430\u0445",
    "\u0433\u0435\u043d\u043e\u0432",
    "\u043c\u0443\u0442\u0430\u0446\u0438\u044f",
    "\u043c\u0443\u0442\u0430\u0446\u0438\u0438",
    "\u043c\u0443\u0442\u0430\u0446\u0438\u0439",
    "\u043f\u043e\u043b\u0438\u043c\u043e\u0440\u0444\u0438\u0437\u043c",
    "\u043f\u043e\u043b\u0438\u043c\u043e\u0440\u0444\u0438\u0437\u043c\u044b",
    "\u043e\u043f\u0440\u0435\u0434\u0435\u043b\u044f\u044e\u0442\u0441\u044f",
    "\u0441\u0432\u044f\u0437\u044b\u0432\u0430\u044e\u0442",
    "\u0440\u0438\u0441\u043a",
    "\u0440\u0430\u0437\u0432\u0438\u0442\u0438\u044f",
  ].flatMap((item) => uniqueTokens(item)),
);

/**
 * Проверяет, что вопрос действительно про мутации/полиморфизмы генов.
 * Такой gate нужен, чтобы gene-specific OCR-логика не влияла на обычные вопросы.
 */
export function geneMutationQuestion(question) {
  const normalized = normalizeForSearch(question);
  const tokens = new Set(tokenize(question, { keepStopwords: true }));
  const geneRoot = normalizeForSearch("\u0433\u0435\u043d");
  const hasGeneToken = [...tokens].some((token) => token === geneRoot || token.startsWith(geneRoot));
  const hasMutationCue =
    containsNormalizedPhrase(normalized, "\u043c\u0443\u0442\u0430\u0446") ||
    containsNormalizedPhrase(normalized, "\u043f\u043e\u043b\u0438\u043c\u043e\u0440\u0444");
  return hasGeneToken && hasMutationCue;
}

/** Оставляет из вопроса только негeneric-токены для привязки gene-предложения. */
function geneQuestionFocusTokens(question) {
  return uniqueTokens(question).filter((token) => token.length >= 4 && !GENE_QUESTION_GENERIC_TOKENS.has(token));
}

/**
 * Делит текст PDF на достаточно длинные предложения. Для biomedical-symbol
 * задач предложение часто надежнее широкого окна, потому что список генов
 * обычно находится в одной фразе.
 */
export function sentenceSegments(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/u)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length >= 24);
}

/** Возвращает точное или OCR-вариантное попадание gene-token в предложении. */
function geneSentenceHit(sentence, answerText) {
  const answerTokens = latinAnswerTokens(answerText);
  if (!answerTokens.length || answerTokens.length > 2) return null;
  const sentenceTokens = new Set(relaxedLatinTokens(sentence));
  for (const token of answerTokens) {
    let bestVariant = null;
    for (const variant of geneTokenVariants(token)) {
      if (sentenceTokens.has(variant)) {
        bestVariant = variant;
        break;
      }
    }
    if (bestVariant) return { token, variant: bestVariant };
  }
  return null;
}

/**
 * Для вопросов про мутации генов выбирает предложение с фокусом вопроса и
 * проверяет, есть ли в нем вариант ответа как латинский или OCR-искаженный код.
 */
export function bestGeneSentenceSupport({ pages, topQuestionPages, question, answer }) {
  if (!geneMutationQuestion(question)) return null;
  const focusTokens = geneQuestionFocusTokens(question);
  let best = null;

  for (const page of pages) {
    const nearTopPage =
      !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
    if (!nearTopPage) continue;
    for (const sentence of sentenceSegments(page.text)) {
      const normalized = normalizeForSearch(sentence);
      const hasGeneCue = containsNormalizedPhrase(normalized, "\u0433\u0435\u043d");
      if (!hasGeneCue) continue;
      const sentenceTokens = tokenizeNormalized(normalized);
      const focusHits = tokenHitCount(focusTokens, sentenceTokens);
      if (focusTokens.length && focusHits <= 0) continue;
      const hit = geneSentenceHit(sentence, answer.text);
      if (!hit) continue;
      const score = 13.6 + Math.min(3, focusHits) * 1.35 + (hit.variant === hit.token.toLowerCase() ? 2.2 : 1.4);
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text: sentence,
        score,
        kind: "gene_sentence_segment",
      });
    }
  }
  return best;
}
