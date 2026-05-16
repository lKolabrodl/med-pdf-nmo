const CYRILLIC_LOOKALIKES = new Map([
  ["а", "a"],
  ["в", "b"],
  ["е", "e"],
  ["к", "k"],
  ["м", "m"],
  ["н", "h"],
  ["о", "o"],
  ["р", "p"],
  ["с", "c"],
  ["т", "t"],
  ["у", "y"],
  ["х", "x"],
]);

const LATIN_LOOKALIKES = new Map([
  ["a", "a"],
  ["b", "b"],
  ["c", "c"],
  ["e", "e"],
  ["h", "h"],
  ["k", "k"],
  ["m", "m"],
  ["o", "o"],
  ["p", "p"],
  ["t", "t"],
  ["x", "x"],
  ["y", "y"],
]);

const DASHES = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g;
const SPACES = /[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000]/g;
const NUMERIC_REFERENCE_MARKS = /\s*\[\s*\d+(?:\s*(?:[,;]|\u2010|\u2011|\u2012|\u2013|\u2014|\u2015|-)\s*\d+)*\s*\](?=\s*(?:[.,;:]|$))/g;

/**
 * Стоп-слова, которые удаляются из большинства поисковых token-запросов.
 */
export const RUSSIAN_STOPWORDS = new Set([
  "а",
  "без",
  "более",
  "был",
  "была",
  "были",
  "было",
  "быть",
  "в",
  "во",
  "все",
  "для",
  "до",
  "его",
  "ее",
  "если",
  "же",
  "за",
  "и",
  "из",
  "или",
  "им",
  "их",
  "к",
  "как",
  "ко",
  "на",
  "над",
  "не",
  "ни",
  "но",
  "о",
  "об",
  "от",
  "по",
  "под",
  "при",
  "с",
  "со",
  "так",
  "также",
  "то",
  "у",
  "что",
  "это",
  "является",
  "являются",
  "следует",
  "следующие",
  "следующим",
  "следующих",
  "выделяют",
  "относят",
  "относится",
  "составляет",
  "составляют",
  "характеризуется",
  "имеет",
  "имеют",
]);

const IMPORTANT_SHORT = new Set([
  "а",
  "b",
  "c",
  "d",
  "e",
  "h",
  "k",
  "m",
  "p",
  "q",
  "s",
  "t",
  "y",
  "a1",
  "a2",
  "a3",
  "b1",
  "b2",
  "b3",
  "c1",
  "c2",
  "c3",
  "t1",
  "t2",
  "n1",
  "n2",
  "m1",
]);

const STEM_SUFFIXES = [
  "иями",
  "ями",
  "ами",
  "ости",
  "ость",
  "ение",
  "ения",
  "ений",
  "иями",
  "ический",
  "ическая",
  "ические",
  "ического",
  "ических",
  "ически",
  "ировать",
  "ирован",
  "ированн",
  "ого",
  "ему",
  "ыми",
  "ими",
  "ыми",
  "ими",
  "ая",
  "яя",
  "ое",
  "ее",
  "ые",
  "ие",
  "ый",
  "ий",
  "ой",
  "ых",
  "их",
  "ую",
  "юю",
  "ам",
  "ям",
  "ах",
  "ях",
  "ом",
  "ем",
  "ей",
  "ой",
  "ия",
  "ие",
  "ии",
  "ию",
  "ью",
  "а",
  "я",
  "ы",
  "и",
  "е",
  "у",
  "ю",
];

STEM_SUFFIXES.push(
  "\u043e\u0432",
  "\u0435\u0432",
  "\u0438\u0447\u0435\u0441\u043a\u0443\u044e",
  "\u0438\u0447\u0435\u0441\u043a\u043e\u0439",
  "\u0438\u0447\u0435\u0441\u043a\u0438\u043c",
  "\u0438\u0447\u0435\u0441\u043a\u0438\u043c\u0438",
  "\u0435\u0441\u043a\u0443\u044e",
  "\u0435\u0441\u043a\u043e\u0439",
  "\u0435\u0441\u043a\u0438\u043c",
  "\u0435\u0441\u043a\u0438\u043c\u0438",
);

const NUMBER_WORD_PAIRS = [
  ["\u043d\u043e\u043b\u044c", "0"],
  ["\u043e\u0434\u0438\u043d", "1"],
  ["\u043e\u0434\u043d\u0430", "1"],
  ["\u043e\u0434\u043d\u043e", "1"],
  ["\u043e\u0434\u043d\u043e\u0433\u043e", "1"],
  ["\u043e\u0434\u043d\u043e\u0439", "1"],
  ["\u043e\u0434\u043d\u0438\u043c", "1"],
  ["\u0434\u0432\u0430", "2"],
  ["\u0434\u0432\u0435", "2"],
  ["\u0434\u0432\u0443\u0445", "2"],
  ["\u0434\u0432\u0443\u043c", "2"],
  ["\u0442\u0440\u0438", "3"],
  ["\u0442\u0440\u0435\u0445", "3"],
  ["\u0442\u0440\u0435\u043c", "3"],
  ["\u0447\u0435\u0442\u044b\u0440\u0435", "4"],
  ["\u0447\u0435\u0442\u044b\u0440\u0435\u0445", "4"],
  ["\u0447\u0435\u0442\u044b\u0440\u0435\u043c", "4"],
  ["\u043f\u044f\u0442\u044c", "5"],
  ["\u043f\u044f\u0442\u0438", "5"],
  ["\u043f\u044f\u0442\u044c\u044e", "5"],
  ["\u0448\u0435\u0441\u0442\u044c", "6"],
  ["\u0448\u0435\u0441\u0442\u0438", "6"],
  ["\u0448\u0435\u0441\u0442\u044c\u044e", "6"],
  ["\u0441\u0435\u043c\u044c", "7"],
  ["\u0441\u0435\u043c\u0438", "7"],
  ["\u0441\u0435\u043c\u044c\u044e", "7"],
  ["\u0432\u043e\u0441\u0435\u043c\u044c", "8"],
  ["\u0432\u043e\u0441\u044c\u043c\u0438", "8"],
  ["\u0432\u043e\u0441\u0435\u043c\u044c\u044e", "8"],
  ["\u0434\u0435\u0432\u044f\u0442\u044c", "9"],
  ["\u0434\u0435\u0432\u044f\u0442\u0438", "9"],
  ["\u0434\u0435\u0432\u044f\u0442\u044c\u044e", "9"],
  ["\u0434\u0435\u0441\u044f\u0442\u044c", "10"],
  ["\u0434\u0435\u0441\u044f\u0442\u0438", "10"],
  ["\u043e\u0434\u0438\u043d\u043d\u0430\u0434\u0446\u0430\u0442\u044c", "11"],
  ["\u043e\u0434\u0438\u043d\u043d\u0430\u0434\u0446\u0430\u0442\u0438", "11"],
  ["\u0434\u0432\u0435\u043d\u0430\u0434\u0446\u0430\u0442\u044c", "12"],
  ["\u0434\u0432\u0435\u043d\u0430\u0434\u0446\u0430\u0442\u0438", "12"],
];

let foldedNumberWords = null;
let foldedStemSuffixes = null;

/**
 * Нормализует сырой текст PDF, вопроса или ответа перед поисковой обработкой.
 *
 * Обрабатывает Unicode-форму, пробелы, варианты тире, десятичные разделители и
 * частые медицинские символы, сохраняя структуру текста для дальнейшей
 * токенизации.
 */
export function normalizeText(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .replace(SPACES, " ")
    .replace(DASHES, "-")
    .replace(NUMERIC_REFERENCE_MARKS, "")
    .replace(/[βΒ]/g, " beta ")
    .replace(/[αΑ]/g, " alpha ")
    .replace(/[γΓ]/g, " gamma ")
    .replace(/\u0430\u043b\u044c\u0444\u0430/giu, "alpha")
    .replace(/\u0431\u0435\u0442\u0430/giu, "beta")
    .replace(/\u0433\u0430\u043c\u043c\u0430/giu, "gamma")
    .replace(/[“”„«»]/g, '"')
    .replace(/[’‘`´]/g, "'")
    .replace(/ё/g, "е")
    .replace(/Ё/g, "Е")
    .replace(/№/g, " no ")
    .replace(/([0-9])\s*[xх×]\s*10/g, "$1x10")
    .replace(/([0-9])\s*,\s*([0-9])/g, "$1.$2")
    .replace(/([0-9])\s*-\s*([0-9])/g, "$1-$2")
    .replace(/([а-я])([a-z0-9])/giu, "$1 $2")
    .replace(/([a-z0-9])([а-я])/giu, "$1 $2")
    .replace(/([a-zа-я])-([a-zа-я])/giu, "$1$2")
    .replace(/([a-zа-я])-\s+([a-zа-я])/giu, "$1$2")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Приводит визуально похожие кириллические и латинские символы к общей форме.
 */
export function foldLookalikes(text) {
  const source = normalizeText(text);
  let out = "";
  for (const ch of source) {
    out += CYRILLIC_LOOKALIKES.get(ch) ?? LATIN_LOOKALIKES.get(ch) ?? ch;
  }
  return out;
}

/**
 * Переводит текст в нормализованную поисковую форму для фразового и token-match.
 */
export function normalizeForSearch(text) {
  return foldLookalikes(text)
    .replace(/([0-9])\s*%\s*/g, "$1% ")
    .replace(/[^a-zа-я0-9%./+-]+/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Токенизирует текст для поиска и скоринга.
 *
 * @param text Сырой или нормализованный текст.
 * @param options Переключатели фильтрации стоп-слов и стемминга.
 * @returns Поисковые токены и безопасные расширения для составных/медицинских форм.
 */
export function tokenize(text, { keepStopwords = false, stem = true } = {}) {
  const normalized = normalizeForSearch(text);
  const tokens = normalized.match(/[a-zа-я0-9]+(?:[.%/+-][a-zа-я0-9]+)*/giu) ?? [];
  const result = [];
  for (const token of tokens) {
    if (!token) continue;
    if (!keepStopwords && token.length > 1 && RUSSIAN_STOPWORDS.has(token)) continue;
    if (!keepStopwords && token.length === 1 && !IMPORTANT_SHORT.has(token) && !/^\d$/.test(token)) continue;
    const normalizedToken = stem ? stemToken(token) : token;
    result.push(normalizedToken, ...expandToken(normalizedToken));
    for (const part of compoundTokenParts(token)) {
      const normalizedPart = stem ? stemToken(part) : part;
      if (normalizedPart && normalizedPart !== normalizedToken) {
        result.push(normalizedPart, ...expandToken(normalizedPart));
      }
    }
  }
  return result;
}

/**
 * Токенизирует текст и удаляет дубликаты, сохраняя порядок первого появления.
 */
export function uniqueTokens(text, options = {}) {
  return [...new Set(tokenize(text, options))];
}

/**
 * Применяет легкий русский/медицинский suffix-стеммер для эвристического
 * predictor.
 */
export function stemToken(token) {
  if (/^[0-9]+(?:[./+-][0-9a-zа-я]+)*%?$/iu.test(token)) return token;
  if (token.length <= 4) return token;
  for (const suffix of stemSuffixes()) {
    if (token.length - suffix.length >= 4 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length);
    }
  }
  return token;
}

function stemSuffixes() {
  if (!foldedStemSuffixes) {
    foldedStemSuffixes = [...new Set(STEM_SUFFIXES.flatMap((suffix) => [suffix, foldLookalikes(suffix)]))]
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
  }
  return foldedStemSuffixes;
}

function compoundTokenParts(token) {
  if (!/[a-zР°-СЏ].*[\/+].*[a-zР°-СЏ]/iu.test(token)) return [];
  return token
    .split(/[\/+]+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && !/^\d+$/u.test(part));
}

function expandToken(token) {
  const out = [];
  if (/средн.*тяж/.test(token)) out.push("средн", "тяжел", "тяжест");
  if (/легк/.test(token)) out.push("легк");
  if (/тяжел|тяжест/.test(token)) out.push("тяжел", "тяжест");
  if (/крайн.*тяж/.test(token)) out.push("крайн", "тяжел", "тяжест");
  if (/умерен/.test(token)) out.push("средн");
  return out.filter((item) => item !== token);
}

/**
 * Извлекает числовые токены и поддержанные русские числительные из текста.
 */
export function extractNumbers(text) {
  const normalized = normalizeForSearch(text);
  const numeric = normalized.match(/\d+(?:[.,]\d+)?(?:-\d+(?:[.,]\d+)?)?%?/g) ?? [];
  const wordNumbers = (normalized.match(/[a-zа-я]+/giu) ?? [])
    .map((token) => numberWordValue(token) ?? numberWordValue(stemToken(token)))
    .filter(Boolean);
  return [...numeric, ...wordNumbers];
}

function numberWordValue(token) {
  if (!foldedNumberWords) {
    foldedNumberWords = new Map();
    for (const [word, value] of NUMBER_WORD_PAIRS) {
      const folded = foldLookalikes(word);
      foldedNumberWords.set(folded, value);
      foldedNumberWords.set(stemToken(folded), value);
    }
  }
  return foldedNumberWords.get(String(token ?? "").toLowerCase());
}

/**
 * Определяет общие признаки вопроса, которые используют downstream scorers.
 */
export function detectQuestionIntent(question) {
  const q = normalizeForSearch(question);
  const raw = normalizeText(question);
  const negative =
    /\b(не|нет|кроме|исключая|исключить|неверно|ошибочно|противопоказан|неправильн)\b/.test(q) ||
    /не\s+(?:относ|явля|рекоменду|показан|характериз|следует|применя)/.test(q);
  const exception = /\b(кроме|исключая|за\s+исключением|все\s+кроме)\b/.test(q);
  const numeric = extractNumbers(question).length > 0 || /\b(доз|процент|лет|мг|мл|мм|балл|сут|час|недель|дней)\b/.test(q);
  const listLike =
    /(относятся|включа|выделяют|являются|следующие|применяются|проводят|рекомендуются|показан|критериями|факторами)/.test(raw) ||
    /^к\s+.+\s+относятся/u.test(raw);
  return { negative, exception, numeric, listLike };
}

/**
 * Считает Jaccard similarity для двух массивов токенов.
 */
export function jaccard(a, b) {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  let hit = 0;
  for (const token of new Set(b)) {
    if (setA.has(token)) hit += 1;
  }
  return hit / Math.max(setA.size, new Set(b).size);
}

/**
 * Доля уникальных токенов запроса, найденных среди токенов документа.
 */
export function coverage(queryTokens, documentTokens) {
  if (!queryTokens.length || !documentTokens.length) return 0;
  const doc = new Set(documentTokens);
  let hit = 0;
  const uniq = [...new Set(queryTokens)];
  for (const token of uniq) {
    if (doc.has(token)) hit += 1;
  }
  return hit / uniq.length;
}

/**
 * Экранирует текст для безопасного использования как literal-фрагмент RegExp.
 */
export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Токенизирует фразу без стемминга и удаления стоп-слов.
 */
export function phraseTokens(text) {
  return tokenize(text, { keepStopwords: true, stem: false });
}

/**
 * Создает мягкий whitespace-tolerant RegExp для нормализованной фразы.
 */
export function phrasePattern(text) {
  const tokens = phraseTokens(text);
  if (!tokens.length) return null;
  return new RegExp(tokens.map(escapeRegExp).join("\\s+"), "i");
}
