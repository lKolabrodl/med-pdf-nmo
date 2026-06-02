import { normalizeForSearch, normalizeText } from "./normalize.js";

let configuredPdfJs: any = null;

/**
 * Настраивает модуль PDF.js, который будет использовать runtime.
 *
 * В браузере это удобно вызывать, когда PDF.js загружен с CDN или через
 * собственный bundler. В Node.js обычно достаточно пакетного импорта.
 *
 * @param pdfjsLib Объект модуля с методом `getDocument`.
 */
export function setPdfJsLib(pdfjsLib: any) {
  configuredPdfJs = pdfjsLib;
}

async function resolvePdfJs(options: any = {}) {
  if (options.pdfjsLib?.getDocument) return options.pdfjsLib;
  if (configuredPdfJs?.getDocument) return configuredPdfJs;

  const fromGlobal = (globalThis as any).pdfjsLib ?? (globalThis as any).PDFJS;
  if (fromGlobal?.getDocument) return fromGlobal;

  try {
    return await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch {
    throw new Error(
      "PDF.js is not available. In the browser, include pdf.js before this library or call setPdfJsLib(pdfjsLib).",
    );
  }
}

function pdfVerbosity(pdfjs: any, options: any = {}) {
  if (typeof options.pdfVerbosity === "number") return options.pdfVerbosity;
  return pdfjs.VerbosityLevel?.ERRORS ?? 0;
}

async function toUint8Array(input: any): Promise<Uint8Array> {
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

function lineKey(item: any) {
  const [, , , , , y] = item.transform ?? [1, 0, 0, 1, 0, 0];
  return Math.round(y / 3) * 3;
}

function itemX(item: any) {
  return item.transform?.[4] ?? 0;
}

function itemY(item: any) {
  return item.transform?.[5] ?? 0;
}

function groupItemsIntoLineObjects(items: any[]) {
  const useful = items
    .filter((item) => typeof item.str === "string" && item.str.trim())
    .sort((a, b) => itemY(b) - itemY(a) || itemX(a) - itemX(b));
  const groups: any[] = [];
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
  return groups
    .map((group) => {
      const sortedItems = group.items.sort((a: any, b: any) => itemX(a) - itemX(b));
      const text = sortedItems
        .map((item: any) => item.str.trim())
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      return {
        text,
        y: group.key,
        items: sortedItems.map((item: any) => ({
          text: item.str.trim(),
          x: itemX(item),
          y: itemY(item),
          width: item.width ?? 0,
          height: item.height ?? 0,
        })),
      };
    })
    .filter((line) => line.text);
}

/**
 * Убирает повторяющийся служебный текст PDF (running header/footer, ссылки),
 * который не несет содержательной информации для скоринга.
 *
 * Сопоставление идет с `normalizeText` (чистая кириллица в нижнем регистре),
 * а не с `normalizeForSearch`, потому что последняя сворачивает кириллические
 * lookalike-символы в латиницу. Правила нарочно общие и не привязаны к
 * конкретному документу: колонтитул "страница N из M", бегущий заголовок
 * "клинические рекомендации - <название> - <годы>" и строки-ссылки.
 */
function stripLikelyBoilerplate(lines: any[]) {
  return lines.filter((line) => {
    const text = typeof line === "string" ? line : line.text;
    if (!normalizeForSearch(text)) return false;
    const clean = normalizeText(text);
    if (/^страниц[аы]\s+\d+\s+из\s+\d+\b/.test(clean)) return false;
    if (/^[-\s]*\d{1,3}[-\s]*$/.test(clean)) return false;
    if (/(https?:\/\/|www\.|disuria\.ru)/.test(clean)) return false;
    return true;
  });
}

function buildPageText(lines: string[]) {
  const out: string[] = [];
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

const BIBLIO_HEADING = /^(список\s+литературы|литература|библиографи)/;
const BIBLIO_NEXT_SECTION = /^(приложение|критерии оценки качества|связанные документы)/;
const TOC_HEADING = /^(содержание|оглавление)\b/;
// Точечная выноска оглавления: "Диагностика ............ 12" или вариант с
// символом многоточия "Диагностика …………… 12". 4+ точек подряд или символ «…»
// в обычном тексте как выноска не встречаются. Одиночное «…» в прозе не опасно:
// удаление включается только для плотного блока таких строк в начале документа.
const TOC_LEADER = /\.(\s?\.){3,}|…/;
const ABBREVIATION_HEADING = /^(?:список\s+сокращ(?:ений|ения)?|перечень\s+сокращ(?:ений|ения)?|условные\s+сокращения)\b/iu;
const ABBREVIATION_STOP_HEADING =
  /^(?:термины(?:\s|$)|термины\s+и\s+определения(?:\s|$)|\d+(?:\.\d+)*\.?\s+|краткая\s+информация(?:\s|$)|список\s+литературы(?:\s|$)|приложение(?:\s|$)|клинические\s+рекомендации(?:\s|$))/iu;
const ATC_CODE_PARENTHETICAL = /\s*\((?:код\s+)?(?:атх|atc)\s*[:：]\s*[^)]{1,80}\)/giu;
const ABBREVIATION_PARENTHETICAL = /\s*\([^)]{1,160}\)/gu;
const ABBREVIATION_TRAILING_PARENTHETICAL = /\s*\([^)]*$/u;

/** Плоский индекс всех строк документа: {p: индекс страницы, l: индекс строки в странице}. */
function buildFlatLineIndex(pages: any[]) {
  const flat: Array<{ p: number; l: number }> = [];
  pages.forEach((page, p) => page.lines.forEach((_: string, l: number) => flat.push({ p, l })));
  return flat;
}

function rebuildPage(page: any) {
  const lines: string[] = [];
  const lineItems: any[] = [];
  for (let index = 0; index < page.lines.length; index += 1) {
    const line = String(page.lines[index] ?? "").trim();
    if (!normalizeForSearch(line)) continue;
    lines.push(line);
    lineItems.push(page.lineItems[index]);
  }
  page.lines = lines;
  page.lineItems = lineItems;
  page.text = buildPageText(page.lines);
  page.normalized = normalizeForSearch(page.text);
  page.charLength = page.text.length;
}

/**
 * Удаляет строки flat[start..end) со страниц и пересобирает text/normalized.
 * Каждый вызов должен получать свежий flat-индекс, потому что предыдущее
 * удаление меняет page.lines.
 */
function removeFlatLineSpan(pages: any[], flat: Array<{ p: number; l: number }>, start: number, end: number) {
  const removeByPage = new Map<number, Set<number>>();
  for (let i = start; i < end; i += 1) {
    const f = flat[i];
    if (!removeByPage.has(f.p)) removeByPage.set(f.p, new Set());
    removeByPage.get(f.p)!.add(f.l);
  }
  for (const [p, removed] of removeByPage) {
    const page = pages[p];
    page.lines = page.lines.filter((_: string, idx: number) => !removed.has(idx));
    page.lineItems = page.lineItems.filter((_: any, idx: number) => !removed.has(idx));
    rebuildPage(page);
  }
}

/**
 * Удаляет оглавление в начале документа.
 *
 * В НМО-рекомендациях оглавление часто идет БЕЗ заголовка "Содержание" — сразу
 * списком пунктов с точечными выносками ("Диагностика ........ 12"). Поэтому
 * детект идет по сигнатуре выноски, а не по заголовку: в ранней части документа
 * берется плотный блок от первой до последней строки с выноской и удаляется
 * целиком (вместе с переносами длинных названий). Предшествующий заголовок
 * "Содержание"/"Оглавление" тоже убирается, если он есть.
 *
 * Оглавление это навигация (названия разделов + номера страниц), оно дублирует
 * реальные заголовки тела и не может быть ответом. Тело идет ПОСЛЕ оглавления и
 * выносок не имеет, поэтому контент не страдает.
 */
function removeTableOfContents(pages: any[]) {
  const flat = buildFlatLineIndex(pages);
  if (!flat.length) return;
  const lineRaw = (f: { p: number; l: number }) => pages[f.p].lines[f.l];

  // Пункты оглавления опознаются по точечной выноске; берем их в ранней части.
  const earlyLimit = Math.max(1, Math.floor(flat.length * 0.4));
  const leaderIdx: number[] = [];
  for (let i = 0; i < earlyLimit; i += 1) {
    if (TOC_LEADER.test(lineRaw(flat[i]))) leaderIdx.push(i);
  }
  if (leaderIdx.length < 5) return;

  let start = leaderIdx[0];
  const end = leaderIdx[leaderIdx.length - 1] + 1;
  // Блок должен быть плотным по выноскам (оглавление, а не случайные строки).
  if (leaderIdx.length / Math.max(1, end - start) < 0.3) return;
  // Включить предшествующий заголовок "Содержание"/"Оглавление", если он есть.
  const prev = start > 0 ? normalizeText(lineRaw(flat[start - 1])) : "";
  if (prev && prev.length <= 30 && TOC_HEADING.test(prev)) start -= 1;

  removeFlatLineSpan(pages, flat, start, end);
}

/**
 * Удаляет секцию "Список литературы" со страниц PDF.
 *
 * Список литературы это ссылки и цитаты (авторы, журналы, годы), он занимает
 * около пятой части текста и не может быть правильным ответом на клинический
 * вопрос НМО, но засоряет поиск и числовые/латинские совпадения. Секция строго
 * ограничена: от заголовка "Список литературы" до следующего раздела
 * ("Приложение ..."), поэтому все приложения с клиническим контентом
 * сохраняются. Берется последнее вхождение заголовка (чтобы не спутать с
 * пунктом оглавления) и только в последней части документа.
 */
function removeBibliographySection(pages: any[]) {
  const flat = buildFlatLineIndex(pages);
  if (!flat.length) return;
  const lineText = (f: { p: number; l: number }) => normalizeText(pages[f.p].lines[f.l]);

  let start = -1;
  for (let i = 0; i < flat.length; i += 1) {
    const t = lineText(flat[i]);
    if (BIBLIO_HEADING.test(t) && t.length <= 30) start = i;
  }
  if (start < 0 || start < flat.length * 0.4) return;

  let end = flat.length;
  for (let i = start + 1; i < flat.length; i += 1) {
    if (BIBLIO_NEXT_SECTION.test(lineText(flat[i]))) {
      end = i;
      break;
    }
  }
  removeFlatLineSpan(pages, flat, start, end);
}

/**
 * Ранг приложения по букве/номеру: А1=1, А2=2, А3=3, Б=4, В=5, Г=6, иначе 0.
 *
 * Используется, чтобы безопасно удалять только метаданные-приложения (А1-А3:
 * состав рабочей группы, методология, связанные документы) и всегда сохранять
 * клинические приложения (Б — алгоритмы, В — памятка пациенту, Г — шкалы).
 */
function appendixRank(t: string): number {
  if (/^приложение\s*а\s*1/.test(t) || /^приложениеа\s*1/.test(t)) return 1;
  if (/^приложение\s*а\s*2/.test(t) || /^приложениеа\s*2/.test(t)) return 2;
  if (/^приложение\s*а\s*3/.test(t) || /^приложениеа\s*3/.test(t)) return 3;
  if (/^приложение\s*б/.test(t) || /^приложениеб/.test(t)) return 4;
  if (/^приложение\s*в/.test(t) || /^приложениев/.test(t)) return 5;
  if (/^приложение\s*г/.test(t) || /^приложениег/.test(t)) return 6;
  return 0;
}

/**
 * Удаляет метаданные-приложение: от приложения ранга `fromRank` до первого
 * приложения с рангом >= `toRank`. Это служебные разделы (ФИО рабочей группы,
 * методология, связанные документы), а не клинический контент. Удаление
 * происходит ТОЛЬКО если найдены и стартовое приложение, и приложение-терминатор
 * нужного ранга, иначе ничего не удаляется — так клинические приложения Б/В/Г
 * не пострадают, даже если разметка PDF нестандартная. Диапазонная форма
 * позволяет убрать одно приложение изолированно (например, только А3),
 * сохранив соседние.
 */
function removeMetadataAppendices(pages: any[], fromRank: number, toRank: number) {
  const flat = buildFlatLineIndex(pages);
  if (!flat.length) return;
  const lineText = (f: { p: number; l: number }) => normalizeText(pages[f.p].lines[f.l]);

  let start = -1;
  for (let i = 0; i < flat.length; i += 1) {
    if (appendixRank(lineText(flat[i])) === fromRank) start = i;
  }
  if (start < 0 || start < flat.length * 0.4) return;

  let end = -1;
  for (let i = start + 1; i < flat.length; i += 1) {
    if (appendixRank(lineText(flat[i])) >= toRank) {
      end = i;
      break;
    }
  }
  if (end < 0) return;
  removeFlatLineSpan(pages, flat, start, end);
}

/**
 * Удаляет список приложений из front matter (первые ~15% документа).
 *
 * В части PDF оглавление перечисляет приложения отдельным блоком без точечных
 * выносок ("Приложение А1. Состав рабочей группы... / Приложение А2. Методология
 * / Приложение А3. Справочные материалы"), поэтому leader-детект оглавления его
 * не ловит. Это TOC-остаток (само тело приложений в конце документа). Удаляется
 * только плотный блок из >=2 заголовков приложений в первых 15% — настоящие
 * приложения тела лежат в последней части и не затрагиваются.
 */
function removeFrontMatterAppendixList(pages: any[]) {
  const flat = buildFlatLineIndex(pages);
  if (!flat.length) return;
  const limit = Math.max(1, Math.floor(flat.length * 0.15));
  const idx: number[] = [];
  for (let i = 0; i < limit; i += 1) {
    if (appendixRank(normalizeText(pages[flat[i].p].lines[flat[i].l])) > 0) idx.push(i);
  }
  if (idx.length < 2 || idx[idx.length - 1] - idx[0] > 15) return;

  const start = idx[0];
  let end = idx[idx.length - 1] + 1;
  // Захватить одну строку-перенос названия последнего приложения, если она короткая.
  if (end < limit) {
    const t = normalizeText(pages[flat[end].p].lines[flat[end].l]);
    if (t.length > 0 && t.length < 60 && appendixRank(t) === 0 && !/^(список|термины|введение|1\b)/.test(t)) end += 1;
  }
  removeFlatLineSpan(pages, flat, start, end);
}

function stripAbbreviationEntryNoise(text: string) {
  return String(text ?? "")
    .replace(ATC_CODE_PARENTHETICAL, "")
    .replace(ABBREVIATION_PARENTHETICAL, "")
    .replace(ABBREVIATION_TRAILING_PARENTHETICAL, "")
    .replace(/^(?:код\s+)?(?:атх|atc)\s*[:：]\s*[^)]{1,80}\)\s*/iu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAbbreviationHeading(text: string) {
  const normalized = normalizeText(text);
  return (
    ABBREVIATION_HEADING.test(normalized) ||
    (normalized.includes("сокращ") &&
      (normalized.includes("список") || normalized.includes("перечень") || normalized.includes("условн") || normalized.startsWith("сокращ")))
  );
}

function splitAbbreviationEntry(text: string) {
  const cleaned = stripAbbreviationEntryNoise(text);
  const dashMatch = cleaned.match(/^(.{1,42}?)\s+(?:[–—]|-)\s+(.{3,})$/u);
  if (dashMatch) return { abbr: dashMatch[1], expansion: dashMatch[2] };

  const spaceMatch = cleaned.match(/^([A-ZА-ЯЁ0-9][A-ZА-ЯЁ0-9./+<>*_-]{1,18})\s+(.{4,})$/u);
  if (spaceMatch) return { abbr: spaceMatch[1], expansion: spaceMatch[2] };
  return null;
}

function compactAbbreviation(value: string) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .trim();
}

function likelyAbbreviation(value: string) {
  const compact = String(value ?? "").replace(/[^A-Za-zА-ЯЁа-яё0-9]/gu, "");
  if (compact.length < 2 || compact.length > 24) return false;
  const hasUpper = /[A-ZА-ЯЁ]/u.test(value);
  const hasDigit = /\d/u.test(value);
  const letters = value.match(/[A-Za-zА-ЯЁа-яё]/gu) ?? [];
  const uppers = value.match(/[A-ZА-ЯЁ]/gu) ?? [];
  if (/\s/u.test(value) && compact.length > 8 && uppers.length / Math.max(1, letters.length) < 0.6) return false;
  if (!hasUpper && !hasDigit && compact.length > 5) return false;
  return true;
}

function likelyAbbreviationExpansion(value: string) {
  const normalized = normalizeForSearch(value);
  if (normalized.length < 4 || normalized.length > 360) return false;
  if (/^(?:код\s+)?(?:атх|atc)\b/iu.test(normalized)) return false;
  return true;
}

function isAbbreviationContinuation(value: string) {
  const cleaned = stripAbbreviationEntryNoise(value);
  if (cleaned.length < 4 || cleaned.length > 220) return false;
  if (/^[\d\s.,;:()[\]-]+$/u.test(cleaned)) return false;
  if (ABBREVIATION_STOP_HEADING.test(normalizeText(cleaned))) return false;
  return !splitAbbreviationEntry(cleaned);
}

function parseAbbreviationEntry(line: string, pageNumber: number) {
  const parsed = splitAbbreviationEntry(line);
  if (!parsed) return null;
  const abbr = compactAbbreviation(parsed.abbr);
  const expansion = stripAbbreviationEntryNoise(parsed.expansion);
  if (!likelyAbbreviation(abbr) || !likelyAbbreviationExpansion(expansion)) return null;
  return { abbr, expansion, page: pageNumber };
}

function countAbbreviationEntries(lines: string[]) {
  return lines.reduce((count, line) => count + (parseAbbreviationEntry(line, 0) ? 1 : 0), 0);
}

function dedupeAbbreviations(items: Array<{ abbr: string; expansion: string; page: number }>) {
  const out: Array<{ abbr: string; expansion: string; page: number }> = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${normalizeForSearch(item.abbr)}=>${normalizeForSearch(item.expansion)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Извлекает пары из разделов "Список сокращений" и очищает внутри этих строк служебные ATC-коды.
 *
 * Раздел сокращений полезен как словарь алиасов, но сам по себе не является клиническим evidence.
 * Поэтому здесь сохраняется только общая пара `аббревиатура -> расшифровка`, а шум вида
 * `(Код АТХ: A02BC01)` удаляется из строки до построения чанков и BM25.
 */
function extractAndCleanAbbreviationLists(pages: any[]) {
  const abbreviations: Array<{ abbr: string; expansion: string; page: number }> = [];
  const touchedPages = new Set<number>();

  for (let p = 0; p < pages.length; p += 1) {
    const page = pages[p];
    const lines = page.lines;
    for (let index = 0; index < lines.length; index += 1) {
      if (!isAbbreviationHeading(lines[index])) continue;

      const preview = lines.slice(index + 1, Math.min(lines.length, index + 26));
      if (countAbbreviationEntries(preview) < 2) continue;

      let current: { abbr: string; expansion: string; page: number } | null = null;
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const original = lines[cursor];
        const cleaned = stripAbbreviationEntryNoise(original);
        if (cleaned !== original) {
          lines[cursor] = cleaned;
          if (page.lineItems[cursor]) page.lineItems[cursor].text = cleaned;
          touchedPages.add(p);
        }

        const normalized = normalizeText(cleaned);
        if (/^[\d\s]+$/u.test(normalized)) continue;
        if (ABBREVIATION_STOP_HEADING.test(normalized)) break;

        const entry = parseAbbreviationEntry(cleaned, page.page);
        if (entry) {
          if (current) abbreviations.push(current);
          current = entry;
          continue;
        }

        if (current && isAbbreviationContinuation(cleaned)) {
          current = {
            ...current,
            expansion: stripAbbreviationEntryNoise(`${current.expansion} ${cleaned}`).slice(0, 360),
          };
        }
      }
      if (current) abbreviations.push(current);
    }
  }

  for (const p of touchedPages) rebuildPage(pages[p]);
  return dedupeAbbreviations(abbreviations);
}

/**
 * Извлекает текст и легкие layout-метаданные из PDF.
 *
 * Экстрактор принимает байты, браузерные File/Blob, ArrayBuffer-подобные
 * объекты или URL-строки. Возвращает текст страниц, строки, нормализованный
 * текст и флаг `ocrNeeded`, если в PDF найдено подозрительно мало текста.
 *
 * @param pdfInput Байты PDF, File/Blob, ArrayBuffer, Uint8Array или URL.
 * @param options Необязательный `cacheKey`, явно переданный `pdfjsLib` и уровень логирования PDF.js.
 * @returns Текст страниц и метаданные, которые использует predictor.
 */
export async function extractPdfText(pdfInput: any, options: any = {}) {
  const pdfjs = await resolvePdfJs(options);
  const data = await toUint8Array(pdfInput);
  const loadingTask = pdfjs.getDocument({
    data,
    disableWorker: true,
    useSystemFonts: true,
    isEvalSupported: false,
    verbosity: pdfVerbosity(pdfjs, options),
  });
  const pdf = await loadingTask.promise;
  const pages: any[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent({
      disableCombineTextItems: false,
      includeMarkedContent: false,
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
      charLength: text.length,
    });
  }

  removeTableOfContents(pages);
  removeFrontMatterAppendixList(pages);
  removeBibliographySection(pages);
  removeMetadataAppendices(pages, 1, 2);
  const abbreviations = extractAndCleanAbbreviationLists(pages);

  const pageTextChars = pages.reduce((sum, page) => sum + page.text.length, 0);
  return {
    pdfId: options.cacheKey ?? (typeof pdfInput === "string" ? pdfInput : "<browser-pdf>"),
    cacheVersion: 2,
    pageCount: pdf.numPages,
    extractedAt: new Date().toISOString(),
    pages,
    abbreviations,
    ocrNeeded: pageTextChars < Math.max(1000, pdf.numPages * 100),
  };
}

/**
 * Очищает кеш извлечения PDF.
 *
 * Текущая browser-first реализация хранит текст PDF в runtime-кеше predictor,
 * поэтому эта функция намеренно оставлена как совместимый no-op.
 */
export function clearPdfMemoryCache() {
  // Browser build keeps PDF text in the predictor runtime cache.
}
