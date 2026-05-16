import { expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { predict } from "../src/predictor.js";

type CaseInput = {
  question: string;
  variants: string[];
  type: "single" | "multi";
  expected: string[];
};

function answerId(index: number) {
  return String.fromCharCode(65 + index);
}

function sameSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((value, index) => value === b[index]);
}

export function makeRunner(importMetaUrl: string) {
  const caseFile = fileURLToPath(importMetaUrl);
  const pdfPath = path.join(path.dirname(caseFile), "doc.pdf");

  return {
    runCase(input: CaseInput) {
      if (process.env.NMO_RUN_CASE_TESTS !== "1") {
        it.skip("dataset case is evaluated by npm run eval", () => {});
        return;
      }

      it("predicts expected answer set", async () => {
        const answers = input.variants.map((text, index) => ({ id: answerId(index), text }));
        const pdfData = await fs.readFile(pdfPath);
        const output = await predict({
          pdfData,
          cacheKey: pdfPath,
          question: input.question,
          answers,
          mode: input.type,
        });
        const selectedTexts = output.selected
          .map((id) => answers.find((answer) => answer.id === id)?.text)
          .filter((text): text is string => Boolean(text));
        expect(sameSet(selectedTexts, input.expected), JSON.stringify(output, null, 2)).toBe(true);
      });
    },
  };
}
