import { describe, expect, it } from "vitest";
import { resolveClauseLocalCountTuple } from "../src/predictor/scorers/count-tuple.js";

function answers(values: string[]) {
  return values.map((text, index) => ({ id: String.fromCharCode(65 + index), text }));
}

function resolve(question: string, values: string[], text: string) {
  return resolveClauseLocalCountTuple({
    mode: "single",
    question,
    answers: answers(values),
    fragments: [{ page: 1, text }],
  });
}

describe("clause-local count tuple", () => {
  it("binds a number word to a pure numeric option and a compound counted-object token", () => {
    const result = resolve(
      "Количество учебных групп каталога составляет",
      ["8", "4", "2", "6"],
      "В учебном каталоге выделяют четыре подгруппы.",
    );
    expect(result?.answerId).toBe("B");
  });

  it("binds the count when predicate order is inverted", () => {
    expect(
      resolve(
        "Количество этапов проверки документа составляет",
        ["4", "3", "2", "5"],
        "Проверка документа проводится в два этапа.",
      )?.answerId,
    ).toBe("C");
  });

  it("abstains when one fragment contains two candidate counts", () => {
    expect(
      resolve(
        "Количество этапов проверки документа составляет",
        ["4", "3", "2", "5"],
        "Проверка документа проводится в два или три этапа.",
      ),
    ).toBeNull();
  });

  it("abstains without the counted object", () => {
    expect(resolve("Количество этапов проверки документа", ["4", "3", "2"], "Выделяют два раздела каталога.")).toBeNull();
  });
});
