import {describe, expect, it, vi} from "vitest";
import {buildPdfStructure, extractPdfText} from "./pdf.js";

describe("PDF resource lifecycle", () => {
  function setup() {
    const page = {getTextContent: vi.fn(async () => ({items: []})), getStructTree: vi.fn(async () => null)};
    const document = {numPages: 1, getPage: vi.fn(async () => page), destroy: vi.fn(async () => {})};
    const task = {promise: Promise.resolve(document), destroy: vi.fn(async () => {})};
    const pdfjsLib = {getDocument: vi.fn(() => task)};
    return {page, document, task, pdfjsLib};
  }

  it("destroys the loading task once after successful extraction", async () => {
    const {task, document, pdfjsLib} = setup();
    const result = await extractPdfText(new Uint8Array([1]), {pdfjsLib});
    expect(result.pageCount).toBe(1);
    expect(result.pages).toHaveLength(1);
    expect(task.destroy).toHaveBeenCalledTimes(1);
    expect(document.destroy).not.toHaveBeenCalled();
  });

  it.each(["load", "page", "text", "structure"])("cleans up after a %s failure and preserves its error", async (stage) => {
    const {page, document, task, pdfjsLib} = setup();
    const failure = new Error(`${stage} failure`);
    if (stage === "load") task.promise = Promise.reject(failure);
    if (stage === "page") document.getPage.mockRejectedValueOnce(failure);
    if (stage === "text") page.getTextContent.mockRejectedValueOnce(failure);
    if (stage === "structure") page.getStructTree.mockRejectedValueOnce(failure);
    task.destroy.mockRejectedValueOnce(new Error("secondary cleanup failure"));
    await expect(extractPdfText(new Uint8Array([1]), {pdfjsLib, nativePdfStructure: true})).rejects.toBe(failure);
    expect(task.destroy).toHaveBeenCalledTimes(1);
  });

  it("reports cleanup failure when extraction itself succeeded", async () => {
    const {task, pdfjsLib} = setup();
    task.destroy.mockRejectedValueOnce(new Error("cleanup failure"));
    await expect(extractPdfText(new Uint8Array([1]), {pdfjsLib})).rejects.toThrow("cleanup failure");
  });

  it("awaits cleanup before resolving the extracted text", async () => {
    const {task, pdfjsLib} = setup();
    let release!: () => void;
    const cleanup = new Promise<void>((resolve) => { release = resolve; });
    task.destroy.mockReturnValueOnce(cleanup);
    let completed = false;
    const result = extractPdfText(new Uint8Array([1]), {pdfjsLib}).then(() => { completed = true; });
    await vi.waitFor(() => expect(task.destroy).toHaveBeenCalledTimes(1));
    expect(completed).toBe(false);
    release();
    await result;
    expect(completed).toBe(true);
  });

  it("falls back to document cleanup for a custom loading task", async () => {
    const {document} = setup();
    await extractPdfText(new Uint8Array([1]), {pdfjsLib: {getDocument: () => ({promise: Promise.resolve(document)})}});
    expect(document.destroy).toHaveBeenCalledTimes(1);
  });

  it("keeps compatibility with custom adapters without cleanup hooks", async () => {
    const pdfjsLib = {getDocument: () => ({promise: Promise.resolve({numPages: 0, getPage: vi.fn()})})};
    await expect(extractPdfText(new Uint8Array([1]), {pdfjsLib})).resolves.toHaveProperty("pageCount", 0);
  });
});

describe("native PDF structure extraction", () => {
  it("maps marked-content ids into table rows and drops TOC branches", () => {
    const items = [
      {type: "beginMarkedContentProps", id: "p1_mc1"},
      {str: "Показатель"},
      {type: "endMarkedContent"},
      {type: "beginMarkedContentProps", id: "p1_mc2"},
      {str: "Значение"},
      {type: "endMarkedContent"},
      {type: "beginMarkedContentProps", id: "p1_mc3"},
      {str: "Содержание"},
      {type: "endMarkedContent"},
    ];
    const tree = {
      role: "Root",
      children: [
        {
          role: "Table",
          children: [
            {
              role: "TR",
              children: [
                {role: "TH", children: [{type: "content", id: "p1_mc1"}]},
                {role: "TH", children: [{type: "content", id: "p1_mc2"}]},
              ],
            },
          ],
        },
        {role: "TOC", children: [{type: "content", id: "p1_mc3"}]},
      ],
    };

    const structure = buildPdfStructure(items, tree);
    const table = structure?.children[0];
    const row = table?.children[0];

    expect(table?.role).toBe("Table");
    expect(row?.text).toBe("Показатель Значение");
    expect(row?.children.map((cell) => cell.text)).toEqual(["Показатель", "Значение"]);
    expect(structure?.text).not.toContain("Содержание");
  });

  it("returns null when a page has no native structure tree", () => {
    expect(buildPdfStructure([{str: "Обычный текст"}], null)).toBeNull();
  });
});
