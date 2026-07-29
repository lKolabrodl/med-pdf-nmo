import { BM25Index } from "../bm25.js";
import { buildChunks, type PdfChunk } from "../chunk.js";
import {
  extractPdfText,
  type ExtractedPdfText,
  type PdfExtractionOptions,
} from "../pdf.js";
import type { AnswerOption } from "./types.js";

export type PdfRuntime = {
  pdfText: ExtractedPdfText;
  chunks: PdfChunk[];
  index: BM25Index<PdfChunk>;
};

export type PdfRuntimeStoreDependencies = {
  extractPdfText: typeof extractPdfText;
  buildChunks: typeof buildChunks;
  createIndex(chunks: PdfChunk[]): BM25Index<PdfChunk>;
};

export type PdfRuntimeOptions = PdfExtractionOptions;

const DEFAULT_RUNTIME_DEPENDENCIES: PdfRuntimeStoreDependencies = {
  extractPdfText,
  buildChunks,
  createIndex: (chunks) => new BM25Index(chunks),
};

function answerId(index: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < alphabet.length) return alphabet[index];
  return `A${index + 1}`;
}

/**
 * Нормализует публичные варианты ответа в стабильные объекты `{ id, text }`.
 */
export function normalizeAnswers(
  answers: Array<AnswerOption | string>,
): AnswerOption[] {
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

function objectKey(input: unknown): object | null {
  return input && typeof input === "object" ? input : null;
}

function runtimeVariantKey(options: PdfRuntimeOptions): string {
  if (!options.documentTokenRepair) return "base";
  const minFrequency = Math.max(1, Math.floor(Number(options.documentTokenRepairMinFrequency) || 1));
  const scope = options.documentTokenRepairStructuralOnly ? "structural" : "all";
  return `document-token-repair:${minFrequency}:${scope}`;
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
  private readonly objectRuntimeCache = new WeakMap<object, Map<string, Promise<PdfRuntime>>>();

  constructor(
    private readonly dependencies: PdfRuntimeStoreDependencies = DEFAULT_RUNTIME_DEPENDENCIES,
  ) {}

  /**
   * Создает или переиспользует runtime-состояние одного PDF.
   */
  async get(
    pdfInput: unknown,
    options: PdfRuntimeOptions = {},
  ): Promise<PdfRuntime> {
    const suppliedCacheKey = options.cacheKey ?? (typeof pdfInput === "string" ? pdfInput : null);
    const variantKey = runtimeVariantKey(options);
    const cacheKey = suppliedCacheKey ? `${suppliedCacheKey}\u0000${variantKey}` : null;
    if (cacheKey && this.keyedRuntimeCache.has(cacheKey)) return this.keyedRuntimeCache.get(cacheKey);

    const weakKey = objectKey(pdfInput);
    const objectVariants = weakKey ? this.objectRuntimeCache.get(weakKey) : null;
    if (!cacheKey && objectVariants?.has(variantKey)) return objectVariants.get(variantKey);

    const runtimePromise = (async () => {
      const pdfText = await this.dependencies.extractPdfText(pdfInput, options);
      const chunks = this.dependencies.buildChunks(pdfText);
      const index = this.dependencies.createIndex(chunks);
      return { pdfText, chunks, index };
    })();

    if (cacheKey) this.keyedRuntimeCache.set(cacheKey, runtimePromise);
    else if (weakKey) {
      const variants = objectVariants ?? new Map<string, Promise<PdfRuntime>>();
      variants.set(variantKey, runtimePromise);
      this.objectRuntimeCache.set(weakKey, variants);
    }

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
export async function getPdfRuntime(
  pdfInput: unknown,
  options: PdfRuntimeOptions = {},
) {
  return defaultPdfRuntimeStore.get(pdfInput, options);
}

/**
 * Очищает keyed runtime-кеш PDF.
 */
export function clearPdfRuntimeCache() {
  defaultPdfRuntimeStore.clear();
}
