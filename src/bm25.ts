import { tokenize } from "./normalize.js";

/**
 * Документ, сохраненный в поисковом BM25-индексе.
 *
 * Чанки predictor добавляют дополнительные метаданные: страницу, тип, текст и id.
 */
export type BM25Document = {
  tokens?: string[];
  [key: string]: unknown;
};

/**
 * Небольшая реализация BM25 для локального поиска по чанкам PDF.
 */
export class BM25Index {
  documents: BM25Document[];
  k1: number;
  b: number;
  docFreq: Map<string, number>;
  termFreqs: Map<string, number>[];
  lengths: number[];
  avgdl: number;

  /**
   * Создает индекс для уже токенизированных документов.
   *
   * @param documents Документы с необязательными массивами `tokens`.
   * @param options Параметры настройки BM25.
   */
  constructor(documents: BM25Document[], { k1 = 1.35, b = 0.72 } = {}) {
    this.documents = documents;
    this.k1 = k1;
    this.b = b;
    this.docFreq = new Map();
    this.termFreqs = [];
    this.lengths = [];

    let totalLength = 0;
    for (const document of documents) {
      const frequencies = new Map();
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

  /**
   * Считает inverse document frequency для одного нормализованного токена.
   */
  idf(token: string) {
    const n = this.documents.length;
    const df = this.docFreq.get(token) ?? 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  /**
   * Считает score токенизированного запроса для одного документа в индексе.
   */
  scoreTokens(queryTokens: string[], docIndex: number) {
    const frequencies = this.termFreqs[docIndex];
    if (!frequencies) return 0;
    const dl = this.lengths[docIndex] || 1;
    let score = 0;
    for (const token of queryTokens) {
      const tf = frequencies.get(token) ?? 0;
      if (!tf) continue;
      const idf = this.idf(token);
      const denom = tf + this.k1 * (1 - this.b + this.b * (dl / (this.avgdl || 1)));
      score += idf * ((tf * (this.k1 + 1)) / denom);
    }
    return score;
  }

  /**
   * Ищет по индексу сырой текст или заранее токенизированный запрос.
   *
   * @returns Лучшие совпадающие чанки с положительным BM25 score.
   */
  search(query: string | string[], { limit = 10 } = {}) {
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
}
