var NmoPdfEasy = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/browser.ts
  var browser_exports = {};
  __export(browser_exports, {
    answerQuestion: () => answerQuestion,
    clearPredictorCache: () => clearPredictorCache,
    predict: () => predict,
    setPdfJsLib: () => setPdfJsLib
  });

  // src/normalize.ts
  var CYRILLIC_LOOKALIKES = /* @__PURE__ */ new Map([
    ["\u0430", "a"],
    ["\u0432", "b"],
    ["\u0435", "e"],
    ["\u043A", "k"],
    ["\u043C", "m"],
    ["\u043D", "h"],
    ["\u043E", "o"],
    ["\u0440", "p"],
    ["\u0441", "c"],
    ["\u0442", "t"],
    ["\u0443", "y"],
    ["\u0445", "x"]
  ]);
  var LATIN_LOOKALIKES = /* @__PURE__ */ new Map([
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
    ["y", "y"]
  ]);
  var DASHES = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g;
  var SPACES = /[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000]/g;
  var RUSSIAN_STOPWORDS = /* @__PURE__ */ new Set([
    "\u0430",
    "\u0431\u0435\u0437",
    "\u0431\u043E\u043B\u0435\u0435",
    "\u0431\u044B\u043B",
    "\u0431\u044B\u043B\u0430",
    "\u0431\u044B\u043B\u0438",
    "\u0431\u044B\u043B\u043E",
    "\u0431\u044B\u0442\u044C",
    "\u0432",
    "\u0432\u043E",
    "\u0432\u0441\u0435",
    "\u0434\u043B\u044F",
    "\u0434\u043E",
    "\u0435\u0433\u043E",
    "\u0435\u0435",
    "\u0435\u0441\u043B\u0438",
    "\u0436\u0435",
    "\u0437\u0430",
    "\u0438",
    "\u0438\u0437",
    "\u0438\u043B\u0438",
    "\u0438\u043C",
    "\u0438\u0445",
    "\u043A",
    "\u043A\u0430\u043A",
    "\u043A\u043E",
    "\u043D\u0430",
    "\u043D\u0430\u0434",
    "\u043D\u0435",
    "\u043D\u0438",
    "\u043D\u043E",
    "\u043E",
    "\u043E\u0431",
    "\u043E\u0442",
    "\u043F\u043E",
    "\u043F\u043E\u0434",
    "\u043F\u0440\u0438",
    "\u0441",
    "\u0441\u043E",
    "\u0442\u0430\u043A",
    "\u0442\u0430\u043A\u0436\u0435",
    "\u0442\u043E",
    "\u0443",
    "\u0447\u0442\u043E",
    "\u044D\u0442\u043E",
    "\u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F",
    "\u044F\u0432\u043B\u044F\u044E\u0442\u0441\u044F",
    "\u0441\u043B\u0435\u0434\u0443\u0435\u0442",
    "\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0435",
    "\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u043C",
    "\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0445",
    "\u0432\u044B\u0434\u0435\u043B\u044F\u044E\u0442",
    "\u043E\u0442\u043D\u043E\u0441\u044F\u0442",
    "\u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0441\u044F",
    "\u0441\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442",
    "\u0441\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u044E\u0442",
    "\u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0437\u0443\u0435\u0442\u0441\u044F",
    "\u0438\u043C\u0435\u0435\u0442",
    "\u0438\u043C\u0435\u044E\u0442"
  ]);
  var IMPORTANT_SHORT = /* @__PURE__ */ new Set([
    "\u0430",
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
    "m1"
  ]);
  var STEM_SUFFIXES = [
    "\u0438\u044F\u043C\u0438",
    "\u044F\u043C\u0438",
    "\u0430\u043C\u0438",
    "\u043E\u0441\u0442\u0438",
    "\u043E\u0441\u0442\u044C",
    "\u0435\u043D\u0438\u0435",
    "\u0435\u043D\u0438\u044F",
    "\u0435\u043D\u0438\u0439",
    "\u0438\u044F\u043C\u0438",
    "\u0438\u0447\u0435\u0441\u043A\u0438\u0439",
    "\u0438\u0447\u0435\u0441\u043A\u0430\u044F",
    "\u0438\u0447\u0435\u0441\u043A\u0438\u0435",
    "\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E",
    "\u0438\u0447\u0435\u0441\u043A\u0438\u0445",
    "\u0438\u0447\u0435\u0441\u043A\u0438",
    "\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
    "\u0438\u0440\u043E\u0432\u0430\u043D",
    "\u0438\u0440\u043E\u0432\u0430\u043D\u043D",
    "\u043E\u0433\u043E",
    "\u0435\u043C\u0443",
    "\u044B\u043C\u0438",
    "\u0438\u043C\u0438",
    "\u044B\u043C\u0438",
    "\u0438\u043C\u0438",
    "\u0430\u044F",
    "\u044F\u044F",
    "\u043E\u0435",
    "\u0435\u0435",
    "\u044B\u0435",
    "\u0438\u0435",
    "\u044B\u0439",
    "\u0438\u0439",
    "\u043E\u0439",
    "\u044B\u0445",
    "\u0438\u0445",
    "\u0443\u044E",
    "\u044E\u044E",
    "\u0430\u043C",
    "\u044F\u043C",
    "\u0430\u0445",
    "\u044F\u0445",
    "\u043E\u043C",
    "\u0435\u043C",
    "\u0435\u0439",
    "\u043E\u0439",
    "\u0438\u044F",
    "\u0438\u0435",
    "\u0438\u0438",
    "\u0438\u044E",
    "\u044C\u044E",
    "\u0430",
    "\u044F",
    "\u044B",
    "\u0438",
    "\u0435",
    "\u0443",
    "\u044E"
  ];
  STEM_SUFFIXES.push(
    "\u043E\u0432",
    "\u0435\u0432",
    "\u0438\u0447\u0435\u0441\u043A\u0443\u044E",
    "\u0438\u0447\u0435\u0441\u043A\u043E\u0439",
    "\u0438\u0447\u0435\u0441\u043A\u0438\u043C",
    "\u0438\u0447\u0435\u0441\u043A\u0438\u043C\u0438",
    "\u0435\u0441\u043A\u0443\u044E",
    "\u0435\u0441\u043A\u043E\u0439",
    "\u0435\u0441\u043A\u0438\u043C",
    "\u0435\u0441\u043A\u0438\u043C\u0438"
  );
  var NUMBER_WORD_PAIRS = [
    ["\u043D\u043E\u043B\u044C", "0"],
    ["\u043E\u0434\u0438\u043D", "1"],
    ["\u043E\u0434\u043D\u0430", "1"],
    ["\u043E\u0434\u043D\u043E", "1"],
    ["\u043E\u0434\u043D\u043E\u0433\u043E", "1"],
    ["\u043E\u0434\u043D\u043E\u0439", "1"],
    ["\u043E\u0434\u043D\u0438\u043C", "1"],
    ["\u0434\u0432\u0430", "2"],
    ["\u0434\u0432\u0435", "2"],
    ["\u0434\u0432\u0443\u0445", "2"],
    ["\u0434\u0432\u0443\u043C", "2"],
    ["\u0442\u0440\u0438", "3"],
    ["\u0442\u0440\u0435\u0445", "3"],
    ["\u0442\u0440\u0435\u043C", "3"],
    ["\u0447\u0435\u0442\u044B\u0440\u0435", "4"],
    ["\u0447\u0435\u0442\u044B\u0440\u0435\u0445", "4"],
    ["\u0447\u0435\u0442\u044B\u0440\u0435\u043C", "4"],
    ["\u043F\u044F\u0442\u044C", "5"],
    ["\u043F\u044F\u0442\u0438", "5"],
    ["\u043F\u044F\u0442\u044C\u044E", "5"],
    ["\u0448\u0435\u0441\u0442\u044C", "6"],
    ["\u0448\u0435\u0441\u0442\u0438", "6"],
    ["\u0448\u0435\u0441\u0442\u044C\u044E", "6"],
    ["\u0441\u0435\u043C\u044C", "7"],
    ["\u0441\u0435\u043C\u0438", "7"],
    ["\u0441\u0435\u043C\u044C\u044E", "7"],
    ["\u0432\u043E\u0441\u0435\u043C\u044C", "8"],
    ["\u0432\u043E\u0441\u044C\u043C\u0438", "8"],
    ["\u0432\u043E\u0441\u0435\u043C\u044C\u044E", "8"],
    ["\u0434\u0435\u0432\u044F\u0442\u044C", "9"],
    ["\u0434\u0435\u0432\u044F\u0442\u0438", "9"],
    ["\u0434\u0435\u0432\u044F\u0442\u044C\u044E", "9"],
    ["\u0434\u0435\u0441\u044F\u0442\u044C", "10"],
    ["\u0434\u0435\u0441\u044F\u0442\u0438", "10"],
    ["\u043E\u0434\u0438\u043D\u043D\u0430\u0434\u0446\u0430\u0442\u044C", "11"],
    ["\u043E\u0434\u0438\u043D\u043D\u0430\u0434\u0446\u0430\u0442\u0438", "11"],
    ["\u0434\u0432\u0435\u043D\u0430\u0434\u0446\u0430\u0442\u044C", "12"],
    ["\u0434\u0432\u0435\u043D\u0430\u0434\u0446\u0430\u0442\u0438", "12"]
  ];
  var foldedNumberWords = null;
  var foldedStemSuffixes = null;
  function normalizeText(text) {
    return String(text ?? "").normalize("NFKC").replace(SPACES, " ").replace(DASHES, "-").replace(/[βΒ]/g, " beta ").replace(/[αΑ]/g, " alpha ").replace(/[γΓ]/g, " gamma ").replace(/[“”„«»]/g, '"').replace(/[’‘`´]/g, "'").replace(/ё/g, "\u0435").replace(/Ё/g, "\u0415").replace(/№/g, " no ").replace(/([0-9])\s*[xх×]\s*10/g, "$1x10").replace(/([0-9])\s*,\s*([0-9])/g, "$1.$2").replace(/([0-9])\s*-\s*([0-9])/g, "$1-$2").replace(/([а-я])([a-z0-9])/giu, "$1 $2").replace(/([a-z0-9])([а-я])/giu, "$1 $2").replace(/([a-zа-я])-([a-zа-я])/giu, "$1$2").replace(/([a-zа-я])-\s+([a-zа-я])/giu, "$1$2").replace(/\s+/g, " ").trim().toLowerCase();
  }
  function foldLookalikes(text) {
    const source = normalizeText(text);
    let out = "";
    for (const ch of source) {
      out += CYRILLIC_LOOKALIKES.get(ch) ?? LATIN_LOOKALIKES.get(ch) ?? ch;
    }
    return out;
  }
  function normalizeForSearch(text) {
    return foldLookalikes(text).replace(/([0-9])\s*%\s*/g, "$1% ").replace(/[^a-zа-я0-9%./+-]+/giu, " ").replace(/\s+/g, " ").trim();
  }
  function tokenize(text, { keepStopwords = false, stem = true } = {}) {
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
  function uniqueTokens(text, options = {}) {
    return [...new Set(tokenize(text, options))];
  }
  function stemToken(token) {
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
      foldedStemSuffixes = [...new Set(STEM_SUFFIXES.flatMap((suffix) => [suffix, foldLookalikes(suffix)]))].filter(Boolean).sort((a, b) => b.length - a.length);
    }
    return foldedStemSuffixes;
  }
  function compoundTokenParts(token) {
    if (!/[a-zР°-СЏ].*[\/+].*[a-zР°-СЏ]/iu.test(token)) return [];
    return token.split(/[\/+]+/u).map((part) => part.trim()).filter((part) => part.length > 1 && !/^\d+$/u.test(part));
  }
  function expandToken(token) {
    const out = [];
    if (/средн.*тяж/.test(token)) out.push("\u0441\u0440\u0435\u0434\u043D", "\u0442\u044F\u0436\u0435\u043B", "\u0442\u044F\u0436\u0435\u0441\u0442");
    if (/легк/.test(token)) out.push("\u043B\u0435\u0433\u043A");
    if (/тяжел|тяжест/.test(token)) out.push("\u0442\u044F\u0436\u0435\u043B", "\u0442\u044F\u0436\u0435\u0441\u0442");
    if (/крайн.*тяж/.test(token)) out.push("\u043A\u0440\u0430\u0439\u043D", "\u0442\u044F\u0436\u0435\u043B", "\u0442\u044F\u0436\u0435\u0441\u0442");
    if (/умерен/.test(token)) out.push("\u0441\u0440\u0435\u0434\u043D");
    return out.filter((item) => item !== token);
  }
  function extractNumbers(text) {
    const normalized = normalizeForSearch(text);
    const numeric = normalized.match(/\d+(?:[.,]\d+)?(?:-\d+(?:[.,]\d+)?)?%?/g) ?? [];
    const wordNumbers = (normalized.match(/[a-zа-я]+/giu) ?? []).map((token) => numberWordValue(token) ?? numberWordValue(stemToken(token))).filter(Boolean);
    return [...numeric, ...wordNumbers];
  }
  function numberWordValue(token) {
    if (!foldedNumberWords) {
      foldedNumberWords = /* @__PURE__ */ new Map();
      for (const [word, value] of NUMBER_WORD_PAIRS) {
        const folded = foldLookalikes(word);
        foldedNumberWords.set(folded, value);
        foldedNumberWords.set(stemToken(folded), value);
      }
    }
    return foldedNumberWords.get(String(token ?? "").toLowerCase());
  }
  function detectQuestionIntent(question) {
    const q = normalizeForSearch(question);
    const raw = normalizeText(question);
    const negative = /\b(не|нет|кроме|исключая|исключить|неверно|ошибочно|противопоказан|неправильн)\b/.test(q) || /не\s+(?:относ|явля|рекоменду|показан|характериз|следует|применя)/.test(q);
    const exception = /\b(кроме|исключая|за\s+исключением|все\s+кроме)\b/.test(q);
    const numeric = extractNumbers(question).length > 0 || /\b(доз|процент|лет|мг|мл|мм|балл|сут|час|недель|дней)\b/.test(q);
    const listLike = /(относятся|включа|выделяют|являются|следующие|применяются|проводят|рекомендуются|показан|критериями|факторами)/.test(raw) || /^к\s+.+\s+относятся/u.test(raw);
    return { negative, exception, numeric, listLike };
  }
  function jaccard(a, b) {
    if (!a.length || !b.length) return 0;
    const setA = new Set(a);
    let hit = 0;
    for (const token of new Set(b)) {
      if (setA.has(token)) hit += 1;
    }
    return hit / Math.max(setA.size, new Set(b).size);
  }
  function coverage(queryTokens, documentTokens) {
    if (!queryTokens.length || !documentTokens.length) return 0;
    const doc = new Set(documentTokens);
    let hit = 0;
    const uniq = [...new Set(queryTokens)];
    for (const token of uniq) {
      if (doc.has(token)) hit += 1;
    }
    return hit / uniq.length;
  }
  function phraseTokens(text) {
    return tokenize(text, { keepStopwords: true, stem: false });
  }

  // src/predictor/constants.ts
  var FOCUS_STOPWORD_TEXT = [
    "\u043F\u0430\u0446\u0438\u0435\u043D\u0442",
    "\u043F\u0430\u0446\u0438\u0435\u043D\u0442\u044B",
    "\u043F\u0430\u0446\u0438\u0435\u043D\u0442\u0430\u043C",
    "\u0431\u043E\u043B\u044C\u043D\u043E\u0439",
    "\u0431\u043E\u043B\u044C\u043D\u044B\u043C",
    "\u043F\u043E\u0441\u0442\u0440\u0430\u0434\u0430\u0432\u0448\u0438\u0439",
    "\u043F\u043E\u0441\u0442\u0440\u0430\u0434\u0430\u0432\u0448\u0438\u043C",
    "\u0437\u0430\u0431\u043E\u043B\u0435\u0432\u0430\u043D\u0438\u0435",
    "\u0437\u0430\u0431\u043E\u043B\u0435\u0432\u0430\u043D\u0438\u044F",
    "\u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435",
    "\u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F",
    "\u0433\u0440\u0443\u043F\u043F\u0430",
    "\u0433\u0440\u0443\u043F\u043F\u044B",
    "\u043E\u0441\u0442\u0440\u044B\u0439",
    "\u043E\u0441\u0442\u0440\u044B\u043C",
    "\u0445\u0440\u043E\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0439",
    "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u0442\u0441\u044F",
    "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u043E\u0432\u0430\u043D\u043E",
    "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u043E\u0432\u0430\u043D\u044B",
    "\u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u0435",
    "\u043F\u0440\u043E\u0432\u043E\u0434\u0438\u0442\u0441\u044F",
    "\u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0438\u0435",
    "\u043D\u0430\u0437\u043D\u0430\u0447\u0430\u0435\u0442\u0441\u044F",
    "\u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435",
    "\u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F",
    "\u044F\u0432\u043B\u044F\u044E\u0442\u0441\u044F",
    "\u043E\u0442\u043D\u043E\u0441\u044F\u0442\u0441\u044F",
    "\u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0441\u044F",
    "\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0435",
    "\u043C\u0435\u0442\u043E\u0434",
    "\u043C\u0435\u0442\u043E\u0434\u044B",
    "\u0446\u0435\u043B\u044C",
    "\u0446\u0435\u043B\u044C\u044E",
    "\u0434\u0430\u043D\u043D\u044B\u0435",
    "\u0434\u0430\u043D\u043D\u044B\u0445",
    "\u043D\u0430\u043B\u0438\u0447\u0438\u0435",
    "\u0444\u043E\u0440\u043C\u0430",
    "\u0444\u043E\u0440\u043C\u044B",
    "\u0442\u0438\u043F",
    "\u0432\u0438\u0434",
    "\u0432\u0438\u0434\u044B"
  ];
  var FOCUS_STOPWORDS = new Set(FOCUS_STOPWORD_TEXT.flatMap((item) => uniqueTokens(item)));
  var LABEL_CUES = ["\u043B\u0435\u0433\u043A", "\u0441\u0440\u0435\u0434\u043D", "\u0442\u044F\u0436\u0435\u043B", "\u043A\u0440\u0430\u0439\u043D", "\u0443\u043C\u0435\u0440\u0435\u043D", "\u043B\u043E\u043A\u0430\u043B\u0438\u0437\u043E\u0432\u0430\u043D", "\u0433\u0435\u043D\u0435\u0440\u0430\u043B\u0438\u0437\u043E\u0432\u0430\u043D"].map((item) => normalizeForSearch(item));
  var SECTION_GENERIC_TOKENS = new Set(
    [
      "\u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u0435",
      "\u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F",
      "\u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435",
      "\u0434\u044B\u0445\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439",
      "\u0434\u044B\u0445\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0445",
      "\u043F\u0443\u0442\u044C",
      "\u043F\u0443\u0442\u0435\u0439",
      "\u043E\u0440\u0433\u0430\u043D",
      "\u043E\u0440\u0433\u0430\u043D\u044B",
      "\u0442\u043A\u0430\u043D\u044C",
      "\u0441\u0438\u0441\u0442\u0435\u043C\u0430"
    ].flatMap((item) => uniqueTokens(item))
  );

  // src/predictor/config.ts
  var DEFAULT_CONFIG = {
    multiRelativeThreshold: 0.84,
    multiAbsoluteThreshold: 12,
    multiGapThreshold: 0.72,
    multiMinAnswers: 2,
    multiThirdGapThreshold: 0.45,
    multiThirdRelativeThreshold: 0.55,
    frozenFeatureRanker: true,
    multiCardinalityModel: true,
    multiAllOptionsGuard: true,
    pairwiseContrastRanker: true,
    structuralClusterAdjustments: true,
    singleSpecificityTieBreak: true,
    singleTieMaxRawGap: 0.2,
    singleTieMinRawRatio: 0.94,
    singleTieSpecificityGap: 0.5,
    sharedMultiSegmentBoost: true,
    countRelationBoost: false,
    topQuestionChunks: 28,
    evidenceLimit: 8
  };

  // src/bm25.ts
  var BM25Index = class {
    constructor(documents, { k1 = 1.35, b = 0.72 } = {}) {
      __publicField(this, "documents");
      __publicField(this, "k1");
      __publicField(this, "b");
      __publicField(this, "docFreq");
      __publicField(this, "termFreqs");
      __publicField(this, "lengths");
      __publicField(this, "avgdl");
      this.documents = documents;
      this.k1 = k1;
      this.b = b;
      this.docFreq = /* @__PURE__ */ new Map();
      this.termFreqs = [];
      this.lengths = [];
      let totalLength = 0;
      for (const document of documents) {
        const frequencies = /* @__PURE__ */ new Map();
        for (const token of document.tokens ?? []) {
          frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
        }
        this.termFreqs.push(frequencies);
        this.lengths.push(document.tokens?.length ?? 0);
        totalLength += document.tokens?.length ?? 0;
        for (const token of frequencies.keys()) {
          this.docFreq.set(token, (this.docFreq.get(token) ?? 0) + 1);
        }
      }
      this.avgdl = documents.length ? totalLength / documents.length : 0;
    }
    idf(token) {
      const n = this.documents.length;
      const df = this.docFreq.get(token) ?? 0;
      return Math.log(1 + (n - df + 0.5) / (df + 0.5));
    }
    scoreTokens(queryTokens, docIndex) {
      const frequencies = this.termFreqs[docIndex];
      if (!frequencies) return 0;
      const dl = this.lengths[docIndex] || 1;
      let score = 0;
      for (const token of queryTokens) {
        const tf = frequencies.get(token) ?? 0;
        if (!tf) continue;
        const idf = this.idf(token);
        const denom = tf + this.k1 * (1 - this.b + this.b * (dl / (this.avgdl || 1)));
        score += idf * (tf * (this.k1 + 1) / denom);
      }
      return score;
    }
    search(query, { limit = 10 } = {}) {
      const queryTokens = Array.isArray(query) ? query : tokenize(query);
      if (!queryTokens.length) return [];
      const scores = [];
      for (let i = 0; i < this.documents.length; i += 1) {
        const score = this.scoreTokens(queryTokens, i);
        if (score > 0) scores.push({ chunk: this.documents[i], score });
      }
      scores.sort((a, b) => b.score - a.score);
      return scores.slice(0, limit);
    }
  };

  // src/chunk.ts
  function splitSentences(text) {
    const normalized = String(text ?? "").replace(/\r/g, "").replace(/([.!?;])\s+(?=[А-ЯA-Z0-9])/g, "$1\n").replace(/\n{3,}/g, "\n\n");
    return normalized.split(/\n+|(?<=[.!?;])\s+/u).map((part) => part.trim()).filter((part) => part.length >= 8);
  }
  function tokenCount(text) {
    return tokenize(text, { keepStopwords: true, stem: false }).length;
  }
  function buildChunks(pdfText, { targetTokens = 95, overlapSentences = 2 } = {}) {
    const chunks = [];
    for (const page of pdfText.pages) {
      const sentences = splitSentences(page.text);
      let current = [];
      let currentTokens = 0;
      for (const sentence of sentences) {
        const sentenceTokens = Math.max(1, tokenCount(sentence));
        if (current.length && currentTokens + sentenceTokens > targetTokens) {
          chunks.push(makeChunk(page.page, current.join(" ")));
          current = current.slice(-overlapSentences);
          currentTokens = tokenCount(current.join(" "));
        }
        current.push(sentence);
        currentTokens += sentenceTokens;
      }
      if (current.length) {
        chunks.push(makeChunk(page.page, current.join(" ")));
      }
      const lines = page.text.split(/\n+/).map((line) => line.trim()).filter((line) => line.length >= 12);
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        chunks.push(makeChunk(page.page, line, "line"));
        if (i + 1 < lines.length) {
          chunks.push(makeChunk(page.page, `${line} ${lines[i + 1]}`, "line_pair"));
        }
        const listLike = /^(\d+(?:\.\d+)*[.)]?|[-*•]|[a-zа-я]\))\s+/iu.test(line);
        const headingLike = line.length < 120 && !/[.!?]$/.test(line);
        if (listLike || headingLike) {
          const context = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 5)).join(" ");
          chunks.push(makeChunk(page.page, context, listLike ? "list" : "heading"));
        }
      }
    }
    return chunks.filter((chunk) => chunk.tokens.length).map((chunk, index) => ({ ...chunk, id: index }));
  }
  function makeChunk(page, text, kind = "body") {
    return {
      page,
      kind,
      text: String(text ?? "").replace(/\s+/g, " ").trim(),
      normalized: normalizeForSearch(text),
      tokens: tokenize(text),
      rawTokens: tokenize(text, { keepStopwords: true, stem: false })
    };
  }

  // src/pdf.ts
  var configuredPdfJs = null;
  function setPdfJsLib(pdfjsLib) {
    configuredPdfJs = pdfjsLib;
  }
  async function resolvePdfJs(options = {}) {
    if (options.pdfjsLib?.getDocument) return options.pdfjsLib;
    if (configuredPdfJs?.getDocument) return configuredPdfJs;
    const fromGlobal = globalThis.pdfjsLib ?? globalThis.PDFJS;
    if (fromGlobal?.getDocument) return fromGlobal;
    try {
      return await import("pdfjs-dist/legacy/build/pdf.mjs");
    } catch {
      throw new Error(
        "PDF.js is not available. In the browser, include pdf.js before this library or call setPdfJsLib(pdfjsLib)."
      );
    }
  }
  async function toUint8Array(input) {
    if (input instanceof Uint8Array) {
      return new Uint8Array(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength));
    }
    if (input instanceof ArrayBuffer) return new Uint8Array(input.slice(0));
    if (typeof Blob !== "undefined" && input instanceof Blob) {
      return new Uint8Array(await input.arrayBuffer());
    }
    if (typeof input === "string") {
      if (typeof fetch !== "function") {
        throw new Error("String PDF input is treated as a URL, but fetch() is not available in this environment.");
      }
      const response = await fetch(input);
      if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      return new Uint8Array(await response.arrayBuffer());
    }
    if (input?.arrayBuffer && typeof input.arrayBuffer === "function") {
      return new Uint8Array(await input.arrayBuffer());
    }
    throw new Error("PDF input must be ArrayBuffer, Uint8Array, Blob/File, or URL string.");
  }
  function lineKey(item) {
    const [, , , , , y] = item.transform ?? [1, 0, 0, 1, 0, 0];
    return Math.round(y / 3) * 3;
  }
  function itemX(item) {
    return item.transform?.[4] ?? 0;
  }
  function itemY(item) {
    return item.transform?.[5] ?? 0;
  }
  function groupItemsIntoLineObjects(items) {
    const useful = items.filter((item) => typeof item.str === "string" && item.str.trim()).sort((a, b) => itemY(b) - itemY(a) || itemX(a) - itemX(b));
    const groups = [];
    for (const item of useful) {
      const key = lineKey(item);
      let group = groups.find((candidate) => Math.abs(candidate.key - key) <= 2);
      if (!group) {
        group = { key, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    }
    groups.sort((a, b) => b.key - a.key);
    return groups.map((group) => {
      const sortedItems = group.items.sort((a, b) => itemX(a) - itemX(b));
      const text = sortedItems.map((item) => item.str.trim()).join(" ").replace(/\s+/g, " ").trim();
      return {
        text,
        y: group.key,
        items: sortedItems.map((item) => ({
          text: item.str.trim(),
          x: itemX(item),
          y: itemY(item),
          width: item.width ?? 0,
          height: item.height ?? 0
        }))
      };
    }).filter((line) => line.text);
  }
  function stripLikelyBoilerplate(lines) {
    return lines.filter((line) => {
      const text = typeof line === "string" ? line : line.text;
      const normalized = normalizeForSearch(text);
      if (!normalized) return false;
      if (/^СЃС‚СЂР°РЅРёС†Р°\s+\d+\s+РёР·\s+\d+/.test(normalized)) return false;
      if (/disuria\.ru|СѓР»СѓС‡С€РµРЅРЅР°СЏ\s+РІРµСЂСЃС‚РєР°/.test(normalized)) return false;
      if (/^РєР»РёРЅРёС‡РµСЃРєРёРµ СЂРµРєРѕРјРµРЅРґР°С†РёРё\s+[-вЂ“]/.test(normalized) && normalized.length < 140) return false;
      return true;
    });
  }
  function buildPageText(lines) {
    const out = [];
    for (const line of lines) {
      const previous = out[out.length - 1] ?? "";
      const startsList = /^(\d+(?:\.\d+)*[.)]?|[-*вЂў]|[a-zР°-СЏ]\))\s+/iu.test(line);
      const previousEnds = /[.!?;:]$/.test(previous) || previous.length < 30;
      if (out.length && !startsList && !previousEnds && line.length < 100) {
        out[out.length - 1] = `${previous} ${line}`.replace(/\s+/g, " ");
      } else {
        out.push(line);
      }
    }
    return out.join("\n");
  }
  async function extractPdfText(pdfInput, options = {}) {
    const pdfjs = await resolvePdfJs(options);
    const data = await toUint8Array(pdfInput);
    const loadingTask = pdfjs.getDocument({
      data,
      disableWorker: true,
      useSystemFonts: true,
      isEvalSupported: false
    });
    const pdf = await loadingTask.promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent({
        disableCombineTextItems: false,
        includeMarkedContent: false
      });
      const lineObjects = stripLikelyBoilerplate(groupItemsIntoLineObjects(content.items));
      const lines = lineObjects.map((line) => line.text);
      const text = buildPageText(lines);
      pages.push({
        page: pageNumber,
        text,
        lines,
        lineItems: lineObjects,
        normalized: normalizeForSearch(text),
        charLength: text.length
      });
    }
    const pageTextChars = pages.reduce((sum, page) => sum + page.text.length, 0);
    return {
      pdfId: options.cacheKey ?? (typeof pdfInput === "string" ? pdfInput : "<browser-pdf>"),
      cacheVersion: 1,
      pageCount: pdf.numPages,
      extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
      pages,
      ocrNeeded: pageTextChars < Math.max(1e3, pdf.numPages * 100)
    };
  }

  // src/predictor/runtime.ts
  var keyedRuntimeCache = /* @__PURE__ */ new Map();
  var objectRuntimeCache = /* @__PURE__ */ new WeakMap();
  function answerId(index) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (index < alphabet.length) return alphabet[index];
    return `A${index + 1}`;
  }
  function normalizeAnswers(answers) {
    return answers.map((answer, index) => {
      if (typeof answer === "string") {
        return { id: answerId(index), text: answer };
      }
      return {
        id: String(answer.id ?? answerId(index)),
        text: String(answer.text ?? "")
      };
    });
  }
  function objectKey(input) {
    return input && typeof input === "object" ? input : null;
  }
  async function getPdfRuntime(pdfInput, options = {}) {
    const cacheKey = options.cacheKey ?? (typeof pdfInput === "string" ? pdfInput : null);
    if (cacheKey && keyedRuntimeCache.has(cacheKey)) return keyedRuntimeCache.get(cacheKey);
    const weakKey = objectKey(pdfInput);
    if (!cacheKey && weakKey && objectRuntimeCache.has(weakKey)) return objectRuntimeCache.get(weakKey);
    const runtimePromise = (async () => {
      const pdfText = await extractPdfText(pdfInput, options);
      const chunks = buildChunks(pdfText);
      const index = new BM25Index(chunks);
      return { pdfText, chunks, index };
    })();
    if (cacheKey) keyedRuntimeCache.set(cacheKey, runtimePromise);
    else if (weakKey) objectRuntimeCache.set(weakKey, runtimePromise);
    return runtimePromise;
  }
  function clearPdfRuntimeCache() {
    keyedRuntimeCache.clear();
  }

  // src/predictor/text-utils.ts
  function rawTokens(text) {
    return normalizeText(text).match(/[a-zа-я0-9]+/giu) ?? [];
  }
  function findPhraseOccurrences(text, phrase, { textIsNormalized = false } = {}) {
    const normalizedText = textIsNormalized ? String(text ?? "") : normalizeForSearch(text);
    const normalizedPhrase = normalizeForSearch(phrase);
    if (!normalizedText || !normalizedPhrase || normalizedPhrase.length < 2) return [];
    const hits = [];
    let start = 0;
    while (start < normalizedText.length) {
      const index = normalizedText.indexOf(normalizedPhrase, start);
      if (index < 0) break;
      hits.push(index);
      start = index + Math.max(1, normalizedPhrase.length);
      if (hits.length > 80) break;
    }
    return hits;
  }
  function hasSearchBoundaries(text, index, length) {
    const before = index > 0 ? text[index - 1] : "";
    const after = index + length < text.length ? text[index + length] : "";
    return !isSearchTokenChar(before) && !isSearchTokenChar(after);
  }
  function isSearchTokenChar(char) {
    return !!char && /[a-zа-я0-9%./+-]/iu.test(char);
  }
  function answerSearchPhrases(answerText) {
    const normalized = normalizeForSearch(answerText);
    const phrases = /* @__PURE__ */ new Set([answerText, normalized]);
    const withoutParentheses = normalized.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    if (withoutParentheses) phrases.add(withoutParentheses);
    const rawAnswerText = String(answerText ?? "");
    const rawHyphenSplit = rawAnswerText.replace(/\s*[-\u2010-\u2015]\s*/g, " ").replace(/\s+/g, " ").trim();
    if (rawHyphenSplit) phrases.add(rawHyphenSplit);
    const hyphenSplit = normalizeForSearch(rawAnswerText.replace(/\s*[-\u2010-\u2015]\s*/g, " "));
    if (hyphenSplit) phrases.add(hyphenSplit);
    const rawHyphenSpaced = rawAnswerText.replace(/\s*[-\u2010-\u2015]\s*/g, " - ").replace(/\s+/g, " ").trim();
    if (rawHyphenSpaced) phrases.add(rawHyphenSpaced);
    const hyphenSpaced = normalizeForSearch(rawAnswerText.replace(/\s*[-\u2010-\u2015]\s*/g, " - "));
    if (hyphenSpaced) phrases.add(hyphenSpaced);
    const inhibitorMatch = rawAnswerText.match(new RegExp(`\u0438\u043D\u0433\u0438\u0431\u0438\u0442\\S*\\s+([A-Z\\u0410-\\u042F]{2,8})(.*)$`, "iu"));
    if (inhibitorMatch?.[1]) {
      const abbreviated = `\u0438${inhibitorMatch[1]}${inhibitorMatch[2] ?? ""}`.replace(/\s+/g, " ").trim();
      if (abbreviated) {
        phrases.add(abbreviated);
        phrases.add(abbreviated.replace(/\s*\/\s*/g, " / ").replace(/\s+/g, " ").trim());
        phrases.add(abbreviated.replace(/\s*\/\s*/g, " ").replace(/\s+/g, " ").trim());
        phrases.add(normalizeForSearch(abbreviated));
      }
    }
    if (withoutParentheses.includes("/")) {
      phrases.add(withoutParentheses.replace(/\s*\/\s*/g, " ").replace(/\s+/g, " ").trim());
      phrases.add(withoutParentheses.replace(/\s*\/\s*/g, " \u0438 ").replace(/\s+/g, " ").trim());
    }
    const withoutUnits = withoutParentheses.replace(/\b(ме|мг|мкг|г|мл|л|мм|см|сут|час|день|дня|дней|неделя|недели|недель)\b(?:\s*\/\s*\b(мл|л|сут|час)\b)?/g, " ").replace(/\b(рт\.?\s*ст\.?|log\s*10\s*ме\s*\/\s*мл|ме\s*\/\s*мл|мг\s*\/\s*л|ммоль\s*\/\s*л)\b/g, " ").replace(/\s+/g, " ").trim();
    if (withoutUnits) phrases.add(withoutUnits);
    const tokens = phraseTokens(withoutUnits || normalized);
    if (tokens.length >= 3) {
      phrases.add(tokens.slice(0, Math.min(tokens.length, 5)).join(" "));
    }
    const numbers = extractNumbers(answerText);
    if (numbers.length === 1) {
      const aroundNumber = normalized.match(new RegExp(`(?:\\S+\\s+){0,2}${numbers[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s+\\S+){0,3}`));
      if (aroundNumber?.[0]) phrases.add(aroundNumber[0]);
    }
    return [...phrases].filter((phrase) => normalizeForSearch(phrase).length >= 2);
  }
  function focusedAnswerSearchPhrases(answerText) {
    const phrases = /* @__PURE__ */ new Set();
    const plusParts = normalizeText(answerText).split(/\s*\+\s*/u).map((part) => part.trim()).filter(Boolean);
    if (plusParts.length > 1) {
      phrases.add(plusParts.join(" + "));
      const firstTokens = rawTokens(plusParts[0]);
      if (firstTokens.length > 1) {
        phrases.add([firstTokens.slice(1).join(" "), ...plusParts.slice(1)].join(" + "));
      }
    }
    const tokens = rawTokens(answerText);
    if (tokens.length >= 3) {
      for (const length of [6, 5, 4]) {
        if (tokens.length < length) continue;
        for (let index = 0; index <= tokens.length - length; index += 1) {
          phrases.add(tokens.slice(index, index + length).join(" "));
        }
      }
    }
    for (const phrase of answerSearchPhrases(answerText)) phrases.add(phrase);
    return [...phrases].filter((phrase) => normalizeForSearch(phrase).length >= 2);
  }
  function containsNormalizedPhrase(normalizedHaystack, needle) {
    const normalizedNeedle = normalizeForSearch(needle);
    if (!normalizedNeedle) return false;
    return String(normalizedHaystack ?? "").includes(normalizedNeedle);
  }
  function tokenizeNormalized(text) {
    return (String(text ?? "").match(/[a-zа-я0-9]+(?:[.%/+-][a-zа-я0-9]+)*/giu) ?? []).map((token) => stemToken(token));
  }
  function tokenSequenceIncludes(haystackTokens, needleTokens) {
    if (!needleTokens.length || needleTokens.length > haystackTokens.length) return false;
    for (let index = 0; index <= haystackTokens.length - needleTokens.length; index += 1) {
      let ok = true;
      for (let offset = 0; offset < needleTokens.length; offset += 1) {
        if (haystackTokens[index + offset] !== needleTokens[offset]) {
          ok = false;
          break;
        }
      }
      if (ok) return true;
    }
    return false;
  }
  function rawSoftCoverage(queryTokens, documentTokens) {
    if (!queryTokens.length || !documentTokens.length) return 0;
    let hit = 0;
    for (const token of queryTokens) {
      if (/^(?:[ivx]+|\d+)$/iu.test(token)) {
        if (documentTokens.includes(token)) hit += 1;
        continue;
      }
      const prefixLength = Math.min(10, Math.max(4, token.length - 2));
      const prefix = token.slice(0, prefixLength);
      if (documentTokens.some((candidate) => candidate === token || candidate.startsWith(prefix) || token.startsWith(candidate.slice(0, prefixLength)))) {
        hit += 1;
      }
    }
    return hit / queryTokens.length;
  }
  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function softCoverage(queryTokens, documentTokens) {
    if (!queryTokens.length || !documentTokens.length) return 0;
    const doc = [...new Set(documentTokens)];
    let hit = 0;
    for (const token of new Set(queryTokens)) {
      const prefixLength = Math.min(8, Math.max(4, token.length - 2));
      const prefix = token.slice(0, prefixLength);
      if (doc.some((candidate) => candidate === token || candidate.startsWith(prefix) || token.startsWith(candidate.slice(0, prefixLength)))) {
        hit += 1;
      }
    }
    return hit / new Set(queryTokens).size;
  }
  function strictSoftCoverage(queryTokens, documentTokens) {
    if (!queryTokens.length || !documentTokens.length) return 0;
    const doc = [...new Set(documentTokens)];
    let hit = 0;
    for (const token of new Set(queryTokens)) {
      if (doc.includes(token)) {
        hit += 1;
        continue;
      }
      if (token.length < 8) continue;
      const prefixLength = Math.min(10, Math.max(7, token.length - 3));
      const prefix = token.slice(0, prefixLength);
      if (doc.some((candidate) => candidate.length >= 8 && (candidate.startsWith(prefix) || token.startsWith(candidate.slice(0, prefixLength))))) {
        hit += 1;
      }
    }
    return hit / new Set(queryTokens).size;
  }
  function tokenHitCount(queryTokens, documentTokens) {
    if (!queryTokens.length || !documentTokens.length) return 0;
    const doc = new Set(documentTokens);
    let hit = 0;
    for (const token of new Set(queryTokens)) {
      if (doc.has(token)) hit += 1;
    }
    return hit;
  }
  function evidenceFromChunk(answerIdValue, chunk, score, kind) {
    return {
      answerId: answerIdValue,
      page: chunk.page,
      text: chunk.text.slice(0, 900),
      score,
      kind
    };
  }
  function betterEvidence(left, right) {
    if (!right) return left;
    if (!left || right.score > left.score) return right;
    return left;
  }
  function evidenceSnippet(pageText, ...needles) {
    const clean = String(pageText ?? "").replace(/\s+/g, " ").trim();
    if (!clean) return "";
    const normalizedPage = normalizeForSearch(clean);
    let bestIndex = -1;
    for (const needle of needles) {
      const normalizedNeedle = normalizeForSearch(needle);
      if (!normalizedNeedle) continue;
      const index = normalizedPage.indexOf(normalizedNeedle.slice(0, Math.min(80, normalizedNeedle.length)));
      if (index >= 0 && (bestIndex < 0 || index < bestIndex)) bestIndex = index;
    }
    if (bestIndex < 0) return clean.slice(0, 900);
    const start = Math.max(0, bestIndex - 300);
    const end = Math.min(clean.length, bestIndex + 700);
    return clean.slice(start, end);
  }
  function numberCoverage(answer, text) {
    const answerNumbers = extractNumbers(answer).flatMap(expandNumberToken);
    if (!answerNumbers.length) return 0;
    const textNumbers = new Set(extractNumbers(text).flatMap(expandNumberToken));
    if (!textNumbers.size) return 0;
    let hit = 0;
    for (const number of answerNumbers) {
      if (textNumbers.has(number)) hit += 1;
    }
    return hit / answerNumbers.length;
  }
  function expandNumberToken(token) {
    const cleaned = String(token).replace("%", "");
    const parts = cleaned.split("-").filter(Boolean);
    const out = [];
    for (const part of parts) {
      if (/^0+\d/.test(part)) out.push(part.replace(/^0+/, "") || "0");
      const value = Number(part);
      if (!Number.isFinite(value)) {
        out.push(part);
        continue;
      }
      out.push(String(value));
      if (Number.isInteger(value) && value > 1) out.push(String(value - 1));
    }
    return out;
  }
  function tokenProximity(questionTokens, answerTokens, documentTokens) {
    if (!questionTokens.length || !answerTokens.length || !documentTokens.length) return 0;
    const qSet = new Set(questionTokens);
    const aSet = new Set(answerTokens);
    const qPositions = [];
    const aPositions = [];
    documentTokens.forEach((token, index) => {
      if (qSet.has(token)) qPositions.push(index);
      if (aSet.has(token)) aPositions.push(index);
    });
    if (!qPositions.length || !aPositions.length) return 0;
    let total = 0;
    for (const aPos of aPositions) {
      let best = Infinity;
      for (const qPos of qPositions) {
        best = Math.min(best, Math.abs(aPos - qPos));
      }
      total += Math.exp(-best / 18);
    }
    return total / aPositions.length;
  }
  function cachedPageTokens(page) {
    if (!page.__tokens) Object.defineProperty(page, "__tokens", { value: tokenize(page.text), enumerable: false });
    return page.__tokens;
  }
  function pageWindow(page, center, radius = 1e3) {
    const normalized = page.normalized;
    const start = Math.max(0, center - radius);
    const end = Math.min(normalized.length, center + radius);
    return normalized.slice(start, end);
  }
  function proximityBonus(distance, radius) {
    if (distance < 0 || distance > radius) return 0;
    return 1 - distance / radius;
  }
  function answerHasQuestionNumbers(answer, question) {
    const answerNumbers = new Set(extractNumbers(answer));
    if (!answerNumbers.size) return false;
    for (const number of extractNumbers(question)) {
      if (answerNumbers.has(number)) return true;
    }
    return false;
  }

  // src/predictor/scorers/drug-dose.ts
  var DOSE_DRUG_GENERIC = new Set(
    [
      "\u0441\u0443\u0442\u043E\u0447\u043D\u0430\u044F",
      "\u0434\u043E\u0437\u0430",
      "\u0434\u043E\u0437\u044B",
      "\u0434\u043E\u0437\u0435",
      "\u043F\u0440\u0438",
      "\u043B\u0435\u0447\u0435\u043D\u0438\u0438",
      "\u043B\u0435\u0447\u0435\u043D\u0438\u044F",
      "\u043B\u0435\u0447\u0435\u043D\u0438\u0435",
      "\u043B\u043E\u043A\u0430\u043B\u0438\u0437\u043E\u0432\u0430\u043D\u043D\u044B\u0445",
      "\u043B\u043E\u043A\u0430\u043B\u0438\u0437\u043E\u0432\u0430\u043D\u043D\u044B\u0435",
      "\u0444\u043E\u0440\u043C",
      "\u0444\u043E\u0440\u043C\u044B",
      "\u0438\u043D\u0444\u0435\u043A\u0446\u0438\u0438",
      "\u0438\u043D\u0444\u0435\u043A\u0446\u0438\u044F",
      "\u043C\u0435\u043D\u0438\u043D\u0433\u043E\u043A\u043E\u043A\u043A\u043E\u0432\u043E\u0439",
      "\u043F\u0430\u0446\u0438\u0435\u043D\u0442\u0430\u043C",
      "\u043F\u0430\u0446\u0438\u0435\u043D\u0442\u043E\u0432",
      "\u043E\u043F\u044B\u0442\u043E\u043C",
      "\u043F\u0440\u0435\u0434\u0448\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0435\u0439",
      "\u0442\u0435\u0440\u0430\u043F\u0438\u0438",
      "\u0434\u0430\u043D\u043D\u044B\u043C",
      "\u043F\u0440\u0435\u043F\u0430\u0440\u0430\u0442\u043E\u043C",
      "\u0441\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442",
      "\u0441\u0443\u0442\u043A\u0438",
      "\u0441\u0443\u0442"
    ].flatMap((item) => uniqueTokens(item))
  );
  var DOSE_ASSIGNMENT_CUES = [
    "\u043D\u0430\u0437\u043D\u0430\u0447",
    "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434",
    "\u043F\u0440\u0438\u043C\u0435\u043D",
    "\u043F\u043E\u043B\u0443\u0447",
    "\u0432\u0432\u043E\u0434",
    "\u0441\u043E\u0441\u0442\u0430\u0432\u043B"
  ].map((item) => normalizeForSearch(item));
  function doseTokenStartsWithAny(token, cues) {
    const normalized = normalizeForSearch(token);
    return cues.some((cue) => normalized.startsWith(cue));
  }
  function doseContentTokens(text) {
    return uniqueTokens(text).filter((token) => token.length >= 5 && !DOSE_DRUG_GENERIC.has(token) && !FOCUS_STOPWORDS.has(token) && !/^\d/u.test(token));
  }
  function questionDoseDrugTokens(question) {
    const normalized = normalizeForSearch(question);
    if (!containsNormalizedPhrase(normalized, "\u0434\u043E\u0437")) return [];
    const raw = rawTokens(question);
    const doseIndex = raw.findIndex((token) => doseTokenStartsWithAny(token, [normalizeForSearch("\u0434\u043E\u0437")]));
    const assignIndex = raw.findIndex((token, index) => index < (doseIndex < 0 ? raw.length : doseIndex) && doseTokenStartsWithAny(token, DOSE_ASSIGNMENT_CUES));
    if (assignIndex > 0) {
      const beforeAssign = raw.slice(Math.max(0, assignIndex - 9), assignIndex).join(" ");
      const local = doseContentTokens(beforeAssign).slice(-3);
      if (local.length) return local;
    }
    const tokens = doseContentTokens(question);
    return tokens.slice(0, 3);
  }
  function drugTokenIndex(normalized, drugTokens) {
    let best = -1;
    for (const token of drugTokens) {
      const prefix = token.slice(0, Math.min(token.length, 9));
      const index = normalized.indexOf(prefix);
      if (index >= 0) best = best < 0 ? index : Math.min(best, index);
    }
    return best;
  }
  function doseSlashNumbers(sourceText, drugTokens) {
    const out = [];
    const slashPattern = /(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*мг/giu;
    for (const match of sourceText.matchAll(slashPattern)) {
      const rawIndex = match.index ?? 0;
      const beforeText = sourceText.slice(Math.max(0, rawIndex - 150), rawIndex);
      const before = normalizeForSearch(beforeText);
      if (softCoverage(drugTokens, tokenizeNormalized(before)) < 0.8) continue;
      const drugIndex = drugTokenIndex(before, drugTokens);
      if (drugIndex < 0) continue;
      const plusAfter = before.indexOf("+", drugIndex);
      const plusBefore = before.lastIndexOf("+", drugIndex);
      const first = String(match[1]).replace(",", ".");
      const second = String(match[2]).replace(",", ".");
      if (plusAfter >= 0 && plusAfter <= before.length - 1) {
        out.push(first);
      } else if (plusBefore >= 0) {
        out.push(second);
      } else {
        out.push(first, second);
      }
      break;
    }
    return out;
  }
  function doseNearDrugNumbers(sourceText, drugTokens) {
    const normalized = normalizeForSearch(sourceText);
    const drugIndex = drugTokenIndex(normalized, drugTokens);
    if (drugIndex < 0) return [];
    const local = normalized.slice(drugIndex, Math.min(normalized.length, drugIndex + 95));
    if (!containsNormalizedPhrase(local, "\u043C\u0433")) return [];
    if (/\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?\s*mг/iu.test(local)) return [];
    const firstNumber = local.match(/\d+(?:[.,]\d+)?/u);
    if (!firstNumber || (firstNumber.index ?? 0) > 55) return [];
    if (local.slice(0, firstNumber.index ?? 0).includes("+")) return [];
    const beforeNumberTokens = tokenizeNormalized(local.slice(0, firstNumber.index ?? 0));
    const genericBeforeDose = /* @__PURE__ */ new Set(["ta\u0431", "ta\u0431\u043B", "pa\u0437", "p", "\u0434", "m\u0433"]);
    const hasOtherDrugMarker = beforeNumberTokens.some((token) => {
      if (genericBeforeDose.has(token) || /^\d/.test(token)) return false;
      if (drugTokens.some((drugToken) => drugToken.startsWith(token) || token.startsWith(drugToken.slice(0, Math.min(8, drugToken.length))))) return false;
      return token.length >= 3;
    });
    if (hasOtherDrugMarker) return [];
    return extractNumbers(local).slice(0, 2).map((number) => String(number).replace(",", "."));
  }
  function normalizeDoseNumber(value) {
    return String(value ?? "").replace(",", ".").replace(/\.0$/u, "");
  }
  function answerDoseFact(answerText) {
    const normalized = normalizeForSearch(answerText);
    const doseMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*[\u006d\u043c]\u0433/iu);
    const frequencyMatch = normalized.match(/(?:[\u0078\u0445]\s*|(?:\u0440\u0430\u0437|\u0440)\s*)(\d+(?:[.,]\d+)?)(?:\s*[\u0070\u0440]\s*\/\s*\u0434|\s*\u0440|\s*\u0440\u0430\u0437)?/iu);
    return {
      dose: doseMatch?.[1] ? normalizeDoseNumber(doseMatch[1]) : null,
      frequency: frequencyMatch?.[1] ? normalizeDoseNumber(frequencyMatch[1]) : null
    };
  }
  function sourceDoseFacts(sourceText, drugTokens) {
    const normalized = normalizeForSearch(sourceText);
    const drugIndex = drugTokenIndex(normalized, drugTokens);
    if (drugIndex < 0) return [];
    const local = normalized.slice(drugIndex, Math.min(normalized.length, drugIndex + 125));
    const facts = [];
    const dosePattern = /(\d+(?:[.,]\d+)?)\s*[\u006d\u043c]\u0433(?:\s*[\u0078\u0445]\s*(\d+(?:[.,]\d+)?))?/giu;
    for (const match of local.matchAll(dosePattern)) {
      const index = match.index ?? 0;
      if (index > 80) continue;
      facts.push({
        dose: normalizeDoseNumber(match[1]),
        frequency: match[2] ? normalizeDoseNumber(match[2]) : null
      });
      break;
    }
    for (const number of [...doseSlashNumbers(sourceText, drugTokens), ...doseNearDrugNumbers(sourceText, drugTokens)]) {
      facts.push({ dose: normalizeDoseNumber(number), frequency: null });
    }
    return facts;
  }
  function doseFactMatchesAnswer(fact, answerFact, answerNumbers, hasFrequencyFacts = false) {
    if (answerFact.dose && fact.dose !== answerFact.dose) return false;
    if (!answerFact.dose && !answerNumbers.has(fact.dose)) return false;
    if (answerFact.frequency && hasFrequencyFacts && !fact.frequency) return false;
    if (answerFact.frequency && fact.frequency && fact.frequency !== answerFact.frequency) return false;
    return true;
  }
  function bestDrugDoseSupport({ mode, pages, question, answer }) {
    if (mode !== "single") return null;
    const drugTokens = questionDoseDrugTokens(question);
    if (!drugTokens.length) return null;
    const answerNumbers = new Set(extractNumbers(answer.text).flatMap(expandNumberToken).map((number) => String(number).replace(",", ".")));
    if (!answerNumbers.size || !containsNormalizedPhrase(normalizeForSearch(answer.text), "\u043C\u0433")) return null;
    const answerFact = answerDoseFact(answer.text);
    let best = null;
    for (const page of pages) {
      const lines = page.lines ?? [];
      for (let index = 0; index < lines.length; index += 1) {
        const text = lines.slice(index, Math.min(lines.length, index + 3)).join(" ");
        const normalized = normalizeForSearch(text);
        const sourceTokens = tokenizeNormalized(normalized);
        if (softCoverage(drugTokens, sourceTokens) < 0.8) continue;
        const facts = sourceDoseFacts(text, drugTokens);
        if (!facts.length) continue;
        const hasFrequencyFacts = facts.some((fact) => fact.frequency);
        const hit = facts.some((fact) => doseFactMatchesAnswer(fact, answerFact, answerNumbers, hasFrequencyFacts));
        if (!hit) continue;
        const score = 16.2 + Math.min(2, facts.length) * 0.7 + (answerFact.frequency && facts.some((fact) => fact.frequency === answerFact.frequency) ? 2.1 : 0);
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text,
          score,
          kind: "drug_dose_segment"
        });
      }
    }
    return best;
  }

  // src/predictor/scorers/fibrosis-stage.ts
  function fibrosisDescriptorKey(text) {
    const normalized = normalizeForSearch(text);
    const metavir = normalized.match(/^f\s*([0-4])\b/iu);
    if (metavir?.[1] === "0" && containsNormalizedPhrase(normalized, "\u043E\u0442\u0441\u0443\u0442")) return "none";
    if (metavir?.[1] === "1" && containsNormalizedPhrase(normalized, "\u0431\u0435\u0437") && containsNormalizedPhrase(normalized, "\u0441\u0435\u043F\u0442")) return "mild";
    if (metavir?.[1] === "2" && containsNormalizedPhrase(normalized, "\u0435\u0434\u0438\u043D\u0438\u0447") && containsNormalizedPhrase(normalized, "\u0441\u0435\u043F\u0442")) return "moderate";
    if (metavir?.[1] === "3" && (containsNormalizedPhrase(normalized, "\u043C\u043D\u043E\u0433\u043E\u0447\u0438\u0441\u043B") || containsNormalizedPhrase(normalized, "\u0431\u0435\u0437 \u0446\u0438\u0440\u0440\u043E\u0437"))) return "marked";
    if (metavir?.[1] === "4" && containsNormalizedPhrase(normalized, "\u0446\u0438\u0440\u0440\u043E\u0437")) return "cirrhosis";
    if (!containsNormalizedPhrase(normalized, "\u0444\u0438\u0431\u0440\u043E\u0437") && !containsNormalizedPhrase(normalized, "\u0446\u0438\u0440\u0440\u043E\u0437")) return null;
    if (containsNormalizedPhrase(normalized, "\u0431\u0435\u0437 \u0446\u0438\u0440\u0440\u043E\u0437") && !containsNormalizedPhrase(normalized, "\u0444\u0438\u0431\u0440\u043E\u0437")) return null;
    if (containsNormalizedPhrase(normalized, "\u0431\u0435\u0437 \u0444\u0438\u0431\u0440\u043E\u0437") || containsNormalizedPhrase(normalized, "\u043E\u0442\u0441\u0443\u0442")) return "none";
    if (containsNormalizedPhrase(normalized, "\u0441\u043B\u0430\u0431\u043E\u0432\u044B\u0440\u0430\u0436")) return "mild";
    if (containsNormalizedPhrase(normalized, "\u0443\u043C\u0435\u0440\u0435\u043D")) return "moderate";
    if (containsNormalizedPhrase(normalized, "\u0442\u044F\u0436\u0435\u043B")) return "severe";
    if (containsNormalizedPhrase(normalized, "\u0446\u0438\u0440\u0440\u043E\u0437")) return "cirrhosis";
    if (containsNormalizedPhrase(normalized, "\u0432\u044B\u0440\u0430\u0436")) return "marked";
    return null;
  }
  function questionFibrosisStage(question) {
    const tokens = rawTokens(question);
    const stageIndex = tokens.findIndex((token) => token.startsWith("\u0441\u0442\u0430\u0434"));
    for (let index = Math.max(0, stageIndex); index >= 0 && index < Math.min(tokens.length, stageIndex + 4); index += 1) {
      const token = tokens[index];
      if (/^[0-4]$/u.test(token)) return token;
    }
    const normalized = normalizeForSearch(question);
    const fStage = normalized.match(/\bf\s*([0-4])\b/iu);
    return fStage?.[1] ?? null;
  }
  function answerFibrosisStage(answerText) {
    const normalized = normalizeForSearch(answerText);
    const exact = normalized.match(/^(?:f\s*)?([0-4])$/iu);
    if (exact) return exact[1];
    const numbers = extractNumbers(answerText).map((item) => String(item).replace(",", "."));
    const stageNumbers = numbers.filter((number) => /^[0-4]$/u.test(number));
    return stageNumbers.length === 1 ? stageNumbers[0] : null;
  }
  function fibrosisRowStage(line) {
    const normalized = normalizeForSearch(line).trim();
    const numeric = normalized.match(/^([0-4])\s*-/u);
    if (numeric) return numeric[1];
    const metavir = normalized.match(/^f\s*([0-4])\b/iu);
    return metavir?.[1] ?? null;
  }
  function bestFibrosisStageSupport({ mode, pages, question, answer }) {
    if (mode !== "single") return null;
    const questionNorm = normalizeForSearch(question);
    if (!containsNormalizedPhrase(questionNorm, "\u0444\u0438\u0431\u0440\u043E\u0437") && !containsNormalizedPhrase(questionNorm, "\u0446\u0438\u0440\u0440\u043E\u0437") && !containsNormalizedPhrase(questionNorm, "\u0441\u0442\u0430\u0434")) {
      return null;
    }
    const qStage = questionFibrosisStage(question);
    const qDescriptor = fibrosisDescriptorKey(question);
    const answerStage = answerFibrosisStage(answer.text);
    const answerDescriptor = fibrosisDescriptorKey(answer.text);
    if (!qStage && answerStage && !containsNormalizedPhrase(questionNorm, "\u0441\u043E\u043E\u0442\u0432\u0435\u0442")) return null;
    const targetStage = qStage ?? answerStage;
    const targetDescriptor = qStage ? answerDescriptor : qDescriptor;
    if (!targetStage || !targetDescriptor) return null;
    let best = null;
    for (const page of pages) {
      const lines = page.lines ?? [];
      for (let index = 0; index < lines.length; index += 1) {
        const text = lines[index];
        const stage = fibrosisRowStage(text);
        if (stage !== targetStage) continue;
        const descriptor = fibrosisDescriptorKey(text);
        if (descriptor !== targetDescriptor) continue;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text,
          score: 22.4,
          kind: "fibrosis_stage_row"
        });
      }
    }
    return best;
  }

  // src/predictor/scorers/recommendation-item.ts
  var RECOMMENDATION_QUESTION_GENERIC = new Set(
    [
      "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u0442\u0441\u044F",
      "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u043E\u0432\u0430\u043D\u043E",
      "\u043F\u0430\u0446\u0438\u0435\u043D\u0442\u0430\u043C",
      "\u043F\u0430\u0446\u0438\u0435\u043D\u0442\u043E\u0432",
      "\u043F\u0430\u0446\u0438\u0435\u043D\u0442\u044B",
      "\u043F\u0440\u0438",
      "\u0434\u043B\u044F",
      "\u0441",
      "\u0438",
      "\u0443",
      "\u044F\u0432\u043B\u044F\u044E\u0442\u0441\u044F",
      "\u043F\u0440\u0435\u043F\u0430\u0440\u0430\u0442\u0430\u043C\u0438",
      "\u043F\u0435\u0440\u0432\u043E\u0439",
      "\u043B\u0438\u043D\u0438\u0438"
    ].flatMap((item) => uniqueTokens(item))
  );
  function recommendationItemQuestion(question) {
    const normalized = normalizeForSearch(question);
    const firstLineTherapy = containsNormalizedPhrase(normalized, "\u043F\u0435\u0440\u0432\u043E\u0439 \u043B\u0438\u043D\u0438\u0438");
    const valveProsthesisChoice = containsNormalizedPhrase(normalized, "\u043F\u0440\u043E\u0442\u0435\u0437") && containsNormalizedPhrase(normalized, "\u043A\u043B\u0430\u043F") && (containsNormalizedPhrase(normalized, "\u0431\u0438\u043E\u043B\u043E\u0433") || containsNormalizedPhrase(normalized, "\u043C\u0435\u0445\u0430\u043D"));
    const universalInstrumental = containsNormalizedPhrase(normalized, "\u0432\u0441\u0435\u043C \u043F\u0430\u0446\u0438\u0435\u043D\u0442") && (containsNormalizedPhrase(normalized, "\u043F\u0435\u0440\u0432\u0438\u0447") && containsNormalizedPhrase(normalized, "\u0441\u0442\u0430\u0434") || containsNormalizedPhrase(normalized, "\u0434\u0438\u043D\u0430\u043C\u0438\u0447") && containsNormalizedPhrase(normalized, "\u044D\u0444\u0444\u0435\u043A\u0442"));
    return firstLineTherapy || valveProsthesisChoice || universalInstrumental;
  }
  function recommendationQuestionTokens(question) {
    return uniqueTokens(question).filter((token) => token.length >= 4 && !FOCUS_STOPWORDS.has(token) && !RECOMMENDATION_QUESTION_GENERIC.has(token));
  }
  function isPageNumberOnly(line) {
    return /^\s*\d+\s*$/u.test(String(line ?? ""));
  }
  function startsBullet(line) {
    return /^\s*[•*\-]\s*/u.test(String(line ?? ""));
  }
  function recommendationLineStart(line) {
    if (isPageNumberOnly(line)) return false;
    const normalized = normalizeForSearch(line);
    return startsBullet(line) || containsNormalizedPhrase(normalized, "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434") || containsNormalizedPhrase(normalized, "\u043F\u0435\u0440\u0432\u043E\u0439 \u043B\u0438\u043D\u0438\u0438");
  }
  function recommendationBoundaryLine(line, isFirstLine) {
    if (isPageNumberOnly(line)) return true;
    if (!isFirstLine && startsBullet(line)) return true;
    const normalized = normalizeForSearch(line);
    return /^e\s*o?k\b/iu.test(normalized) || normalized.startsWith("eok") || normalized.startsWith("ypobeh") || containsNormalizedPhrase(normalized, "\u0443\u0443\u0440") || containsNormalizedPhrase(normalized, "\u0443\u0434\u0434");
  }
  function collectRecommendationSegment(pages, pageIndex, lineIndex) {
    const lines = [];
    for (let currentPageIndex = pageIndex; currentPageIndex < Math.min(pages.length, pageIndex + 2); currentPageIndex += 1) {
      const page = pages[currentPageIndex];
      const pageLines = page.lines ?? [];
      const startLine = currentPageIndex === pageIndex ? lineIndex : 0;
      for (let index = startLine; index < pageLines.length && lines.length < 12; index += 1) {
        const line = pageLines[index];
        if (recommendationBoundaryLine(line, currentPageIndex === pageIndex && index === lineIndex)) {
          if (!isPageNumberOnly(line)) return lines.join(" ");
          continue;
        }
        lines.push(line);
      }
      if (lines.length >= 12) break;
      const nextPage = pages[currentPageIndex + 1];
      if (!nextPage?.lines?.length || startsBullet(nextPage.lines[0])) break;
    }
    return lines.join(" ");
  }
  function recommendationSegments(pages) {
    const segments = [];
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const page = pages[pageIndex];
      const lines = page.lines ?? [];
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        if (!recommendationLineStart(lines[lineIndex])) continue;
        const text = collectRecommendationSegment(pages, pageIndex, lineIndex).replace(/\s+/gu, " ").trim();
        if (text.length < 24) continue;
        segments.push({
          page: page.page,
          text,
          normalized: normalizeForSearch(text)
        });
      }
    }
    return segments;
  }
  function recommendationSubjectCompatible(questionNorm, segmentNorm) {
    const questionBiological = containsNormalizedPhrase(questionNorm, "\u0431\u0438\u043E\u043B\u043E\u0433");
    const questionMechanical = containsNormalizedPhrase(questionNorm, "\u043C\u0435\u0445\u0430\u043D");
    const segmentBiological = containsNormalizedPhrase(segmentNorm, "\u0431\u0438\u043E\u043B\u043E\u0433");
    const segmentMechanical = containsNormalizedPhrase(segmentNorm, "\u043C\u0435\u0445\u0430\u043D");
    if (questionBiological && segmentMechanical && !segmentBiological) return false;
    if (questionMechanical && segmentBiological && !segmentMechanical) return false;
    if (questionBiological && !segmentBiological) return false;
    if (questionMechanical && !segmentMechanical) return false;
    if (containsNormalizedPhrase(questionNorm, "\u043F\u0435\u0440\u0432\u043E\u0439 \u043B\u0438\u043D\u0438\u0438") && !containsNormalizedPhrase(segmentNorm, "\u043F\u0435\u0440\u0432\u043E\u0439 \u043B\u0438\u043D\u0438\u0438")) {
      return false;
    }
    return true;
  }
  function recommendationQuestionCoverage(questionNorm, questionTokens, segmentNorm) {
    const segmentTokens = tokenizeNormalized(segmentNorm);
    let coverageScore = strictSoftCoverage(questionTokens, segmentTokens);
    const valveProsthesisQuestion = containsNormalizedPhrase(questionNorm, "\u043F\u0440\u043E\u0442\u0435\u0437") && containsNormalizedPhrase(questionNorm, "\u0430\u043E\u0440\u0442") && containsNormalizedPhrase(questionNorm, "\u043A\u043B\u0430\u043F");
    if (valveProsthesisQuestion && containsNormalizedPhrase(segmentNorm, "\u041F\u0410\u041A")) coverageScore = Math.max(coverageScore, 0.58);
    return coverageScore;
  }
  function recommendationAnswerWindow(questionNorm, segmentNorm) {
    if (containsNormalizedPhrase(questionNorm, "\u0434\u0438\u043B\u0430\u0442\u0430\u0446")) {
      const withoutDilation = segmentNorm.indexOf(normalizeForSearch("\u0431\u0435\u0437 \u0434\u0438\u043B\u0430\u0442\u0430\u0446"));
      if (withoutDilation > 80) return segmentNorm.slice(0, withoutDilation);
    }
    return segmentNorm;
  }
  function recommendationAliasSupport(answerText, segmentNorm) {
    const answerNorm = normalizeForSearch(answerText);
    let support = 0;
    if (containsNormalizedPhrase(answerNorm, "\u0438\u043D\u0433\u0438\u0431") && containsNormalizedPhrase(answerNorm, "\u0430\u043F\u0444") && containsNormalizedPhrase(segmentNorm, "\u0438\u0410\u041F\u0424")) {
      support = Math.max(support, 0.98);
    }
    if (containsNormalizedPhrase(answerNorm, "\u0431\u0435\u0442\u0430") && containsNormalizedPhrase(answerNorm, "\u0430\u0434\u0440\u0435\u043D\u043E") && containsNormalizedPhrase(answerNorm, "\u0431\u043B\u043E\u043A") && containsNormalizedPhrase(segmentNorm, "\u0431\u0435\u0442\u0430")) {
      support = Math.max(support, 0.96);
    }
    return support;
  }
  function anticoagulationContraPolarity(normalized) {
    if (!containsNormalizedPhrase(normalized, "\u0430\u043D\u0442\u0438\u043A\u043E\u0430\u0433")) return null;
    const contra = normalizeForSearch("\u043F\u0440\u043E\u0442\u0438\u0432\u043E\u043F\u043E\u043A\u0430\u0437");
    let start = 0;
    while (start < normalized.length) {
      const index = normalized.indexOf(contra, start);
      if (index < 0) break;
      const before = normalized.slice(Math.max(0, index - 58), index);
      if (containsNormalizedPhrase(before, "\u043E\u0442\u0441\u0443\u0442")) return "absence";
      if (containsNormalizedPhrase(before, "\u043D\u0430\u043B\u0438\u0447")) return "presence";
      start = index + contra.length;
    }
    return null;
  }
  function recommendationPresenceMismatch(answerText, segmentNorm) {
    const answerNorm = normalizeForSearch(answerText);
    const answerContraPolarity = anticoagulationContraPolarity(answerNorm);
    const segmentContraPolarity = anticoagulationContraPolarity(segmentNorm);
    if (answerContraPolarity && segmentContraPolarity && answerContraPolarity !== segmentContraPolarity) return true;
    if (containsNormalizedPhrase(answerNorm, "\u043E\u043F\u0442\u0438\u043C") && !containsNormalizedPhrase(segmentNorm, "\u043E\u043F\u0442\u0438\u043C")) return true;
    if ((containsNormalizedPhrase(answerNorm, "\u043C\u0435\u043D\u044C\u0448") || containsNormalizedPhrase(answerNorm, "\u043D\u0438\u0436\u0435")) && !containsNormalizedPhrase(segmentNorm, "\u043C\u0435\u043D\u044C\u0448") && !containsNormalizedPhrase(segmentNorm, "\u043D\u0438\u0436\u0435")) {
      return true;
    }
    const answerAbsence = containsNormalizedPhrase(answerNorm, "\u043E\u0442\u0441\u0443\u0442\u0441\u0442");
    const answerPresence = containsNormalizedPhrase(answerNorm, "\u043D\u0430\u043B\u0438\u0447");
    const segmentAbsence = containsNormalizedPhrase(segmentNorm, "\u043E\u0442\u0441\u0443\u0442\u0441\u0442");
    const segmentPresence = containsNormalizedPhrase(segmentNorm, "\u043D\u0430\u043B\u0438\u0447");
    const contra = containsNormalizedPhrase(answerNorm, "\u043F\u0440\u043E\u0442\u0438\u0432\u043E\u043F\u043E\u043A\u0430\u0437") || containsNormalizedPhrase(segmentNorm, "\u043F\u0440\u043E\u0442\u0438\u0432\u043E\u043F\u043E\u043A\u0430\u0437");
    if (contra && answerAbsence && segmentPresence && !segmentAbsence) return true;
    if (contra && answerPresence && segmentAbsence && !segmentPresence) return true;
    return false;
  }
  function bestRecommendationItemSupport({ pages, question, answer, answerTokens }) {
    if (!recommendationItemQuestion(question)) return null;
    const questionNorm = normalizeForSearch(question);
    const qTokens = recommendationQuestionTokens(question);
    if (!qTokens.length) return null;
    let best = null;
    for (const segment of recommendationSegments(pages)) {
      const answerNorm = normalizeForSearch(answer.text);
      if (containsNormalizedPhrase(answerNorm, "\u043E\u043F\u0442\u0438\u043C") && !containsNormalizedPhrase(questionNorm, "\u043E\u043F\u0442\u0438\u043C")) continue;
      if (!recommendationSubjectCompatible(questionNorm, segment.normalized)) continue;
      const qCoverage = recommendationQuestionCoverage(questionNorm, qTokens, segment.normalized);
      if (qCoverage < 0.34) continue;
      const answerWindow = recommendationAnswerWindow(questionNorm, segment.normalized);
      if (recommendationPresenceMismatch(answer.text, answerWindow)) continue;
      const tokens = tokenizeNormalized(answerWindow);
      const phraseHit = answerSearchPhrases(answer.text).some((phrase) => containsNormalizedPhrase(answerWindow, phrase));
      const alias = recommendationAliasSupport(answer.text, answerWindow);
      const answerCoverage = Math.max(strictSoftCoverage(answerTokens, tokens), alias);
      if (!phraseHit && answerCoverage < 0.62) continue;
      const score = 15.8 + qCoverage * 4 + answerCoverage * 6.2 + (phraseHit ? 2.4 : 0) + alias * 2;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: segment.page,
        text: segment.text,
        score,
        kind: "recommendation_item_segment"
      });
    }
    return best;
  }

  // src/predictor/scorers/search.ts
  var ROW_LABEL_RE = /(локализован[а-яa-z0-9-]*|генерализован[а-яa-z0-9-]*|редк[а-яa-z0-9-]*|перинатальн[а-яa-z0-9-]*|ранн[а-яa-z0-9-]*\s+младенческ[а-яa-z0-9-]*|поздн[а-яa-z0-9-]*\s+младенческ[а-яa-z0-9-]*|ювенильн[а-яa-z0-9-]*|подростков[а-яa-z0-9-]*|взросл[а-яa-z0-9-]*|положительн[а-яa-z0-9-]*|сомнительн[а-яa-z0-9-]*|отрицательн[а-яa-z0-9-]*|планов[а-яa-z0-9-]*|экстренн[а-яa-z0-9-]*|неотложн[а-яa-z0-9-]*|перв[а-яa-z0-9-]*\s+лини[ияею]|втор[а-яa-z0-9-]*\s+лини[ияею]|треть[а-яa-z0-9-]*\s+лини[ияею]|не\s+имеющ[а-яa-z0-9-]*\s+фактор[а-яa-z0-9-]*\s+риска|при\s+наличи[а-яa-z0-9-]*\s+фактор[а-яa-z0-9-]*\s+риска)/giu;
  function questionAnchorPhrases(question) {
    const raw = normalizeText(question);
    const normalized = normalizeForSearch(question);
    const phrases = /* @__PURE__ */ new Set([raw, normalized]);
    const match = raw.match(/^к\s+(.+?)\s+относятся/u);
    if (match) {
      const middleTokens = rawTokens(match[1]).filter(
        (token) => !["\u0433\u0440\u0443\u043F\u043F\u0435", "\u0433\u0440\u0443\u043F\u043F\u0430", "\u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430\u043C", "\u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u044B", "\u043F\u0440\u0435\u043F\u0430\u0440\u0430\u0442\u044B", "\u043F\u0440\u0435\u043F\u0430\u0440\u0430\u0442\u0430\u043C", "\u0441\u0440\u0435\u0434\u0441\u0442\u0432\u0430", "\u043C\u0435\u0442\u043E\u0434\u044B"].includes(token)
      );
      if (middleTokens.length) {
        phrases.add(`\u043A ${middleTokens[0]} \u043E\u0442\u043D\u043E\u0441\u044F\u0442\u0441\u044F`);
        phrases.add(`\u043A ${middleTokens[0]} \u043F\u0440\u0438\u0447\u0438\u043D\u0430\u043C \u043E\u0442\u043D\u043E\u0441\u044F\u0442\u0441\u044F`);
        phrases.add(`\u043A ${middleTokens[0]} \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430\u043C \u043E\u0442\u043D\u043E\u0441\u044F\u0442\u0441\u044F`);
        phrases.add(`${middleTokens.slice(0, 3).join(" ")} \u043E\u0442\u043D\u043E\u0441\u044F\u0442\u0441\u044F`);
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
  function findAnchorSegments(pages, question) {
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
            anchor
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
    return `\u043F\u043E ${match[1].trim()}`;
  }
  function findSectionSegments(pages, question) {
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
          anchor
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
    for (const keyword of ["\u0443\u0440\u043E\u0432\u0435\u043D\u044C", "\u043F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435", "\u0442\u0430\u0431\u043B\u0438\u0446\u0430", "\u0440\u0430\u0437\u0434\u0435\u043B", "\u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0438"]) {
      const folded = normalizeForSearch(keyword);
      const pos = normalizedAfter.indexOf(` ${folded}`, 80);
      if (pos > 80) boundary = Math.min(boundary, pos);
    }
    return Math.max(80, boundary);
  }
  function bestPhraseSupport({ pages, question, answer, questionTokens, answerTokens, intent }) {
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
          const score = 8.5 + coverage(questionTokens, winTokens) * 2.2 + coverage(answerTokens, winTokens) * 1.2 + numberCoverage(answer.text, window) * 0.9 + (intent.numeric ? 0.45 : 0);
          best = betterEvidence(best, {
            answerId: answer.id,
            page: page.page,
            text: evidenceSnippet(page.text, joined),
            score,
            kind: "question_answer_phrase"
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
            const score = 6.4 + proximityBonus(distance, 1200) * 2.3 + coverage(answerTokens, tokenize(local)) * 0.8 + numberCoverage(answer.text, local) * 0.7;
            best = betterEvidence(best, {
              answerId: answer.id,
              page: page.page,
              text: evidenceSnippet(page.text, question, answer.text),
              score,
              kind: "answer_after_question"
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
          const prefixBonus = qPrefix && before.includes(qPrefix.slice(0, Math.min(70, qPrefix.length))) ? 1 : 0;
          const directionalBonus = localCoverage > 0.24 ? 2.4 + localCoverage * 4.2 : 0;
          const score = 0.8 + broadCoverage * 2.7 + coverage(answerTokens, winTokens) * 1.2 + numberCoverage(answer.text, window) * 1.2 + directionalBonus + prefixBonus + (intent.numeric && answerHasQuestionNumbers(answer.text, question) ? 0.35 : 0);
          best = betterEvidence(best, {
            answerId: answer.id,
            page: page.page,
            text: evidenceSnippet(page.text, answer.text),
            score,
            kind: localCoverage > broadCoverage ? "answer_directional_window" : "answer_window"
          });
        }
      }
    }
    return best;
  }
  function bestAnchorSupport({ anchorSegments, answer, answerTokens }) {
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
        kind: "question_anchor_segment"
      });
    }
    return best;
  }
  function bestSectionSupport({ sectionSegments, answer, answerTokens }) {
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
      const score = 8.2 + support * 4 + (phraseHit ? 2 : 0) + numericCoverage * 0.8;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: segment.page,
        text: segment.text,
        score,
        kind: "section_list_segment"
      });
    }
    return best;
  }
  function questionRowCues(question) {
    const raw = normalizeText(question);
    const cues = /* @__PURE__ */ new Set();
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
      /при\s+лечении\s+(.+?)\s+(?:назнач|примен)/u
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
        best = Math.max(best, cueTokens.length >= 2 ? 1.15 : 1);
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
  function findRowSegments(pages, question, topQuestionPages) {
    const cues = questionRowCues(question);
    if (!cues.length) return [];
    const mcbCodeQuestion = /мкб/u.test(normalizeText(question)) && /кодир/u.test(normalizeText(question));
    const segments = [];
    const seen = /* @__PURE__ */ new Set();
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
          cues: cues.filter((cue) => rowCueMatch(lines[index], [cue]) > 0)
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
      const restPattern = cueTokens.slice(1).map((token) => `${escapeRegExp(token.slice(0, Math.min(8, token.length)))}[\u0430-\u044Fa-z0-9-]*`).join("\\s+");
      if (firstPrefix && restPattern) {
        const combinedPattern = new RegExp(`${escapeRegExp(firstPrefix)}[\u0430-\u044Fa-z0-9-]*.+\\s\u0441\\s+${escapeRegExp(firstPrefix)}[\u0430-\u044Fa-z0-9-]*\\s+${restPattern}`, "iu");
        if (combinedPattern.test(raw)) penalty += 3;
      }
      const index = raw.indexOf(cueRaw);
      if (index < 0) continue;
      const before = raw.slice(0, index).replace(/^[a-zа-я]?\s*\d{2}(?:[.\s]\d)?\s*/iu, "").trim();
      if (before.length > 3) penalty += 1.8;
      const after = raw.slice(index + cueRaw.length, index + cueRaw.length + 16);
      if (!cueRaw.includes(" \u0441 ") && /^\s+с\s+/u.test(after)) penalty += 2.6;
    }
    return penalty;
  }
  function answerCodeVariants(answerText) {
    const normalized = normalizeForSearch(answerText);
    const variants = /* @__PURE__ */ new Set();
    for (const match of normalized.matchAll(/\b([a-zа-я])?0?(\d{2}[.]\d)\b/giu)) {
      const code = match[2];
      variants.add(code);
      variants.add(`0${code}`);
      variants.add(`d${code}`);
    }
    return [...variants];
  }
  function rowAnswerPhrases(answerText) {
    return [.../* @__PURE__ */ new Set([...answerSearchPhrases(answerText), ...answerCodeVariants(answerText)])].slice(0, 18);
  }
  function bestRowLabelSupport({ rowSegments, answer, answerTokens }) {
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
      const coverageSupport = (answerTokens.length >= 3 && answerCoverage >= 0.66 || answerTokens.length >= 2 && answerCoverage >= 0.95) && (!answerHasNegation || segmentHasNegation);
      if (answerHasNegation && !segmentHasNegation && numericCoverage < 0.65) continue;
      if (!phraseHit && numericCoverage < 0.65 && !coverageSupport) continue;
      const earlyBonus = phraseIndex >= 0 && phraseIndex <= 180 ? 0.65 : 0;
      const score = 8 + support * 3.8 + segment.cueScore * 1.5 + (phraseHit ? 1.7 : 0) + numericCoverage * 0.8 + earlyBonus - rowCueSpecificityPenalty(segment);
      best = betterEvidence(best, {
        answerId: answer.id,
        page: segment.page,
        text: segment.text,
        score,
        kind: "row_label_segment"
      });
    }
    return best;
  }

  // src/predictor/selection.ts
  var STRUCTURAL_EVIDENCE_WEIGHTS = new Map(
    Object.entries({
      coordinate_table_row: 1.25,
      visual_table_column: 1.2,
      exact_short_label_visual_row: 1.15,
      short_label_visual_row: 1.05,
      answer_ordinal_row: 1.05,
      fibrosis_stage_row: 1.2,
      classification_code_segment: 1.15,
      label_number_proximity: 1,
      label_definition_segment: 1,
      row_label_segment: 0.95,
      bounded_list_segment: 0.95,
      ordinal_list_segment: 0.9,
      drug_dose_segment: 0.9,
      recommendation_item_segment: 0.85,
      numeric_condition_less_than: 0.85,
      numeric_condition_more_than: 0.85,
      numeric_condition_equal: 0.85,
      conditioned_number_segment: 0.8,
      cloze_gap_local: 0.8
    })
  );
  var BROAD_EVIDENCE_KINDS = /* @__PURE__ */ new Set([
    "bm25_question_answer",
    "question_chunk_answer",
    "answer_chunk_question",
    "answer_window",
    "focused_answer_window",
    "shared_multi_segment"
  ]);
  var NOISY_SHARED_EVIDENCE_KINDS = /* @__PURE__ */ new Set(["question_chunk_answer", "bm25_question_answer", "shared_multi_segment"]);
  function calibrateScores(answerScores) {
    const rawValues = answerScores.map((item) => item.raw);
    const max = Math.max(...rawValues, 1e-4);
    const min = Math.min(...rawValues, 0);
    const span = Math.max(1e-4, max - min);
    const expValues = rawValues.map((value) => Math.exp((value - max) / 2.2));
    const expSum = expValues.reduce((sum, value) => sum + value, 0) || 1;
    return answerScores.map((item, index) => {
      const relative = (item.raw - min) / span;
      const probability = expValues[index] / expSum;
      const confidence = Math.max(probability, relative * 0.88);
      return { ...item, score: round4(confidence), relative };
    });
  }
  function applyFrozenFeatureRanker(answerScores, mode, config, context = {}) {
    if (!config.frozenFeatureRanker) return answerScores;
    const allowMultiPruning = mode === "multi" && multiPruningAllowed(context.question ?? "");
    const ranked = answerScores.map((item) => {
      const summary = summarizeEvidence(item);
      let raw = item.raw;
      if (summary.bestStructuralScore >= 10) {
        raw += Math.min(1.1, summary.bestStructuralScore * 0.035 * summary.structuralWeight);
      }
      if (allowMultiPruning && summary.broadOnly && item.raw >= 8) {
        raw *= 0.985;
      }
      if (allowMultiPruning && summary.noisySharedOnly && item.raw >= 8) {
        raw *= 0.975;
      }
      return { ...item, raw };
    });
    const contrasted = config.pairwiseContrastRanker ? applyPairwiseContrast(ranked, mode) : ranked;
    return config.structuralClusterAdjustments ? applyStructuralClusterAdjustments(contrasted, mode, allowMultiPruning) : contrasted;
  }
  function selectAnswers(scored, mode, config) {
    const sorted = [...scored].sort((a, b) => b.raw - a.raw);
    if (mode === "single") return selectSingleAnswer(sorted, config);
    const maxRaw = sorted[0]?.raw ?? 0;
    const minRaw = sorted[sorted.length - 1]?.raw ?? 0;
    const span = Math.max(1e-4, maxRaw - minRaw);
    const threshold = Math.max(config.multiAbsoluteThreshold, maxRaw * config.multiRelativeThreshold);
    let selected = sorted.filter((item) => {
      const gapRelative = (item.raw - minRaw) / span;
      return item.raw >= threshold || gapRelative >= config.multiGapThreshold;
    }).map((item) => item.answer.id);
    if (config.multiMinAnswers > 1 && selected.length < config.multiMinAnswers && sorted.length >= config.multiMinAnswers) {
      selected = sorted.slice(0, config.multiMinAnswers).map((item) => item.answer.id);
    }
    if (selected.length === 2 && sorted.length >= 3 && sorted[1].raw - sorted[2].raw <= config.multiThirdGapThreshold && sorted[2].raw >= maxRaw * config.multiThirdRelativeThreshold) {
      selected = sorted.slice(0, 3).map((item) => item.answer.id);
    }
    if (config.multiAllOptionsGuard) {
      selected = applyMultiAllOptionsGuard(sorted, selected, scored);
    }
    if (config.multiCardinalityModel) {
      selected = applyMultiCardinalityModel(sorted, selected, scored);
    }
    if (!selected.length && sorted.length) selected = [sorted[0].answer.id];
    return selected.sort((a, b) => scored.findIndex((item) => item.answer.id === a) - scored.findIndex((item) => item.answer.id === b));
  }
  function selectSingleAnswer(sorted, config) {
    const top = sorted[0];
    const second = sorted[1];
    if (!top) return [];
    if (!config.singleSpecificityTieBreak || !second) return [top.answer.id];
    const rawGap = top.raw - second.raw;
    const rawRatio = second.raw / Math.max(1e-3, top.raw);
    if (rawGap > config.singleTieMaxRawGap || rawRatio < config.singleTieMinRawRatio) return [top.answer.id];
    const specificityGap = answerSpecificityScore(second.answer.text) - answerSpecificityScore(top.answer.text);
    if (specificityGap >= config.singleTieSpecificityGap) return [second.answer.id];
    return [top.answer.id];
  }
  var SINGLE_TIE_NEGATION_CUES = ["\u043D\u0435", "\u043E\u0442\u0441\u0443\u0442\u0441\u0442", "\u043D\u0435\u0432\u044B\u043F"].map(
    (item) => normalizeForSearch(item)
  );
  function answerSpecificityScore(answerText) {
    const normalized = normalizeForSearch(answerText);
    const negation = SINGLE_TIE_NEGATION_CUES.some((cue) => normalized.includes(cue)) ? 0.5 : 0;
    return normalized.length * 0.02 + tokenize(answerText).length * 0.4 + negation;
  }
  function summarizeEvidence(item) {
    let bestStructuralScore = 0;
    let structuralWeight = 0;
    let broadCount = 0;
    let noisySharedCount = 0;
    let bestKind = "";
    let bestScore = 0;
    for (const evidence of item.evidence ?? []) {
      const score = evidence.score ?? 0;
      if (score > bestScore) {
        bestScore = score;
        bestKind = evidence.kind;
      }
      const weight = STRUCTURAL_EVIDENCE_WEIGHTS.get(evidence.kind) ?? 0;
      if (weight > 0) {
        bestStructuralScore = Math.max(bestStructuralScore, score);
        structuralWeight = Math.max(structuralWeight, weight);
      }
      if (BROAD_EVIDENCE_KINDS.has(evidence.kind)) broadCount += 1;
      if (NOISY_SHARED_EVIDENCE_KINDS.has(evidence.kind)) noisySharedCount += 1;
    }
    return {
      bestKind,
      bestScore,
      bestStructuralScore,
      structuralWeight,
      broadCount,
      noisySharedCount,
      hasStructural: bestStructuralScore > 0,
      broadOnly: broadCount > 0 && bestStructuralScore <= 0,
      noisySharedOnly: noisySharedCount > 0 && bestStructuralScore <= 0
    };
  }
  function applyPairwiseContrast(answerScores, mode) {
    const sorted = [...answerScores].sort((a, b) => b.raw - a.raw);
    if (mode !== "single" || sorted.length < 2) return answerScores;
    const top = sorted[0];
    const second = sorted[1];
    const rawGap = top.raw - second.raw;
    const rawRatio = second.raw / Math.max(1e-3, top.raw);
    if (rawGap > 0.85 || rawRatio < 0.965) return answerScores;
    const topSummary = summarizeEvidence(top);
    const secondSummary = summarizeEvidence(second);
    const structuralAdvantage = secondSummary.bestStructuralScore * Math.max(0.75, secondSummary.structuralWeight) - topSummary.bestStructuralScore * Math.max(0.75, topSummary.structuralWeight);
    if (structuralAdvantage < 3.8 || secondSummary.bestStructuralScore < 9) return answerScores;
    return answerScores.map(
      (item) => item.answer.id === second.answer.id ? { ...item, raw: item.raw + Math.min(0.7, structuralAdvantage * 0.08) } : item
    );
  }
  function applyStructuralClusterAdjustments(answerScores, mode, allowMultiPruning) {
    if (mode !== "multi" || !allowMultiPruning || answerScores.length < 4) return answerScores;
    const clusters = /* @__PURE__ */ new Map();
    for (const item of answerScores) {
      const evidence = (item.evidence ?? []).find((entry) => NOISY_SHARED_EVIDENCE_KINDS.has(entry.kind) && (entry.text?.length ?? 0) >= 60);
      if (!evidence) continue;
      const key = `${evidence.page}:${evidence.kind}:${normalizeForSearch(evidence.text).slice(0, 180)}`;
      const list = clusters.get(key) ?? [];
      list.push(item);
      clusters.set(key, list);
    }
    const penalties = /* @__PURE__ */ new Map();
    for (const cluster of clusters.values()) {
      if (cluster.length < 3) continue;
      const sorted = [...cluster].sort((a, b) => b.raw - a.raw);
      const clusterTop = sorted[0]?.raw ?? 0;
      for (const item of sorted.slice(2)) {
        const summary = summarizeEvidence(item);
        if (summary.hasStructural) continue;
        if (item.raw < clusterTop * 0.92) continue;
        penalties.set(item.answer.id, Math.max(penalties.get(item.answer.id) ?? 0, 0.035));
      }
    }
    if (!penalties.size) return answerScores;
    return answerScores.map((item) => {
      const penalty = penalties.get(item.answer.id) ?? 0;
      return penalty ? { ...item, raw: item.raw * (1 - penalty) } : item;
    });
  }
  function multiPruningAllowed(question) {
    const normalized = normalizeForSearch(question);
    const recommendationLike = normalized.includes(normalizeForSearch("\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434")) || normalized.includes(normalizeForSearch("\u043D\u0430\u0437\u043D\u0430\u0447")) || normalized.includes(normalizeForSearch("\u043F\u043E\u043A\u0430\u0437\u0430\u043D"));
    if (!recommendationLike) return false;
    const broadListLike = [
      "\u0432\u0441\u0435\u043C \u043F\u0430\u0446\u0438\u0435\u043D\u0442",
      "\u0432\u0441\u0435\u0445 \u043F\u0430\u0446\u0438\u0435\u043D\u0442",
      "\u0434\u0435\u043B\u044F\u0442\u0441\u044F",
      "\u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A",
      "\u0440\u0435\u0436\u0438\u043C \u0434\u043E\u0437\u0438\u0440\u043E\u0432\u0430\u043D",
      "\u0434\u0438\u0444\u0444\u0435\u0440\u0435\u043D\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0439 \u0434\u0438\u0430\u0433\u043D\u043E\u0441\u0442",
      "\u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0443\u0440\u043E\u0432\u043D\u044F"
    ].map((item) => normalizeForSearch(item));
    return !broadListLike.some((cue) => normalized.includes(cue));
  }
  function applyMultiCardinalityModel(sorted, selectedIds, scored) {
    let selected = [...selectedIds];
    const selectedSet = new Set(selected);
    if (selected.length >= 3) {
      const selectedSorted = sorted.filter((item) => selectedSet.has(item.answer.id));
      const weakest = selectedSorted[selectedSorted.length - 1];
      const previous = selectedSorted[selectedSorted.length - 2];
      if (weakest && previous) {
        const weakestSummary = summarizeEvidence(weakest);
        const topRaw = selectedSorted[0]?.raw ?? 0;
        const weakGap = previous.raw - weakest.raw;
        if (!weakestSummary.hasStructural && weakest.raw < topRaw * 0.74 && weakGap > 0.32) {
          selected = selected.filter((id) => id !== weakest.answer.id);
        }
      }
    }
    if (selected.length === 2 && sorted.length >= 3) {
      const third = sorted[2];
      const thirdSummary = summarizeEvidence(third);
      const topRaw = sorted[0]?.raw ?? 0;
      if (thirdSummary.bestStructuralScore >= 11 && third.raw >= topRaw * 0.46 && sorted[1].raw - third.raw <= 1.2) {
        selected = sorted.slice(0, 3).map((item) => item.answer.id);
      }
    }
    return selected.sort((a, b) => scored.findIndex((item) => item.answer.id === a) - scored.findIndex((item) => item.answer.id === b));
  }
  function applyMultiAllOptionsGuard(sorted, selectedIds, scored) {
    if (selectedIds.length !== scored.length) return selectedIds;
    if (scored.length < 3 || scored.length > 4) return selectedIds;
    return sorted.slice(0, 2).map((item) => item.answer.id);
  }
  function round4(value) {
    return Math.round((Number.isFinite(value) ? value : 0) * 1e4) / 1e4;
  }

  // src/predictor.ts
  var POLARITY_UP_CUES = ["\u043F\u043E\u0432\u044B\u0448", "\u0443\u0432\u0435\u043B\u0438\u0447", "\u0432\u043E\u0437\u0440\u0430\u0441\u0442\u0430", "\u0440\u043E\u0441\u0442", "\u0432\u044B\u0441\u043E\u043A", "\u0431\u043E\u043B\u0435\u0435", "\u0432\u044B\u0448\u0435"].map((item) => normalizeForSearch(item));
  var POLARITY_DOWN_CUES = ["\u0441\u043D\u0438\u0436", "\u0443\u043C\u0435\u043D\u044C\u0448", "\u043D\u0438\u0437\u043A", "\u043C\u0435\u043D\u0435\u0435", "\u043D\u0438\u0436\u0435"].map((item) => normalizeForSearch(item));
  var OCR_LATIN_MAP = new Map(
    Object.entries({
      \u0410: "a",
      \u0412: "b",
      \u0415: "e",
      \u041A: "k",
      \u041C: "m",
      \u041D: "h",
      \u041E: "o",
      \u0420: "p",
      \u0421: "c",
      \u0422: "t",
      \u0423: "y",
      \u0425: "x",
      \u0430: "a",
      \u0432: "b",
      \u0435: "e",
      \u043A: "k",
      \u043C: "m",
      \u043D: "h",
      \u043E: "o",
      \u0440: "p",
      \u0441: "c",
      \u0442: "t",
      \u0443: "y",
      \u0445: "x",
      \u0411: "b",
      \u0413: "r",
      \u0414: "d",
      \u0417: "z",
      \u0418: "n",
      \u0419: "n",
      \u041B: "l",
      \u041F: "n",
      \u0424: "f",
      \u0426: "c",
      \u0427: "y",
      \u0428: "w",
      \u0429: "w",
      \u042B: "h",
      \u042C: "b",
      \u042A: "b",
      \u042E: "io",
      \u042F: "r",
      \u0431: "b",
      \u0433: "r",
      \u0434: "d",
      \u0437: "z",
      \u0438: "n",
      \u0439: "n",
      \u043B: "l",
      \u043F: "n",
      \u0444: "f",
      \u0446: "c",
      \u0447: "y",
      \u0448: "w",
      \u0449: "w",
      \u044B: "h",
      \u044C: "b",
      \u044A: "b",
      \u044E: "io",
      \u044F: "r",
      "\xA7": "g",
      "%": "g"
    })
  );
  function questionFocusTokens(question) {
    const allTokens = uniqueTokens(question);
    const cueTokens = cueFocusTokens(question);
    const numbers = new Set(extractNumbers(question).flatMap(expandNumberToken));
    const filtered = allTokens.filter((token) => {
      if (!token) return false;
      if (numbers.has(token) || /^\d/.test(token)) return true;
      if (FOCUS_STOPWORDS.has(token)) return false;
      return token.length > 2;
    });
    const merged = [];
    for (const token of [...cueTokens, ...filtered]) {
      if (!merged.includes(token)) merged.push(token);
    }
    return merged.slice(0, 16);
  }
  function cueFocusTokens(question) {
    const raw = normalizeText(question);
    const parts = [];
    const patterns = [
      /с\s+целью\s+(.+?)(?:\s+рекоменд|\s+провод|\s+назнач|$)/u,
      /для\s+(.+?)(?:\s+рекоменд|\s+провод|\s+назнач|$)/u,
      /(?:старше|младше|моложе|до|после)\s+\d+(?:[.,]\d+)?\s+(?:лет|года|месяц|дней|сут)/u,
      /по\s+([а-яa-z0-9 -]{4,48})/u
    ];
    for (const pattern of patterns) {
      const match = raw.match(pattern);
      if (match?.[0]) parts.push(match[1] ?? match[0]);
    }
    return uniqueTokens(parts.join(" ")).filter((token) => !FOCUS_STOPWORDS.has(token));
  }
  function bestFocusedSupport({ pages, topQuestionPages, question, answer, answerTokens, focusTokens, intent }) {
    if (!focusTokens?.length) return null;
    const answerPhrases = focusedAnswerSearchPhrases(answer.text).slice(0, 24);
    let best = null;
    for (const page of pages) {
      if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
      const pageNorm = page.normalized;
      for (const phrase of answerPhrases) {
        const normalizedPhrase = normalizeForSearch(phrase);
        if (!normalizedPhrase || normalizedPhrase.length < 5) continue;
        const hits = findPhraseOccurrences(pageNorm, phrase, { textIsNormalized: true });
        for (const hit of hits) {
          const local = pageWindow(page, hit, 260);
          const localTokens = tokenizeNormalized(local);
          const focusCoverage = coverage(focusTokens, localTokens);
          const questionNumberCoverage = numberCoverage(question, local);
          if (focusCoverage < 0.22 && questionNumberCoverage <= 0) continue;
          const answerCoverage = coverage(answerTokens, localTokens);
          const limitedPenalty = intent.negative || intent.exception ? 0 : limitedCuePenalty(local);
          const score = 2.2 + focusCoverage * 5.2 + answerCoverage * 1.2 + questionNumberCoverage * (intent.numeric ? 4 : 2.2) - limitedPenalty;
          if (score <= 2.6) continue;
          best = betterEvidence(best, {
            answerId: answer.id,
            page: page.page,
            text: evidenceSnippet(page.text, phrase, question),
            score,
            kind: "focused_answer_window"
          });
        }
      }
    }
    return best;
  }
  function lineTokenSegments(page) {
    const lines = page.lines ?? [];
    const segments = [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (line?.length >= 8) segments.push({ text: line, kind: "line" });
      if (index + 1 < lines.length) {
        const pair = `${line} ${lines[index + 1]}`.replace(/\s+/g, " ").trim();
        if (pair.length >= 16 && pair.length <= 700) segments.push({ text: pair, kind: "line_pair" });
      }
    }
    return segments;
  }
  function cachedLineTokenSegments(page) {
    if (!page.__lineTokenSegments) {
      Object.defineProperty(page, "__lineTokenSegments", {
        value: lineTokenSegments(page).map((segment) => ({
          ...segment,
          normalized: normalizeForSearch(segment.text),
          tokens: tokenize(segment.text)
        })),
        enumerable: false
      });
    }
    return page.__lineTokenSegments;
  }
  function bestLineTokenSupport({ pages, topQuestionPages, question, answer, questionTokens, answerTokens, focusTokens, intent }) {
    if (!answerTokens.length) return null;
    const numericAnswer = extractNumbers(answer.text).length > 0;
    const minAnswerSupport = numericAnswer ? 0.65 : answerTokens.length <= 2 ? 0.95 : 0.62;
    const usefulFocusTokens = (focusTokens?.length ? focusTokens : questionTokens).filter((token) => token.length > 2 || /^\d/.test(token));
    if (!usefulFocusTokens.length) return null;
    const answerPhrases = answerSearchPhrases(answer.text);
    let best = null;
    for (const page of pages) {
      const isTopPage = topQuestionPages?.has(page.page);
      const pageTokens = cachedPageTokens(page);
      const pageFocusHits = tokenHitCount(usefulFocusTokens, pageTokens);
      const pageAnswerSupport = Math.max(strictSoftCoverage(answerTokens, pageTokens), numberCoverage(answer.text, page.normalized));
      if (!isTopPage && (pageFocusHits < 2 || pageAnswerSupport < minAnswerSupport)) continue;
      for (const segment of cachedLineTokenSegments(page)) {
        const segmentTokens = segment.tokens;
        if (!segmentTokens.length) continue;
        const answerCoverage = strictSoftCoverage(answerTokens, segmentTokens);
        const numericCoverage = numberCoverage(answer.text, segment.text);
        const answerSupport = Math.max(answerCoverage, numericCoverage);
        if (answerSupport < minAnswerSupport) continue;
        const focusHits = tokenHitCount(usefulFocusTokens, segmentTokens);
        const focusCoverage = coverage(usefulFocusTokens, segmentTokens);
        const questionNumberCoverage = numberCoverage(question, segment.text);
        const enoughFocus = isTopPage ? focusHits >= 1 || focusCoverage >= 0.16 : focusHits >= 2 || focusCoverage >= 0.24;
        if (!enoughFocus && questionNumberCoverage <= 0) continue;
        const exactPhrase = answerPhrases.some((phrase) => containsNormalizedPhrase(segment.normalized, phrase));
        const lengthPenalty = segment.text.length > 420 ? Math.min(1.4, (segment.text.length - 420) / 220) : 0;
        const score = 3.2 + answerSupport * 4.4 + Math.min(0.55, focusCoverage) * 5.2 + Math.min(4, focusHits) * 0.42 + questionNumberCoverage * (intent.numeric ? 2.5 : 1.2) + (exactPhrase ? 0.8 : 0) + (isTopPage ? 0.5 : 0) - lengthPenalty;
        if (score < 6.2) continue;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: segment.text,
          score,
          kind: `line_token_${segment.kind}`
        });
      }
    }
    return best;
  }
  function limitedCuePenalty(normalizedText) {
    const limitedCues = ["\u043D\u0435 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u0442\u0441\u044F", "\u043D\u0435 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u043E\u0432\u0430\u043D\u043E", "\u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u0441\u043B\u0443\u0447\u0430\u044F\u0445", "\u043F\u0440\u0438 \u043D\u0435\u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438", "\u043D\u0435\u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438", "\u0437\u0430 \u0438\u0441\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435\u043C"];
    let penalty = 0;
    for (const cue of limitedCues) {
      if (containsNormalizedPhrase(normalizedText, cue)) penalty += 0.8;
    }
    return Math.min(1.6, penalty);
  }
  function detectPolarity(text) {
    const normalized = normalizeForSearch(text);
    if (containsNormalizedPhrase(normalized, "\u043C\u0435\u043D\u0435\u0435 \u0432\u044B\u0441\u043E\u043A\u0438\u0439") || containsNormalizedPhrase(normalized, "\u043C\u0435\u043D\u0435\u0435 \u0432\u044B\u0441\u043E\u043A") || containsNormalizedPhrase(normalized, "\u043D\u0438\u0436\u0435")) {
      return "down";
    }
    if (containsNormalizedPhrase(normalized, "\u0431\u043E\u043B\u0435\u0435 \u0432\u044B\u0441\u043E\u043A\u0438\u0439") || containsNormalizedPhrase(normalized, "\u0431\u043E\u043B\u0435\u0435 \u0432\u044B\u0441\u043E\u043A") || containsNormalizedPhrase(normalized, "\u0432\u044B\u0448\u0435")) {
      return "up";
    }
    const up = POLARITY_UP_CUES.some((cue) => normalized.includes(cue));
    const down = POLARITY_DOWN_CUES.some((cue) => normalized.includes(cue));
    if (up && !down) return "up";
    if (down && !up) return "down";
    return null;
  }
  function nearestPolarityBefore(pageNorm, hit) {
    const before = pageNorm.slice(Math.max(0, hit - 140), hit);
    let best = null;
    for (const cue of POLARITY_UP_CUES) {
      const index = before.lastIndexOf(cue);
      if (index >= 0 && (!best || index > best.index)) best = { type: "up", index };
    }
    for (const cue of POLARITY_DOWN_CUES) {
      const index = before.lastIndexOf(cue);
      if (index >= 0 && (!best || index > best.index)) best = { type: "down", index };
    }
    return best?.type ?? null;
  }
  function polarityAdjustment({ pages, topQuestionPages, mode, question, questionTokens, answer }) {
    const targetPolarity = detectPolarity(question) ?? detectPolarity(answer.text);
    if (!targetPolarity) return { adjustment: 0, evidence: null };
    const phrases = [.../* @__PURE__ */ new Set([...latinAnswerTokens(answer.text), ...answerSearchPhrases(answer.text)])].slice(0, 14);
    let bestMatch = null;
    let bestMismatch = null;
    for (const page of pages) {
      if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
      const pageNorm = page.normalized;
      for (const phrase of phrases) {
        const normalizedPhrase = normalizeForSearch(phrase);
        if (!normalizedPhrase || normalizedPhrase.length < 3) continue;
        const hits = findPhraseOccurrences(pageNorm, phrase, { textIsNormalized: true });
        for (const hit of hits) {
          const local = pageWindow(page, hit, 180);
          const questionCoverage = coverage(questionTokens, tokenizeNormalized(local));
          if (questionCoverage < 0.16) continue;
          const found = nearestPolarityBefore(pageNorm, hit);
          if (!found) continue;
          const evidence = {
            answerId: answer.id,
            page: page.page,
            text: evidenceSnippet(page.text, phrase),
            score: (found === targetPolarity ? 4.8 : 4.2) + questionCoverage * 5,
            kind: found === targetPolarity ? "polarity_match" : "polarity_mismatch"
          };
          if (found === targetPolarity) bestMatch = betterEvidence(bestMatch, evidence);
          else bestMismatch = betterEvidence(bestMismatch, evidence);
        }
      }
    }
    if (bestMatch && (!bestMismatch || bestMatch.score >= bestMismatch.score + 0.3)) return { adjustment: 2.4, evidence: bestMatch };
    if (bestMismatch && (!bestMatch || bestMismatch.score > bestMatch.score + 0.3)) {
      return { adjustment: mode === "single" ? -5.2 : -2.4, evidence: bestMismatch };
    }
    return { adjustment: 0, evidence: null };
  }
  function temporalCue(text) {
    const normalized = normalizeForSearch(text);
    if (containsNormalizedPhrase(normalized, "\u043D\u043E\u0447")) return "night";
    if (containsNormalizedPhrase(normalized, "\u0434\u043D\u0435\u043C") || containsNormalizedPhrase(normalized, "\u0434\u043D\u0435\u0432")) return "day";
    return null;
  }
  function nearestTemporalCue(local) {
    return nearestCueName(local, [
      ["night", ["\u043D\u043E\u0447"]],
      ["day", ["\u0434\u043D\u0435\u043C", "\u0434\u043D\u0435\u0432"]]
    ]);
  }
  function temporalCueAdjustment({ mode, pages, topQuestionPages, answer, focusTokens, questionTokens }) {
    if (mode !== "single") return { support: null, adjustment: 0, evidence: null };
    const cue = temporalCue(answer.text);
    if (!cue) return { support: null, adjustment: 0, evidence: null };
    const usefulFocus = focusTokens?.length ? focusTokens : questionTokens;
    let bestMatch = null;
    let bestMismatch = null;
    for (const page of pages) {
      const topPage = topQuestionPages?.has(page.page);
      const adjacentTopPage = topQuestionPages?.has(page.page - 1) || topQuestionPages?.has(page.page + 1);
      if (topQuestionPages?.size && !topPage && !adjacentTopPage) continue;
      for (const segment of cachedLineWindowSegments(page)) {
        const focusCoverage = coverage(usefulFocus, segment.tokens);
        if (focusCoverage < 0.12) continue;
        const found = nearestTemporalCue(segment.normalized);
        if (!found) continue;
        const evidence = {
          answerId: answer.id,
          page: page.page,
          text: segment.text,
          score: 9.8 + Math.min(0.5, focusCoverage) * 5,
          kind: found === cue ? "temporal_cue_match" : "temporal_cue_mismatch"
        };
        if (found === cue) bestMatch = betterEvidence(bestMatch, evidence);
        else bestMismatch = betterEvidence(bestMismatch, evidence);
      }
    }
    if (bestMatch && (!bestMismatch || bestMatch.score >= bestMismatch.score - 0.4)) return { support: bestMatch, adjustment: 0, evidence: null };
    if (bestMismatch && (!bestMatch || bestMismatch.score > bestMatch.score + 0.4)) return { support: null, adjustment: -4.8, evidence: bestMismatch };
    return { support: null, adjustment: 0, evidence: null };
  }
  function latinAnswerTokens(text) {
    return String(text ?? "").match(/[A-Za-z][A-Za-z0-9-]{1,}/g) ?? [];
  }
  function latinTokenVariants(token) {
    const normalized = token.toLowerCase().replace(/[^a-z0-9]/g, "");
    const variants = /* @__PURE__ */ new Set([normalized]);
    const th = normalized.match(/^th(\d+)$/);
    if (th) {
      if (th[1] === "1") variants.add("th");
      variants.add(`th${th[1].slice(-1)}`);
    }
    return [...variants].filter(Boolean);
  }
  function relaxedLatinText(text) {
    let out = "";
    for (const char of String(text ?? "").normalize("NFKC")) {
      out += OCR_LATIN_MAP.get(char) ?? char;
    }
    return out.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  }
  function relaxedLatinTokens(text) {
    const rawTokens2 = relaxedLatinText(text).match(/[a-z0-9]+/g) ?? [];
    const joined = [];
    for (let index = 0; index < rawTokens2.length - 1; index += 1) {
      if (/^[a-z]+$/.test(rawTokens2[index]) && /^\d+$/.test(rawTokens2[index + 1])) joined.push(`${rawTokens2[index]}${rawTokens2[index + 1]}`);
    }
    const tokens = rawTokens2.filter((token) => token.length >= 2);
    return [...tokens, ...joined];
  }
  function cachedLatinTokens(page) {
    if (!page.__latinTokens) Object.defineProperty(page, "__latinTokens", { value: relaxedLatinTokens(page.text), enumerable: false });
    return page.__latinTokens;
  }
  function diceSimilarity(left, right) {
    const a = String(left ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const b = String(right ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.length <= 3 || b.length <= 3) {
      if (/\d/.test(a) || /\d/.test(b)) return 0;
      return a.startsWith(b) || b.startsWith(a) ? 0.72 : 0;
    }
    const counts = /* @__PURE__ */ new Map();
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
    return 2 * hit / Math.max(1, a.length + b.length - 2);
  }
  function bestLatinFuzzySupport({ pages, topQuestionPages, questionTokens, answer }) {
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
      const score = 4.2 + average * 5 + strong * 0.9 + questionCoverage * 2;
      best = betterEvidence(best, {
        answerId: answer.id,
        page: page.page,
        text: evidenceSnippet(page.text, latinTokens[0]),
        score,
        kind: "latin_fuzzy_ocr"
      });
    }
    return best;
  }
  function questionLabelCues(question) {
    const normalized = normalizeForSearch(question);
    return LABEL_CUES.filter((cue) => normalized.includes(cue));
  }
  function bestLabelNumberSupport({ pages, topQuestionPages, question, answer }) {
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
          if (!containsNormalizedPhrase(around, "\u0441\u0442\u0435\u043F\u0435\u043D\u0438 \u0442\u044F\u0436\u0435\u0441\u0442\u0438")) labelHits.push(index);
          start = index + Math.max(1, label.length);
        }
      }
      if (!labelHits.length) continue;
      for (const phrase of answerPhrases) {
        const hits = findPhraseOccurrences(pageNorm, phrase, { textIsNormalized: true });
        for (const hit of hits) {
          const forwardDistances = labelHits.map((labelHit) => hit - labelHit).filter((distance2) => distance2 >= 0);
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
            kind: "label_number_proximity"
          });
        }
      }
    }
    return best;
  }
  var CLASSIFICATION_CODE_QUESTION_CUES = [
    "\u043A\u043E\u0434",
    "\u043A\u043E\u0434\u0438\u0440",
    "\u043C\u043A\u0431"
  ].map((item) => normalizeForSearch(item));
  var CLASSIFICATION_CODE_GENERIC_TOKENS = new Set(
    [
      "\u043A\u043E\u0434",
      "\u043A\u043E\u0434\u0438\u0440\u0443\u0435\u0442\u0441\u044F",
      "\u043A\u043E\u0434\u0438\u0440\u043E\u0432\u043A\u0430",
      "\u043C\u043A\u0431",
      "\u043C\u0435\u0436\u0434\u0443\u043D\u0430\u0440\u043E\u0434\u043D\u043E\u0439",
      "\u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0439",
      "\u043A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438",
      "\u0431\u043E\u043B\u0435\u0437\u043D\u0435\u0439",
      "\u043F\u0440\u043E\u0431\u043B\u0435\u043C",
      "\u0441\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u0445",
      "\u0437\u0434\u043E\u0440\u043E\u0432\u044C\u0435\u043C",
      "\u043A\u0440\u0438\u0442\u0435\u0440\u0438\u0439",
      "\u043A\u0440\u0438\u0442\u0435\u0440\u0438\u0438",
      "\u0443\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442",
      "\u0441\u0432\u0438\u0434\u0435\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u0443\u0435\u0442",
      "\u043E\u0442\u0440\u0430\u0436\u0430\u0435\u0442",
      "\u043F\u0440\u0438\u0437\u043D\u0430\u043A\u0438",
      "\u0441\u0442\u0430\u0434\u0438\u044F"
    ].flatMap((item) => uniqueTokens(item))
  );
  var CYRILLIC_CODE_LETTERS = /* @__PURE__ */ new Map([
    ["\u0410", "a"],
    ["\u0412", "b"],
    ["\u0421", "c"],
    ["\u0415", "e"],
    ["\u041D", "h"],
    ["\u041A", "k"],
    ["\u041C", "m"],
    ["\u041E", "o"],
    ["\u0420", "p"],
    ["\u0422", "t"],
    ["\u0425", "x"],
    ["\u0430", "a"],
    ["\u0432", "b"],
    ["\u0441", "c"],
    ["\u0435", "e"],
    ["\u043D", "h"],
    ["\u043A", "k"],
    ["\u043C", "m"],
    ["\u043E", "o"],
    ["\u0440", "p"],
    ["\u0442", "t"],
    ["\u0445", "x"]
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
    while (match = pattern.exec(normalized)) {
      const code = canonicalClassificationCode(match[0]);
      if (code) codes.push(code);
    }
    const ocrJPattern = /(?:^|[^\p{L}\p{N}])(?:[.\u041b\u043b])\s*\.?\s*(\d{2,3})(?:\s*[.]\s*(\d{1,2}))?(?![\p{L}\p{N}])/gu;
    while (match = ocrJPattern.exec(normalized)) {
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
  function bestClassificationCodeSupport({ pages, topQuestionPages, question, answer, questionTokens, focusTokens }) {
    const code = canonicalClassificationCode(answer.text);
    if (!code) return null;
    const normalizedQuestion = normalizeForSearch(question);
    const isCodeQuestion = CLASSIFICATION_CODE_QUESTION_CUES.some((cue) => normalizedQuestion.includes(cue));
    if (!isCodeQuestion) return null;
    const filteredFocus = focusTokens.filter((token) => token.length >= 3 && !CLASSIFICATION_CODE_GENERIC_TOKENS.has(token) && !/^\d/.test(token)).slice(0, 12);
    const filteredQuestion = questionTokens.filter((token) => token.length >= 3 && !CLASSIFICATION_CODE_GENERIC_TOKENS.has(token) && !/^\d/.test(token)).slice(0, 18);
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
          kind: "classification_code_segment"
        });
      }
    }
    return best;
  }
  function canonicalShortLabel(value) {
    const compact = String(value ?? "").normalize("NFKC").toLowerCase().replace(/[.\s_\-–—]+/g, "").replace(/[тТ]/g, "t").replace(/[мМ]/g, "m").replace(/[хХ]/g, "x").replace(/[оОoO]/g, "0").replace(/[аА]/g, "a").replace(/[вВ]/g, "b");
    return compact.replace(/[^a-z0-9]/g, "");
  }
  function questionShortLabels(question) {
    const text = String(question ?? "").normalize("NFKC");
    const labels = /* @__PURE__ */ new Set();
    const patterns = [
      /(?<![\p{L}\p{N}])[TТ]\s*(?:is|[0-4xхoо])\s*[abаАвВ]?(?![\p{L}\p{N}])/giu,
      /(?<![\p{L}\p{N}])[NН]\s*(?:[0-3xхoо])\s*[abаАвВ]?(?![\p{L}\p{N}])/giu,
      /(?<![\p{L}\p{N}])[MМ]\s*(?:[0-1xхoо])\s*[abаАвВ]?(?![\p{L}\p{N}])/giu,
      /(?<![\p{L}\p{N}])(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\s*[abаАвВ]?(?![\p{L}\p{N}])/giu
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
    const labels = new Set(questionShortLabels(raw));
    const compact = canonicalShortLabel(raw);
    if (/^[tnm](?:is|[0-4x])(?:[ab])?$/.test(compact)) labels.add(compact);
    if (/^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)(?:[ab])?$/.test(compact)) labels.add(compact);
    return [...labels];
  }
  function visualRowText(lines, index) {
    const start = Math.max(0, index - 2);
    const end = Math.min(lines.length, index + 4);
    return lines.slice(start, end).map((line) => line.text).join(" ").replace(/\s+/g, " ").trim();
  }
  var CLOZE_GENERIC_FOCUS = new Set(
    uniqueTokens(
      [
        "\u043F\u0430\u0446\u0438\u0435\u043D\u0442 \u043F\u0430\u0446\u0438\u0435\u043D\u0442\u044B \u043F\u0430\u0446\u0438\u0435\u043D\u0442\u0430\u043C \u0431\u043E\u043B\u044C\u043D\u043E\u0439 \u0431\u043E\u043B\u044C\u043D\u044B\u0445 \u0434\u0435\u0442\u0438 \u0434\u0435\u0442\u0435\u0439 \u0440\u0435\u0431\u0435\u043D\u043E\u043A \u0440\u0435\u0431\u0435\u043D\u043A\u0430",
        "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u0442\u0441\u044F \u043F\u0440\u043E\u0432\u043E\u0434\u0438\u0442\u0441\u044F \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u043D\u0430\u0437\u043D\u0430\u0447\u0430\u0435\u0442\u0441\u044F \u043F\u0440\u0438\u043D\u0438\u043C\u0430\u0435\u0442\u0441\u044F \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044E\u0442",
        "\u0441\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442 \u043E\u0442\u043D\u043E\u0441\u044F\u0442\u0441\u044F \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0435 \u043A\u0440\u0438\u0442\u0435\u0440\u0438\u0438 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0442\u0435\u0440\u0430\u043F\u0438\u044F \u043B\u0435\u0447\u0435\u043D\u0438\u0435",
        "\u043A\u043B\u0438\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0438 \u0437\u0430\u0431\u043E\u043B\u0435\u0432\u0430\u043D\u0438\u0435 \u0434\u0438\u0430\u0433\u043D\u043E\u0437 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430",
        "\u043E\u0431\u044B\u0447\u043D\u043E \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E \u0441\u043B\u0435\u0434\u0443\u0435\u0442 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E \u043F\u043E\u0441\u043B\u0435 \u043F\u0435\u0440\u0435\u0434 \u043F\u0440\u0438 \u0434\u043B\u044F"
      ].join(" ")
    )
  );
  var CLOZE_COUNT_RIGHT_TOKENS = new Set(uniqueTokens("\u0440\u0430\u0437 \u0441\u0443\u0442\u043A\u0438 \u043F\u0440\u0438\u0435\u043C \u043F\u0440\u0438\u0451\u043C \u0434\u0435\u043D\u044C"));
  var CLOZE_CONTRAST_PHRASES = [
    "\u043F\u0440\u0438 \u043C\u0435\u043D\u0435\u0435",
    "\u043C\u0435\u043D\u0435\u0435 \u0432\u044B\u0440\u0430\u0436",
    "\u0434\u0430\u043B\u0435\u0435",
    "\u043F\u043E\u0441\u043B\u0435",
    "\u043B\u0438\u0431\u043E",
    "\u0438\u043B\u0438",
    "\u0434\u043B\u044F \u0434\u0435\u043A\u0440\u0435\u0442",
    "\u0434\u0435\u043A\u0440\u0435\u0442\u0438\u0440\u043E\u0432\u0430\u043D",
    "\u0441\u0442\u0430\u0440\u0448\u0435",
    "\u043E\u0442 1 \u0433\u043E\u0434\u0430",
    "\u0447\u0435\u0440\u0435\u0437"
  ].map((phrase) => normalizeForSearch(phrase));
  var SMALL_NUMBER_ALIASES = new Map(
    Object.entries({
      "1": ["\u043E\u0434\u0438\u043D", "\u043E\u0434\u043D\u0430", "\u043E\u0434\u043D\u043E", "\u043E\u0434\u043D\u043E\u043A\u0440\u0430\u0442\u043D\u043E", "\u043E\u0434\u043D\u043E\u043A\u0440\u0430\u0442\u043D\u043E\u0435", "\u043E\u0434\u043D\u043E\u043A\u0440\u0430\u0442\u043D\u044B\u0439", "\u043E\u0434\u043D\u043E\u043A\u0440\u0430\u0442\u043D\u0430\u044F", "1 \u0440\u0430\u0437", "1 \u0440"],
      "2": ["\u0434\u0432\u0430", "\u0434\u0432\u0435", "\u0434\u0432\u0430\u0436\u0434\u044B", "\u0434\u0432\u0443\u043A\u0440\u0430\u0442\u043D\u043E", "\u0434\u0432\u0443\u043A\u0440\u0430\u0442\u043D\u043E\u0435", "\u0434\u0432\u0443\u043A\u0440\u0430\u0442\u043D\u044B\u0439", "\u0434\u0432\u0443\u043A\u0440\u0430\u0442\u043D\u0430\u044F", "2 \u0440\u0430\u0437\u0430", "2 \u0440"],
      "3": ["\u0442\u0440\u0438", "\u0442\u0440\u0438\u0436\u0434\u044B", "\u0442\u0440\u0435\u0445\u043A\u0440\u0430\u0442\u043D\u043E", "\u0442\u0440\u0451\u0445\u043A\u0440\u0430\u0442\u043D\u043E", "3 \u0440\u0430\u0437\u0430", "3 \u0440"],
      "4": ["\u0447\u0435\u0442\u044B\u0440\u0435", "\u0447\u0435\u0442\u044B\u0440\u0435\u0445\u043A\u0440\u0430\u0442\u043D\u043E", "\u0447\u0435\u0442\u044B\u0440\u0451\u0445\u043A\u0440\u0430\u0442\u043D\u043E", "4 \u0440\u0430\u0437\u0430", "4 \u0440"],
      "5": ["\u043F\u044F\u0442\u044C", "5 \u0440\u0430\u0437", "5 \u0440"],
      "6": ["\u0448\u0435\u0441\u0442\u044C", "6 \u0440\u0430\u0437", "6 \u0440"]
    })
  );
  function clozeQuestionParts(question) {
    const raw = String(question ?? "");
    const blank = raw.match(/_{2,}|…+/u);
    if (!blank?.index) return { left: raw, right: "" };
    return {
      left: raw.slice(0, blank.index),
      right: raw.slice(blank.index + blank[0].length)
    };
  }
  function clozeApplicable({ mode, question, answer }) {
    if (mode !== "single") return false;
    const hasBlank = /_{2,}|…+/u.test(String(question ?? ""));
    if (hasBlank) return true;
    return false;
  }
  function clozeFocusTokens(question, focusTokens, answerTokens) {
    const answerSet = new Set(answerTokens ?? []);
    const out = [];
    for (const token of [...focusTokens ?? [], ...uniqueTokens(question)]) {
      if (!token || token.length < 3) continue;
      if (answerSet.has(token)) continue;
      if (FOCUS_STOPWORDS.has(token) || CLOZE_GENERIC_FOCUS.has(token)) continue;
      if (!out.includes(token)) out.push(token);
    }
    return out.slice(0, 18);
  }
  function clozeCoreTokens(question, answerTokens) {
    const parts = clozeQuestionParts(question);
    const left = parts.left.split(
      /\s+(?:у|для|при|с|со|в)\s+пациент|\s+пациентам|\s+пациентов|\s+больным|\s+детям|\s+младше|\s+старше|\s+кажд|\s+принима|\s+провод|\s+составля|\s+равн|\s+в\s+дозе/iu
    )[0];
    const tokens = uniqueTokens(left).filter((token) => token.length >= 4 && !FOCUS_STOPWORDS.has(token) && !CLOZE_GENERIC_FOCUS.has(token));
    const answerSet = new Set(answerTokens ?? []);
    return tokens.filter((token) => !answerSet.has(token)).slice(0, 6);
  }
  function clozeAnswerPhraseEntries(answerText) {
    const entries = [];
    const seen = /* @__PURE__ */ new Set();
    const add = (value, alias = false) => {
      const normalizedPhrase = normalizeForSearch(value);
      if (!normalizedPhrase || normalizedPhrase.length < 1 || seen.has(normalizedPhrase)) return;
      seen.add(normalizedPhrase);
      entries.push({
        phrase: String(value),
        alias,
        bareNumber: /^\d+(?:[.,]\d+)?$/u.test(normalizedPhrase)
      });
    };
    for (const phrase of answerSearchPhrases(answerText).slice(0, 18)) add(phrase, false);
    const numbers = extractNumbers(answerText);
    for (const number of numbers) {
      for (const expanded of expandNumberToken(number)) add(expanded, true);
    }
    if (numbers.length === 1) {
      const normalizedNumber = numbers[0].replace(/[.,]0+$/u, "");
      for (const alias of SMALL_NUMBER_ALIASES.get(normalizedNumber) ?? []) add(alias, true);
    }
    const answerNorm = normalizeForSearch(answerText);
    if (containsNormalizedPhrase(answerNorm, normalizeForSearch("\u043C\u0435\u0441\u044F\u0446")) || containsNormalizedPhrase(answerNorm, normalizeForSearch("\u043C\u0435\u0441\u044F\u0446\u0435\u0432"))) {
      add("\u043C\u0435\u0441", true);
    }
    if (containsNormalizedPhrase(answerNorm, normalizeForSearch("\u043D\u0435\u0434\u0435\u043B\u044F")) || containsNormalizedPhrase(answerNorm, normalizeForSearch("\u043D\u0435\u0434\u0435\u043B\u0438"))) {
      add("\u043D\u0435\u0434", true);
    }
    return entries;
  }
  function clozeHasUnitCue(local, question) {
    const text = normalizeForSearch(`${local} ${question}`);
    return /(?:мг|мес|месяц|сут|дн|раз|р |%|°|мм|г\/л|лет|год)/u.test(text);
  }
  function lastTokenDistance(before, focusTokens) {
    let best = -1;
    for (const token of focusTokens) {
      if (!token) continue;
      const index = before.lastIndexOf(token);
      if (index > best) best = index;
    }
    if (best < 0) return Number.POSITIVE_INFINITY;
    return before.length - best;
  }
  function clozeContrastPenalty(tail, questionNumbers) {
    let penalty = 0;
    for (const phrase of CLOZE_CONTRAST_PHRASES) {
      if (phrase && containsNormalizedPhrase(tail, phrase)) penalty += 1;
    }
    const localNumbers = extractNumbers(tail);
    if (questionNumbers.length && localNumbers.some((number) => !questionNumbers.includes(number))) {
      penalty += 1;
    }
    return Math.min(3, penalty);
  }
  function relevantClozeQuestionNumbers(question) {
    const raw = String(question ?? "");
    const out = [];
    const pattern = /(?<![\p{L}])([<>]?\d+(?:[.,]\d+)?)(?![\p{L}])/giu;
    for (const match of raw.matchAll(pattern)) {
      const index = match.index ?? 0;
      const around = raw.slice(Math.max(0, index - 24), index + match[0].length + 24).toLowerCase();
      if (!/[<>]|мг|мм|мес|меся|лет|год|сут|дн|%|°|температур|доз|кажд|раз/u.test(around)) continue;
      const cleaned = match[1].replace(/^[<>]/u, "");
      for (const expanded of expandNumberToken(cleaned)) {
        if (!out.includes(expanded)) out.push(expanded);
      }
    }
    return out;
  }
  function clozeLocalHasRelevantQuestionNumber(local, relevantNumbers) {
    if (!relevantNumbers.length) return true;
    const localNumbers = new Set(extractNumbers(local).flatMap(expandNumberToken));
    return relevantNumbers.some((number) => localNumbers.has(number));
  }
  function clozeTailHasConflictingNumber(tail, answerText) {
    const answerNumbers = new Set(extractNumbers(answerText).flatMap(expandNumberToken));
    if (!answerNumbers.size) return false;
    return extractNumbers(tail).flatMap(expandNumberToken).some((number) => !answerNumbers.has(number));
  }
  function clozeTailHasTimingCue(tail) {
    return containsNormalizedPhrase(tail, "\u0447\u0435\u0440\u0435\u0437") || containsNormalizedPhrase(tail, "\u043F\u043E\u0441\u043B\u0435");
  }
  function bestClozeGapSupport({ mode, pages, topQuestionPages, question, answer, answerTokens, focusTokens }) {
    if (!clozeApplicable({ mode, question, answer })) return null;
    const specificFocus = clozeFocusTokens(question, focusTokens, answerTokens);
    if (specificFocus.length < 2) return null;
    const answerEntries = clozeAnswerPhraseEntries(answer.text);
    if (!answerEntries.length) return null;
    const parts = clozeQuestionParts(question);
    const rightTokens = clozeFocusTokens(parts.right, uniqueTokens(parts.right), answerTokens);
    if (!rightTokens.some((token) => CLOZE_COUNT_RIGHT_TOKENS.has(token))) return null;
    const hasBlank = /_{2,}|…+/u.test(String(question ?? ""));
    const coreTokens = clozeCoreTokens(question, answerTokens);
    const questionNumbers = extractNumbers(question);
    const relevantQuestionNumbers = relevantClozeQuestionNumbers(question);
    let best = null;
    for (const page of pages) {
      const nearTopPage = !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
      if (!nearTopPage) continue;
      const sources = cachedLineWindowSegments(page).filter((segment) => segment.normalized.length <= 760);
      for (const source of sources) {
        const tokens = tokenizeNormalized(source.normalized);
        const focusHits = tokenHitCount(specificFocus, tokens);
        const focusCoverage = coverage(specificFocus, tokens);
        if (focusHits < 2 && focusCoverage < 0.24) continue;
        for (const entry of answerEntries) {
          const hits = findPhraseOccurrences(source.normalized, entry.phrase, { textIsNormalized: true });
          for (const hit of hits) {
            const local = source.normalized.slice(Math.max(0, hit - 80), hit + entry.phrase.length + 90);
            if (entry.bareNumber && !clozeHasUnitCue(local, question)) continue;
            const relevantLocal = source.normalized.slice(Math.max(0, hit - 220), hit + entry.phrase.length + 140);
            if (!clozeLocalHasRelevantQuestionNumber(relevantLocal, relevantQuestionNumbers)) continue;
            const before = source.normalized.slice(Math.max(0, hit - 300), hit);
            const after = source.normalized.slice(hit + entry.phrase.length, hit + entry.phrase.length + 180);
            const beforeTokens = tokenizeNormalized(before);
            if (hasBlank && coreTokens.length >= 2) {
              const recentCoreCoverage = coverage(coreTokens, tokenizeNormalized(before.slice(-180)));
              const overallCoreCoverage = coverage(coreTokens, beforeTokens);
              if (recentCoreCoverage < 0.45 && overallCoreCoverage < 0.75) continue;
              if (lastTokenDistance(before, coreTokens) > 110) continue;
            }
            const beforeFocusHits = tokenHitCount(specificFocus, beforeTokens);
            const beforeCoverage = coverage(specificFocus, beforeTokens);
            if (beforeFocusHits < 2 && beforeCoverage < 0.18) continue;
            const distance = lastTokenDistance(before, specificFocus);
            if (!Number.isFinite(distance) || distance > 220) continue;
            const tail = before.slice(Math.max(0, before.length - Math.min(140, distance + 28)));
            const contrastPenalty = clozeContrastPenalty(tail, questionNumbers);
            if (!hasBlank && entry.bareNumber && clozeTailHasTimingCue(tail)) continue;
            if (!hasBlank && clozeTailHasConflictingNumber(tail, answer.text)) continue;
            if (contrastPenalty >= 2 && !rightTokens.length) continue;
            const rightCoverage = rightTokens.length ? coverage(rightTokens, tokenizeNormalized(after)) : 0;
            const numeric = numberCoverage(answer.text, local);
            const score = 12.1 + Math.min(6, focusHits) * 0.65 + Math.min(6, beforeFocusHits) * 0.85 + Math.min(0.7, beforeCoverage) * 4 + proximityBonus(distance, 180) * 6 + Math.min(0.75, rightCoverage) * 4 + (entry.alias ? 1.4 : 0) + numeric * 1.1 - contrastPenalty * 5.2;
            if (score < 10.8) continue;
            best = betterEvidence(best, {
              answerId: answer.id,
              page: page.page,
              text: source.text,
              score,
              kind: "cloze_gap_local"
            });
          }
        }
      }
    }
    return best;
  }
  var VISUAL_TABLE_COLUMN_GENERIC_FOCUS = new Set(
    uniqueTokens(
      [
        "\u043F\u0440\u0438\u0437\u043D\u0430\u043A\u0438 \u043A\u0440\u0438\u0442\u0435\u0440\u0438\u0438 \u043E\u0442\u043D\u043E\u0441\u044F\u0442\u0441\u044F \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438 \u0442\u0430\u0431\u043B\u0438\u0446\u0430 \u0441\u043E\u0433\u043B\u0430\u0441\u043D\u043E \u043A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F",
        "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u043D\u044B \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u044F\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u0432\u043A\u043B\u044E\u0447\u0430\u0435\u0442 \u0432\u043A\u043B\u044E\u0447\u0430\u044E\u0442"
      ].join(" ")
    )
  );
  var VISUAL_TABLE_METRIC_STOP = new Set(uniqueTokens("\u043C\u043C \u043C\u0433 \u043C\u043B \u0433 \u043B \u0447 \u043C\u0438\u043D \u0441\u0443\u0442\u043A\u0438 \u0434\u0435\u043D\u044C \u0434\u043D\u0435\u0439 \u0440\u0430\u0437 \u0431\u043E\u043B\u0435\u0435 \u043C\u0435\u043D\u0435\u0435 \u0432\u044B\u0448\u0435 \u043D\u0438\u0436\u0435 \u0438\u043B\u0438 \u043D\u043E\u0440\u043C\u0430"));
  var VISUAL_TABLE_COLUMN_CUE_TOKENS = new Set(
    uniqueTokens("\u043B\u0435\u0433\u043A\u0430\u044F \u043B\u0435\u0433\u043A\u043E\u0439 \u0441\u0440\u0435\u0434\u043D\u044F\u044F \u0441\u0440\u0435\u0434\u043D\u0435\u0439 \u0441\u0440\u0435\u0434\u043D\u0435\u0442\u044F\u0436\u0435\u043B\u0430\u044F \u0441\u0440\u0435\u0434\u043D\u0435\u0442\u044F\u0436\u0435\u043B\u043E\u0439 \u0442\u044F\u0436\u0435\u043B\u0430\u044F \u0442\u044F\u0436\u0435\u043B\u043E\u0439 \u0441\u0442\u0435\u043F\u0435\u043D\u044C \u0441\u0442\u0435\u043F\u0435\u043D\u0438 \u0441\u0442\u0430\u0434\u0438\u044F \u0441\u0442\u0430\u0434\u0438\u0438 \u043A\u043B\u0430\u0441\u0441 \u043A\u043B\u0430\u0441\u0441\u0430 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u0433\u0440\u0443\u043F\u043F\u0430 \u0442\u0438\u043F \u0444\u043E\u0440\u043C\u0430")
  );
  function hasVisualTableColumnCue(question, focusTokens) {
    const tokens = [.../* @__PURE__ */ new Set([...focusTokens ?? [], ...uniqueTokens(question)])];
    return tokens.some((token) => VISUAL_TABLE_COLUMN_CUE_TOKENS.has(token));
  }
  function visualTableColumnFocusTokens(focusTokens, question) {
    const out = [];
    for (const token of [...focusTokens ?? [], ...uniqueTokens(question)]) {
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
      if (containsNormalizedPhrase(lineNorm, "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443") || /pekom/iu.test(lineNorm)) continue;
      for (const item of line.items ?? []) {
        if (String(item.text ?? "").length > 90) continue;
        const itemTokens = uniqueTokens(item.text);
        const hits = tokenHitCount(focus, itemTokens);
        const required = focus.length >= 2 ? 2 : 1;
        if (hits < required) continue;
        targets.push({
          x: item.x ?? 0,
          text: line.text,
          page: page.page
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
  function buildVisualTableColumnTargetsByPage(pages, question, focusTokens, topQuestionPages) {
    const byPage = /* @__PURE__ */ new Map();
    for (const page of pages) {
      const nearTopPage = !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
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
    const signs = /* @__PURE__ */ new Set();
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
    return (line.items ?? []).filter((item) => Math.abs((item.x ?? 0) - targetX) <= 52).map((item) => item.text).join(" ").replace(/\s+/g, " ").trim();
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
  function bestVisualTableColumnSupport({ mode, pages, topQuestionPages, question, answer, focusTokens, visualTableColumnTargetsByPage }) {
    if (mode !== "multi" || !extractNumbers(answer.text).length) return null;
    if (!visualTableColumnTargetsByPage) return null;
    const metricTokens = answerMetricTokens(answer.text);
    if (!metricTokens.length) return null;
    let best = null;
    for (const page of pages) {
      const nearTopPage = !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
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
            const score = 15.2 + proximityBonus(xDistance, 48) * 3 + Math.min(3, metricHits) * 1.8 + Math.min(0.8, metricCoverage) * 4.2 + numberCoverage(answer.text, normalizeForSearch(cellText)) * 2.2;
            best = betterEvidence(best, {
              answerId: answer.id,
              page: page.page,
              text: `${target.text} ${metricText} ${cellText}`.replace(/\s+/g, " ").trim(),
              score,
              kind: "visual_table_column"
            });
          }
        }
      }
    }
    return best;
  }
  var COORDINATE_TABLE_GENERIC_TOKENS = new Set(
    [
      "\u0442\u0430\u0431\u043B\u0438\u0446\u0430 \u0442\u0430\u0431\u043B\u0438\u0446\u0435 \u0442\u0430\u0431\u043B\u0438\u0447\u043D\u044B\u0439 \u0441\u043E\u0433\u043B\u0430\u0441\u043D\u043E",
      "\u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F",
      "\u043A\u0440\u0438\u0442\u0435\u0440\u0438\u0439 \u043A\u0440\u0438\u0442\u0435\u0440\u0438\u0438 \u043F\u0440\u0438\u0437\u043D\u0430\u043A \u043F\u0440\u0438\u0437\u043D\u0430\u043A\u0438",
      "\u043A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u043A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 \u0433\u0440\u0430\u0434\u0430\u0446\u0438\u044F",
      "\u043F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u044F \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u0435 \u0441\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442 \u0441\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u044E\u0442"
    ].flatMap((item) => uniqueTokens(item))
  );
  var COORDINATE_TABLE_CUE_TOKENS = new Set(
    [
      "\u0442\u0430\u0431\u043B\u0438\u0446\u0430 \u0442\u0430\u0431\u043B\u0438\u0446\u0435 \u0448\u043A\u0430\u043B\u0430 \u0448\u043A\u0430\u043B\u0435 \u043A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u043A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438",
      "\u0441\u0442\u0435\u043F\u0435\u043D\u044C \u0441\u0442\u0435\u043F\u0435\u043D\u0438 \u0441\u0442\u0430\u0434\u0438\u044F \u0441\u0442\u0430\u0434\u0438\u0438 \u043A\u043B\u0430\u0441\u0441 \u043A\u043B\u0430\u0441\u0441\u0430 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438",
      "\u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u044F \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u0435",
      "\u043A\u0440\u0438\u0442\u0435\u0440\u0438\u0439 \u043A\u0440\u0438\u0442\u0435\u0440\u0438\u0438 \u0433\u0440\u0430\u0434\u0430\u0446\u0438\u044F \u0430\u0431\u0441\u043E\u043B\u044E\u0442\u043D\u044B\u0435 \u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435"
    ].flatMap((item) => uniqueTokens(item))
  );
  function hasCoordinateTableCue(question, focusTokens) {
    const raw = String(question ?? "").toLowerCase();
    const rawCue = [
      "\u0442\u0430\u0431\u043B\u0438\u0446",
      "\u0448\u043A\u0430\u043B",
      "\u043A\u043B\u0430\u0441\u0441\u0438\u0444",
      "\u0441\u0442\u0435\u043F\u0435\u043D",
      "\u0441\u0442\u0430\u0434",
      "\u043A\u043B\u0430\u0441\u0441",
      "\u043A\u0430\u0442\u0435\u0433\u043E\u0440",
      "\u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B",
      "\u043F\u043E\u043A\u0430\u0437\u0430\u043D",
      "\u043A\u0440\u0438\u0442\u0435\u0440",
      "\u0433\u0440\u0430\u0434\u0430\u0446",
      "\u0430\u0431\u0441\u043E\u043B\u044E\u0442",
      "\u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0435\u043B"
    ].some((cue) => raw.includes(cue));
    if (rawCue) return true;
    const tokens = [.../* @__PURE__ */ new Set([...focusTokens ?? [], ...uniqueTokens(question)])];
    return tokens.some((token) => COORDINATE_TABLE_CUE_TOKENS.has(token));
  }
  function coordinateCellText(cell) {
    return String(cell?.text ?? "").replace(/\s+/g, " ").trim();
  }
  function coordinateLineCells(line) {
    const items = [...line?.items ?? []].filter((item) => String(item?.text ?? "").trim()).sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
    const cells = [];
    for (const item of items) {
      const text = String(item.text ?? "").replace(/\s+/g, " ").trim();
      const x = item.x ?? 0;
      const width = item.width ?? Math.max(8, text.length * 4.2);
      const endX = x + Math.max(width, 4);
      const previous = cells[cells.length - 1];
      if (!previous) {
        cells.push({ text, x, endX, y: item.y ?? line?.y ?? 0, itemCount: 1 });
        continue;
      }
      const visualGap = x - previous.endX;
      const originGap = x - previous.x;
      if (visualGap > 18 && originGap > 34) {
        cells.push({ text, x, endX, y: item.y ?? line?.y ?? 0, itemCount: 1 });
      } else {
        previous.text = `${previous.text} ${text}`.replace(/\s+/g, " ").trim();
        previous.endX = Math.max(previous.endX, endX);
        previous.itemCount += 1;
      }
    }
    return cells.filter((cell) => coordinateCellText(cell));
  }
  function coordinateCellsSpread(cells) {
    if (cells.length < 2) return 0;
    return Math.max(...cells.map((cell) => cell.endX)) - Math.min(...cells.map((cell) => cell.x));
  }
  function coordinateCellsHaveNumericValue(cells) {
    return cells.some((cell) => extractNumbers(cell.text).length > 0 || /[<>≤≥=]/u.test(String(cell.text ?? "")));
  }
  function isCoordinateTableLine(line, cells = coordinateLineCells(line)) {
    if (!cells.length) return false;
    const text = String(line?.text ?? "").replace(/\s+/g, " ").trim();
    const spread = coordinateCellsSpread(cells);
    if (text.length > 340) return false;
    if (cells.length >= 3 && spread >= 135) return true;
    if (cells.length >= 2 && spread >= 190 && coordinateCellsHaveNumericValue(cells)) return true;
    return false;
  }
  function coordinateLineHasHeaderCue(line) {
    const tokens = tokenize(line?.text ?? "");
    return tokenHitCount([...COORDINATE_TABLE_CUE_TOKENS], tokens) > 0;
  }
  function coordinateTextHasTableCaption(text) {
    const normalized = normalizeForSearch(text);
    if (containsNormalizedPhrase(normalized, "\u0441\u043E\u0433\u043B\u0430\u0441\u043D\u043E \u0442\u0430\u0431\u043B\u0438\u0446")) return false;
    return containsNormalizedPhrase(normalized, "\u0442\u0430\u0431\u043B\u0438\u0446") || containsNormalizedPhrase(normalized, "\u0448\u043A\u0430\u043B") || containsNormalizedPhrase(normalized, "\u0433\u0440\u0430\u0434\u0430\u0446") || containsNormalizedPhrase(normalized, "\u043A\u043B\u0430\u0441\u0441\u0438\u0444");
  }
  function coordinateTextIsRecommendationMeta(text) {
    const raw = String(text ?? "").toLowerCase();
    if (raw.includes("\u0443\u0440\u043E\u0432\u0435\u043D\u044C \u0443\u0431\u0435\u0434\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442") || raw.includes("\u0434\u043E\u0441\u0442\u043E\u0432\u0435\u0440\u043D\u043E\u0441\u0442") || raw.includes("\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434") || raw.includes("\u043A\u043E\u043C\u043C\u0435\u043D\u0442")) {
      return true;
    }
    const normalized = normalizeForSearch(text);
    return containsNormalizedPhrase(normalized, "\u0443\u0440\u043E\u0432\u0435\u043D\u044C \u0443\u0431\u0435\u0434\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442") || containsNormalizedPhrase(normalized, "\u0434\u043E\u0441\u0442\u043E\u0432\u0435\u0440\u043D\u043E\u0441\u0442\u0438 \u0434\u043E\u043A\u0430\u0437") || containsNormalizedPhrase(normalized, "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434") || containsNormalizedPhrase(normalized, "\u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440");
  }
  function coordinateLineLooksLikeDataRow(line, cells = coordinateLineCells(line)) {
    if (!cells.length) return false;
    if (coordinateLineHasHeaderCue(line)) return false;
    const firstCell = normalizeForSearch(cells[0]?.text ?? "");
    const firstTwoText = cells.slice(0, 2).map((cell) => cell.text).join(" ");
    if (/^(?:[ivxlcdm]+|\d+(?:[.)])?)$/iu.test(firstCell)) return true;
    if (severityCue(firstTwoText)) return true;
    if (cells.length >= 3 && coordinateCellsHaveNumericValue(cells) && !containsNormalizedPhrase(normalizeForSearch(line?.text ?? ""), "\u0442\u0430\u0431\u043B\u0438\u0446")) return true;
    return false;
  }
  function coordinateSeverityCueCount(text) {
    const normalized = normalizeForSearch(text);
    const cues = [
      "\u043A\u0440\u0430\u0439\u043D",
      "\u0441\u0440\u0435\u0434\u043D\u0435\u0442\u044F\u0436",
      "\u0441\u0440\u0435\u0434\u043D",
      "\u0443\u043C\u0435\u0440\u0435\u043D",
      "\u0442\u044F\u0436\u0435\u043B",
      "\u043B\u0435\u0433\u043A"
    ];
    let count = 0;
    for (const cue of cues) {
      if (containsNormalizedPhrase(normalized, cue)) count += 1;
    }
    return count;
  }
  function coordinateRowHasTableContext(row) {
    const firstCell = normalizeForSearch(row.cells?.[0]?.text ?? "");
    const firstTwoText = (row.cells ?? []).slice(0, 2).map((cell) => cell.text).join(" ");
    const structuralFirstCell = (row.cells?.length ?? 0) >= 3 && /^(?:[ivxlcdm]+|\d+(?:[.)])?)$/iu.test(firstCell) || (row.cells?.length ?? 0) >= 3 && severityCue(firstTwoText);
    if (coordinateTextIsRecommendationMeta(row.sourceText || row.text) && !structuralFirstCell) return false;
    if (coordinateTextHasTableCaption(row.headerText)) return true;
    if (structuralFirstCell) return true;
    return false;
  }
  function coordinateTableQuestionBlocked(question) {
    const normalized = normalizeForSearch(question);
    return containsNormalizedPhrase(normalized, "\u0444\u0438\u0431\u0440\u043E\u0437") || containsNormalizedPhrase(normalized, "metavir");
  }
  function nearestCoordinateCell(cells, x) {
    let best = null;
    let bestDistance = Infinity;
    for (const cell of cells) {
      const center = (cell.x + cell.endX) / 2;
      const distance = Math.min(Math.abs(cell.x - x), Math.abs(center - x));
      if (distance < bestDistance) {
        best = cell;
        bestDistance = distance;
      }
    }
    return bestDistance <= 54 ? best : null;
  }
  function appendCoordinateContinuation(baseCells, continuationCells) {
    let appended = false;
    for (const cell of continuationCells) {
      const target = nearestCoordinateCell(baseCells, cell.x);
      if (!target) continue;
      target.text = `${target.text} ${cell.text}`.replace(/\s+/g, " ").trim();
      target.endX = Math.max(target.endX, cell.endX);
      target.itemCount += cell.itemCount ?? 1;
      appended = true;
    }
    return appended;
  }
  function coordinateHeaderText(lines, index) {
    const parts = [];
    for (let current = index - 1; current >= 0 && parts.length < 5; current -= 1) {
      const line = lines[current];
      const text = String(line?.text ?? "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      if (coordinateTextIsRecommendationMeta(text)) break;
      const cells = coordinateLineCells(line);
      if (coordinateLineLooksLikeDataRow(line, cells)) break;
      const normalized = normalizeForSearch(text);
      const headerLike = isCoordinateTableLine(line, cells) || containsNormalizedPhrase(normalized, "\u0442\u0430\u0431\u043B\u0438\u0446") || text.length <= 140 && (cells.length <= 2 || coordinateCellsSpread(cells) < 180);
      if (!headerLike) break;
      parts.unshift(text);
    }
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }
  function coordinateTableRows(page) {
    if (page.__coordinateTableRows) return page.__coordinateTableRows;
    const lines = page.lineItems ?? [];
    const rows = [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const baseCells = coordinateLineCells(line).map((cell) => ({ ...cell }));
      if (!isCoordinateTableLine(line, baseCells)) continue;
      let previousY = line?.y ?? 0;
      const rowLineTexts = [line.text];
      for (let nextIndex = index + 1; nextIndex < lines.length && nextIndex <= index + 4; nextIndex += 1) {
        const nextLine = lines[nextIndex];
        const y = nextLine?.y ?? previousY;
        if (Math.abs(y - previousY) > 25) break;
        const nextCells = coordinateLineCells(nextLine);
        if (!nextCells.length) break;
        const looksLikeNewRow = isCoordinateTableLine(nextLine, nextCells) && nextCells.length >= Math.max(2, baseCells.length - 1) && Math.abs((nextCells[0]?.x ?? 0) - (baseCells[0]?.x ?? 0)) <= 32;
        if (looksLikeNewRow) break;
        const appended = appendCoordinateContinuation(baseCells, nextCells);
        if (!appended) break;
        rowLineTexts.push(nextLine.text);
        previousY = y;
      }
      const text = baseCells.map((cell) => cell.text).join(" ").replace(/\s+/g, " ").trim();
      if (text.length < 8) continue;
      rows.push({
        page: page.page,
        index,
        y: line?.y ?? 0,
        headerText: coordinateHeaderText(lines, index),
        text,
        sourceText: rowLineTexts.join(" ").replace(/\s+/g, " ").trim(),
        cells: baseCells.map((cell, cellIndex) => ({
          ...cell,
          index: cellIndex,
          normalized: normalizeForSearch(cell.text),
          tokens: tokenize(cell.text)
        }))
      });
    }
    Object.defineProperty(page, "__coordinateTableRows", {
      value: rows,
      enumerable: false
    });
    return rows;
  }
  function buildCoordinateTableRowsByPage(pages, topQuestionPages) {
    const byPage = /* @__PURE__ */ new Map();
    for (const page of pages) {
      const nearTopPage = !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
      if (!nearTopPage) continue;
      const rows = coordinateTableRows(page);
      if (rows.length) byPage.set(page.page, rows);
    }
    return byPage;
  }
  function coordinateTableFocusTokens(question, focusTokens, answerTokens) {
    const answerSet = new Set(answerTokens ?? []);
    const out = [];
    for (const token of [...focusTokens ?? [], ...uniqueTokens(question)]) {
      if (!token || token.length < 3) continue;
      if (FOCUS_STOPWORDS.has(token) || COORDINATE_TABLE_GENERIC_TOKENS.has(token)) continue;
      if (answerSet.has(token) && !/^\d/u.test(token)) continue;
      if (!out.includes(token)) out.push(token);
    }
    return out.slice(0, 12);
  }
  function severityCue(text) {
    const normalized = normalizeForSearch(text);
    if (containsNormalizedPhrase(normalized, "\u043A\u0440\u0430\u0439\u043D") && containsNormalizedPhrase(normalized, "\u0442\u044F\u0436")) return "very_severe";
    if (containsNormalizedPhrase(normalized, "\u0441\u0440\u0435\u0434\u043D\u0435\u0442\u044F\u0436") || containsNormalizedPhrase(normalized, "\u0441\u0440\u0435\u0434\u043D") && containsNormalizedPhrase(normalized, "\u0442\u044F\u0436") || containsNormalizedPhrase(normalized, "\u0443\u043C\u0435\u0440\u0435\u043D")) return "moderate";
    if (containsNormalizedPhrase(normalized, "\u0442\u044F\u0436\u0435\u043B")) return "severe";
    if (containsNormalizedPhrase(normalized, "\u043B\u0435\u0433\u043A")) return "mild";
    return null;
  }
  function coordinateCellAnswerSupport(cell, answer, answerTokens, answerPhrases, answerNumbers) {
    const text = coordinateCellText(cell);
    const normalized = normalizeForSearch(text);
    const tokens = tokenizeNormalized(normalized);
    const numericCoverage = numberCoverage(answer.text, normalized);
    const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(normalized, phrase));
    const tokenSupport = answerTokens.length ? strictSoftCoverage(answerTokens, tokens) : 0;
    let support = Math.max(tokenSupport, phraseHit ? 1 : 0, numericCoverage);
    if (answerNumbers.length) {
      const expanded = [...new Set(answerNumbers.flatMap(expandNumberToken))];
      const required = expanded.length > 1 ? 0.82 : 0.5;
      if (numericCoverage < required) support = Math.min(support, numericCoverage * 0.7);
    }
    return { support, numericCoverage, phraseHit, tokens, normalized };
  }
  function coordinateRowContrastBonus(row, bestCell, tableFocus, bestCellSupport, wholeRowAnswerMatch) {
    if (!row?.cells?.length || !bestCell || wholeRowAnswerMatch) return -0.35;
    const cellIndex = bestCell.index ?? -1;
    if (cellIndex < 0) return -0.35;
    const labelText = row.cells.filter((cell) => (cell.index ?? 0) < cellIndex).slice(-2).map((cell) => cell.text).join(" ");
    const labelTokens = tokenize(labelText);
    const leftFocusHits = tokenHitCount(tableFocus, labelTokens);
    const leftFocusCoverage = tableFocus.length ? coverage(tableFocus, labelTokens) : 0;
    const headerCue = coordinateTextHasTableCaption(row.headerText) ? 0.25 : 0;
    const numericSpecificity = bestCellSupport?.numericCoverage >= 0.82 ? 0.35 : 0;
    if (leftFocusHits <= 0 && leftFocusCoverage < 0.18) return headerCue + numericSpecificity - 0.2;
    return Math.min(1.4, leftFocusHits * 0.35 + leftFocusCoverage * 1.6 + headerCue + numericSpecificity);
  }
  function bestCoordinateTableRowSupport({
    mode,
    question,
    answer,
    answerTokens,
    focusTokens,
    coordinateTableRowsByPage
  }) {
    if (!coordinateTableRowsByPage) return null;
    if (mode !== "single") return null;
    if (coordinateTableQuestionBlocked(question)) return null;
    const answerNumbers = extractNumbers(answer.text);
    const answerPhrases = answerSearchPhrases(answer.text).slice(0, 12);
    const tableFocus = coordinateTableFocusTokens(question, focusTokens, answerTokens);
    if (!tableFocus.length && !answerNumbers.length) return null;
    const questionSeverity = severityCue(question);
    let best = null;
    for (const rows of coordinateTableRowsByPage.values()) {
      for (const row of rows) {
        if (!row.cells?.length) continue;
        if (!coordinateRowHasTableContext(row)) continue;
        if (questionSeverity && coordinateSeverityCueCount(row.text) > 1) continue;
        let bestCell = null;
        let bestCellSupport = null;
        for (const cell of row.cells) {
          const support = coordinateCellAnswerSupport(cell, answer, answerTokens, answerPhrases, answerNumbers);
          if (!bestCellSupport || support.support > bestCellSupport.support) {
            bestCell = cell;
            bestCellSupport = support;
          }
        }
        const minAnswerSupport = answerNumbers.length ? 0.5 : 0.64;
        let wholeRowAnswerMatch = false;
        if ((!bestCellSupport || bestCellSupport.support < minAnswerSupport) && answerNumbers.length) {
          const rowSupport = coordinateCellAnswerSupport(
            { text: `${row.headerText} ${row.text}`.replace(/\s+/g, " ").trim(), index: -1 },
            answer,
            answerTokens,
            answerPhrases,
            answerNumbers
          );
          if (rowSupport.support >= minAnswerSupport) {
            bestCell = { text: "", index: -1 };
            bestCellSupport = rowSupport;
            wholeRowAnswerMatch = true;
          }
        }
        if (!bestCell || !bestCellSupport || bestCellSupport.support < minAnswerSupport) continue;
        const otherCellsText = row.cells.filter((cell) => wholeRowAnswerMatch || cell.index !== bestCell.index).map((cell) => cell.text).join(" ");
        const rowSpecificTokens = tokenize(otherCellsText);
        const rowSpecificCoverage = tableFocus.length ? coverage(tableFocus, rowSpecificTokens) : 0;
        const rowSpecificHits = tokenHitCount(tableFocus, rowSpecificTokens);
        const headerTokens = tokenize(row.headerText);
        const headerCoverage = tableFocus.length ? coverage(tableFocus, headerTokens) : 0;
        if (tableFocus.length && rowSpecificCoverage < 0.16 && rowSpecificHits < 1) continue;
        const rowLabelText = row.cells.filter((cell) => cell.index !== bestCell.index).slice(0, 2).map((cell) => cell.text).join(" ");
        const rowSeverity = severityCue(rowLabelText || otherCellsText);
        if (questionSeverity && rowSeverity !== questionSeverity) continue;
        const score = 13.4 + Math.min(1, bestCellSupport.support) * 8.4 + Math.min(0.75, rowSpecificCoverage) * 7 + Math.min(3, rowSpecificHits) * 1.2 + Math.min(0.45, headerCoverage) * 2.4 + bestCellSupport.numericCoverage * 2.6 + (bestCellSupport.phraseHit ? 1.1 : 0) + (row.cells.length >= 3 ? 1.3 : 0) + coordinateRowContrastBonus(row, bestCell, tableFocus, bestCellSupport, wholeRowAnswerMatch);
        best = betterEvidence(best, {
          answerId: answer.id,
          page: row.page,
          text: `${row.headerText} ${row.sourceText || row.text}`.replace(/\s+/g, " ").trim(),
          score,
          kind: "coordinate_table_row"
        });
      }
    }
    return best;
  }
  function lineStartX(line) {
    return line?.items?.[0]?.x ?? 0;
  }
  function linePrefixShortLabels(line) {
    const prefix = (line?.items ?? []).slice(0, 3).map((item) => item.text).join(" ");
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
        const startsNewLabel = (linePrefixShortLabels(line).length > 0 || lineStartsWithShortLabelStem(line)) && Math.abs(lineStartX(line) - startX) <= 18;
        if (startsNewLabel) break;
        if (lineStartX(line) < startX + 18 && row.length > 1) break;
      }
      previousY = line?.y ?? previousY;
      if (/^\d{1,2}$/.test(text) && lineStartX(line) > startX + 120) continue;
      row.push(text);
    }
    return row.join(" ").replace(/\s+/g, " ").trim();
  }
  function bestExactShortLabelRowSupport({ pages, topQuestionPages, question, answer, answerTokens, focusTokens }) {
    const labels = questionShortLabels(question);
    if (!labels.length || !answerTokens.length) return null;
    const answerPhrases = answerSearchPhrases(answer.text);
    const usefulFocusTokens = (focusTokens?.length ? focusTokens : uniqueTokens(question)).filter((token) => token.length > 2);
    const numericAnswer = extractNumbers(answer.text).length > 0;
    const minSupport = numericAnswer ? 0.48 : answerTokens.length <= 2 ? 0.84 : 0.4;
    let best = null;
    for (const page of pages) {
      const nearTopPage = !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
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
        const score = 15.8 + answerSupport * 8.6 + Math.min(0.42, focusCoverage) * 3.1 + numericCoverage * 1.6 + (phraseHit ? 1.8 : 0);
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text,
          score,
          kind: "short_label_exact_row"
        });
      }
    }
    return best;
  }
  function bestShortLabelRowSupport({ pages, topQuestionPages, question, answer, answerTokens, focusTokens }) {
    const labels = questionShortLabels(question);
    if (!labels.length || !answerTokens.length) return null;
    const answerPhrases = answerSearchPhrases(answer.text);
    const usefulFocusTokens = (focusTokens?.length ? focusTokens : uniqueTokens(question)).filter((token) => token.length > 2);
    const numericAnswer = extractNumbers(answer.text).length > 0;
    const minSupport = numericAnswer ? 0.55 : answerTokens.length <= 2 ? 0.86 : 0.34;
    let best = null;
    for (const page of pages) {
      const nearTopPage = !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
      if (!nearTopPage) continue;
      const lines = page.lineItems ?? [];
      for (let index = 0; index < lines.length; index += 1) {
        const localLabels = new Set(lineShortLabels(lines[index]?.text));
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
        const score = 10.4 + answerSupport * 7.2 + Math.min(0.35, focusCoverage) * 3 + numericCoverage * 1.2 + (phraseHit ? 1.2 : 0);
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text,
          score,
          kind: "short_label_visual_row"
        });
      }
    }
    return best;
  }
  function questionPrefixes(question) {
    const tokens = phraseTokens(question);
    const prefixes = /* @__PURE__ */ new Set();
    for (const length of [14, 11, 8, 6]) {
      if (tokens.length >= length) prefixes.add(tokens.slice(0, length).join(" "));
    }
    if (tokens.length > 12) {
      prefixes.add(tokens.slice(Math.max(0, tokens.length - 10)).join(" "));
    }
    return [...prefixes].filter((prefix) => prefix.length >= 18);
  }
  function bestPrefixSupport({ pages, question, answer, answerTokens, intent }) {
    const prefixes = questionPrefixes(question);
    if (!prefixes.length) return null;
    const answerPhrases = answerSearchPhrases(answer.text);
    let best = null;
    for (const page of pages) {
      for (const prefix of prefixes) {
        const normalizedPrefix = normalizeForSearch(prefix);
        let start = 0;
        while (start < page.normalized.length) {
          const index = page.normalized.indexOf(normalizedPrefix, start);
          if (index < 0) break;
          const afterStart = index + normalizedPrefix.length;
          const after = page.normalized.slice(afterStart, afterStart + 850);
          for (const phrase of answerPhrases) {
            const normalizedPhrase = normalizeForSearch(phrase);
            if (!normalizedPhrase) continue;
            const answerIndex = after.indexOf(normalizedPhrase);
            if (answerIndex < 0) continue;
            const local = after.slice(Math.max(0, answerIndex - 120), answerIndex + normalizedPhrase.length + 180);
            const score = 5.8 + proximityBonus(answerIndex, 850) * 3 + coverage(answerTokens, tokenize(local)) * 1.2 + numberCoverage(answer.text, local) * 0.6 + (intent.numeric ? 0.25 : 0);
            best = betterEvidence(best, {
              answerId: answer.id,
              page: page.page,
              text: evidenceSnippet(page.text, question, answer.text),
              score,
              kind: "question_prefix_continuation"
            });
          }
          start = index + normalizedPrefix.length;
        }
      }
    }
    return best;
  }
  function bestChunkSupport({ index, chunks, question, answer, questionTokens, answerTokens }) {
    const qaTokens = tokenize(`${question} ${answer.text}`);
    const answerOnlyTokens = tokenize(answer.text);
    const qResults = index.search(questionTokens, { limit: DEFAULT_CONFIG.topQuestionChunks });
    const qaResults = index.search(qaTokens, { limit: 8 });
    const aResults = index.search(answerOnlyTokens, { limit: 8 });
    const topQScore = qResults[0]?.score || 0;
    const topQaScore = qaResults[0]?.score || 0;
    const topAScore = aResults[0]?.score || 0;
    let best = null;
    for (const result of qaResults) {
      const chunk = result.chunk;
      const answerCoverage = coverage(answerTokens, chunk.tokens);
      const questionCoverage = coverage(questionTokens, chunk.tokens);
      const exact = containsNormalizedPhrase(chunk.normalized, answer.text) ? 1 : 0;
      const score = normalizeBm25(result.score, topQaScore) * 2.4 + questionCoverage * 1.7 + answerCoverage * 1.4 + exact * 2.4 + numberCoverage(answer.text, chunk.normalized) * 0.9 + tokenProximity(questionTokens, answerTokens, chunk.tokens) * 1.1;
      best = betterEvidence(best, evidenceFromChunk(answer.id, chunk, score, "bm25_question_answer"));
    }
    for (const result of qResults) {
      const chunk = result.chunk;
      const answerCoverage = coverage(answerTokens, chunk.tokens);
      if (answerCoverage <= 0 && !containsNormalizedPhrase(chunk.normalized, answer.text)) continue;
      const exact = containsNormalizedPhrase(chunk.normalized, answer.text) ? 1 : 0;
      const lineBoost = chunk.kind === "line" || chunk.kind === "line_pair" || chunk.kind === "layout_line" || chunk.kind === "layout_line_pair" ? 0.55 : chunk.kind === "list" ? 0.35 : chunk.kind === "heading" ? 0.2 : 0;
      const score = normalizeBm25(result.score, topQScore) * 1.6 + answerCoverage * 3.2 + exact * 3.4 + lineBoost + jaccard(answerTokens, chunk.tokens) * 0.8 + numberCoverage(answer.text, chunk.normalized) * 1.2 + tokenProximity(questionTokens, answerTokens, chunk.tokens) * 1.4;
      best = betterEvidence(best, evidenceFromChunk(answer.id, chunk, score, "question_chunk_answer"));
    }
    for (const result of aResults) {
      const chunk = result.chunk;
      const questionCoverage = coverage(questionTokens, chunk.tokens);
      if (questionCoverage <= 0.06) continue;
      const score = normalizeBm25(result.score, topAScore) * 0.8 + questionCoverage * 2.2 + numberCoverage(answer.text, chunk.normalized) * 0.7 + tokenProximity(questionTokens, answerTokens, chunk.tokens) * 0.8;
      best = betterEvidence(best, evidenceFromChunk(answer.id, chunk, score, "answer_chunk_question"));
    }
    if (!best && chunks.length) {
      const fallback = qResults[0]?.chunk ?? chunks[0];
      best = evidenceFromChunk(answer.id, fallback, 0, "fallback");
    }
    return best;
  }
  function normalizeBm25(score, topScore) {
    if (!score || !topScore) return 0;
    return Math.min(1, score / topScore);
  }
  function numberSpecificity(answer) {
    const count = extractNumbers(answer).length;
    return Math.min(1, count / 3);
  }
  function lineTokenApplicable({ mode, question, answer, intent }) {
    if (mode !== "single") return false;
    if (intent.numeric || extractNumbers(answer.text).length) return false;
    const raw = normalizeText(question);
    return /является\s+заболеванием/u.test(raw) || /переда[а-яa-z0-9-]*\s+пут/u.test(raw) || /рекоменду[а-яa-z0-9-]*\s+(?:применение|назначение|применять|назначать)/u.test(raw) || /конкурентно\s+ингибирует/u.test(raw) || /фермент/u.test(raw);
  }
  function conditionFamily(text) {
    const normalized = normalizeForSearch(text);
    if (containsNormalizedPhrase(normalized, "\u0442\u044F\u0436\u0435\u043B")) return "heavy";
    if (containsNormalizedPhrase(normalized, "\u0443\u043C\u0435\u0440\u0435\u043D") || containsNormalizedPhrase(normalized, "\u0441\u0440\u0435\u0434\u043D")) return "moderate";
    if (containsNormalizedPhrase(normalized, "\u043B\u0435\u0433\u043A")) return "mild";
    return null;
  }
  function nearestConditionFamily(normalizedText) {
    let best = null;
    for (const [family, cues] of [
      ["heavy", ["\u0442\u044F\u0436\u0435\u043B"]],
      ["moderate", ["\u0443\u043C\u0435\u0440\u0435\u043D", "\u0441\u0440\u0435\u0434\u043D"]],
      ["mild", ["\u043B\u0435\u0433\u043A"]]
    ]) {
      for (const cueText of cues) {
        const cue = normalizeForSearch(cueText);
        const index = normalizedText.indexOf(cue);
        if (index >= 0 && (!best || index < best.index)) best = { family, index };
      }
    }
    return best?.family ?? null;
  }
  function answerValueCondition(answerText) {
    const raw = normalizeText(answerText);
    const match = raw.match(/^(.{2,90}?)\s+для\s+(.{3,120})$/u);
    if (!match) return null;
    const value = match[1].trim();
    const condition = match[2].trim();
    if (!extractNumbers(value).length && !/(год|месяц|дн|сут|раз)/u.test(value)) return null;
    const family = conditionFamily(condition);
    if (!family) return null;
    return { value, condition, family };
  }
  function conditionPairAdjustment({ pages, topQuestionPages, answer }) {
    const pair = answerValueCondition(answer.text);
    if (!pair) return { adjustment: 0, evidence: null };
    let bestMatch = null;
    let bestMismatch = null;
    const valuePhrases = answerSearchPhrases(pair.value).slice(0, 8);
    for (const page of pages) {
      if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
      for (const phrase of valuePhrases) {
        const phraseNorm = normalizeForSearch(phrase);
        if (!phraseNorm || phraseNorm.length < 3) continue;
        const hits = findPhraseOccurrences(page.normalized, phrase, { textIsNormalized: true });
        for (const hit of hits) {
          const after = page.normalized.slice(hit + phraseNorm.length, hit + phraseNorm.length + 120);
          const actual = nearestConditionFamily(after);
          if (!actual) continue;
          const local = page.normalized.slice(Math.max(0, hit - 80), hit + phraseNorm.length + 160);
          const evidence = {
            answerId: answer.id,
            page: page.page,
            text: evidenceSnippet(page.text, pair.value, pair.condition),
            score: actual === pair.family ? 8.8 : 2.4,
            kind: actual === pair.family ? "condition_pair_match" : "condition_pair_mismatch"
          };
          if (actual === pair.family) {
            const proximity = after.indexOf(normalizeForSearch(pair.condition).slice(0, 5));
            bestMatch = betterEvidence(bestMatch, { ...evidence, score: evidence.score + proximityBonus(proximity, 120) });
          } else if (local) {
            bestMismatch = betterEvidence(bestMismatch, evidence);
          }
        }
      }
    }
    if (bestMatch) return { adjustment: 4.6, evidence: bestMatch };
    if (bestMismatch) return { adjustment: -2.4, evidence: bestMismatch };
    return { adjustment: 0, evidence: null };
  }
  function questionRiskCondition(question) {
    const raw = normalizeText(question);
    if (/(?:не\s+имеющ|без|отсутств)[а-яa-z0-9-\s]{0,80}фактор[а-яa-z0-9-\s]{0,40}риска/u.test(raw)) return "risk_absent";
    if (/(?:имеющ|налич)[а-яa-z0-9-\s]{0,80}фактор[а-яa-z0-9-\s]{0,40}риска/u.test(raw)) return "risk_present";
    return null;
  }
  function windowRiskCondition(normalizedWindow) {
    if (containsNormalizedPhrase(normalizedWindow, "\u043D\u0435 \u0438\u043C\u0435\u044E\u0449\u0438\u0445 \u0444\u0430\u043A\u0442\u043E\u0440\u043E\u0432 \u0440\u0438\u0441\u043A\u0430") || containsNormalizedPhrase(normalizedWindow, "\u0431\u0435\u0437 \u0444\u0430\u043A\u0442\u043E\u0440\u043E\u0432 \u0440\u0438\u0441\u043A\u0430")) {
      return "risk_absent";
    }
    if (containsNormalizedPhrase(normalizedWindow, "\u043F\u0440\u0438 \u043D\u0430\u043B\u0438\u0447\u0438\u0438") && containsNormalizedPhrase(normalizedWindow, "\u0444\u0430\u043A\u0442\u043E\u0440")) {
      return "risk_present";
    }
    if (containsNormalizedPhrase(normalizedWindow, "\u0438\u043C\u0435\u044E\u0449\u0438\u0445") && containsNormalizedPhrase(normalizedWindow, "\u0444\u0430\u043A\u0442\u043E\u0440\u043E\u0432 \u0440\u0438\u0441\u043A\u0430")) {
      return "risk_present";
    }
    return null;
  }
  function primaryNumberPhrase(answerText) {
    const first = extractNumbers(answerText)[0];
    if (!first) return null;
    return String(first).replace(",", ".");
  }
  function riskConditionAdjustment({ pages, topQuestionPages, question, answer }) {
    const target = questionRiskCondition(question);
    const value = primaryNumberPhrase(answer.text);
    if (!target || !value) return { adjustment: 0, evidence: null };
    let bestMatch = null;
    let bestMismatch = null;
    for (const page of pages) {
      if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
      const hits = findPhraseOccurrences(page.normalized, value, { textIsNormalized: true });
      for (const hit of hits) {
        const beforeNumber = page.normalized.slice(Math.max(0, hit - 50), hit);
        if (!containsNormalizedPhrase(beforeNumber, "\u0443\u0440\u043E\u0432\u043D")) continue;
        const levelIndex = beforeNumber.lastIndexOf(normalizeForSearch("\u0443\u0440\u043E\u0432\u043D"));
        if (levelIndex >= 0 && extractNumbers(beforeNumber.slice(levelIndex)).length) continue;
        const window = page.normalized.slice(Math.max(0, hit - 70), hit + value.length + 240);
        if (!containsNormalizedPhrase(window, "\u0444\u0430\u043A\u0442\u043E\u0440") || !containsNormalizedPhrase(window, "\u0440\u0438\u0441\u043A")) continue;
        const after = page.normalized.slice(hit, hit + value.length + 240);
        const actual = windowRiskCondition(after) ?? windowRiskCondition(window);
        if (!actual) continue;
        const evidence = {
          answerId: answer.id,
          page: page.page,
          text: evidenceSnippet(page.text, value, question),
          score: actual === target ? 8.4 : 2.2,
          kind: actual === target ? "risk_condition_match" : "risk_condition_mismatch"
        };
        if (actual === target) bestMatch = betterEvidence(bestMatch, evidence);
        else bestMismatch = betterEvidence(bestMismatch, evidence);
      }
    }
    if (bestMatch) return { adjustment: 4.2, evidence: bestMatch };
    if (bestMismatch) return { adjustment: -2.1, evidence: bestMismatch };
    return { adjustment: 0, evidence: null };
  }
  function genericPopulationAnswer(answerText) {
    const raw = normalizeText(answerText);
    return /^(?:всем|все)\s+(?:пациент|больн|пострадав)/u.test(raw);
  }
  function genericPopulationConditionAdjustment({ mode, pages, topQuestionPages, question, answer, focusTokens }) {
    if (mode !== "single" || !genericPopulationAnswer(answer.text)) return { adjustment: 0, evidence: null };
    if (/^(?:всем|все)\s+(?:пациент|больн|пострадав)/u.test(normalizeText(question))) return { adjustment: 0, evidence: null };
    const answerPhrases = answerSearchPhrases(answer.text).slice(0, 8);
    let best = null;
    for (const page of pages) {
      if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
      for (const phrase of answerPhrases) {
        const phraseNorm = normalizeForSearch(phrase);
        if (!phraseNorm || phraseNorm.length < 5) continue;
        const hits = findPhraseOccurrences(page.normalized, phrase, { textIsNormalized: true });
        for (const hit of hits) {
          const after = page.normalized.slice(hit + phraseNorm.length, hit + phraseNorm.length + 520);
          const hasCondition = containsNormalizedPhrase(after, "\u043F\u0440\u0438") || containsNormalizedPhrase(after, "\u0441 \u0446\u0435\u043B\u044C\u044E") || containsNormalizedPhrase(after, "\u043F\u0440\u0438 \u043D\u0430\u043B\u0438\u0447\u0438\u0438") || containsNormalizedPhrase(after, "\u043F\u0440\u0438 \u0440\u0430\u0437\u0432\u0438\u0442\u0438\u0438");
          if (!hasCondition) continue;
          const focusCoverage = coverage(focusTokens, tokenizeNormalized(after));
          if (focusCoverage < 0.12) continue;
          best = betterEvidence(best, {
            answerId: answer.id,
            page: page.page,
            text: evidenceSnippet(page.text, answer.text, question),
            score: 3 + focusCoverage * 4,
            kind: "generic_population_condition_penalty"
          });
        }
      }
    }
    return best ? { adjustment: -10.4, evidence: best } : { adjustment: 0, evidence: null };
  }
  function questionClassSubject(question) {
    const raw = normalizeText(question);
    const match = raw.match(/^(.+?)\s+относят\s+к\s+классу/u);
    if (!match?.[1]) return null;
    const subject = match[1].trim();
    return subject.length >= 4 ? subject : null;
  }
  function romanClassVariants(answerText) {
    const raw = normalizeText(answerText).replace(/\s+/g, "");
    const variants = /* @__PURE__ */ new Set();
    const romanMap = /* @__PURE__ */ new Map([
      ["i", "1"],
      ["ii", "2"],
      ["iii", "3"],
      ["iv", "4"],
      ["v", "5"]
    ]);
    if (romanMap.has(raw)) {
      variants.add(raw);
      variants.add(romanMap.get(raw));
    }
    const numeric = extractNumbers(answerText)[0];
    if (numeric) {
      variants.add(numeric);
      for (const [roman, value] of romanMap.entries()) if (value === numeric) variants.add(roman);
    }
    return [...variants].map((item) => normalizeForSearch(item)).filter(Boolean);
  }
  function tokenBoundaryIncludes(normalizedText, normalizedToken) {
    if (!normalizedText || !normalizedToken) return false;
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(normalizedToken)}(\\s|$)`, "iu");
    return pattern.test(normalizedText);
  }
  function bestClassSubjectSupport({ pages, question, answer }) {
    const subject = questionClassSubject(question);
    const variants = romanClassVariants(answer.text);
    if (!subject || !variants.length) return null;
    const subjectTokens = uniqueTokens(subject);
    let best = null;
    for (const page of pages) {
      for (const segment of cachedLineTokenSegments(page)) {
        if (!containsNormalizedPhrase(segment.normalized, "\u043A\u043B\u0430\u0441\u0441")) continue;
        const subjectCoverage = coverage(subjectTokens, segment.tokens);
        if (subjectCoverage < 0.65) continue;
        const hasAnswerClass = variants.some((variant) => tokenBoundaryIncludes(segment.normalized, variant));
        if (!hasAnswerClass) continue;
        const score = 10.8 + subjectCoverage * 4;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: segment.text,
          score,
          kind: "subject_class_line"
        });
      }
    }
    return best;
  }
  function frequencyAnswer(answerText) {
    const raw = normalizeText(answerText);
    return /\d|один|два|три|четыре|пять|шесть|семь|восемь|девять/u.test(raw) && /(год|месяц|недел|дн|сут|раз)/u.test(raw);
  }
  function frequencySearchPhrases(answerText) {
    const raw = normalizeText(answerText);
    const numbers = extractNumbers(answerText);
    const phrases = /* @__PURE__ */ new Set();
    if (answerText && /(год|месяц|недел|дн|сут|раз|\d)/u.test(raw)) phrases.add(answerText);
    for (const number of numbers) {
      if (/год/u.test(raw)) {
        phrases.add(`${number} \u0433\u043E\u0434`);
        phrases.add(`${number} \u0440\u0430\u0437 \u0432 \u0433\u043E\u0434`);
      }
      if (/месяц/u.test(raw)) {
        phrases.add(`${number} \u043C\u0435\u0441\u044F\u0446`);
        phrases.add(`${number} \u043C\u0435\u0441\u044F\u0446\u0435\u0432`);
        phrases.add(`${number} \u043C\u0435\u0441\u044F\u0446\u0430`);
      }
      if (/недел/u.test(raw)) {
        phrases.add(`${number} \u043D\u0435\u0434\u0435\u043B\u044E`);
        phrases.add(`${number} \u043D\u0435\u0434\u0435\u043B\u0438`);
        phrases.add(`${number} \u043D\u0435\u0434\u0435\u043B\u044C`);
      }
      if (/(дн|сут)/u.test(raw)) {
        phrases.add(`${number} \u0434\u0435\u043D\u044C`);
        phrases.add(`${number} \u0434\u043D\u044F`);
        phrases.add(`${number} \u0434\u043D\u0435\u0439`);
        phrases.add(`${number} \u0441\u0443\u0442\u043A\u0438`);
        phrases.add(`${number} \u0441\u0443\u0442\u043E\u043A`);
      }
    }
    return [...phrases].filter((phrase) => {
      const phraseNorm = normalizeForSearch(phrase);
      if (!/\u0441\u0443\u0442/u.test(raw) && containsNormalizedPhrase(phraseNorm, "\u0441\u0443\u0442")) return false;
      if (!/\u0434\u043d/u.test(raw) && (containsNormalizedPhrase(phraseNorm, "\u0434\u0435\u043D\u044C") || containsNormalizedPhrase(phraseNorm, "\u0434\u043D\u044F") || containsNormalizedPhrase(phraseNorm, "\u0434\u043D\u0435\u0439"))) return false;
      return phraseNorm.length >= 4;
    });
  }
  function lineWindowSegments(page, radius = 2) {
    const lines = page.lines ?? [];
    const segments = [];
    for (let index = 0; index < lines.length; index += 1) {
      const text = lines.slice(index, Math.min(lines.length, index + radius + 1)).join(" ").replace(/\s+/g, " ").trim();
      if (text.length >= 16 && text.length <= 900) {
        segments.push({
          text,
          normalized: normalizeForSearch(text),
          tokens: tokenize(text)
        });
      }
    }
    return segments;
  }
  function cachedLineWindowSegments(page) {
    if (!page.__lineWindowSegments) {
      Object.defineProperty(page, "__lineWindowSegments", {
        value: lineWindowSegments(page, 3),
        enumerable: false
      });
    }
    return page.__lineWindowSegments;
  }
  var FREQUENCY_GENERIC_FOCUS = new Set(
    [
      "\u0434\u0438\u043D\u0430\u043C\u0438\u0447\u0435\u0441\u043A\u043E\u0435",
      "\u0434\u0438\u043D\u0430\u043C\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E",
      "\u043D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u0435",
      "\u043D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u044F",
      "\u043F\u0430\u0446\u0438\u0435\u043D\u0442",
      "\u043F\u0430\u0446\u0438\u0435\u043D\u0442\u0430\u043C",
      "\u0445\u0432\u0433\u0441",
      "\u0445\u0432\u0433\u0432",
      "\u0446\u043F",
      "\u0446\u0438\u0440\u0440\u043E\u0437",
      "\u043F\u0435\u0447\u0435\u043D\u044C",
      "\u043F\u0435\u0447\u0435\u043D\u0438",
      "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u0442\u0441\u044F",
      "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u043E\u0432\u0430\u043D\u043E",
      "\u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435",
      "\u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0442\u044C",
      "\u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u0435",
      "\u043F\u0440\u043E\u0432\u043E\u0434\u0438\u0442\u044C",
      "\u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C",
      "\u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044F",
      "\u044D\u0444\u0444\u0435\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u044C",
      "\u044D\u0444\u0444\u0435\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u0438",
      "\u0438\u0441\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435",
      "\u0440\u0435\u0446\u0438\u0434\u0438\u0432",
      "\u0440\u0430\u0437"
    ].flatMap((item) => uniqueTokens(item))
  );
  function specificFrequencyFocusTokens(focusTokens) {
    return focusTokens.filter((token) => token.length >= 4 && !/^\d/.test(token) && !FREQUENCY_GENERIC_FOCUS.has(token));
  }
  function bestFrequencyRecommendationSupport({ mode, pages, topQuestionPages, question, answer, focusTokens }) {
    if (mode !== "single") return null;
    if (!frequencyAnswer(answer.text)) return null;
    const questionRaw = normalizeText(question);
    if (!/(рекоменд|наблюден|контрол|выполн|провод)/u.test(questionRaw)) return null;
    const phrases = frequencySearchPhrases(answer.text).slice(0, 10);
    if (!phrases.length) return null;
    const specificTokens = specificFrequencyFocusTokens(focusTokens);
    let best = null;
    for (const page of pages) {
      if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
      for (const segment of cachedLineWindowSegments(page)) {
        if (!containsNormalizedPhrase(segment.normalized, "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434")) continue;
        const hasAnswer = phrases.some((phrase) => containsNormalizedPhrase(segment.normalized, phrase));
        if (!hasAnswer) continue;
        if (specificTokens.length && tokenHitCount(specificTokens, segment.tokens) < Math.min(2, specificTokens.length)) continue;
        const focusCoverage = coverage(focusTokens, segment.tokens);
        const score = 11.8 + focusCoverage * 9 + numberCoverage(answer.text, segment.normalized) * 1;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: segment.text,
          score,
          kind: "frequency_recommendation_line"
        });
      }
    }
    return best;
  }
  function boundedListQuestion({ mode, question, intent }) {
    if (mode !== "multi" || intent.negative || intent.exception) return false;
    const normalized = normalizeForSearch(question);
    return containsNormalizedPhrase(normalized, "\u043A\u043B\u0438\u043D\u0438\u0447") && containsNormalizedPhrase(normalized, "\u043F\u0440\u043E\u044F\u0432\u043B") || containsNormalizedPhrase(normalized, "\u0441\u0438\u043C\u043F\u0442\u043E\u043C") || containsNormalizedPhrase(normalized, "\u0441\u043E\u043F\u0440\u043E\u0432\u043E\u0436\u0434") || containsNormalizedPhrase(normalized, "\u043E\u0441\u043D\u043E\u0432\u043D") && containsNormalizedPhrase(normalized, "\u044D\u0444\u0444\u0435\u043A\u0442") || containsNormalizedPhrase(normalized, "\u0432 \u043E\u0441\u043D\u043E\u0432\u0435");
  }
  function boundedListAnchors(question) {
    const tokens = rawTokens(question);
    const anchors = /* @__PURE__ */ new Set();
    const addTokens = (items) => {
      const cleaned = items.filter(Boolean).join(" ").trim();
      if (cleaned.length >= 3) anchors.add(cleaned);
    };
    const syndromeIndex = tokens.findIndex((token) => token.startsWith("\u0441\u0438\u043D\u0434\u0440\u043E\u043C"));
    if (syndromeIndex >= 0) {
      const stopPrefixes = [
        "\u044F\u0432\u043B\u044F",
        "\u0441\u043E\u043F\u0440\u043E\u0432\u043E\u0436\u0434",
        "\u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440",
        "\u043E\u0441\u043D\u043E\u0432\u043D",
        "\u043E\u0442\u043D\u043E\u0441"
      ];
      const anchor = [];
      for (let index = syndromeIndex + 1; index < Math.min(tokens.length, syndromeIndex + 6); index += 1) {
        if (stopPrefixes.some((prefix) => tokens[index].startsWith(prefix))) break;
        anchor.push(tokens[index]);
      }
      addTokens(anchor);
    }
    const ageIndex = tokens.findIndex((token) => token === "\u0432\u043E\u0437\u0440\u0430\u0441\u0442\u0435");
    if (ageIndex >= 0) {
      const next = tokens.slice(ageIndex, Math.min(tokens.length, ageIndex + 12));
      const directionIndex = next.findIndex(
        (token) => token.startsWith("\u043C\u043E\u043B\u043E\u0436") || token.startsWith("\u0441\u0442\u0430\u0440\u0448") || token.startsWith("\u043C\u043B\u0430\u0434\u0448")
      );
      if (next.some((token) => /^\d/.test(token)) && directionIndex >= 0) {
        addTokens(next.slice(0, directionIndex + 1));
      }
    }
    return [...anchors].slice(0, 6);
  }
  function boundedListBoundary(after) {
    const boundaries = [
      "\u0438 \u0441",
      "\u043E\u0431\u0449\u0438\u0435 \u0441\u0438\u043C\u043F\u0442\u043E\u043C\u044B",
      "\u044D\u0442\u043E \u0440\u0430\u0437\u0434\u0435\u043B\u0435\u043D\u0438\u0435",
      "\u0443\u0440\u043E\u0432\u0435\u043D\u044C \u0443\u0431\u0435\u0434\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u0438",
      "\u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0438",
      "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0438"
    ].map((item) => normalizeForSearch(item));
    let end = Math.min(after.length, 900);
    for (const boundary of boundaries) {
      const index = after.indexOf(` ${boundary} `, 70);
      if (index > 0) end = Math.min(end, index);
    }
    return Math.max(90, end);
  }
  function findBoundedListSegments(pages, question, topQuestionPages, mode, intent) {
    if (!boundedListQuestion({ mode, question, intent })) return [];
    const anchors = boundedListAnchors(question);
    if (!anchors.length) return [];
    const segments = [];
    const seen = /* @__PURE__ */ new Set();
    const triadCue = normalizeForSearch("\u0434\u043E\u043C\u0438\u043D\u0438\u0440\u0443\u0435\u0442 \u0442\u0440\u0438\u0430\u0434\u0430");
    for (const page of pages) {
      for (const source of cachedLineWindowSegments(page)) {
        for (const anchor of anchors) {
          const anchorNorm = normalizeForSearch(anchor);
          const anchorIndex = source.normalized.indexOf(anchorNorm);
          if (anchorIndex < 0) continue;
          let start = anchorIndex;
          const afterAnchor = source.normalized.slice(anchorIndex);
          const triadIndex = afterAnchor.indexOf(triadCue);
          if (triadIndex >= 0 && triadIndex <= 260) {
            start = anchorIndex + triadIndex + triadCue.length;
          }
          const after = source.normalized.slice(start);
          const end = start + boundedListBoundary(after);
          const included = source.normalized.slice(start, end);
          const outside = `${source.normalized.slice(0, start)} ${source.normalized.slice(end)}`.trim();
          const key = `${page.page}:${included.slice(0, 220)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          segments.push({
            page: page.page,
            text: source.text,
            normalized: included,
            outside,
            anchor,
            priority: topQuestionPages?.has(page.page) ? 1 : 0
          });
        }
      }
    }
    return segments.sort((a, b) => b.priority - a.priority).slice(0, 40);
  }
  function bestBoundedListSupport({ boundedListSegments, answer, answerTokens }) {
    if (!boundedListSegments?.length) return { support: null, adjustment: 0, evidence: null };
    const answerPhrases = answerSearchPhrases(answer.text).slice(0, 16);
    let bestSupport = null;
    let bestPenalty = null;
    for (const segment of boundedListSegments) {
      const segmentTokens = tokenizeNormalized(segment.normalized);
      const outsideTokens = tokenizeNormalized(segment.outside);
      const answerCoverage = strictSoftCoverage(answerTokens, segmentTokens);
      const outsideCoverage = strictSoftCoverage(answerTokens, outsideTokens);
      const insidePhrase = answerPhrases.some((phrase) => containsNormalizedPhrase(segment.normalized, phrase));
      const outsidePhrase = answerPhrases.some((phrase) => containsNormalizedPhrase(segment.outside, phrase));
      const hasInside = insidePhrase || answerCoverage >= 0.66;
      const hasOutside = outsidePhrase || outsideCoverage >= 0.72;
      if (hasInside) {
        const score = 10.8 + (insidePhrase ? 2.6 : 0) + answerCoverage * 3.2 + numberCoverage(answer.text, segment.normalized) * 0.8;
        bestSupport = betterEvidence(bestSupport, {
          answerId: answer.id,
          page: segment.page,
          text: segment.text,
          score,
          kind: "bounded_list_segment"
        });
      } else if (hasOutside) {
        bestPenalty = betterEvidence(bestPenalty, {
          answerId: answer.id,
          page: segment.page,
          text: segment.text,
          score: 6 + outsideCoverage * 2,
          kind: "bounded_list_outside_penalty"
        });
      }
    }
    if (bestSupport) return { support: bestSupport, adjustment: 0, evidence: null };
    return bestPenalty ? { support: null, adjustment: -4.8, evidence: bestPenalty } : { support: null, adjustment: 0, evidence: null };
  }
  function ordinalTarget(question) {
    const normalized = normalizeForSearch(question);
    const hasStage = containsNormalizedPhrase(normalized, "\u044D\u0442\u0430\u043F");
    const hasLine = containsNormalizedPhrase(normalized, "\u043B\u0438\u043D\u0438");
    const hasStep = containsNormalizedPhrase(normalized, "\u0441\u0442\u0443\u043F\u0435\u043D");
    const hasDegree = containsNormalizedPhrase(normalized, "\u0441\u0442\u0435\u043F\u0435\u043D");
    if (!hasStage && !hasLine && !hasStep && !hasDegree) return null;
    if (hasStep) {
      const stepCue = normalizeForSearch("\u0441\u0442\u0443\u043F\u0435\u043D");
      const stepMatch = normalized.match(new RegExp(`(?:^|\\s)(\\d{1,2})(?:\\s*-?\\s*\\S{0,2})?\\s+${escapeRegExp(stepCue)}`, "iu"));
      if (stepMatch) return { number: Number(stepMatch[1]), kind: "step" };
    }
    if (hasDegree) {
      const degreeCue = normalizeForSearch("\u0441\u0442\u0435\u043F\u0435\u043D");
      const degreeMatch = normalized.match(new RegExp(`(?:^|\\s)(\\d{1,2}|[ivx]{1,7})(?:\\s*-?\\s*\\S{0,2})?\\s+${escapeRegExp(degreeCue)}`, "iu"));
      if (degreeMatch) {
        const number = ordinalValueToNumber(degreeMatch[1]);
        if (number) return { number, kind: "degree" };
      }
    }
    const candidates = [
      { number: 1, cues: ["\u043F\u0435\u0440\u0432"] },
      { number: 2, cues: ["\u0432\u0442\u043E\u0440"] },
      { number: 3, cues: ["\u0442\u0440\u0435\u0442", "\u0442\u0440\u0435\u0442\u044C"] },
      { number: 4, cues: ["\u0447\u0435\u0442\u0432\u0435\u0440"] }
    ];
    for (const candidate of candidates) {
      if (candidate.cues.some((cue) => containsNormalizedPhrase(normalized, cue))) {
        return { number: candidate.number, kind: hasDegree ? "degree" : hasStage ? "stage" : "line" };
      }
    }
    return null;
  }
  function ordinalWordForms(number, kind = "line") {
    const formsByKind = {
      line: {
        1: [
          "\u043F\u0435\u0440\u0432\u043E\u0439 \u043B\u0438\u043D\u0438\u0438",
          "\u043F\u0435\u0440\u0432\u0430\u044F \u043B\u0438\u043D\u0438\u044F",
          "\u043F\u0435\u0440\u0432\u0443\u044E \u043B\u0438\u043D\u0438\u044E"
        ],
        2: [
          "\u0432\u0442\u043E\u0440\u043E\u0439 \u043B\u0438\u043D\u0438\u0438",
          "\u0432\u0442\u043E\u0440\u0430\u044F \u043B\u0438\u043D\u0438\u044F",
          "\u0432\u0442\u043E\u0440\u0443\u044E \u043B\u0438\u043D\u0438\u044E"
        ],
        3: [
          "\u0442\u0440\u0435\u0442\u044C\u0435\u0439 \u043B\u0438\u043D\u0438\u0438",
          "\u0442\u0440\u0435\u0442\u044C\u044F \u043B\u0438\u043D\u0438\u044F",
          "\u0442\u0440\u0435\u0442\u044C\u044E \u043B\u0438\u043D\u0438\u044E"
        ],
        4: [
          "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u043E\u0439 \u043B\u0438\u043D\u0438\u0438",
          "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u0430\u044F \u043B\u0438\u043D\u0438\u044F",
          "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u0443\u044E \u043B\u0438\u043D\u0438\u044E"
        ]
      },
      degree: {
        1: [
          "\u043F\u0435\u0440\u0432\u043E\u0439 \u0441\u0442\u0435\u043F\u0435\u043D\u0438",
          "\u043F\u0435\u0440\u0432\u0430\u044F \u0441\u0442\u0435\u043F\u0435\u043D\u044C",
          "\u043F\u0435\u0440\u0432\u0443\u044E \u0441\u0442\u0435\u043F\u0435\u043D\u044C"
        ],
        2: [
          "\u0432\u0442\u043E\u0440\u043E\u0439 \u0441\u0442\u0435\u043F\u0435\u043D\u0438",
          "\u0432\u0442\u043E\u0440\u0430\u044F \u0441\u0442\u0435\u043F\u0435\u043D\u044C",
          "\u0432\u0442\u043E\u0440\u0443\u044E \u0441\u0442\u0435\u043F\u0435\u043D\u044C"
        ],
        3: [
          "\u0442\u0440\u0435\u0442\u044C\u0435\u0439 \u0441\u0442\u0435\u043F\u0435\u043D\u0438",
          "\u0442\u0440\u0435\u0442\u044C\u044F \u0441\u0442\u0435\u043F\u0435\u043D\u044C",
          "\u0442\u0440\u0435\u0442\u044C\u044E \u0441\u0442\u0435\u043F\u0435\u043D\u044C"
        ],
        4: [
          "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u043E\u0439 \u0441\u0442\u0435\u043F\u0435\u043D\u0438",
          "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u0430\u044F \u0441\u0442\u0435\u043F\u0435\u043D\u044C",
          "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u0443\u044E \u0441\u0442\u0435\u043F\u0435\u043D\u044C"
        ]
      }
    };
    return formsByKind[kind]?.[number] ?? formsByKind.line[number] ?? [];
  }
  function nextOrdinalIndex(normalized, start, number) {
    let best = -1;
    for (const nextNumber of [number + 1, number + 2]) {
      const pattern = new RegExp(`(?:^|[ .])${nextNumber}(?:[ .]|$)`, "u");
      const match = normalized.slice(start).match(pattern);
      if (match?.index != null) {
        const index = start + match.index;
        if (best < 0 || index < best) best = index;
      }
    }
    return best;
  }
  function nextStepOrdinalIndex(normalized, start, number) {
    const stepCue = normalizeForSearch("\u0441\u0442\u0443\u043F\u0435\u043D");
    let best = -1;
    for (const nextNumber of [number + 1, number + 2, number + 3]) {
      const pattern = new RegExp(`(?:^|\\s)${nextNumber}(?:\\s*-?\\s*\\S{0,2})?\\s+${escapeRegExp(stepCue)}`, "iu");
      const match = normalized.slice(start).match(pattern);
      if (match?.index != null) {
        const index = start + match.index;
        if (best < 0 || index < best) best = index;
      }
    }
    return best;
  }
  function ordinalValueToNumber(value) {
    const normalized = normalizeForSearch(value);
    if (/^\d{1,2}$/.test(normalized)) return Number(normalized);
    const roman = /* @__PURE__ */ new Map([
      ["i", 1],
      ["ii", 2],
      ["iii", 3],
      ["iv", 4],
      ["v", 5],
      ["vi", 6],
      ["vii", 7],
      ["viii", 8],
      ["ix", 9],
      ["x", 10]
    ]);
    return roman.get(normalized) ?? null;
  }
  function nextDegreeOrdinalIndex(normalized, start, number) {
    const degreeCue = normalizeForSearch("\u0441\u0442\u0435\u043F\u0435\u043D");
    let best = -1;
    for (const nextNumber of [number + 1, number + 2, number + 3]) {
      for (const variant of romanStageVariants(String(nextNumber))) {
        const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(variant)}(?:\\s|-|$)`, "iu");
        const match = normalized.slice(start).match(pattern);
        if (!match?.index && match?.index !== 0) continue;
        const index = start + match.index;
        const before = normalized.slice(Math.max(0, index - 180), index);
        const after = normalized.slice(index, Math.min(normalized.length, index + 80));
        if (!before.includes(degreeCue) && !after.includes(degreeCue)) continue;
        if (best < 0 || index < best) best = index;
      }
    }
    return best;
  }
  function ordinalWindows(source, target) {
    const normalized = source.normalized;
    const windows = [];
    if (target.kind === "degree") {
      const degreeCue = normalizeForSearch("\u0441\u0442\u0435\u043F\u0435\u043D");
      for (const variant of romanStageVariants(String(target.number))) {
        const directPatterns = [
          new RegExp(`(?:^|\\s)${escapeRegExp(variant)}(?:\\s*-?\\s*\\S{0,3})?\\s+${escapeRegExp(degreeCue)}`, "giu"),
          new RegExp(`${escapeRegExp(degreeCue)}\\s+(?:\\S+\\s+){0,2}${escapeRegExp(variant)}(?:\\s|$)`, "giu")
        ];
        for (const pattern of directPatterns) {
          for (const match of normalized.matchAll(pattern)) {
            const index = match.index ?? 0;
            const afterStart = index + match[0].length;
            const afterLimit = nextDegreeOrdinalIndex(normalized, afterStart + 8, target.number);
            const end = afterLimit > 0 ? afterLimit : Math.min(normalized.length, afterStart + 520);
            windows.push(normalized.slice(Math.max(0, index - 160), end));
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
          const before = normalized.slice(Math.max(0, index - 220), index);
          if (!before.includes(degreeCue)) {
            start = index + Math.max(1, variant.length);
            continue;
          }
          const afterLimit = nextDegreeOrdinalIndex(normalized, index + variant.length + 8, target.number);
          const end = afterLimit > 0 ? afterLimit : Math.min(normalized.length, index + 520);
          windows.push(normalized.slice(Math.max(0, index - 160), end));
          start = index + Math.max(1, variant.length);
        }
      }
      for (const form of ordinalWordForms(target.number, "degree")) {
        const formNorm = normalizeForSearch(form);
        let start = 0;
        while (start < normalized.length) {
          const index = normalized.indexOf(formNorm, start);
          if (index < 0) break;
          windows.push(normalized.slice(Math.max(0, index - 220), Math.min(normalized.length, index + formNorm.length + 480)));
          start = index + formNorm.length;
        }
      }
      return windows;
    }
    if (target.kind === "step") {
      const stepCue = normalizeForSearch("\u0441\u0442\u0443\u043F\u0435\u043D");
      const pattern = new RegExp(`(?:^|\\s)${target.number}(?:\\s*-?\\s*\\S{0,2})?\\s+${escapeRegExp(stepCue)}`, "giu");
      for (const match of normalized.matchAll(pattern)) {
        const index = match.index ?? 0;
        const afterStart = index + match[0].length;
        const afterLimit = nextStepOrdinalIndex(normalized, afterStart + 12, target.number);
        const end = afterLimit > 0 ? afterLimit : Math.min(normalized.length, afterStart + 700);
        windows.push(normalized.slice(index, end));
      }
      return windows;
    }
    if (target.kind === "stage") {
      if (!containsNormalizedPhrase(normalized, "\u044D\u0442\u0430\u043F")) return windows;
      const pattern = new RegExp(`(?:^|[ .])${target.number}(?:[ .]|$)`, "gu");
      for (const match of normalized.matchAll(pattern)) {
        const index = match.index ?? 0;
        const before = normalized.slice(Math.max(0, index - 180), index);
        const afterStart = index + match[0].length;
        const afterLimit = nextOrdinalIndex(normalized, afterStart + 12, target.number);
        const end = afterLimit > 0 ? afterLimit : Math.min(normalized.length, afterStart + 520);
        const local = normalized.slice(index, end);
        if (!containsNormalizedPhrase(`${before} ${local}`, "\u044D\u0442\u0430\u043F")) continue;
        windows.push(local);
      }
      return windows;
    }
    for (const form of ordinalWordForms(target.number, "line")) {
      const formNorm = normalizeForSearch(form);
      let start = 0;
      while (start < normalized.length) {
        const index = normalized.indexOf(formNorm, start);
        if (index < 0) break;
        windows.push(normalized.slice(Math.max(0, index - 260), Math.min(normalized.length, index + formNorm.length + 420)));
        start = index + formNorm.length;
      }
    }
    return windows;
  }
  function abbreviationSupport(answerText, window) {
    const answerNorm = normalizeForSearch(answerText);
    if (containsNormalizedPhrase(window, "\u0441\u0433\u043A\u0441") && containsNormalizedPhrase(answerNorm, "\u043A\u043E\u0440\u0442\u0438\u043A\u043E\u0441\u0442\u0435\u0440\u043E\u0438\u0434")) return 1;
    return 0;
  }
  var ORDINAL_GENERIC_FOCUS = new Set(
    [
      "\u043F\u0435\u0440\u0432\u044B\u0439",
      "\u0432\u0442\u043E\u0440\u043E\u0439",
      "\u0442\u0440\u0435\u0442\u0438\u0439",
      "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u044B\u0439",
      "\u0441\u0442\u0430\u0434\u0438\u044F",
      "\u0441\u0442\u0430\u0434\u0438\u0438",
      "\u0441\u0442\u0435\u043F\u0435\u043D\u044C",
      "\u0441\u0442\u0435\u043F\u0435\u043D\u0438",
      "\u043A\u043B\u0430\u0441\u0441",
      "\u043A\u043B\u0430\u0441\u0441\u0430",
      "\u043B\u0438\u043D\u0438\u044F",
      "\u043B\u0438\u043D\u0438\u0438",
      "\u044D\u0442\u0430\u043F",
      "\u044D\u0442\u0430\u043F\u043E\u043C",
      "\u0442\u0435\u0440\u0430\u043F\u0438\u044F",
      "\u0442\u0435\u0440\u0430\u043F\u0438\u0438",
      "\u043B\u0435\u0447\u0435\u043D\u0438\u0435",
      "\u043B\u0435\u0447\u0435\u043D\u0438\u044F",
      "\u043F\u0440\u0435\u043F\u0430\u0440\u0430\u0442",
      "\u043F\u0440\u0435\u043F\u0430\u0440\u0430\u0442\u043E\u043C",
      "\u043F\u0440\u0435\u043F\u0430\u0440\u0430\u0442\u0430\u043C\u0438",
      "\u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F",
      "\u044F\u0432\u043B\u044F\u044E\u0442\u0441\u044F",
      "\u0441\u0430\u0440\u043A\u043E\u0438\u0434\u043E\u0437",
      "\u0441\u0430\u0440\u043A\u043E\u0438\u0434\u043E\u0437\u0430"
    ].flatMap((item) => uniqueTokens(item))
  );
  function specificOrdinalFocusTokens(focusTokens) {
    return (focusTokens ?? []).filter((token) => token.length >= 4 && !/^\d/.test(token) && !ORDINAL_GENERIC_FOCUS.has(token));
  }
  function bestOrdinalListSupport({ mode, pages, question, answer, answerTokens, focusTokens }) {
    const target = ordinalTarget(question);
    if (!target) return null;
    if (mode !== "single" && target.kind !== "degree") return null;
    const answerPhrases = answerSearchPhrases(answer.text).slice(0, 16);
    const specificTokens = specificOrdinalFocusTokens(focusTokens);
    let best = null;
    for (const page of pages) {
      const nextPage = target.kind === "step" ? pages.find((candidate) => candidate.page === page.page + 1) : null;
      const sources = [...cachedLineWindowSegments(page), { normalized: page.normalized, text: page.text }];
      if (nextPage) {
        const text = `${page.text}
${nextPage.text}`;
        sources.push({ normalized: normalizeForSearch(text), text });
      }
      for (const source of sources) {
        for (const window of ordinalWindows(source, target)) {
          const tokens = tokenizeNormalized(window);
          const focusHits = tokenHitCount(specificTokens, tokens);
          if (target.kind !== "step" && specificTokens.length && focusHits <= 0) continue;
          const answerCoverage = strictSoftCoverage(answerTokens, tokens);
          const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(window, phrase));
          const abbreviation = abbreviationSupport(answer.text, window);
          if (!phraseHit && answerCoverage < 0.58 && abbreviation <= 0) continue;
          const score = 12.2 + (phraseHit ? 2.4 : 0) + Math.max(answerCoverage, abbreviation) * 4.4 + Math.min(2, focusHits) * 1.1;
          best = betterEvidence(best, {
            answerId: answer.id,
            page: page.page,
            text: source.text,
            score,
            kind: "ordinal_list_segment"
          });
        }
      }
    }
    return best;
  }
  function typeOrdinalNumber(question) {
    const normalized = normalizeForSearch(question);
    if (!containsNormalizedPhrase(normalized, "\u0442\u0438\u043F")) return null;
    if (!containsNormalizedPhrase(normalized, "\u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440") && !containsNormalizedPhrase(normalized, "\u043C\u0435\u0445\u0430\u043D\u0438\u0437\u043C")) {
      return null;
    }
    if (containsNormalizedPhrase(normalized, "\u043F\u0435\u0440\u0432")) return 1;
    if (containsNormalizedPhrase(normalized, "\u0432\u0442\u043E\u0440")) return 2;
    if (containsNormalizedPhrase(normalized, "\u0442\u0440\u0435\u0442")) return 3;
    return null;
  }
  function typeOrdinalForms(number) {
    if (number === 1) return ["\u043F\u0435\u0440\u0432\u044B\u0439", "\u043F\u0435\u0440\u0432\u043E\u0433\u043E", "\u043F\u0435\u0440\u0432\u044B\u043C"];
    if (number === 2) return ["\u0432\u0442\u043E\u0440\u043E\u0439", "\u0432\u0442\u043E\u0440\u043E\u0433\u043E", "\u0432\u0442\u043E\u0440\u044B\u043C"];
    return ["\u0442\u0440\u0435\u0442\u0438\u0439", "\u0442\u0440\u0435\u0442\u044C\u0435\u0433\u043E", "\u0442\u0440\u0435\u0442\u044C\u0438\u043C"];
  }
  function nextTypeOrdinalBoundary(normalized, start, number) {
    let best = -1;
    for (const otherNumber of [1, 2, 3]) {
      if (otherNumber === number) continue;
      for (const form of typeOrdinalForms(otherNumber)) {
        const formNorm = normalizeForSearch(form);
        let index = normalized.indexOf(formNorm, start);
        while (index >= 0) {
          const before = normalized.slice(Math.max(0, index - 20), index);
          const after = normalized.slice(index, Math.min(normalized.length, index + 40));
          if (/\d/u.test(form) || containsNormalizedPhrase(`${before} ${after}`, "\u0442\u0438\u043F") || containsNormalizedPhrase(before, "\u0438")) {
            best = best < 0 ? index : Math.min(best, index);
            break;
          }
          index = normalized.indexOf(formNorm, index + formNorm.length);
        }
      }
    }
    return best;
  }
  function typeOrdinalWindows(source, number) {
    const windows = [];
    const normalized = source.normalized;
    for (const form of typeOrdinalForms(number)) {
      const formNorm = normalizeForSearch(form);
      let start = 0;
      while (start < normalized.length) {
        const index = normalized.indexOf(formNorm, start);
        if (index < 0) break;
        const before = normalized.slice(Math.max(0, index - 180), index);
        const near = normalized.slice(index, Math.min(normalized.length, index + 90));
        if (containsNormalizedPhrase(`${before} ${near}`, "\u0442\u0438\u043F")) {
          const afterStart = index + formNorm.length;
          const boundary = nextTypeOrdinalBoundary(normalized, afterStart + 8, number);
          const end = boundary > afterStart ? boundary : Math.min(normalized.length, afterStart + 360);
          windows.push(normalized.slice(index, end));
        }
        start = index + Math.max(1, formNorm.length);
      }
    }
    return windows;
  }
  function typeAbbreviationSupport(answerText, window) {
    const answerNorm = normalizeForSearch(answerText);
    let support = 0;
    if (containsNormalizedPhrase(answerNorm, "\u0430\u043E\u0440\u0442") && containsNormalizedPhrase(answerNorm, "\u043A\u043B\u0430\u043F\u0430\u043D") && containsNormalizedPhrase(window, "\u0410\u041A")) {
      support += 0.28;
    }
    if (containsNormalizedPhrase(answerNorm, "\u0432\u043E\u0441\u0445\u043E\u0434") && containsNormalizedPhrase(answerNorm, "\u0430\u043E\u0440\u0442") && containsNormalizedPhrase(window, "\u0412\u0410")) {
      support += 0.22;
    }
    return support;
  }
  var TYPE_ORDINAL_GENERIC_ANSWER = new Set(
    [
      "\u0441\u0442\u0432\u043E\u0440\u043A\u0438",
      "\u0441\u0442\u0432\u043E\u0440\u043E\u043A",
      "\u0430\u043E\u0440\u0442\u0430\u043B\u044C\u043D\u043E\u0433\u043E",
      "\u0430\u043E\u0440\u0442\u0430\u043B\u044C\u043D\u044B\u0439",
      "\u043A\u043B\u0430\u043F\u0430\u043D",
      "\u043A\u043B\u0430\u043F\u0430\u043D\u0430",
      "\u0440\u0435\u0433\u0443\u0440\u0433\u0438\u0442\u0430\u0446\u0438\u0438",
      "\u043F\u043E\u0442\u043E\u043A",
      "\u043F\u043E\u0442\u043E\u043A\u043E\u043C"
    ].flatMap((item) => uniqueTokens(item))
  );
  function typeDistinctiveAnswerTokens(answerTokens) {
    return answerTokens.filter((token) => token.length >= 4 && !TYPE_ORDINAL_GENERIC_ANSWER.has(token));
  }
  function bestTypeOrdinalSupport({ pages, question, answer, answerTokens }) {
    const number = typeOrdinalNumber(question);
    if (!number) return null;
    const answerPhrases = answerSearchPhrases(answer.text).slice(0, 16);
    const distinctiveTokens = typeDistinctiveAnswerTokens(answerTokens);
    let best = null;
    for (const page of pages) {
      const sources = [...cachedLineWindowSegments(page), { normalized: page.normalized, text: page.text }];
      for (const source of sources) {
        for (const window of typeOrdinalWindows(source, number)) {
          const tokens = tokenizeNormalized(window);
          const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(window, phrase));
          const coverageScore = strictSoftCoverage(answerTokens, tokens);
          const distinctiveCoverage = distinctiveTokens.length ? softCoverage(distinctiveTokens, tokens) : 0;
          if (distinctiveTokens.length && distinctiveCoverage <= 0) continue;
          const abbreviation = typeAbbreviationSupport(answer.text, window);
          const support = Math.min(1, coverageScore + abbreviation + Math.min(0.2, distinctiveCoverage * 0.2));
          if (!phraseHit && support < 0.5) continue;
          const score = 13.4 + (phraseHit ? 2.6 : 0) + support * 5.2;
          best = betterEvidence(best, {
            answerId: answer.id,
            page: page.page,
            text: source.text,
            score,
            kind: "type_ordinal_segment"
          });
        }
      }
    }
    return best;
  }
  var INDICATION_LABEL_STOPS = new Set(
    [
      "\u043F\u0430\u0446\u0438\u0435\u043D\u0442",
      "\u043F\u0430\u0446\u0438\u0435\u043D\u0442\u0430",
      "\u043F\u0430\u0446\u0438\u0435\u043D\u0442\u043E\u0432",
      "\u0431\u043E\u043B\u044C\u043D\u043E\u0439",
      "\u0431\u043E\u043B\u044C\u043D\u044B\u0445",
      "\u0437\u0430",
      "\u0441",
      "\u043F\u0440\u0438",
      "\u043F\u043E"
    ].flatMap((item) => rawTokens(item))
  );
  function questionIndicationLabel(question) {
    const tokens = rawTokens(question);
    if (!tokens.some((token) => token.startsWith("\u043F\u043E\u043A\u0430\u0437\u0430\u043D"))) return null;
    const start = tokens.findIndex((token) => token === "\u0434\u043B\u044F" || token === "\u043A");
    if (start < 0) return null;
    const label = [];
    for (let index = start + 1; index < tokens.length && label.length < 5; index += 1) {
      const token = tokens[index];
      if (INDICATION_LABEL_STOPS.has(token)) break;
      label.push(token);
    }
    return label.length ? label.join(" ") : null;
  }
  function indicationLineMatches(line, labelTokens) {
    const lineTokens = tokenizeNormalized(normalizeForSearch(line));
    if (softCoverage(labelTokens, lineTokens) < Math.min(1, labelTokens.length <= 3 ? 0.9 : 0.72)) return false;
    const normalized = normalizeForSearch(line);
    return containsNormalizedPhrase(normalized, "\u043F\u043E\u043A\u0430\u0437\u0430\u043D") || containsNormalizedPhrase(normalized, "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434") || labelTokens.length >= 2;
  }
  function buildIndicationSegment(lines, index) {
    const current = normalizeForSearch(lines[index]);
    const before = normalizeForSearch(lines.slice(Math.max(0, index - 2), index).join(" "));
    let start = index;
    if (!containsNormalizedPhrase(current, "\u0433\u043E\u0441\u043F\u0438\u0442\u0430\u043B") && containsNormalizedPhrase(before, "\u043E\u0442\u0441\u0443\u0442")) {
      start = Math.max(0, index - 2);
    }
    const out = [];
    for (let cursor = start; cursor < Math.min(lines.length, index + 5); cursor += 1) {
      if (cursor > index) {
        const normalized = normalizeForSearch(lines[cursor]);
        if (containsNormalizedPhrase(normalized, "\u043F\u043B\u0430\u043D\u043E\u0432") || containsNormalizedPhrase(normalized, "\u044D\u043A\u0441\u0442\u0440\u0435\u043D") || containsNormalizedPhrase(normalized, "\u043F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u044F \u043A")) {
          break;
        }
      }
      out.push(lines[cursor]);
    }
    return out.join(" ");
  }
  function indicationSemanticSupport(answerText, segment) {
    const answerNorm = normalizeForSearch(answerText);
    const segmentNorm = normalizeForSearch(segment);
    if (containsNormalizedPhrase(answerNorm, "\u0441\u043E\u0445\u0440\u0430\u043D") && containsNormalizedPhrase(answerNorm, "\u0444\u0443\u043D\u043A\u0446") && containsNormalizedPhrase(segmentNorm, "\u043E\u0442\u0441\u0443\u0442") && containsNormalizedPhrase(segmentNorm, "\u0441\u043D\u0438\u0436") && containsNormalizedPhrase(segmentNorm, "\u0444\u0443\u043D\u043A\u0446")) {
      return 0.78;
    }
    if (containsNormalizedPhrase(answerNorm, "\u043E\u0441\u0442\u0440") && containsNormalizedPhrase(answerNorm, "\u043F\u0440\u043E\u0433\u0440\u0435\u0441") && containsNormalizedPhrase(segmentNorm, "\u043E\u0441\u0442\u0440") && containsNormalizedPhrase(segmentNorm, "\u043F\u0440\u043E\u0433\u0440\u0435\u0441")) {
      return 0.86;
    }
    return 0;
  }
  function indicationContrastMismatch(answerText, segment) {
    const answerNorm = normalizeForSearch(answerText);
    const segmentNorm = normalizeForSearch(segment);
    if (containsNormalizedPhrase(segmentNorm, "\u043E\u0442\u0441\u0443\u0442") && !containsNormalizedPhrase(answerNorm, "\u043E\u0442\u0441\u0443\u0442") && (containsNormalizedPhrase(answerNorm, "\u0443\u0433\u0440\u043E\u0437") || containsNormalizedPhrase(answerNorm, "\u043D\u0435\u0434\u043E\u0441\u0442\u0430\u0442")) && containsNormalizedPhrase(segmentNorm, "\u043D\u0435\u0434\u043E\u0441\u0442\u0430\u0442")) {
      return true;
    }
    return false;
  }
  function bestIndicationSegmentSupport({ pages, question, answer, answerTokens }) {
    const label = questionIndicationLabel(question);
    if (!label) return null;
    const labelTokens = uniqueTokens(label);
    if (!labelTokens.length) return null;
    const answerPhrases = answerSearchPhrases(answer.text).slice(0, 16);
    let best = null;
    for (const page of pages) {
      const lines = page.lines ?? [];
      for (let index = 0; index < lines.length; index += 1) {
        const neighborhood = lines.slice(index, Math.min(lines.length, index + 2)).join(" ");
        if (!indicationLineMatches(neighborhood, labelTokens)) continue;
        const segment = buildIndicationSegment(lines, index);
        if (indicationContrastMismatch(answer.text, segment)) continue;
        const normalized = normalizeForSearch(segment);
        const tokens = tokenizeNormalized(normalized);
        const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(normalized, phrase));
        const answerCoverage = strictSoftCoverage(answerTokens, tokens);
        const semantic = indicationSemanticSupport(answer.text, segment);
        const support = Math.max(answerCoverage, semantic);
        if (!phraseHit && support < 0.45) continue;
        const score = 13.8 + (phraseHit ? 2.6 : 0) + support * 5.4;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: segment,
          score,
          kind: "indication_label_segment"
        });
      }
    }
    return best;
  }
  function ageEligibilityAdjustment({ pages, question, answer }) {
    const questionNorm = normalizeForSearch(question);
    const answerNorm = normalizeForSearch(answer.text);
    if (!containsNormalizedPhrase(questionNorm, "\u043F\u043E\u043A\u0430\u0437") && !containsNormalizedPhrase(questionNorm, "\u043D\u0430\u0437\u043D\u0430\u0447") && !containsNormalizedPhrase(questionNorm, "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434")) {
      return { adjustment: 0, evidence: null };
    }
    const childAnswer = containsNormalizedPhrase(answerNorm, "\u0434\u0435\u0442\u0441\u043A") || containsNormalizedPhrase(answerNorm, "\u0434\u0435\u0442\u044F\u043C") || containsNormalizedPhrase(answerNorm, "\u0434\u0435\u0442\u0438") || containsNormalizedPhrase(answerNorm, "\u0434\u0435\u0442\u0435\u0439");
    if (!childAnswer || containsNormalizedPhrase(answerNorm, "\u0432\u0437\u0440\u043E\u0441")) return { adjustment: 0, evidence: null };
    for (const page of pages) {
      for (const source of cachedLineWindowSegments(page)) {
        const normalized = source.normalized;
        if (containsNormalizedPhrase(normalized, "\u0434\u0435\u0442") && (containsNormalizedPhrase(normalized, "\u043F\u0440\u043E\u0442\u0438\u0432\u043E\u043F\u043E\u043A\u0430\u0437") || containsNormalizedPhrase(normalized, "\u0442\u043E\u043B\u044C\u043A\u043E \u0432\u0437\u0440\u043E\u0441") && containsNormalizedPhrase(normalized, "\u0434\u0435\u0442"))) {
          return {
            adjustment: -4.2,
            evidence: {
              answerId: answer.id,
              page: page.page,
              text: source.text,
              score: 4.2,
              kind: "age_eligibility_contraindication"
            }
          };
        }
      }
    }
    return { adjustment: 0, evidence: null };
  }
  function questionDefinitionTerm(question) {
    const tokens = rawTokens(question);
    const podIndex = tokens.findIndex((token) => token === "\u043F\u043E\u0434");
    const ponimIndex = tokens.findIndex((token) => token.startsWith("\u043F\u043E\u043D\u0438\u043C"));
    if (podIndex >= 0 && ponimIndex > podIndex + 1) {
      return tokens.slice(podIndex + 1, ponimIndex).join(" ");
    }
    const calledIndex = tokens.findIndex((token) => token.startsWith("\u043D\u0430\u0437\u044B\u0432"));
    if (calledIndex > 0) return tokens.slice(0, calledIndex).join(" ");
    return null;
  }
  function definitionTermIndex(normalized, term) {
    const labelNorm = normalizeForSearch(term);
    const exact = normalized.indexOf(labelNorm);
    if (exact >= 0) return exact;
    const prefixes = uniqueTokens(term).filter((token) => token.length >= 5).map((token) => token.slice(0, Math.min(6, token.length)));
    return prefixes.length ? normalized.indexOf(prefixes[0]) : -1;
  }
  function definitionTermWindow(normalized, term) {
    const exact = normalizeForSearch(term);
    const prefixes = [
      exact,
      ...uniqueTokens(term).filter((token) => token.length >= 5).map((token) => token.slice(0, Math.min(6, token.length)))
    ].filter(Boolean);
    for (const prefix of prefixes.length ? prefixes : [normalizeForSearch(term)]) {
      let start = 0;
      while (start < normalized.length) {
        const labelIndex = normalized.indexOf(prefix, start);
        if (labelIndex < 0) break;
        const around = normalized.slice(labelIndex, Math.min(normalized.length, labelIndex + 56));
        if (containsNormalizedPhrase(around, "\u044D\u0442\u043E") || containsNormalizedPhrase(around, "\u043F\u043E\u043D\u0438\u043C") || around.includes("-")) {
          let end = Math.min(normalized.length, labelIndex + 300);
          const nextDefinition = normalized.indexOf(normalizeForSearch("\u044D\u0442\u043E"), labelIndex + 64);
          if (nextDefinition > labelIndex) end = Math.min(end, Math.max(labelIndex + 80, nextDefinition - 24));
          return normalized.slice(labelIndex, end);
        }
        start = labelIndex + Math.max(1, prefix.length);
      }
    }
    const fallback = definitionTermIndex(normalized, term);
    return fallback >= 0 ? normalized.slice(fallback, Math.min(normalized.length, fallback + 260)) : null;
  }
  function answerAbbreviations(answerText) {
    return (String(answerText ?? "").match(/[A-ZА-ЯЁ]{2,}(?:-[A-ZА-ЯЁ]{2,})?/gu) ?? []).map((item) => normalizeForSearch(item)).filter((item) => item.length >= 2);
  }
  function bestTermDefinitionSupport({ pages, question, answer, answerTokens }) {
    const term = questionDefinitionTerm(question);
    if (!term) return null;
    if (normalizeForSearch(term).length < 4) return null;
    const abbreviations = answerAbbreviations(answer.text);
    let best = null;
    for (const page of pages) {
      const sources = [...cachedLineWindowSegments(page), { normalized: page.normalized, text: page.text }];
      for (const source of sources) {
        const window = definitionTermWindow(source.normalized, term);
        if (!window) continue;
        if (abbreviations.length && !abbreviations.some((abbr) => window.includes(abbr))) continue;
        const tokens = tokenizeNormalized(window);
        const answerCoverage = strictSoftCoverage(answerTokens, tokens);
        if (answerCoverage < 0.52) continue;
        const score = 14.2 + answerCoverage * 6.2 + numberCoverage(answer.text, window) * 0.8;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: source.text,
          score,
          kind: "term_definition_segment"
        });
      }
    }
    return best;
  }
  function negatedAnswerPrefixAdjustment({ mode, pages, question, answer, answerTokens }) {
    if (mode !== "single" || answerTokens.length < 2) return { adjustment: 0, evidence: null };
    const questionNorm = normalizeForSearch(question);
    if (!containsNormalizedPhrase(questionNorm, "\u043E\u0431\u0440\u0430\u0437\u043E\u0432") && !containsNormalizedPhrase(questionNorm, "\u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440")) {
      return { adjustment: 0, evidence: null };
    }
    const first = answerTokens[0];
    if (first.startsWith("he") || first.startsWith("\u043D\u0435")) return { adjustment: 0, evidence: null };
    const negatedPrefix = `he${first.slice(0, Math.min(first.length, 4))}`;
    for (const page of pages) {
      if (page.normalized.includes(negatedPrefix) && answerTokens.slice(1).some((token) => page.normalized.includes(token.slice(0, Math.min(token.length, 8))))) {
        return {
          adjustment: -3.8,
          evidence: {
            answerId: answer.id,
            page: page.page,
            text: evidenceSnippet(page.text, first, question),
            score: 3.8,
            kind: "negated_answer_prefix_mismatch"
          }
        };
      }
    }
    return { adjustment: 0, evidence: null };
  }
  function impossibilityOnlyAdjustment({ mode, pages, question, answer }) {
    if (mode !== "single") return { adjustment: 0, evidence: null };
    const questionNorm = normalizeForSearch(question);
    if (!containsNormalizedPhrase(questionNorm, "\u0434\u0438\u043D\u0430\u043C\u0438\u0447") && !containsNormalizedPhrase(questionNorm, "\u044D\u0444\u0444\u0435\u043A\u0442\u0438\u0432")) {
      return { adjustment: 0, evidence: null };
    }
    const answerTokens = uniqueTokens(answer.text).filter((token) => token.length >= 5 && !FOCUS_STOPWORDS.has(token));
    const phrases = answerSearchPhrases(answer.text).slice(0, 12);
    for (const page of pages) {
      for (const phrase of phrases) {
        const hits = findPhraseOccurrences(page.normalized, phrase, { textIsNormalized: true });
        for (const hit of hits) {
          const local = pageWindow(page, hit, 230);
          if (containsNormalizedPhrase(local, "\u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u0441\u043B\u0443\u0447\u0430\u044F\u0445 \u043D\u0435\u0432\u043E\u0437\u043C\u043E\u0436") || containsNormalizedPhrase(local, "\u043D\u0435\u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438 \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D")) {
            return {
              adjustment: -3.6,
              evidence: {
                answerId: answer.id,
                page: page.page,
                text: evidenceSnippet(page.text, phrase, question),
                score: 3.6,
                kind: "impossibility_only_penalty"
              }
            };
          }
        }
      }
      if (answerTokens.length) {
        for (const source of cachedLineWindowSegments(page)) {
          const local = source.normalized;
          const tokens = tokenizeNormalized(local);
          const answerCoverage = strictSoftCoverage(answerTokens, tokens);
          if (answerCoverage < 0.45) continue;
          if (containsNormalizedPhrase(local, "\u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u0441\u043B\u0443\u0447\u0430\u044F\u0445 \u043D\u0435\u0432\u043E\u0437\u043C\u043E\u0436") || containsNormalizedPhrase(local, "\u043D\u0435\u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438 \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D")) {
            return {
              adjustment: -3.6,
              evidence: {
                answerId: answer.id,
                page: page.page,
                text: source.text,
                score: 3.6,
                kind: "impossibility_only_penalty"
              }
            };
          }
        }
      }
    }
    return { adjustment: 0, evidence: null };
  }
  function activeTherapyIndicationAdjustment({ question, answer }) {
    const questionNorm = normalizeForSearch(question);
    if (!containsNormalizedPhrase(questionNorm, "\u043D\u0430\u0447\u0430\u043B") || !containsNormalizedPhrase(questionNorm, "\u0430\u043A\u0442\u0438\u0432") || !containsNormalizedPhrase(questionNorm, "\u0442\u0435\u0440\u0430\u043F")) {
      return { adjustment: 0, evidence: null };
    }
    const answerNorm = normalizeForSearch(answer.text);
    const supportive = containsNormalizedPhrase(answerNorm, "\u0443\u0433\u0440\u043E\u0437") || containsNormalizedPhrase(answerNorm, "\u043D\u0435\u0434\u043E\u0441\u0442\u0430\u0442") || containsNormalizedPhrase(answerNorm, "\u043F\u043E\u0442\u0435\u0440") || containsNormalizedPhrase(answerNorm, "\u043A\u0430\u0447\u0435\u0441\u0442") || containsNormalizedPhrase(answerNorm, "\u0436\u0438\u0437\u043D");
    if (supportive) return { adjustment: 0, evidence: null };
    return {
      adjustment: -4.2,
      evidence: {
        answerId: answer.id,
        page: 0,
        text: answer.text,
        score: 4.2,
        kind: "active_therapy_indication_mismatch"
      }
    };
  }
  function questionDefinitionLabel(question) {
    const tokens = rawTokens(question);
    const index = tokens.findIndex((token) => token.startsWith("\u0441\u0447\u0438\u0442\u0430"));
    if (index < 0) return null;
    const label = [];
    for (let offset = index + 1; offset < Math.min(tokens.length, index + 5); offset += 1) {
      if (tokens[offset] === "\u043F\u0440\u0438") break;
      label.push(tokens[offset]);
    }
    return label.length ? label.join(" ") : null;
  }
  function labelDefinitionWindows(normalized, labelNorm) {
    const labelBoundaries = [
      "\u043E\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043B",
      "\u0441\u043E\u043C\u043D\u0438\u0442\u0435\u043B",
      "\u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B"
    ].map((item) => normalizeForSearch(item));
    const windows = [];
    let start = 0;
    while (start < normalized.length) {
      const labelIndex = normalized.indexOf(labelNorm, start);
      if (labelIndex < 0) break;
      const afterLabel = labelIndex + labelNorm.length;
      let end = Math.min(normalized.length, afterLabel + 220);
      for (const boundary of labelBoundaries) {
        if (labelNorm.includes(boundary)) continue;
        const index = normalized.indexOf(boundary, afterLabel + 18);
        if (index > 0) end = Math.min(end, index);
      }
      windows.push({
        answerWindow: normalized.slice(labelIndex, end),
        contextWindow: normalized.slice(Math.max(0, labelIndex - 240), Math.min(normalized.length, end + 80))
      });
      start = afterLabel;
    }
    return windows;
  }
  var LABEL_DEFINITION_GENERIC_FOCUS = new Set(
    [
      "\u043F\u0440\u043E\u0431\u0430",
      "\u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F",
      "\u043F\u0440\u0438",
      "\u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0439",
      "\u0441\u043E\u043C\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0439",
      "\u043E\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0439"
    ].flatMap((item) => uniqueTokens(item))
  );
  function labelDefinitionFocusTokens(focusTokens) {
    return (focusTokens ?? []).filter((token) => token.length >= 3 && !LABEL_DEFINITION_GENERIC_FOCUS.has(token));
  }
  function bestLabelDefinitionSupport({ mode, pages, question, answer, answerTokens, focusTokens }) {
    if (mode !== "single") return null;
    const label = questionDefinitionLabel(question);
    if (!label) return null;
    const labelNorm = normalizeForSearch(label);
    const answerPhrases = answerSearchPhrases(answer.text).slice(0, 16);
    const specificTokens = labelDefinitionFocusTokens(focusTokens);
    let best = null;
    for (const page of pages) {
      for (const source of cachedLineWindowSegments(page)) {
        if (!containsNormalizedPhrase(source.normalized, label)) continue;
        for (const { answerWindow, contextWindow } of labelDefinitionWindows(source.normalized, labelNorm)) {
          if (specificTokens.length && tokenHitCount(specificTokens, tokenizeNormalized(contextWindow)) <= 0) continue;
          const tokens = tokenizeNormalized(answerWindow);
          const answerCoverage = strictSoftCoverage(answerTokens, tokens);
          const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(answerWindow, phrase));
          if (!phraseHit && answerCoverage < 0.55) continue;
          const score = 13 + (phraseHit ? 2.8 : 0) + answerCoverage * 4.2 + numberCoverage(answer.text, answerWindow) * 1.2;
          best = betterEvidence(best, {
            answerId: answer.id,
            page: page.page,
            text: source.text,
            score,
            kind: "label_definition_segment"
          });
        }
      }
    }
    return best;
  }
  var RECOMMENDATION_GENERIC_FOCUS = new Set(
    [
      "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u0442\u0441\u044F",
      "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u043E\u0432\u0430\u043D",
      "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u043E\u0432\u0430\u043D\u043D\u044B\u043C",
      "\u043B\u0435\u0447\u0435\u043D\u0438\u0435",
      "\u043B\u0435\u0447\u0435\u043D\u0438\u044E",
      "\u043F\u0430\u0446\u0438\u0435\u043D\u0442",
      "\u043F\u0430\u0446\u0438\u0435\u043D\u0442\u0430\u043C",
      "\u043F\u0440\u0435\u043F\u0430\u0440\u0430\u0442",
      "\u043F\u0440\u043E\u0432\u043E\u0434\u0438\u0442\u044C",
      "\u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u0435"
    ].flatMap((item) => uniqueTokens(item))
  );
  function specificRecommendationFocusTokens(focusTokens) {
    return (focusTokens ?? []).filter((token) => token.length >= 4 && !RECOMMENDATION_GENERIC_FOCUS.has(token));
  }
  function recommendationQuestion(question) {
    return containsNormalizedPhrase(normalizeForSearch(question), "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434");
  }
  function segmentRecommendationPolarity(normalized) {
    if (containsNormalizedPhrase(normalized, "\u043D\u0435 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434") || containsNormalizedPhrase(normalized, "\u043D\u0435\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434")) {
      return "negative";
    }
    if (containsNormalizedPhrase(normalized, "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434")) return "positive";
    return null;
  }
  function recommendationQuestionPolarity(question, intent) {
    const normalized = normalizeForSearch(question);
    if (intent.negative || containsNormalizedPhrase(normalized, "\u043D\u0435 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434") || containsNormalizedPhrase(normalized, "\u043D\u0435\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434")) {
      return "negative";
    }
    return "positive";
  }
  function recommendationAnswerHit(segment, answer, answerTokens) {
    const answerPhrases = answerSearchPhrases(answer.text).slice(0, 16);
    const phraseHit = answerPhrases.some((phrase) => containsNormalizedPhrase(segment.normalized, phrase));
    const answerCoverage = strictSoftCoverage(answerTokens, segment.tokens);
    return { phraseHit, answerCoverage, hit: phraseHit || answerCoverage >= 0.6 };
  }
  function recommendationPolarityAdjustment({ mode, pages, question, answer, answerTokens, focusTokens, intent }) {
    if (mode !== "single" || !recommendationQuestion(question)) return { support: null, adjustment: 0, evidence: null };
    const target = recommendationQuestionPolarity(question, intent);
    if (target !== "negative") return { support: null, adjustment: 0, evidence: null };
    const specificTokens = specificRecommendationFocusTokens(focusTokens);
    let bestMatch = null;
    let bestMismatch = null;
    for (const page of pages) {
      for (const segment of cachedLineWindowSegments(page)) {
        const polarity = segmentRecommendationPolarity(segment.normalized);
        if (!polarity) continue;
        const focusHits = tokenHitCount(specificTokens, segment.tokens);
        if (specificTokens.length >= 2 && focusHits <= 0) continue;
        const answerHit = recommendationAnswerHit(segment, answer, answerTokens);
        if (!answerHit.hit) continue;
        const evidence = {
          answerId: answer.id,
          page: page.page,
          text: segment.text,
          score: 11.8 + (answerHit.phraseHit ? 2.5 : 0) + answerHit.answerCoverage * 3.2 + Math.min(2, focusHits) * 1,
          kind: polarity === target ? "recommendation_polarity_match" : "recommendation_polarity_mismatch"
        };
        if (polarity === target) bestMatch = betterEvidence(bestMatch, evidence);
        else bestMismatch = betterEvidence(bestMismatch, evidence);
      }
    }
    if (bestMatch) return { support: bestMatch, adjustment: 0, evidence: null };
    return bestMismatch ? { support: null, adjustment: -7.5, evidence: bestMismatch } : { support: null, adjustment: 0, evidence: null };
  }
  var SHARED_MULTI_SOURCE_KINDS = /* @__PURE__ */ new Set([
    "question_anchor_segment",
    "question_chunk_answer",
    "bm25_question_answer",
    "section_list_segment",
    "bounded_list_segment",
    "ordinal_list_segment",
    "latin_fuzzy_ocr"
  ]);
  var SHARED_MULTI_GENERIC_TOKENS = new Set(
    [
      "\u0434\u0430\u043D\u043D\u044B\u0435",
      "\u0434\u0430\u043D\u043D\u044B\u0445",
      "\u0446\u0435\u043B\u044C",
      "\u0446\u0435\u043B\u044C\u044E",
      "\u043F\u0430\u0446\u0438\u0435\u043D\u0442",
      "\u043F\u0430\u0446\u0438\u0435\u043D\u0442\u0430",
      "\u043F\u0430\u0446\u0438\u0435\u043D\u0442\u0430\u043C",
      "\u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D",
      "\u043F\u0440\u043E\u0432\u043E\u0434",
      "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434",
      "\u043E\u0442\u043D\u043E\u0441",
      "\u044F\u0432\u043B\u044F",
      "\u0432\u044B\u043F\u043E\u043B\u043D",
      "\u043B\u0435\u0447\u0435\u043D",
      "\u0442\u0435\u0440\u0430\u043F"
    ].flatMap((item) => uniqueTokens(item))
  );
  var SHARED_MULTI_SECTION_CUES = [
    "\u043F\u043E \u043B\u043E\u043A\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u0438",
    "\u043F\u043E \u044D\u0442\u0438\u043E\u043B\u043E\u0433\u0438\u0438",
    "\u043F\u043E \u0441\u0442\u0435\u043F\u0435\u043D\u0438",
    "\u043F\u043E \u043E\u0441\u043E\u0431\u0435\u043D\u043D\u043E\u0441\u0442\u044F\u043C \u0442\u0435\u0447\u0435\u043D\u0438\u044F",
    "\u043F\u043E \u043A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438"
  ].map((item) => normalizeForSearch(item));
  var SHARED_MULTI_REQUIRED_CUE_GROUPS = [
    {
      answer: ["\u043C\u0435\u043D\u0435\u0435", "\u043D\u0438\u0436\u0435", "\u0441\u043D\u0438\u0436", "\u043D\u0438\u0437\u043A", "\u043C\u043E\u043B\u043E\u0436\u0435", "\u043F\u043E\u043D\u0438\u0436"],
      source: ["\u043C\u0435\u043D\u0435\u0435", "\u043D\u0438\u0436\u0435", "\u0441\u043D\u0438\u0436", "\u043D\u0438\u0437\u043A", "\u043C\u043E\u043B\u043E\u0436\u0435", "\u043F\u043E\u043D\u0438\u0436"]
    },
    {
      answer: ["\u0431\u043E\u043B\u0435\u0435", "\u0432\u044B\u0448\u0435", "\u043F\u043E\u0432\u044B\u0448", "\u0432\u044B\u0441\u043E\u043A", "\u0441\u0442\u0430\u0440\u0448\u0435"],
      source: ["\u0431\u043E\u043B\u0435\u0435", "\u0432\u044B\u0448\u0435", "\u043F\u043E\u0432\u044B\u0448", "\u0432\u044B\u0441\u043E\u043A", "\u0441\u0442\u0430\u0440\u0448\u0435"]
    }
  ].map((group) => ({
    answer: group.answer.map((item) => normalizeForSearch(item)),
    source: group.source.map((item) => normalizeForSearch(item))
  }));
  function sharedMultiTokens(answerText) {
    return uniqueTokens(answerText).filter((token) => token.length >= 3 && !FOCUS_STOPWORDS.has(token) && !SHARED_MULTI_GENERIC_TOKENS.has(token));
  }
  function sharedMultiSectionCue(question) {
    const normalizedQuestion = normalizeForSearch(question);
    return SHARED_MULTI_SECTION_CUES.find((cue) => normalizedQuestion.includes(cue)) ?? null;
  }
  function sharedMultiFocusedNormalized(segmentText, question) {
    const normalized = normalizeForSearch(segmentText);
    const cue = sharedMultiSectionCue(question);
    if (!cue) return normalized;
    const start = normalized.indexOf(cue);
    if (start < 0) return normalized;
    let end = normalized.length;
    for (const nextCue of SHARED_MULTI_SECTION_CUES) {
      if (nextCue === cue) continue;
      const index = normalized.indexOf(nextCue, start + cue.length + 20);
      if (index > start) end = Math.min(end, index);
    }
    return normalized.slice(start, end);
  }
  function sharedMultiRequiredCueMismatch(answerText, normalizedSegment) {
    const normalizedAnswer = normalizeForSearch(answerText);
    for (const group of SHARED_MULTI_REQUIRED_CUE_GROUPS) {
      if (group.answer.some((cue) => normalizedAnswer.includes(cue)) && !group.source.some((cue) => normalizedSegment.includes(cue))) {
        return true;
      }
    }
    return false;
  }
  function sharedMultiTokenPosition(normalizedSegment, token) {
    const probes = [token, token.slice(0, 10), token.slice(0, 8), token.slice(0, 6)].filter((item) => item.length >= 4);
    for (const probe of probes) {
      const index = normalizedSegment.indexOf(probe);
      if (index >= 0) return index;
    }
    return -1;
  }
  function sharedMultiCompactSpan(normalizedSegment, tokens) {
    const positions = tokens.map((token) => sharedMultiTokenPosition(normalizedSegment, token)).filter((position) => position >= 0).sort((a, b) => a - b);
    if (positions.length < Math.min(2, tokens.length)) return Infinity;
    return positions[positions.length - 1] - positions[0];
  }
  function sharedMultiSegmentHit(segmentText, answer, question) {
    const normalized = sharedMultiFocusedNormalized(segmentText, question);
    if (!normalized || normalized.length < 30) return null;
    if (sharedMultiRequiredCueMismatch(answer.text, normalized)) return null;
    const phraseHit = focusedAnswerSearchPhrases(answer.text).map((phrase) => normalizeForSearch(phrase)).filter((phrase) => phrase.length >= 9).some((phrase) => containsNormalizedPhrase(normalized, phrase));
    const tokens = sharedMultiTokens(answer.text);
    const tokenCoverage = tokens.length ? strictSoftCoverage(tokens, tokenizeNormalized(normalized)) : 0;
    const compactSpan = sharedMultiCompactSpan(normalized, tokens);
    const spanLimit = Math.min(520, 150 + tokens.length * 45);
    const strongTokenHit = tokens.length >= 2 && tokenCoverage >= 0.78 && compactSpan <= spanLimit;
    if (!phraseHit && !strongTokenHit) return null;
    return { phraseHit, tokenCoverage, tokens, compactSpan };
  }
  function addSharedMultiSegmentSupport(answerScores, intent, question) {
    if (intent.negative || intent.exception || answerScores.length < 3) return answerScores;
    const sorted = [...answerScores].sort((a, b) => b.raw - a.raw);
    const topRaw = sorted[0]?.raw ?? 0;
    if (topRaw < 5) return answerScores;
    const sourceMap = /* @__PURE__ */ new Map();
    for (const item of sorted.slice(0, Math.min(3, sorted.length))) {
      for (const evidenceItem of item.evidence.slice(0, 4)) {
        if (!SHARED_MULTI_SOURCE_KINDS.has(evidenceItem.kind)) continue;
        if (!evidenceItem.text || evidenceItem.text.length < 50) continue;
        if ((evidenceItem.score ?? 0) < 4.8) continue;
        const key = `${evidenceItem.page}:${evidenceItem.kind}:${evidenceItem.text.slice(0, 220)}`;
        if (!sourceMap.has(key) || sourceMap.get(key).score < evidenceItem.score) {
          sourceMap.set(key, evidenceItem);
        }
      }
    }
    const sources = [...sourceMap.values()].slice(0, 8);
    if (!sources.length) return answerScores;
    return answerScores.map((item) => {
      let best = null;
      for (const source of sources) {
        const hit = sharedMultiSegmentHit(source.text, item.answer, question);
        if (!hit) continue;
        const evidenceScore = 9.2 + Math.min(3.2, source.score * 0.18) + hit.tokenCoverage * 2.6 + (hit.phraseHit ? 1.4 : 0);
        best = betterEvidence(best, {
          answerId: item.answer.id,
          page: source.page,
          text: source.text,
          score: evidenceScore,
          kind: "shared_multi_segment"
        });
      }
      if (!best) return item;
      const minPriorRatio = topRaw < 10 ? 0.48 : 0.38;
      if (item.raw < topRaw * minPriorRatio) return item;
      const supportRatio = topRaw < 13 ? 0.96 : best.score >= 12 ? 0.82 : 0.76;
      const boostedRaw = Math.max(item.raw, topRaw * supportRatio);
      if (boostedRaw <= item.raw + 0.05) return item;
      return { ...item, raw: boostedRaw, evidence: [...item.evidence, best] };
    });
  }
  function nearestCueName(local, entries) {
    const center = Math.floor(local.length / 2);
    let best = null;
    for (const [name, cues] of entries) {
      for (const cueText of cues) {
        const cue = normalizeForSearch(cueText);
        for (let index = local.indexOf(cue); index >= 0; index = local.indexOf(cue, index + cue.length)) {
          const distance = Math.abs(index - center);
          if (!best || distance < best.distance) best = { name, distance };
        }
      }
    }
    return best?.name ?? null;
  }
  var CONDITION_NUMBER_GENERIC_FOCUS = new Set(
    [
      "\u0440\u0438\u0441\u043A",
      "\u0441\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442",
      "\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434",
      "\u043F\u0430\u0446\u0438\u0435\u043D\u0442",
      "\u043C\u0430\u0442\u0435\u0440\u0435\u0439",
      "\u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B\u044C\u043D",
      "\u043E\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043B\u044C\u043D",
      "\u0442\u044F\u0436\u0435\u043B\u044B\u043C",
      "\u0442\u044F\u0436\u0435\u043B\u043E\u043C",
      "\u0441\u0440\u0435\u0434\u043D\u0435\u0439",
      "\u0446\u0438\u0440\u0440\u043E\u0437",
      "hbeag"
    ].flatMap((item) => uniqueTokens(item))
  );
  function specificConditionNumberFocusTokens(focusTokens) {
    return (focusTokens ?? []).filter((token) => token.length >= 4 && !/^\d/.test(token) && !CONDITION_NUMBER_GENERIC_FOCUS.has(token));
  }
  function questionMarkerConditions(question) {
    const normalized = normalizeForSearch(question);
    const conditions = [];
    if (containsNormalizedPhrase(normalized, "hbeag")) {
      if (containsNormalizedPhrase(normalized, "\u043E\u0442\u0440\u0438\u0446")) conditions.push({ type: "hbeag", value: "negative" });
      if (containsNormalizedPhrase(normalized, "\u043F\u043E\u043B\u043E\u0436")) conditions.push({ type: "hbeag", value: "positive" });
    }
    if (containsNormalizedPhrase(normalized, "\u0431\u0435\u0437 \u0446\u0438\u0440\u0440\u043E\u0437")) {
      conditions.push({ type: "cirrhosis", value: "without" });
    } else if (containsNormalizedPhrase(normalized, "\u043F\u0440\u0438 \u0446\u0438\u0440\u0440\u043E\u0437") || containsNormalizedPhrase(normalized, "\u0441 \u0446\u0438\u0440\u0440\u043E\u0437")) {
      conditions.push({ type: "cirrhosis", value: "with" });
    }
    return conditions;
  }
  function markerConditionsMatch(local, conditions) {
    for (const condition of conditions) {
      if (condition.type === "hbeag") {
        const nearestStatus = nearestCueName(local, [
          ["negative", ["\u043E\u0442\u0440\u0438\u0446"]],
          ["positive", ["\u043F\u043E\u043B\u043E\u0436"]]
        ]);
        if (!containsNormalizedPhrase(local, "hbeag") || nearestStatus !== condition.value) return false;
      } else if (condition.type === "cirrhosis") {
        if (condition.value === "without") {
          if (!containsNormalizedPhrase(local, "\u0431\u0435\u0437 \u0446\u0438\u0440\u0440\u043E\u0437")) return false;
        } else if (!containsNormalizedPhrase(local, "\u0446\u0438\u0440\u0440\u043E\u0437") || containsNormalizedPhrase(local, "\u0431\u0435\u0437 \u0446\u0438\u0440\u0440\u043E\u0437")) {
          return false;
        }
      }
    }
    return true;
  }
  function conditionedNumberPhrases(answerText) {
    const phrases = /* @__PURE__ */ new Set();
    for (const number of extractNumbers(answerText)) {
      phrases.add(number);
      for (const expanded of expandNumberToken(number)) phrases.add(expanded);
      const withoutPercent = String(number).replace("%", "");
      if (withoutPercent) phrases.add(withoutPercent);
    }
    for (const phrase of frequencySearchPhrases(answerText)) phrases.add(phrase);
    return [...phrases].map((phrase) => normalizeForSearch(phrase)).filter((phrase) => phrase.length >= 1).slice(0, 18);
  }
  function exactNumericForms(text) {
    const forms = /* @__PURE__ */ new Set();
    for (const number of extractNumbers(text)) {
      const normalized = normalizeForSearch(number);
      if (!normalized) continue;
      forms.add(normalized);
      forms.add(normalized.replace(/\.0+$/u, ""));
      if (normalized.includes(".")) forms.add(normalized.replace(/0+$/u, "").replace(/\.$/u, ""));
    }
    return [...forms].filter(Boolean);
  }
  function numericSearchBoundary(normalizedText, hit, length) {
    const before = hit > 0 ? normalizedText[hit - 1] : "";
    const after = hit + length < normalizedText.length ? normalizedText[hit + length] : "";
    const beforeBefore = hit > 1 ? normalizedText[hit - 2] : "";
    const afterAfter = hit + length + 1 < normalizedText.length ? normalizedText[hit + length + 1] : "";
    const tokenChar = /[a-zа-я0-9%.+/]/iu;
    if (before && tokenChar.test(before)) return false;
    if (after && tokenChar.test(after)) return false;
    if (before === "-" && /\d/u.test(beforeBefore)) return false;
    if (after === "-" && /\d/u.test(afterAfter)) return false;
    return true;
  }
  function findNumericFormHits(normalizedText, form) {
    const hits = [];
    if (!form) return hits;
    let start = 0;
    while (start < normalizedText.length) {
      const index = normalizedText.indexOf(form, start);
      if (index < 0) break;
      if (numericSearchBoundary(normalizedText, index, form.length)) hits.push({ index, length: form.length });
      start = index + Math.max(1, form.length);
      if (hits.length > 80) break;
    }
    return hits;
  }
  function sourceConditionHits(normalizedText, anchor) {
    if (anchor.pattern) {
      const hits2 = [];
      for (const match of normalizedText.matchAll(anchor.pattern)) {
        hits2.push({ index: match.index ?? 0, length: match[0].length });
        if (hits2.length > 80) break;
      }
      return hits2;
    }
    const hits = [];
    for (const phrase of anchor.phrases ?? []) {
      let start = 0;
      while (start < normalizedText.length) {
        const index = normalizedText.indexOf(phrase, start);
        if (index < 0) break;
        if (hasSearchBoundaries(normalizedText, index, phrase.length)) hits.push({ index, length: phrase.length });
        start = index + Math.max(1, phrase.length);
        if (hits.length > 80) break;
      }
    }
    return hits;
  }
  function nextConditionHit(normalizedText, anchor, start) {
    if (!anchor.nextPattern) return -1;
    anchor.nextPattern.lastIndex = start;
    const match = anchor.nextPattern.exec(normalizedText);
    anchor.nextPattern.lastIndex = 0;
    return match?.index ?? -1;
  }
  function interveningNumberCount(normalizedText) {
    return extractNumbers(normalizedText).length;
  }
  function numericConditionDirectionOk(normalizedText, conditionHit, answerHit, anchor) {
    const conditionEnd = conditionHit.index + conditionHit.length;
    const answerEnd = answerHit.index + answerHit.length;
    if (anchor.direction === "before") {
      if (answerHit.index < conditionEnd) return false;
      if (answerHit.index - conditionEnd > anchor.after) return false;
      const next = nextConditionHit(normalizedText, anchor, conditionEnd + 1);
      if (next >= 0 && answerHit.index >= next) return false;
      if (interveningNumberCount(normalizedText.slice(conditionEnd, answerHit.index)) > 0) return false;
      return true;
    }
    if (answerEnd > conditionHit.index) return false;
    if (conditionHit.index - answerEnd > anchor.before) return false;
    if (interveningNumberCount(normalizedText.slice(answerEnd, conditionHit.index)) > 0) return false;
    return true;
  }
  function numericConditionAnchorSatisfied(local, anchor) {
    if (!anchor.phrases?.length || !anchor.minPhraseHits) return true;
    let hits = 0;
    for (const phrase of anchor.phrases) {
      if (local.includes(phrase)) hits += 1;
    }
    return hits >= anchor.minPhraseHits;
  }
  function questionNumericConditionAnchors(question) {
    const raw = normalizeText(question);
    const normalized = normalizeForSearch(question);
    const anchors = [];
    const weekCue = normalizeForSearch("\u043D\u0435\u0434\u0435\u043B");
    const kgCue = normalizeForSearch("\u043A\u0433");
    const weekMatch = normalized.match(new RegExp(`(?:^|\\s)(\\d{1,2})(?:\\s*-?\\s*[a-z\u0430-\u044F]{1,2})?\\s+${escapeRegExp(weekCue)}`, "iu"));
    if (weekMatch?.[1]) {
      const number = weekMatch[1];
      anchors.push({
        kind: "week_number",
        direction: "before",
        after: 170,
        before: 10,
        base: 58,
        pattern: new RegExp(`(?:^|\\s)${escapeRegExp(number)}(?:\\s*-?\\s*[a-z\u0430-\u044F]{1,2})?\\s+${escapeRegExp(weekCue)}`, "giu"),
        nextPattern: new RegExp(`(?:^|\\s)\\d{1,2}(?:\\s*-?\\s*[a-z\u0430-\u044F]{1,2})?\\s+${escapeRegExp(weekCue)}`, "giu")
      });
    }
    for (const number of extractNumbers(question)) {
      const normalizedNumber = normalizeForSearch(number);
      if (!normalizedNumber.includes("-")) continue;
      const hits = findNumericFormHits(normalized, normalizedNumber);
      const hasKg = hits.some((hit) => normalized.slice(hit.index, Math.min(normalized.length, hit.index + 48)).includes(kgCue));
      if (!hasKg && !containsNormalizedPhrase(normalized, "\u043C\u0430\u0441\u0441\u0430") && !containsNormalizedPhrase(normalized, "\u0432\u0435\u0441")) continue;
      anchors.push({
        kind: "weight_range",
        direction: "before",
        after: 90,
        before: 8,
        base: 60,
        pattern: new RegExp(`(?:^|\\s)${escapeRegExp(normalizedNumber)}\\s*${escapeRegExp(kgCue)}`, "giu"),
        nextPattern: new RegExp(`(?:^|\\s)\\d+(?:-\\d+)?\\s*${escapeRegExp(kgCue)}`, "giu")
      });
    }
    if (containsNormalizedPhrase(normalized, "\u0444\u0430\u0437")) {
      if (containsNormalizedPhrase(normalized, "\u0445\u0440\u043E\u043D\u0438\u0447")) {
        anchors.push({
          kind: "phase_abbreviation",
          direction: "after",
          after: 18,
          before: 95,
          base: 59,
          phrases: [normalizeForSearch("\u0445\u0444")],
          minPhraseHits: 1
        });
      }
      const phasePhrases = [];
      if (containsNormalizedPhrase(normalized, "\u0430\u043A\u0441\u0435\u043B\u0435\u0440\u0430\u0446")) phasePhrases.push(normalizeForSearch("\u0444\u0430"));
      if (containsNormalizedPhrase(normalized, "\u0431\u043B\u0430\u0441\u0442")) phasePhrases.push(normalizeForSearch("\u0431\u043A"));
      if (phasePhrases.length) {
        anchors.push({
          kind: "phase_abbreviation",
          direction: "after",
          after: 24,
          before: 105,
          base: 59,
          phrases: phasePhrases,
          minPhraseHits: 1
        });
      }
    }
    return anchors;
  }
  function numericConditionSources(pages, topQuestionPages) {
    const sources = [];
    for (const page of pages) {
      const topPage = topQuestionPages?.has(page.page);
      const adjacentTopPage = topQuestionPages?.has(page.page - 1) || topQuestionPages?.has(page.page + 1);
      if (topQuestionPages?.size && !topPage && !adjacentTopPage) continue;
      for (const segment of cachedLineWindowSegments(page)) {
        sources.push({ page: page.page, text: segment.text, normalized: segment.normalized });
      }
    }
    return sources;
  }
  function bestNumericConditionSupport({ mode, pages, topQuestionPages, question, answer, answerTokens, focusTokens }) {
    if (mode !== "single") return null;
    const answerForms = exactNumericForms(answer.text);
    if (!answerForms.length) return null;
    const anchors = questionNumericConditionAnchors(question);
    if (!anchors.length) return null;
    const specificTokens = specificConditionNumberFocusTokens(focusTokens);
    let best = null;
    for (const source of numericConditionSources(pages, topQuestionPages)) {
      const sourceTokens = tokenizeNormalized(source.normalized);
      const focusHits = tokenHitCount(specificTokens, sourceTokens);
      for (const anchor of anchors) {
        const conditionHits = sourceConditionHits(source.normalized, anchor);
        if (!conditionHits.length) continue;
        for (const answerForm of answerForms) {
          const answerHits = findNumericFormHits(source.normalized, answerForm);
          for (const conditionHit of conditionHits) {
            for (const answerHit of answerHits) {
              if (!numericConditionDirectionOk(source.normalized, conditionHit, answerHit, anchor)) continue;
              const localStart = Math.max(0, Math.min(conditionHit.index, answerHit.index) - 32);
              const localEnd = Math.min(source.normalized.length, Math.max(conditionHit.index + conditionHit.length, answerHit.index + answerHit.length) + 56);
              const local = source.normalized.slice(localStart, localEnd);
              if (!numericConditionAnchorSatisfied(local, anchor)) continue;
              const score = anchor.base + numberCoverage(answer.text, local) * 5.4 + strictSoftCoverage(answerTokens, tokenizeNormalized(local)) * 1.6 + Math.min(3, focusHits) * 0.55;
              best = betterEvidence(best, {
                answerId: answer.id,
                page: source.page,
                text: source.text,
                score,
                kind: `numeric_condition_${anchor.kind}`
              });
            }
          }
        }
      }
    }
    return best;
  }
  function bestConditionedNumberSupport({ mode, pages, topQuestionPages, question, answer, answerTokens, focusTokens }) {
    if (mode !== "single") return null;
    if (!extractNumbers(answer.text).length && !frequencyAnswer(answer.text)) return null;
    const conditions = questionMarkerConditions(question);
    if (!conditions.length) return null;
    const phrases = conditionedNumberPhrases(answer.text);
    if (!phrases.length) return null;
    const specificTokens = specificConditionNumberFocusTokens(focusTokens);
    let best = null;
    for (const page of pages) {
      if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
      for (const phrase of phrases) {
        let start = 0;
        while (start < page.normalized.length) {
          const hit = page.normalized.indexOf(phrase, start);
          if (hit < 0) break;
          const numericRangeStart = /^\d+(?:\.\d+)?%?$/.test(phrase) && page.normalized[hit + phrase.length] === "-";
          if (phrase.length > 1 && !hasSearchBoundaries(page.normalized, hit, phrase.length) && !numericRangeStart) {
            start = hit + Math.max(1, phrase.length);
            continue;
          }
          if (page.normalized.slice(Math.max(0, hit - 3), hit).includes("-")) {
            start = hit + Math.max(1, phrase.length);
            continue;
          }
          const local = page.normalized.slice(Math.max(0, hit - 180), Math.min(page.normalized.length, hit + phrase.length + 190));
          if (!markerConditionsMatch(local, conditions)) {
            start = hit + Math.max(1, phrase.length);
            continue;
          }
          const localTokens = tokenizeNormalized(local);
          const focusHits = tokenHitCount(specificTokens, localTokens);
          const score = 15 + strictSoftCoverage(answerTokens, localTokens) * 2.6 + numberCoverage(answer.text, local) * 3.2 + Math.min(3, focusHits) * 0.9;
          best = betterEvidence(best, {
            answerId: answer.id,
            page: page.page,
            text: evidenceSnippet(page.text, phrase, question),
            score,
            kind: "conditioned_number_segment"
          });
          start = hit + Math.max(1, phrase.length);
        }
      }
    }
    return best;
  }
  var COUNT_NUMBER_WORDS = new Map(
    Object.entries({
      "1": ["\u043E\u0434\u0438\u043D", "\u043E\u0434\u043D"],
      "2": ["\u0434\u0432\u0430", "\u0434\u0432\u0435", "\u0434\u0432\u0443"],
      "3": ["\u0442\u0440\u0438", "\u0442\u0440\u0435"],
      "4": ["\u0447\u0435\u0442\u044B\u0440"],
      "5": ["\u043F\u044F\u0442"],
      "6": ["\u0448\u0435\u0441\u0442"],
      "7": ["\u0441\u0435\u043C"],
      "8": ["\u0432\u043E\u0441\u0435\u043C"],
      "9": ["\u0434\u0435\u0432\u044F\u0442"],
      "10": ["\u0434\u0435\u0441\u044F\u0442"],
      "11": ["\u043E\u0434\u0438\u043D\u043D\u0430\u0434\u0446\u0430\u0442"],
      "12": ["\u0434\u0432\u0435\u043D\u0430\u0434\u0446\u0430\u0442"]
    }).map(([number, words]) => [number, words.map((word) => normalizeForSearch(word))])
  );
  var COUNT_QUESTION_CUES = ["\u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432", "\u0447\u0438\u0441\u043B\u043E", "\u0441\u043A\u043E\u043B\u044C\u043A"].map((item) => normalizeForSearch(item));
  var COUNT_LOCAL_CUES = [
    "\u0441\u043E\u0441\u0442\u0430\u0432\u043B",
    "\u0432\u044B\u0434\u0435\u043B\u044F",
    "\u0432\u044B\u0437\u0432\u0430\u043D",
    "\u043A\u043E\u0434\u0438\u0440",
    "\u0432\u043A\u043B\u044E\u0447",
    "\u0431\u043E\u043B\u044C\u0448\u0438\u043D\u0441\u0442\u0432",
    "\u0441\u0440\u0435\u0434\u0438 \u043A\u043E\u0442\u043E\u0440",
    "\u0440\u0430\u0437\u043B\u0438\u0447\u043D",
    "\u043F\u043E\u0434\u0440\u0430\u0437\u0434\u0435\u043B"
  ].map((item) => normalizeForSearch(item));
  var COUNT_GENERIC_TOKENS = new Set(
    [
      "\u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E",
      "\u0441\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442",
      "\u0447\u0438\u0441\u043B\u043E",
      "\u0441\u043A\u043E\u043B\u044C\u043A\u043E",
      "\u0432\u044B\u0434\u0435\u043B\u044F\u044E\u0442",
      "\u043D\u0430\u0441\u0442\u043E\u044F\u0449\u0435\u0435",
      "\u0432\u0440\u0435\u043C\u044F"
    ].flatMap((item) => uniqueTokens(item))
  );
  function countQuestion(question) {
    const normalized = normalizeForSearch(question);
    return COUNT_QUESTION_CUES.some((cue) => normalized.includes(cue));
  }
  function countFocusTokens(question) {
    return uniqueTokens(question).filter((token) => token.length >= 3 && !FOCUS_STOPWORDS.has(token) && !COUNT_GENERIC_TOKENS.has(token) && !/^\d/.test(token));
  }
  function countNumberSearchPhrases(answerText) {
    const phrases = /* @__PURE__ */ new Set();
    for (const number of extractNumbers(answerText)) {
      for (const expanded of expandNumberToken(number)) {
        const clean = String(expanded).replace("%", "");
        if (!clean || !/^\d+$/.test(clean)) continue;
        phrases.add(clean);
        for (const word of COUNT_NUMBER_WORDS.get(clean) ?? []) phrases.add(word);
      }
    }
    return [...phrases].filter(Boolean);
  }
  function countCueHit(local) {
    return COUNT_LOCAL_CUES.some((cue) => local.includes(cue));
  }
  function positiveStructuralHit(local) {
    const cue = normalizeForSearch("\u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440");
    for (let index = local.indexOf(cue); index >= 0; index = local.indexOf(cue, index + cue.length)) {
      const before = local.slice(Math.max(0, index - 4), index);
      if (!before.includes(normalizeForSearch("\u043D\u0435"))) return true;
    }
    return false;
  }
  function countTargetNear(normalizedPage, hit, phraseLength, question) {
    const questionNorm = normalizeForSearch(question);
    const local = normalizedPage.slice(Math.max(0, hit - 25), Math.min(normalizedPage.length, hit + phraseLength + 55));
    const after = normalizedPage.slice(hit + phraseLength, Math.min(normalizedPage.length, hit + phraseLength + 58));
    if (containsNormalizedPhrase(questionNorm, "\u0433\u0435\u043D\u043E\u0442\u0438\u043F")) {
      return containsNormalizedPhrase(after, "\u0433\u0435\u043D\u043E\u0442\u0438\u043F");
    }
    if (containsNormalizedPhrase(questionNorm, "\u043D\u0435\u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440")) {
      return containsNormalizedPhrase(after, "\u043D\u0435\u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440");
    }
    if (containsNormalizedPhrase(questionNorm, "\u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440") && containsNormalizedPhrase(questionNorm, "\u0431\u0435\u043B\u043A")) {
      return positiveStructuralHit(after);
    }
    if (containsNormalizedPhrase(questionNorm, "\u0441\u0435\u0440\u043E\u0433\u0440\u0443\u043F")) {
      return containsNormalizedPhrase(after, "\u0441\u0435\u0440\u043E\u0433\u0440\u0443\u043F");
    }
    return true;
  }
  function bestCountRelationSupport({ mode, pages, topQuestionPages, question, answer, answerTokens }) {
    if (mode !== "single" || !countQuestion(question)) return null;
    if (!extractNumbers(answer.text).length) return null;
    const phrases = countNumberSearchPhrases(answer.text);
    if (!phrases.length) return null;
    const focusTokens = countFocusTokens(question);
    if (focusTokens.length < 2) return null;
    let best = null;
    for (const page of pages) {
      if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
      for (const phrase of phrases) {
        let start = 0;
        while (start < page.normalized.length) {
          const hit = page.normalized.indexOf(phrase, start);
          if (hit < 0) break;
          if (/^\d+$/.test(phrase)) {
            const before = hit > 0 ? page.normalized[hit - 1] : "";
            const after = page.normalized[hit + phrase.length] ?? "";
            if (/[0-9]/.test(before) || /[0-9]/.test(after)) {
              start = hit + Math.max(1, phrase.length);
              continue;
            }
            const nearBefore = page.normalized.slice(Math.max(0, hit - 3), hit);
            const nearAfter = page.normalized.slice(hit + phrase.length, hit + phrase.length + 3);
            if (nearBefore.includes("[") || nearAfter.includes("]")) {
              start = hit + Math.max(1, phrase.length);
              continue;
            }
          }
          if (!countTargetNear(page.normalized, hit, phrase.length, question)) {
            start = hit + Math.max(1, phrase.length);
            continue;
          }
          const local = page.normalized.slice(Math.max(0, hit - 210), Math.min(page.normalized.length, hit + phrase.length + 230));
          const localTokens = tokenizeNormalized(local);
          const focusCoverage = strictSoftCoverage(focusTokens, localTokens);
          if (focusCoverage < 0.34 || !countCueHit(local)) {
            start = hit + Math.max(1, phrase.length);
            continue;
          }
          const score = 14.2 + focusCoverage * 6.2 + strictSoftCoverage(answerTokens, localTokens) * 1.2 + numberCoverage(answer.text, local) * 2.6;
          best = betterEvidence(best, {
            answerId: answer.id,
            page: page.page,
            text: evidenceSnippet(page.text, phrase, question),
            score,
            kind: "count_relation_segment"
          });
          start = hit + Math.max(1, phrase.length);
        }
      }
    }
    return best;
  }
  function questionAgeFormCues(question) {
    const normalized = normalizeForSearch(question);
    if (!containsNormalizedPhrase(normalized, "\u0432\u043E\u0437\u0440\u0430\u0441\u0442") || !containsNormalizedPhrase(normalized, "\u0444\u043E\u0440\u043C")) return null;
    if (containsNormalizedPhrase(normalized, "\u043F\u043E\u0434\u0440\u043E\u0441\u0442") || containsNormalizedPhrase(normalized, "\u0432\u0437\u0440\u043E\u0441\u043B")) {
      return ["\u043F\u043E\u0434\u0440\u043E\u0441\u0442", "\u0432\u0437\u0440\u043E\u0441\u043B"].map((item) => normalizeForSearch(item));
    }
    if (containsNormalizedPhrase(normalized, "\u043F\u043E\u0437\u0434") && containsNormalizedPhrase(normalized, "\u043C\u043B\u0430\u0434\u0435\u043D")) {
      return ["\u043F\u043E\u0437\u0434", "\u043C\u043B\u0430\u0434\u0435\u043D"].map((item) => normalizeForSearch(item));
    }
    if (containsNormalizedPhrase(normalized, "\u0440\u0430\u043D") && containsNormalizedPhrase(normalized, "\u043C\u043B\u0430\u0434\u0435\u043D")) {
      return ["\u0440\u0430\u043D", "\u043C\u043B\u0430\u0434\u0435\u043D"].map((item) => normalizeForSearch(item));
    }
    if (containsNormalizedPhrase(normalized, "\u044E\u0432\u0435\u043D")) {
      return ["\u044E\u0432\u0435\u043D"].map((item) => normalizeForSearch(item));
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
        const candidate = before >= 0 && Math.abs(before - index) <= 42 ? before : after >= 0 && Math.abs(after - index) <= 42 ? after : -1;
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
  var AGE_FORM_BOUNDARY_CUES = [
    "\u043F\u0435\u0440\u0438\u043D\u0430\u0442",
    "\u0440\u0430\u043D",
    "\u043F\u043E\u0437\u0434",
    "\u044E\u0432\u0435\u043D",
    "\u043F\u043E\u0434\u0440\u043E\u0441\u0442",
    "\u0432\u0437\u0440\u043E\u0441\u043B"
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
    const startsWithDo = normalizedAnswer.startsWith(normalizeForSearch("\u0434\u043E "));
    const lessAnswer = answerText.includes("<") || startsWithDo || containsNormalizedPhrase(normalizedAnswer, "\u043C\u0435\u043D\u0435\u0435") || containsNormalizedPhrase(normalizedAnswer, "\u043C\u0435\u043D\u044C\u0448\u0435") || containsNormalizedPhrase(normalizedAnswer, "\u043C\u043E\u043B\u043E\u0436\u0435");
    if (lessAnswer) {
      return ![
        "\u0434\u043E",
        "\u043C\u0435\u043D\u0435\u0435",
        "\u043C\u0435\u043D\u044C\u0448\u0435",
        "\u043C\u043E\u043B\u043E\u0436\u0435",
        "\u043D\u0438\u0436\u0435"
      ].some((cue) => containsNormalizedPhrase(window, `${cue} ${firstNumber}`));
    }
    const greaterAnswer = answerText.includes(">") || containsNormalizedPhrase(normalizedAnswer, "\u0441\u0442\u0430\u0440\u0448\u0435") || containsNormalizedPhrase(normalizedAnswer, "\u0431\u043E\u043B\u0435\u0435") || containsNormalizedPhrase(normalizedAnswer, "\u0432\u044B\u0448\u0435");
    if (greaterAnswer) {
      return ![
        "\u0441\u0442\u0430\u0440\u0448\u0435",
        "\u0431\u043E\u043B\u0435\u0435",
        "\u0432\u044B\u0448\u0435",
        "\u043F\u043E\u0441\u043B\u0435"
      ].some((cue) => containsNormalizedPhrase(window, `${cue} ${firstNumber}`));
    }
    return false;
  }
  function ageAnswerSupport(window, answer, answerTokens) {
    if (answerComparatorMismatch(answer.text, window)) return null;
    const phraseHit = answerSearchPhrases(answer.text).map((phrase) => normalizeForSearch(phrase)).filter((phrase) => phrase.length >= 2).some((phrase) => containsNormalizedPhrase(window, phrase));
    const tokens = answerTokens.filter((token) => token.length >= 2);
    const tokenCoverage = tokens.length ? strictSoftCoverage(tokens, tokenizeNormalized(window)) : 0;
    const numberHit = numberCoverage(answer.text, window);
    if (!phraseHit && tokenCoverage < 0.7 && numberHit < 0.9) return null;
    return { phraseHit, tokenCoverage, numberHit };
  }
  function bestAgeFormSupport({ mode, pages, question, answer, answerTokens }) {
    if (mode !== "single") return null;
    const cues = questionAgeFormCues(question);
    if (!cues) return null;
    const normalizedAnswer = normalizeForSearch(answer.text);
    if (!extractNumbers(answer.text).length && !containsNormalizedPhrase(normalizedAnswer, "\u0441\u0442\u0430\u0440\u0448") && !containsNormalizedPhrase(normalizedAnswer, "\u043C\u043E\u043B\u043E\u0436")) return null;
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
        const score = 15.4 + support.numberHit * 3.8 + support.tokenCoverage * 2.4 + (support.phraseHit ? 2 : 0);
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text,
          score,
          kind: "age_form_segment"
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
  function romanStageVariants(stage) {
    const romanMap = /* @__PURE__ */ new Map([
      ["1", "i"],
      ["2", "ii"],
      ["3", "iii"],
      ["4", "iv"],
      ["5", "v"],
      ["6", "vi"]
    ]);
    const reverse = new Map([...romanMap.entries()].map(([number, roman]) => [roman, number]));
    const variants = /* @__PURE__ */ new Set([stage]);
    if (romanMap.has(stage)) variants.add(romanMap.get(stage));
    if (reverse.has(stage)) variants.add(reverse.get(stage));
    return [...variants].map((item) => normalizeForSearch(item));
  }
  function nextRomanStageRowIndex(normalized, start) {
    const pattern = /(?:^|\s)(?:[ivx]{1,5}|\d{1,2})(?:\s|$)/giu;
    pattern.lastIndex = start;
    const match = pattern.exec(normalized);
    return match?.index ?? -1;
  }
  function romanStageWindow(normalized, stage) {
    const stageCue = normalizeForSearch("\u0441\u0442\u0430\u0434\u0438\u044F");
    for (const variant of romanStageVariants(stage)) {
      const cues = [normalizeForSearch(`\u0441\u0442\u0430\u0434\u0438\u044F ${variant}`), normalizeForSearch(`${variant} \u0441\u0442\u0430\u0434\u0438\u044F`)];
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
  function bestRomanStageSupport({ mode, pages, question, answer, answerTokens }) {
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
        const score = 12.8 + (phraseHit ? 2.4 : 0) + answerCoverage * 4 + numberCoverage(answer.text, window) * 0.8;
        best = betterEvidence(best, {
          answerId: answer.id,
          page: page.page,
          text: source.text,
          score,
          kind: "roman_stage_segment"
        });
      }
    }
    return best;
  }
  function answerOrdinalLabel(answerText) {
    const normalized = normalizeForSearch(answerText);
    const kinds = [
      { kind: "stage", cue: normalizeForSearch("\u0441\u0442\u0430\u0434\u0438") },
      { kind: "degree", cue: normalizeForSearch("\u0441\u0442\u0435\u043F\u0435\u043D") }
    ];
    const kind = kinds.find((item) => normalized.includes(item.cue));
    if (!kind) return null;
    const values = /* @__PURE__ */ new Set();
    for (const match of normalized.matchAll(/(?:^|\s)(\d{1,2}|[ivx]{1,7})(?:\s|$)/giu)) {
      const number = ordinalValueToNumber(match[1]);
      if (number && number > 0 && number <= 10) values.add(number);
    }
    if (values.size !== 1) return null;
    return { kind: kind.kind, cue: kind.cue, number: [...values][0] };
  }
  function ordinalKindCue(kind) {
    if (kind === "stage") return normalizeForSearch("\u0441\u0442\u0430\u0434\u0438");
    if (kind === "degree") return normalizeForSearch("\u0441\u0442\u0435\u043F\u0435\u043D");
    return normalizeForSearch("\u043A\u043B\u0430\u0441\u0441");
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
        const before = normalized.slice(Math.max(0, index - 180), index);
        const after = normalized.slice(index, Math.min(normalized.length, index + 90));
        if (!before.includes(cue) && !after.includes(cue)) continue;
        if (best < 0 || index < best) best = index;
      }
    }
    return best;
  }
  function answerOrdinalRowWindows(source, label) {
    const normalized = source.normalized;
    const cue = ordinalKindCue(label.kind);
    const windows = [];
    for (const variant of romanStageVariants(String(label.number))) {
      if (normalized.includes(cue)) {
        const directPatterns = [
          new RegExp(`(?:^|\\s)${escapeRegExp(variant)}(?:\\s*-?\\s*\\S{0,3})?\\s+${escapeRegExp(cue)}`, "giu"),
          new RegExp(`${escapeRegExp(cue)}\\s+(?:\\S+\\s+){0,2}${escapeRegExp(variant)}(?:\\s|$)`, "giu")
        ];
        for (const pattern of directPatterns) {
          for (const match of normalized.matchAll(pattern)) {
            const index = match.index ?? 0;
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
          const before = normalized.slice(Math.max(0, index - 220), index);
          const after = normalized.slice(index, Math.min(normalized.length, index + 100));
          if (!before.includes(cue) && !after.includes(cue)) {
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
    const cue = ordinalKindCue(label.kind);
    if (!normalized.includes(cue)) return false;
    const number = label.number;
    const digitPatterns = [
      /(?:^|\s)(\d{1,2})\s*-\s*(\d{1,2})(?:\s|$)/giu,
      /(?:^|\s)(\d{1,2})\s*\/\s*(\d{1,2})(?:\s|$)/giu
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
  var ANSWER_ORDINAL_GENERIC_FOCUS = new Set(
    [
      "\u0441\u043E\u0433\u043B\u0430\u0441\u043D\u043E",
      "\u043A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F",
      "\u043A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438",
      "\u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u043D\u043E",
      "\u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u043D\u044B",
      "\u0441\u0442\u0430\u0434\u0438\u044F",
      "\u0441\u0442\u0430\u0434\u0438\u0438",
      "\u0441\u0442\u0435\u043F\u0435\u043D\u044C",
      "\u0441\u0442\u0435\u043F\u0435\u043D\u0438",
      "\u043A\u043B\u0430\u0441\u0441",
      "\u043A\u043B\u0430\u0441\u0441\u0430"
    ].flatMap((item) => uniqueTokens(item))
  );
  function specificAnswerOrdinalFocusTokens(focusTokens, answerTokens) {
    const answerSet = new Set(answerTokens ?? []);
    return (focusTokens ?? []).filter(
      (token) => token.length >= 4 && !/^\d/.test(token) && !answerSet.has(token) && !ANSWER_ORDINAL_GENERIC_FOCUS.has(token)
    );
  }
  function orderedFocusPairHits(focusTokens, documentTokens) {
    if ((focusTokens?.length ?? 0) < 2 || !documentTokens?.length) return 0;
    const seen = /* @__PURE__ */ new Set();
    let hits = 0;
    for (let index = 0; index < focusTokens.length - 1; index += 1) {
      const left = focusTokens[index];
      const right = focusTokens[index + 1];
      if (!left || !right || left === right) continue;
      const key = `${left}\0${right}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (tokenSequenceIncludes(documentTokens, [left, right])) hits += 1;
    }
    return hits;
  }
  function bestAnswerOrdinalRowSupport({ mode, pages, topQuestionPages, answer, answerTokens, focusTokens }) {
    const label = answerOrdinalLabel(answer.text);
    if (!label) return null;
    const specificTokens = specificAnswerOrdinalFocusTokens(focusTokens, answerTokens);
    if (specificTokens.length < 2) return null;
    let best = null;
    for (const page of pages) {
      const nearTopPage = !topQuestionPages?.size || topQuestionPages.has(page.page) || topQuestionPages.has(page.page - 1) || topQuestionPages.has(page.page + 1);
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
          const score = 13.4 + Math.min(5, focusHits) * 1.45 + Math.min(0.7, focusCoverage) * 5.4 + Math.min(4, pairHits) * 1.8 + answerCoverage * 2.2 + (ordinalRangeIncludesValue(window, label) ? 1 : 0);
          best = betterEvidence(best, {
            answerId: answer.id,
            page: page.page,
            text: source.text,
            score,
            kind: "answer_ordinal_row"
          });
        }
      }
    }
    return best;
  }
  function scoreAnswer(context) {
    const anchor = bestAnchorSupport(context);
    const section = bestSectionSupport(context);
    const rowLabel = bestRowLabelSupport(context);
    const focused = bestFocusedSupport(context);
    const lineToken = lineTokenApplicable(context) ? bestLineTokenSupport(context) : null;
    const prefix = bestPrefixSupport(context);
    const phrase = bestPhraseSupport(context);
    const chunk = bestChunkSupport(context);
    const polarity = polarityAdjustment(context);
    const temporal = temporalCueAdjustment(context);
    const conditionPair = conditionPairAdjustment(context);
    const riskCondition = riskConditionAdjustment(context);
    const genericPopulation = genericPopulationConditionAdjustment(context);
    const classSubject = bestClassSubjectSupport(context);
    const frequency = bestFrequencyRecommendationSupport(context);
    const negativeLocal = { adjustment: 0, evidence: null };
    const boundedList = bestBoundedListSupport(context);
    const ordinalList = bestOrdinalListSupport(context);
    const typeOrdinal = bestTypeOrdinalSupport(context);
    const indicationLabel = bestIndicationSegmentSupport(context);
    const labelDefinition = bestLabelDefinitionSupport(context);
    const recommendationPolarity = recommendationPolarityAdjustment(context);
    const ageEligibility = ageEligibilityAdjustment(context);
    const drugDose = bestDrugDoseSupport(context);
    const termDefinition = bestTermDefinitionSupport(context);
    const negatedAnswerPrefix = negatedAnswerPrefixAdjustment(context);
    const impossibilityOnly = impossibilityOnlyAdjustment(context);
    const activeTherapyIndication = activeTherapyIndicationAdjustment(context);
    const recommendationItem = bestRecommendationItemSupport(context);
    const conditionedNumber = bestConditionedNumberSupport(context);
    const numericCondition = bestNumericConditionSupport(context);
    const countRelation = context.config?.countRelationBoost ? bestCountRelationSupport(context) : null;
    const ageForm = bestAgeFormSupport(context);
    const fibrosisStage = bestFibrosisStageSupport(context);
    const conditionNumber = null;
    const romanStage = bestRomanStageSupport(context);
    const answerOrdinalRow = bestAnswerOrdinalRowSupport(context);
    const clozeGap = bestClozeGapSupport(context);
    const visualTableColumn = bestVisualTableColumnSupport(context);
    const coordinateTableRow = bestCoordinateTableRowSupport(context);
    const latinFuzzy = bestLatinFuzzySupport(context);
    const labelNumber = bestLabelNumberSupport(context);
    const classificationCode = bestClassificationCodeSupport(context);
    const exactShortLabelRow = bestExactShortLabelRowSupport(context);
    const shortLabelRow = bestShortLabelRowSupport(context);
    const answerTokens = context.answerTokens;
    const numbers = extractNumbers(context.answer.text);
    const answerPhraseFound = phrase?.kind === "answer_window" || phrase?.kind === "answer_after_question" || phrase?.kind === "question_answer_phrase";
    const phraseWeight = phrase?.kind === "answer_window" ? 0.55 : phrase?.kind === "answer_directional_window" ? 0.95 : phrase ? 1.15 : 0;
    const focusedWeight = context.mode === "multi" ? 0.15 : 0.9;
    const lineTokenWeight = context.mode === "single" ? 0.85 : 0;
    const latinFuzzyWeight = context.mode === "multi" && polarity.evidence?.kind !== "polarity_mismatch" ? 1.15 : 0;
    let raw = (anchor?.score ?? 0) * 1.35 + (section?.score ?? 0) * 1.2 + (rowLabel?.score ?? 0) * 0.95 + (focused?.score ?? 0) * focusedWeight + (lineToken?.score ?? 0) * lineTokenWeight + (prefix?.score ?? 0) * 1.15 + (phrase?.score ?? 0) * phraseWeight + (chunk?.score ?? 0) * 1 + polarity.adjustment + (temporal.support?.score ?? 0) * 1 + temporal.adjustment + conditionPair.adjustment + riskCondition.adjustment + genericPopulation.adjustment + (classSubject?.score ?? 0) * 1.15 + (frequency?.score ?? 0) * 1.1 + negativeLocal.adjustment + (boundedList.support?.score ?? 0) * 1.15 + boundedList.adjustment + (ordinalList?.score ?? 0) * 1.15 + (typeOrdinal?.score ?? 0) * 1.15 + (indicationLabel?.score ?? 0) * 1.15 + (labelDefinition?.score ?? 0) * 1.15 + (recommendationPolarity.support?.score ?? 0) * 1.05 + recommendationPolarity.adjustment + ageEligibility.adjustment + (drugDose?.score ?? 0) * 1.15 + (termDefinition?.score ?? 0) * 1.15 + negatedAnswerPrefix.adjustment + impossibilityOnly.adjustment + activeTherapyIndication.adjustment + (recommendationItem?.score ?? 0) * 1.1 + (conditionedNumber?.score ?? 0) * 1.1 + (numericCondition?.score ?? 0) * 1.05 + (countRelation?.score ?? 0) * 1.1 + (ageForm?.score ?? 0) * 1.15 + (fibrosisStage?.score ?? 0) * 1.15 + (conditionNumber?.score ?? 0) * 1.15 + (romanStage?.score ?? 0) * 1.15 + (answerOrdinalRow?.score ?? 0) * 1.15 + (clozeGap?.score ?? 0) * 1.12 + (visualTableColumn?.score ?? 0) * 1.18 + (coordinateTableRow?.score ?? 0) * 1.12 + (latinFuzzy?.score ?? 0) * latinFuzzyWeight + (labelNumber?.score ?? 0) * 1.15 + (classificationCode?.score ?? 0) * 1.15 + (exactShortLabelRow?.score ?? 0) * 1.2 + (shortLabelRow?.score ?? 0) * 1.15 + (answerPhraseFound ? 0.35 : 0) + (numbers.length ? numberSpecificity(context.answer.text) * 0.35 : 0) + Math.min(0.35, answerTokens.length * 0.015);
    if (context.intent.listLike && context.anchorSegments?.length && !anchor) {
      raw *= 0.62;
    }
    if (context.intent.listLike && context.sectionSegments?.length && !section) {
      raw *= 0.72;
    }
    const evidence = [
      anchor,
      section,
      rowLabel,
      focused,
      lineToken,
      prefix,
      phrase,
      chunk,
      polarity.evidence,
      temporal.support,
      temporal.evidence,
      conditionPair.evidence,
      riskCondition.evidence,
      genericPopulation.evidence,
      classSubject,
      frequency,
      negativeLocal.evidence,
      boundedList.support,
      boundedList.evidence,
      ordinalList,
      typeOrdinal,
      indicationLabel,
      labelDefinition,
      recommendationPolarity.support,
      recommendationPolarity.evidence,
      ageEligibility.evidence,
      drugDose,
      termDefinition,
      negatedAnswerPrefix.evidence,
      impossibilityOnly.evidence,
      activeTherapyIndication.evidence,
      recommendationItem,
      conditionedNumber,
      numericCondition,
      countRelation,
      ageForm,
      fibrosisStage,
      conditionNumber,
      romanStage,
      answerOrdinalRow,
      clozeGap,
      visualTableColumn,
      coordinateTableRow,
      latinFuzzy,
      labelNumber,
      classificationCode,
      exactShortLabelRow,
      shortLabelRow
    ].filter(Boolean).sort((a, b) => b.score - a.score);
    return { raw, evidence };
  }
  async function predict(input, options = {}) {
    const config = { ...DEFAULT_CONFIG, ...options };
    const pdfInput = input.pdfData ?? input.pdfBuffer ?? input.pdf ?? input.file ?? input.blob ?? input.pdfUrl ?? input.url ?? input.pdfPath;
    if (!pdfInput) throw new Error("predict input requires pdfData, pdfUrl, file/blob, or pdfPath-compatible data");
    const mode = input.mode === "multi" ? "multi" : "single";
    const answers = normalizeAnswers(input.answers ?? input.variants ?? []);
    if (!answers.length) throw new Error("predict input requires answers");
    const runtime = await getPdfRuntime(pdfInput, {
      cacheKey: input.cacheKey ?? input.pdfPath ?? input.pdfUrl ?? input.url,
      pdfjsLib: options.pdfjsLib
    });
    const question = String(input.question ?? "");
    const questionTokens = uniqueTokens(question);
    const focusTokens = questionFocusTokens(question);
    const intent = detectQuestionIntent(question);
    const anchorSegments = findAnchorSegments(runtime.pdfText.pages, question);
    const sectionSegments = findSectionSegments(runtime.pdfText.pages, question);
    const topQuestionPages = new Set(runtime.index.search(questionTokens, { limit: 6 }).map((result) => result.chunk.page));
    const rowSegments = findRowSegments(runtime.pdfText.pages, question, topQuestionPages);
    const boundedListSegments = findBoundedListSegments(runtime.pdfText.pages, question, topQuestionPages, mode, intent);
    const visualTableColumnTargetsByPage = mode === "multi" && hasVisualTableColumnCue(question, focusTokens) ? buildVisualTableColumnTargetsByPage(runtime.pdfText.pages, question, focusTokens, topQuestionPages) : null;
    const coordinateTableRowsByPage = hasCoordinateTableCue(question, focusTokens) ? buildCoordinateTableRowsByPage(runtime.pdfText.pages, topQuestionPages) : null;
    let answerScores = answers.map((answer) => {
      const answerTokens = uniqueTokens(answer.text);
      const result = scoreAnswer({
        pages: runtime.pdfText.pages,
        chunks: runtime.chunks,
        index: runtime.index,
        config,
        mode,
        question,
        answer,
        questionTokens,
        topQuestionPages,
        focusTokens,
        answerTokens,
        intent,
        anchorSegments,
        sectionSegments,
        rowSegments,
        boundedListSegments,
        visualTableColumnTargetsByPage,
        coordinateTableRowsByPage
      });
      return {
        answer,
        raw: result.raw,
        evidence: result.evidence
      };
    });
    if (mode === "multi" && config.sharedMultiSegmentBoost) {
      answerScores = addSharedMultiSegmentSupport(answerScores, intent, question);
    }
    if (mode === "single" && questionDefinitionLabel(question) && answerScores.some((item) => item.evidence.some((evidenceItem) => evidenceItem.kind === "label_definition_segment"))) {
      answerScores = answerScores.map(
        (item) => item.evidence.some((evidenceItem) => evidenceItem.kind === "label_definition_segment") ? item : { ...item, raw: item.raw * 0.48 }
      );
    }
    if (mode === "multi" && answerScores.some((item) => item.evidence.some((evidenceItem) => evidenceItem.kind === "latin_fuzzy_ocr"))) {
      answerScores = answerScores.map((item) => {
        const hasLatin = latinAnswerTokens(item.answer.text).length > 0;
        const hasLatinSupport = item.evidence.some((evidenceItem) => evidenceItem.kind === "latin_fuzzy_ocr");
        return hasLatin && !hasLatinSupport ? { ...item, raw: item.raw * 0.68 } : item;
      });
    }
    answerScores = applyFrozenFeatureRanker(answerScores, mode, config, { question });
    const calibrated = calibrateScores(answerScores);
    const selected = selectAnswers(calibrated, mode, config);
    const selectedScores = selected.map((id) => calibrated.find((item) => item.answer.id === id)?.score ?? 0);
    const confidence = mode === "single" ? Math.max(...selectedScores, 0) : selectedScores.reduce((sum, score) => sum + score, 0) / (selectedScores.length || 1);
    const scores = Object.fromEntries(calibrated.map((item) => [item.answer.id, item.score]));
    const rawScores = Object.fromEntries(calibrated.map((item) => [item.answer.id, round4(item.raw)]));
    const evidence = calibrated.flatMap((item) => item.evidence.map((evidenceItem) => ({ ...evidenceItem, answerId: item.answer.id, score: round4(evidenceItem.score) }))).sort((a, b) => b.score - a.score).slice(0, config.evidenceLimit);
    return {
      selected,
      mode,
      confidence: round4(confidence),
      scores,
      rawScores,
      evidence,
      meta: {
        pageCount: runtime.pdfText.pageCount,
        chunks: runtime.chunks.length,
        ocrNeeded: runtime.pdfText.ocrNeeded,
        intent
      }
    };
  }
  function clearPredictorCache() {
    clearPdfRuntimeCache();
  }

  // src/index.ts
  async function answerQuestion(pdf, options = {}) {
    const variants = options.variants ?? options.answers ?? [];
    const answers = variants.map((item, index) => {
      if (typeof item === "string") {
        return { id: String.fromCharCode(65 + index), text: item };
      }
      return {
        id: String(item.id ?? String.fromCharCode(65 + index)),
        text: String(item.text ?? "")
      };
    });
    const output = await predict(
      {
        pdfData: pdf,
        cacheKey: options.cacheKey,
        question: options.question,
        answers,
        mode: options.type ?? options.mode ?? "single"
      },
      { pdfjsLib: options.pdfjsLib }
    );
    const selectedAnswers = output.selected.map((id) => answers.find((answer) => answer.id === id)).filter(Boolean);
    return {
      selected: selectedAnswers.map((answer) => answer.text),
      selectedIds: selectedAnswers.map((answer) => answer.id),
      mode: output.mode,
      confidence: output.confidence,
      scores: answers.map((answer) => ({
        id: answer.id,
        variant: answer.text,
        score: output.scores[answer.id] ?? 0,
        raw: output.rawScores[answer.id] ?? 0
      })),
      raw: output,
      evidence: output.evidence,
      meta: output.meta
    };
  }
  return __toCommonJS(browser_exports);
})();
