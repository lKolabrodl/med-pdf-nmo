import {describe, expect, it} from "vitest";
import {buildPdfStructure} from "./pdf.js";

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
