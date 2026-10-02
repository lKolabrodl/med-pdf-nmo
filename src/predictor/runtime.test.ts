import {describe, expect, it, vi} from "vitest";
import {BM25Index} from "../bm25.js";
import type {ExtractedPdfText} from "../pdf.js";
import {PdfRuntimeStore} from "./runtime.js";

const pdfText: ExtractedPdfText = {
  pdfId: "synthetic", cacheVersion: 2, pageCount: 0, extractedAt: "",
  pages: [], abbreviations: [], ocrNeeded: false,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

describe.each(["keyed", "object"])("PDF runtime lifecycle (%s)", (kind) => {
  const input = new Uint8Array([1]);
  const options = kind === "keyed" ? {cacheKey: "synthetic"} : {};

  function setup(extract = vi.fn(async () => pdfText)) {
    const chunks = vi.fn(() => []);
    const store = new PdfRuntimeStore({extractPdfText: extract, buildChunks: chunks, createIndex: () => new BM25Index([])});
    return {store, extract, chunks};
  }

  it("shares a failed request, then retries extraction", async () => {
    const pending = deferred<ExtractedPdfText>();
    const failure = new Error("temporary extraction failure");
    const extract = vi.fn(async () => pdfText).mockImplementationOnce(() => pending.promise);
    const {store} = setup(extract);
    const outcomes = Promise.allSettled([store.get(input, options), store.get(input, options)]);
    pending.reject(failure);
    expect(await outcomes).toEqual([{status: "rejected", reason: failure}, {status: "rejected", reason: failure}]);
    expect(extract).toHaveBeenCalledTimes(1);
    const recovered = await store.get(input, options);
    expect(await store.get(input, options)).toBe(recovered);
    expect(extract).toHaveBeenCalledTimes(2);
  });

  it("also retries a failure while building the runtime", async () => {
    const {store, extract, chunks} = setup();
    chunks.mockImplementationOnce(() => { throw new Error("chunk failure"); });
    await expect(store.get(input, options)).rejects.toThrow("chunk failure");
    await expect(store.get(input, options)).resolves.toHaveProperty("pdfText", pdfText);
    expect(extract).toHaveBeenCalledTimes(2);
  });

  it("clears every extraction variant", async () => {
    const {store, extract} = setup();
    const variant = {...options, nativePdfStructure: true};
    const first = await store.get(input, options);
    const structured = await store.get(input, variant);
    store.clear();
    expect(await store.get(input, options)).not.toBe(first);
    expect(await store.get(input, variant)).not.toBe(structured);
    expect(extract).toHaveBeenCalledTimes(4);
  });

  it.each(["resolve", "reject"])("does not evict or restore a cleared in-flight request on %s", async (outcome) => {
    const pending = deferred<ExtractedPdfText>();
    const extract = vi.fn(async () => pdfText).mockImplementationOnce(() => pending.promise);
    const {store} = setup(extract);
    const old = Promise.allSettled([store.get(input, options)]);
    store.clear();
    const fresh = await store.get(input, options);
    if (outcome === "resolve") pending.resolve(pdfText);
    else pending.reject(new Error("old failure"));
    await old;
    expect(await store.get(input, options)).toBe(fresh);
    expect(extract).toHaveBeenCalledTimes(2);
  });
});
