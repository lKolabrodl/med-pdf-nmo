import { describe, expect, it } from "vitest";
import { normalizeForSearch, tokenize, uniqueTokens } from "../src/normalize.js";
import { extractComparatorNumbers, numberCoverage } from "../src/predictor/text-utils.js";
import {
  bestCyrillicOcrSupport,
  cyrillicOcrCoverage,
} from "../src/predictor/scorers/ocr-fuzzy.js";
import { bestSubjectBoundNumericClauseSupport } from "../src/predictor/scorers/numeric.js";
import {
  bestCoordinateRelationalRowSupport,
  buildCoordinateRelationalRowsByPage,
  hasCoordinateRelationalRowCue,
} from "../src/predictor/scorers/coordinate-table.js";

describe("normalize", () => {
  it("aligns Greek letter symbols and Russian letter names", () => {
    const russianAlpha = normalizeForSearch("\u0438\u043d\u0433\u0438\u0431\u0438\u0442\u043e\u0440\u044b \u0424\u041d\u041e-\u0430\u043b\u044c\u0444\u0430");
    const greekAlpha = normalizeForSearch("\u0438\u043d\u0433\u0438\u0431\u0438\u0442\u043e\u0440\u044b \u0424\u041d\u041e-\u03b1");

    expect(russianAlpha).toBe(greekAlpha);
  });

  it("drops numeric reference marks before sentence punctuation", () => {
    const tokens = tokenize(
      "\u0414\u0440\u0443\u0433\u0438\u0435 \u0438\u043d\u0433\u0438\u0431\u0438\u0442\u043e\u0440\u044b \u0424\u041d\u041e-\u03b1 \u0438\u043c\u0435\u044e\u0442 \u043d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u044b\u0439 \u043e\u043f\u044b\u0442 \u043f\u0440\u0438\u043c\u0435\u043d\u0435\u043d\u0438\u044f [151].",
    );

    expect(tokens).not.toContain("151");
  });

  it("canonicalizes spaced thousands in numeric and comparator matching", () => {
    const source = "количество нейтрофилов в крови > 9 500/мкл";

    expect(numberCoverage(">9500/мкл", source)).toBe(1);
    expect(extractComparatorNumbers(source)).toEqual(["9500"]);
  });

  it("matches a long Cyrillic term despite bounded OCR substitutions and fragmentation", () => {
    const match = cyrillicOcrCoverage(
      "антитела к растворимому печеночному антигену",
      "антитела к раствори мому печеиочному аитигену",
    );

    expect(match.coverage).toBeGreaterThan(0.74);
    expect(match.fuzzyMatches).toBeGreaterThanOrEqual(1);
  });

  it("requires the question focus and OCR-like answer match in the same sentence", () => {
    const answer = {
      id: "A",
      text: "антитела к растворимому печеночному антигену",
    };
    const support = bestCyrillicOcrSupport({
      mode: "single",
      pages: [
        {
          page: 1,
          lines: [
            "Болезнь Альфа подробно описана в этом разделе. Антитела к раствори мому печеночному аитигену встречаются отдельно.",
          ],
        },
      ],
      topQuestionPages: new Set([1]),
      answer,
      answers: [answer, { id: "B", text: "антитела к другому маркеру" }],
      focusTokens: uniqueTokens("болезнь Альфа"),
    });

    expect(support).toBeNull();
  });

  it("binds a percentage to the subject in the same clause", () => {
    const pages = [
      {
        page: 1,
        lines: [
          "Болезнь Альфа наблюдается в 20% случаев; болезнь Бета встречается в 50% случаев; болезнь Гамма — более чем в 90% случаев.",
        ],
      },
    ];
    const answers = [
      { id: "A", text: "20%" },
      { id: "B", text: "50%" },
      { id: "C", text: "более 90%" },
      { id: "D", text: "75%" },
    ];
    const support = bestSubjectBoundNumericClauseSupport({
      mode: "single",
      pages,
      topQuestionPages: new Set([1]),
      question: "Какова частота болезни Бета?",
      answer: answers[1],
      answers,
    });
    const neighboringValue = bestSubjectBoundNumericClauseSupport({
      mode: "single",
      pages,
      topQuestionPages: new Set([1]),
      question: "Какова частота болезни Бета?",
      answer: answers[0],
      answers,
    });

    expect(support?.kind).toBe("subject_numeric_clause");
    expect(neighboringValue).toBeNull();
  });

  it("does not mistake a digit inside a biomedical symbol for a numeric subgroup", () => {
    const pages = [
      {
        page: 1,
        lines: [
          "Вариант PITX2 встречается в 20% случаев; вариант ALPHA наблюдается в 50% случаев.",
        ],
      },
    ];
    const answers = [
      { id: "A", text: "20%" },
      { id: "B", text: "50%" },
      { id: "C", text: "75%" },
    ];
    const support = bestSubjectBoundNumericClauseSupport({
      mode: "single",
      pages,
      topQuestionPages: new Set([1]),
      question: "Какова частота варианта PITX2?",
      answer: answers[0],
      answers,
    });

    expect(support?.kind).toBe("subject_numeric_clause");
  });

  it("abstains from percentage binding when the question names a numeric subgroup", () => {
    const pages = [
      {
        page: 1,
        lines: [
          "Состояние Альфа встречается в 20% случаев; состояние Бета наблюдается в 50% случаев.",
        ],
      },
    ];
    const answers = [
      { id: "A", text: "20%" },
      { id: "B", text: "50%" },
      { id: "C", text: "75%" },
    ];
    const support = bestSubjectBoundNumericClauseSupport({
      mode: "single",
      pages,
      topQuestionPages: new Set([1]),
      question: "Какова частота состояния Альфа у пациентов старше 65 лет?",
      answer: answers[0],
      answers,
    });

    expect(support).toBeNull();
  });

  it("does not enable relational table parsing for an incidental symptom mention", () => {
    expect(
      hasCoordinateRelationalRowCue(
        "Лечение заболевания, сопровождающегося выраженным симптомом, включает",
      ),
    ).toBe(false);
    expect(
      hasCoordinateRelationalRowCue(
        "Характерным симптомом заболевания Альфа является",
      ),
    ).toBe(true);
  });

  it("reconstructs a relational table row from visual X coordinates", () => {
    const visualLine = (
      y: number,
      cells: Array<{ text: string; x: number; width: number }>,
    ) => ({
      text: cells.map((cell) => cell.text).join(" "),
      y,
      items: cells.map((cell) => ({ ...cell, y })),
    });
    const pages = [
      {
        page: 1,
        lines: [
          "Таблица 1. Типы повреждения",
          "Заболевание Тип повреждения печени",
          "Альфа-состояние гепатоцеллюлярный тип",
          "Бета-состояние холестатический тип",
        ],
        lineItems: [
          visualLine(760, [{ text: "Таблица 1. Типы повреждения", x: 80, width: 160 }]),
          visualLine(700, [
            { text: "Заболевание", x: 80, width: 75 },
            { text: "Тип повреждения печени", x: 300, width: 130 },
          ]),
          visualLine(650, [
            { text: "Альфа-состояние", x: 80, width: 95 },
            { text: "гепатоцеллюлярный тип", x: 300, width: 130 },
          ]),
          visualLine(600, [
            { text: "Бета-состояние", x: 80, width: 90 },
            { text: "холестатический тип", x: 300, width: 120 },
          ]),
        ],
      },
    ];
    const rows = buildCoordinateRelationalRowsByPage(pages, new Set([1]));
    const question = "Основным типом повреждения печени при Альфа-состоянии является";
    const answer = { id: "A", text: "гепатоцеллюлярный тип" };
    const support = bestCoordinateRelationalRowSupport({
      mode: "single",
      question,
      answer,
      answerTokens: uniqueTokens(answer.text),
      focusTokens: uniqueTokens(question),
      coordinateRelationalRowsByPage: rows,
    });

    expect(rows.get(1)).toHaveLength(2);
    expect(support?.kind).toBe("coordinate_relational_row");
  });
});
