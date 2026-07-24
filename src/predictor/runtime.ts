import { BM25Index } from "../bm25.js";
import { buildChunks } from "../chunk.js";
import { extractPdfText } from "../pdf.js";

export type PdfRuntime = {
  pdfText: any;
  chunks: any[];
  index: BM25Index;
};

export type PdfRuntimeStoreDependencies = {
  extractPdfText: typeof extractPdfText;
  buildChunks: typeof buildChunks;
  createIndex(chunks: any[]): BM25Index;
};

const DEFAULT_RUNTIME_DEPENDENCIES: PdfRuntimeStoreDependencies = {
  extractPdfText,
  buildChunks,
  createIndex: (chunks) => new BM25Index(chunks),
};

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
 * Управляет извлеченным PDF-текстом, поисковыми чанками, BM25-индексом и
 * жизненным циклом runtime-кеша.
 *
 * Кеширование идет по явному `cacheKey`, URL-строке или identity объекта.
 * Promise сохраняется сразу, поэтому параллельные запросы к одному PDF также
 * переиспользуют одну операцию извлечения.
 */
export class PdfRuntimeStore {
  private readonly keyedRuntimeCache = new Map<string, Promise<PdfRuntime>>();
  private readonly objectRuntimeCache = new WeakMap<object, Promise<PdfRuntime>>();

  constructor(
    private readonly dependencies: PdfRuntimeStoreDependencies = DEFAULT_RUNTIME_DEPENDENCIES,
  ) {}

  /**
   * Создает или переиспользует runtime-состояние одного PDF.
   */
  async get(pdfInput, options: any = {}): Promise<PdfRuntime> {
    const cacheKey = options.cacheKey ?? (typeof pdfInput === "string" ? pdfInput : null);
    if (cacheKey && this.keyedRuntimeCache.has(cacheKey)) return this.keyedRuntimeCache.get(cacheKey);

    const weakKey = objectKey(pdfInput);
    if (!cacheKey && weakKey && this.objectRuntimeCache.has(weakKey)) return this.objectRuntimeCache.get(weakKey);

    const runtimePromise = (async () => {
      const pdfText = await this.dependencies.extractPdfText(pdfInput, options);
      const chunks = this.dependencies.buildChunks(pdfText);
      const index = this.dependencies.createIndex(chunks);
      return { pdfText, chunks, index };
    })();

    if (cacheKey) this.keyedRuntimeCache.set(cacheKey, runtimePromise);
    else if (weakKey) this.objectRuntimeCache.set(weakKey, runtimePromise);

    return runtimePromise;
  }

  /**
   * Очищает keyed-кеш. WeakMap сохраняет прежнюю семантику: его записи
   * освобождаются сборщиком мусора вместе с исходными объектами PDF.
   */
  clear() {
    this.keyedRuntimeCache.clear();
  }
}

export const defaultPdfRuntimeStore = new PdfRuntimeStore();

/**
 * Совместимая функциональная обертка над runtime store по умолчанию.
 */
export async function getPdfRuntime(pdfInput, options: any = {}) {
  return defaultPdfRuntimeStore.get(pdfInput, options);
}

/**
 * Очищает keyed runtime-кеш PDF.
 */
export function clearPdfRuntimeCache() {
  defaultPdfRuntimeStore.clear();
}
