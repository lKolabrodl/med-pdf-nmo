import { describe, expect, it } from "vitest";
import { applyExplicitOrdinalRangeSetScores, resolveExplicitOrdinalRangeSet } from "../src/predictor/scorers/multi-set/index.js";

const degreeAnswers = [1, 2, 3, 4].map((value, index) => ({ id: String.fromCharCode(65 + index), text: `${value} степени` }));

function resolve(question: string, lines: string[], answers = degreeAnswers) {
  return resolveExplicitOrdinalRangeSet({ mode: "multi", pages: [{ page: 1, lines }], topQuestionPages: new Set([1]), question, answers });
}

describe("explicit ordinal range set decoder", () => {
  it("uses an explicit numeric ordinal range as the whole set", () => {
    const result = resolve(
      "Консервативная терапия рекомендуется пациентам с тромбозом узлов",
      ["• Пациентам с тромбозом узлов 1-3 степени рекомендуется консервативная терапия.", "УУР C, УДД 5."],
    );
    expect(result?.answerIds).toEqual(["A", "B", "C"]);
  });

  it("supports an explicit roman enumeration", () => {
    const answers = ["I стадии", "II стадии", "III стадии", "IV стадии"].map((text, index) => ({ id: String.fromCharCode(65 + index), text }));
    const result = resolveExplicitOrdinalRangeSet({
      mode: "multi",
      pages: [{ page: 1, lines: ["• Пациентам с внутренним процессом II и III стадии рекомендуется проведение лазерной терапии."] }],
      topQuestionPages: new Set([1]),
      question: "Проведение лазерной терапии рекомендуется пациентам с внутренним процессом",
      answers,
    });
    expect(result?.answerIds).toEqual(["B", "C"]);
  });

  it("ignores citation ranges and ordinary flattened membership", () => {
    expect(resolve("Терапия рекомендуется пациентам с тромбозом узлов", ["• Пациентам с тромбозом узлов рекомендуется терапия [1-3]."])).toBeNull();
    expect(resolve("Терапия рекомендуется пациентам с тромбозом узлов", ["• Пациентам с тромбозом узлов 1 степени, 2 степени, 3 степени и 4 степени рекомендуется терапия."])).toBeNull();
  });

  it("requires explicit question conditions in the same item", () => {
    const result = resolve(
      "Во время беременности и лактации консервативная терапия рекомендуется пациентам с тромбозом узлов",
      [
        "• Пациентам с тромбозом узлов 1-3 степени рекомендуется консервативная терапия.",
        "• Пациентам с тромбозом узлов 2-3 степени во время беременности и лактации рекомендуется консервативная терапия.",
      ],
    );
    expect(result?.answerIds).toEqual(["B", "C"]);
  });

  it("abstains when equally matching items encode different sets", () => {
    expect(
      resolve("Консервативная терапия рекомендуется пациентам с тромбозом узлов", [
        "• Пациентам с тромбозом узлов 1-2 степени рекомендуется консервативная терапия.",
        "• Пациентам с тромбозом узлов 1-3 степени рекомендуется консервативная терапия.",
      ]),
    ).toBeNull();
  });

  it("uses the explicit target token to ignore a sibling intervention", () => {
    const result = resolve("Склеротерапия внутренних узлов рекомендуется пациентам с кровоточащим процессом", [
      "• Пациентам с кровоточащим процессом 1-2 степени рекомендуется фотокоагуляция внутренних узлов.",
      "• Пациентам с кровоточащим процессом 1-3 степени рекомендуется склеротерапия внутренних узлов.",
    ]);
    expect(result?.answerIds).toEqual(["A", "B", "C"]);
  });

  it("does not infer the target from question word order", () => {
    expect(
      resolve("Пациентам с кровоточащим процессом рекомендуется склеротерапия внутренних узлов", [
        "• Пациентам с кровоточащим процессом 1-2 степени рекомендуется фотокоагуляция внутренних узлов.",
      ]),
    ).toBeNull();
  });

  it("treats leading for/at phrases as context, not intervention target", () => {
    const source = ["• Пациентам с тромбозом узлов 1-2 степени рекомендуется фотокоагуляция."];
    expect(resolve("Для лечения тромбоза узлов рекомендуется склеротерапия", source)).toBeNull();
    expect(resolve("При тромбозе узлов рекомендуется склеротерапия", source)).toBeNull();
    expect(resolve("Больным с тромбозом узлов рекомендуется склеротерапия", source)).toBeNull();
    expect(resolve("Детям с тромбозом узлов рекомендуется склеротерапия", source)).toBeNull();
  });

  it("requires positive recommendation polarity", () => {
    expect(
      resolve("Консервативная терапия рекомендуется пациентам с тромбозом узлов", [
        "• Пациентам с тромбозом узлов 1-3 степени не рекомендуется консервативная терапия.",
      ]),
    ).toBeNull();
    expect(
      resolve("Консервативная терапия рекомендуется пациентам с тромбозом узлов", [
        "• Пациентам с тромбозом узлов 1-3 степени не следует назначать консервативную терапию.",
      ]),
    ).toBeNull();
    expect(
      resolve("Консервативная терапия рекомендуется пациентам с тромбозом узлов", [
        "• Пациентам с тромбозом узлов 1-3 степени консервативную терапию назначать не следует.",
      ]),
    ).toBeNull();
  });

  it("never merges a new bullet into the previous target", () => {
    expect(
      resolve("Склеротерапия внутренних узлов рекомендуется пациентам с процессом", [
        "• Склеротерапия внутренних узлов",
        "• Пациентам с процессом 1-2 степени рекомендуется фотокоагуляция.",
      ]),
    ).toBeNull();
    expect(
      resolve("Склеротерапия внутренних узлов рекомендуется пациентам с процессом", [
        "• Склеротерапия внутренних узлов",
        "Пациентам с процессом 1-2 степени рекомендуется фотокоагуляция.",
      ]),
    ).toBeNull();
    expect(
      resolve("Склеротерапия внутренних узлов рекомендуется пациентам с процессом", [
        "• Склеротерапия внутренних узлов",
        "пациентам с процессом 1-2 степени рекомендуется фотокоагуляция.",
      ]),
    ).toBeNull();
  });

  it("masks evidence-grade and spaced bracket ranges", () => {
    expect(
      resolve("Консервативная терапия рекомендуется пациентам с процессом", [
        "• Пациентам с процессом рекомендуется консервативная терапия, уровень доказательности 1-3 степени.",
      ]),
    ).toBeNull();
    expect(
      resolve("Консервативная терапия рекомендуется пациентам с процессом", [
        "• Пациентам с процессом рекомендуется консервативная терапия 1-3 степени доказательности.",
      ]),
    ).toBeNull();
    const roman = ["I степени", "II степени", "III степени", "IV степени"].map((text, index) => ({ id: String.fromCharCode(65 + index), text }));
    expect(
      resolveExplicitOrdinalRangeSet({
        mode: "multi",
        pages: [{ page: 1, lines: ["• Пациентам с процессом рекомендуется консервативная терапия I, II и III степени доказательности."] }],
        topQuestionPages: new Set([1]),
        question: "Консервативная терапия рекомендуется пациентам с процессом",
        answers: roman,
      }),
    ).toBeNull();
    expect(
      resolve("Консервативная терапия рекомендуется пациентам с процессом", [
        "• Пациентам с процессом рекомендуется консервативная терапия [ 1-3 степени ].",
      ]),
    ).toBeNull();
  });

  it("binds generic prepositional conditions", () => {
    expect(
      resolve("При беременности консервативная терапия рекомендуется пациентам с тромбозом узлов", [
        "• Пациентам с тромбозом узлов 1-3 степени рекомендуется консервативная терапия.",
      ]),
    ).toBeNull();
  });

  it("does not borrow a condition from a sibling clause", () => {
    expect(
      resolve("При беременности склеротерапия рекомендуется пациентам с процессом", [
        "• При беременности рекомендуется фотокоагуляция; пациентам с процессом 1-3 степени рекомендуется склеротерапия.",
      ]),
    ).toBeNull();
    expect(
      resolve("При беременности склеротерапия рекомендуется пациентам с процессом", [
        "• Фотокоагуляция рекомендуется только при беременности, а пациентам с процессом 1-3 степени рекомендуется склеротерапия.",
      ]),
    ).toBeNull();
  });

  it("accepts only pure ordinal labels", () => {
    const qualified = [1, 2, 3, 4].map((value, index) => ({ id: String.fromCharCode(65 + index), text: `${value} степени для группы ${index + 1}` }));
    expect(
      resolveExplicitOrdinalRangeSet({
        mode: "multi",
        pages: [{ page: 1, lines: ["• Пациентам 1-2 степени рекомендуется консервативная терапия."] }],
        topQuestionPages: new Set([1]),
        question: "Консервативная терапия рекомендуется пациентам",
        answers: qualified,
      }),
    ).toBeNull();
  });

  it("makes structural set evidence consistent with raw ranking", () => {
    const scores = degreeAnswers.map((answer, index) => ({ answer, raw: [1, 2, 3, 100][index], evidence: [] }));
    const adjusted = applyExplicitOrdinalRangeSetScores(scores, { answerIds: ["A", "B", "C"], page: 1, text: "1-3 степени" });
    expect(adjusted.slice(0, 3).every((item) => item.raw === 100)).toBe(true);
    expect(adjusted[3].raw).toBe(45);
  });

  it("does not run outside multi mode", () => {
    expect(
      resolveExplicitOrdinalRangeSet({
        mode: "single",
        pages: [{ page: 1, lines: ["• Пациентам 1-3 степени рекомендуется терапия."] }],
        topQuestionPages: new Set([1]),
        question: "Терапия рекомендуется пациентам",
        answers: degreeAnswers,
      }),
    ).toBeNull();
  });
});
