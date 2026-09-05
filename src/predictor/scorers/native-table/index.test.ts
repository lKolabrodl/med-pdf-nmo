import {describe, expect, it} from "vitest";
import {defineScorerFunctionContract, scorerTestContext, scorerTestPage} from "../../../../__test__/scorer-test-support.js";
import type {PdfStructureNode} from "../../../pdf.js";
import {resolveNativeTable} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": ["nativeTables", "cellContainsAnswer", "resolveNativeTable", "nativeTableAdjustment"],
});

function tableContext(rows: string[][], question = "Значение параметра альфа при запуске") {
  const page = scorerTestPage(1, rows.map((row) => row.join(" ")));
  page.structure = {role: "Table", text: page.text, children: rows.map((row) => ({
    role: "TR", text: row.join(" "), children: row.map((text) => ({role: "TD", text, children: []})),
  }))};
  return scorerTestContext({pages: [page], question, answers: [{id: "A", text: "17"}, {id: "B", text: "29"}]});
}

describe("native table ownership", () => {
  it("binds the value to both the named row and column", () => {
    const context = tableContext([["Параметр", "При запуске", "При остановке"], ["Параметр альфа", "17", "29"]]);
    expect(resolveNativeTable(context)?.answerId).toBe("A");
  });
  it("abstains when the question does not specify which value column", () => {
    const context = tableContext([["Параметр", "При запуске", "При остановке"], ["Параметр альфа", "17", "29"]], "Значение параметра альфа");
    expect(resolveNativeTable(context)).toBeNull();
  });
  it("does not infer an absent cell or collapsed column", () => {
    const context = tableContext([["Параметр", "При запуске", "При остановке"], ["Параметр альфа", "17"]]);
    expect(resolveNativeTable(context)).toBeNull();
  });
  it("abstains when two rows or two tables disagree", () => {
    const context = tableContext([["Параметр альфа", "17"], ["Параметр альфа", "29"]]);
    expect(resolveNativeTable(context)).toBeNull();
  });
  it("does not match a digit inside a different number", () => {
    expect(resolveNativeTable(tableContext([["Параметр альфа", "117"], ["Параметр бета", "29"]]))).toBeNull();
  });
  it("does not turn a negative cell into positive support", () => {
    expect(resolveNativeTable(tableContext([["Параметр альфа", "не 17"], ["Параметр бета", "29"]]))).toBeNull();
  });
  it("rejects merged cells with unsupported spans", () => {
    const context = tableContext([["Параметр альфа", "17"], ["Параметр бета", "29"]]);
    (context.pages[0].structure as PdfStructureNode).children[0].children[1].colSpan = 2;
    expect(resolveNativeTable(context)).toBeNull();
  });
});
