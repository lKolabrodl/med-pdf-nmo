import { describe, expect, it } from "vitest";
import { answerQuestion } from "../src/index.js";
import { buildPageBlocks } from "../src/pdf.js";
import { buildPredictionSources, emptyPredictionSources } from "../src/predictor/source-context.js";

const answers = [
  { id: "A", text: "препарат Альфа" },
  { id: "B", text: "препарат Бета" },
];

function fixturePage() {
  const blocks = [
    { text: "Лечение заболевания", lineStart: 0, lineEnd: 0 },
    {
      text: "Пациентам с заболеванием рекомендуется препарат Альфа для основной терапии.",
      lineStart: 1,
      lineEnd: 2,
    },
    { text: "• Следующая рекомендация относится к другой группе пациентов.", lineStart: 3, lineEnd: 3 },
  ];
  return {
    page: 7,
    lines: [
      "Лечение заболевания",
      "Пациентам с заболеванием рекомендуется препарат Альфа",
      "для основной терапии.",
      "• Следующая рекомендация относится к другой группе пациентов.",
    ],
    blocks,
    text: blocks.map((block) => block.text).join("\n"),
  };
}

function answerScores() {
  return [
    {
      answer: answers[0],
      raw: 15,
      evidence: [
        {
          answerId: "A",
          page: 7,
          text: "Пациентам с заболеванием рекомендуется препарат Альфа для основной терапии.",
          score: 14,
          kind: "recommendation_item_segment",
        },
        {
          answerId: "A",
          page: 7,
          text: "Пациентам с заболеванием рекомендуется препарат Альфа для основной терапии.",
          score: 10,
          kind: "question_chunk_answer",
        },
      ],
    },
    { answer: answers[1], raw: 3, evidence: [] },
  ];
}

describe("source context presentation layer", () => {
  it("keeps logical PDF blocks mapped to physical line ranges", () => {
    const blocks = buildPageBlocks([
      "Короткий заголовок",
      "Длинный абзац без завершающей точки и с достаточным количеством символов",
      "продолжение той же строки",
      "- Новый пункт",
    ]);

    expect(blocks).toEqual([
      { text: "Короткий заголовок", lineStart: 0, lineEnd: 0 },
      {
        text: "Длинный абзац без завершающей точки и с достаточным количеством символов продолжение той же строки",
        lineStart: 1,
        lineEnd: 2,
      },
      { text: "- Новый пункт", lineStart: 3, lineEnd: 3 },
    ]);
  });

  it("recognizes real bullet and letter markers without treating a dose as a list number", () => {
    const bulletBlocks = buildPageBlocks([
      "Длинный вводный абзац без завершающей точки и с достаточным количеством символов",
      "• Рекомендуется препарат Альфа",
      "а) Отдельный подпункт",
    ]);
    expect(bulletBlocks).toHaveLength(3);
    expect(bulletBlocks[1].text).toBe("• Рекомендуется препарат Альфа");

    const doseBlocks = buildPageBlocks([
      "Препарат вводят пациенту в разовой дозе без завершающей точки",
      "400 мкг через дозированный ингалятор",
    ]);
    expect(doseBlocks).toEqual([
      {
        text: "Препарат вводят пациенту в разовой дозе без завершающей точки 400 мкг через дозированный ингалятор",
        lineStart: 0,
        lineEnd: 1,
      },
    ]);
  });

  it("returns a larger question paragraph and sources in answer order", () => {
    const scores = answerScores();
    const before = JSON.stringify(scores);
    const sources = buildPredictionSources({
      pages: [fixturePage()],
      question: "Какой препарат рекомендуется для основной терапии заболевания?",
      answers,
      selected: ["A"],
      answerScores: scores,
      questionAnchors: [
        {
          chunk: {
            page: 7,
            text: "Пациентам с заболеванием рекомендуется препарат Альфа для основной терапии.",
          },
          score: 9.25,
        },
      ],
      options: { excerptsPerAnswer: 2, maxChars: 900 },
    });

    expect(JSON.stringify(scores)).toBe(before);
    expect(sources.question?.page).toBe(7);
    expect(sources.question?.origin).toBe("selected_answer_context");
    expect(sources.question?.text).toContain("Лечение заболевания");
    expect(sources.question?.text).not.toContain("Следующая рекомендация");
    expect(sources.answers.map((item) => item.id)).toEqual(["A", "B"]);
    expect(sources.answers.map((item) => item.selected)).toEqual([true, false]);
    expect(sources.answers[0].excerpts).toHaveLength(1);
    expect(sources.answers[1].excerpts).toEqual([]);
  });

  it("deduplicates one paragraph and merges its evidence kinds", () => {
    const sources = buildPredictionSources({
      pages: [fixturePage()],
      question: "Какой препарат рекомендуется?",
      answers,
      selected: ["A"],
      answerScores: answerScores(),
      questionAnchors: [],
      options: { excerptsPerAnswer: 2 },
    });

    const [excerpt] = sources.answers[0].excerpts;
    expect(sources.answers[0].excerpts).toHaveLength(1);
    expect(excerpt.evidenceKinds.sort()).toEqual(["question_chunk_answer", "recommendation_item_segment"]);
    expect(excerpt.lineStart).toBe(0);
    expect(excerpt.lineEnd).toBe(2);
    expect(excerpt.text).toContain("препарат Альфа");
    expect(excerpt.text).not.toContain("Следующая рекомендация");
  });

  it("marks one source block as mixed when support and contradiction collide", () => {
    const scores = answerScores();
    scores[0].evidence.push({
      answerId: "A",
      page: 7,
      text: "Пациентам с заболеванием рекомендуется препарат Альфа для основной терапии.",
      score: 9,
      kind: "recommendation_target_mismatch",
    });
    const sources = buildPredictionSources({
      pages: [fixturePage()],
      question: "Какой препарат рекомендуется?",
      answers,
      selected: ["A"],
      answerScores: scores,
      questionAnchors: [],
      options: { excerptsPerAnswer: 2 },
    });

    expect(sources.answers[0].excerpts).toHaveLength(1);
    expect(sources.answers[0].excerpts[0].stance).toBe("mixed");
  });

  it("returns highlight offsets that point into the displayed original text", () => {
    const sources = buildPredictionSources({
      pages: [fixturePage()],
      question: "Какой препарат рекомендуется?",
      answers,
      selected: ["A"],
      answerScores: answerScores(),
      questionAnchors: [],
    });

    const excerpt = sources.answers[0].excerpts[0];
    const highlight = excerpt.highlights.find((item) => item.role === "answer");
    expect(highlight).toBeTruthy();
    expect(excerpt.text.slice(highlight!.start, highlight!.end).toLowerCase()).toContain("препарат альфа");
  });

  it("does not invent a page fragment for evidence that cannot be localized", () => {
    const scores = answerScores();
    scores[0].evidence = [
      {
        answerId: "A",
        page: 7,
        text: "синтетический фрагмент которого нет на странице",
        score: 20,
        kind: "recommendation_item_segment",
      },
    ];
    const sources = buildPredictionSources({
      pages: [fixturePage()],
      question: "Какой препарат рекомендуется?",
      answers,
      selected: ["A"],
      answerScores: scores,
      questionAnchors: [],
    });

    expect(sources.answers[0].excerpts).toEqual([]);
  });

  it("does not match a standalone numeric option inside a larger number", () => {
    const numericAnswers = ["800", "1000", "200", "400"].map((text, index) => ({ id: String.fromCharCode(65 + index), text }));
    const page = {
      page: 2,
      lines: ["В исследовании участвовали 8000 пациентов."],
      blocks: [{ text: "В исследовании участвовали 8000 пациентов.", lineStart: 0, lineEnd: 0 }],
      text: "В исследовании участвовали 8000 пациентов.",
    };
    const sources = buildPredictionSources({
      pages: [page],
      question: "Разовая доза препарата составляет",
      answers: numericAnswers,
      selected: ["A"],
      answerScores: numericAnswers.map((answer) => ({
        answer,
        raw: 1,
        evidence: answer.id === "A"
          ? [{ answerId: "A", page: 2, text: page.text, score: 20, kind: "relation_tuple_segment" }]
          : [],
      })),
      questionAnchors: [],
    });

    expect(sources.answers[0].excerpts).toEqual([]);
  });

  it("preserves comparator, decimal, range, and slash semantics in numeric sources", () => {
    const pairs = [
      { answer: "<5%", source: "Порог риска составляет >5%." },
      { answer: "3,5", source: "Показатель находится в диапазоне 3-5." },
      { answer: "90/400", source: "Используется диапазон 90-400 мг." },
    ];

    for (const [index, pair] of pairs.entries()) {
      const page = {
        page: index + 10,
        lines: [pair.source],
        blocks: [{ text: pair.source, lineStart: 0, lineEnd: 0 }],
        text: pair.source,
      };
      const localAnswers = [pair.answer, "10", "20"].map((text, answerIndex) => ({ id: String.fromCharCode(65 + answerIndex), text }));
      const sources = buildPredictionSources({
        pages: [page],
        question: "Какой порог риска указан?",
        answers: localAnswers,
        selected: ["A"],
        answerScores: localAnswers.map((answer) => ({
          answer,
          raw: 1,
          evidence: answer.id === "A"
            ? [{ answerId: "A", page: page.page, text: pair.source, score: 20, kind: "relation_tuple_segment" }]
            : [],
        })),
        questionAnchors: [],
      });
      expect(sources.answers[0].excerpts, pair.answer).toEqual([]);
    }
  });

  it("uses the selected answer source before an unrelated question search page", () => {
    const unrelated = {
      page: 53,
      lines: ["Общая информация для пациента с заболеванием."],
      blocks: [{ text: "Общая информация для пациента с заболеванием.", lineStart: 0, lineEnd: 0 }],
      text: "Общая информация для пациента с заболеванием.",
    };
    const sources = buildPredictionSources({
      pages: [fixturePage(), unrelated],
      question: "Какой препарат рекомендуется для основной терапии заболевания?",
      answers,
      selected: ["A"],
      answerScores: answerScores(),
      questionAnchors: [{ chunk: { page: 53, text: unrelated.text }, score: 50 }],
    });

    expect(sources.question?.page).toBe(7);
    expect(sources.question?.origin).toBe("selected_answer_context");
    expect(sources.question?.highlights.some((item) => item.role === "answer")).toBe(true);
  });

  it("honors the source character limit and reports clipping", () => {
    const longText = `препарат Альфа ${"длинное описание источника ".repeat(120)}`.trim();
    const page = {
      page: 4,
      lines: [longText],
      blocks: [{ text: longText, lineStart: 0, lineEnd: 0 }],
      text: longText,
    };
    const sources = buildPredictionSources({
      pages: [page],
      question: "Какой препарат указан?",
      answers,
      selected: ["A"],
      answerScores: [
        {
          answer: answers[0],
          raw: 10,
          evidence: [{ answerId: "A", page: 4, text: longText, score: 12, kind: "recommendation_item_segment" }],
        },
        { answer: answers[1], raw: 1, evidence: [] },
      ],
      questionAnchors: [],
      options: { maxChars: 400 },
    });

    const excerpt = sources.answers[0].excerpts[0];
    expect(excerpt.text.length).toBeLessThanOrEqual(400);
    expect(excerpt.truncated).toBe(true);
    expect(excerpt.text).toContain("препарат Альфа");
  });

  it("keeps the public answer structure when source building is disabled", () => {
    expect(emptyPredictionSources(answers, ["A"])).toEqual({
      question: null,
      answers: [
        { id: "A", variant: "препарат Альфа", selected: true, excerpts: [] },
        { id: "B", variant: "препарат Бета", selected: false, excerpts: [] },
      ],
    });
  });

  it("adds sources through the public API without changing the compact prediction", async () => {
    const pdfjsLib = {
      VerbosityLevel: { ERRORS: 0 },
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            getTextContent: async () => ({
              items: [
                { str: "Лечение заболевания", transform: [1, 0, 0, 1, 20, 700], width: 120, height: 12 },
                {
                  str: "Пациентам рекомендуется препарат Альфа для основной терапии.",
                  transform: [1, 0, 0, 1, 20, 680],
                  width: 420,
                  height: 12,
                },
              ],
            }),
          }),
        }),
      }),
    };
    const common = {
      question: "Какой препарат рекомендуется для основной терапии?",
      variants: answers,
      type: "single",
      cacheKey: "source-context-public-api",
      pdfjsLib,
    };
    const withSources = await answerQuestion(new Uint8Array([1, 2, 3]), common);
    const compact = await answerQuestion(new Uint8Array([1, 2, 3]), { ...common, includeSources: false });

    expect(compact.selectedIds).toEqual(withSources.selectedIds);
    expect(compact.scores).toEqual(withSources.scores);
    expect(compact.confidence).toBe(withSources.confidence);
    expect(withSources.sources.answers.map((item) => item.id)).toEqual(["A", "B"]);
    expect(withSources.sources.answers.find((item) => item.selected)?.excerpts.length).toBeGreaterThan(0);
    expect(compact.sources.answers.every((item) => item.excerpts.length === 0)).toBe(true);
    expect(withSources.raw).not.toHaveProperty("sources");
    expect(() => JSON.stringify(withSources.sources)).not.toThrow();
  });
});
