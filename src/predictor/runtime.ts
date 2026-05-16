import { BM25Index } from "../bm25.js";
import { buildChunks } from "../chunk.js";
import { extractPdfText } from "../pdf.js";

const keyedRuntimeCache = new Map();
const objectRuntimeCache = new WeakMap<object, any>();

function answerId(index) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < alphabet.length) return alphabet[index];
  return `A${index + 1}`;
}

/**
 * Нормализует публичные варианты ответа в стабильные объекты `{ id, text }`.
 */
export function normalizeAnswers(answers) {
  return answers.map((answer, index) => {
    if (typeof answer === "string") {
      return { id: answerId(index), text: answer };
    }
    return {
      id: String(answer.id ?? answerId(index)),
      text: String(answer.text ?? ""),
    };
  });
}

function objectKey(input) {
  return input && typeof input === "object" ? input : null;
}

/**
 * Создает или переиспользует runtime-состояние PDF для одного предсказания.
 *
 * Runtime содержит извлеченный текст PDF, поисковые чанки и BM25-индекс.
 * Кеширование идет по явному `cacheKey`, URL-строке или identity объекта.
 */
export async function getPdfRuntime(pdfInput, options: any = {}) {
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

/**
 * Очищает keyed runtime-кеш PDF.
 */
export function clearPdfRuntimeCache() {
  keyedRuntimeCache.clear();
}
