import { predict, clearPredictorCache } from "./predictor.js";
import { setPdfJsLib } from "./pdf.js";

export { predict, clearPredictorCache, setPdfJsLib };

export async function answerQuestion(pdf: any, options: any = {}) {
  const variants = options.variants ?? options.answers ?? [];
  const answers = variants.map((item, index) => {
    if (typeof item === "string") {
      return { id: String.fromCharCode(65 + index), text: item };
    }
    return {
      id: String(item.id ?? String.fromCharCode(65 + index)),
      text: String(item.text ?? ""),
    };
  });

  const output = await predict(
    {
      pdfData: pdf,
      cacheKey: options.cacheKey,
      question: options.question,
      answers,
      mode: options.type ?? options.mode ?? "single",
    },
    { pdfjsLib: options.pdfjsLib },
  );

  const selectedAnswers = output.selected
    .map((id) => answers.find((answer) => answer.id === id))
    .filter(Boolean);

  return {
    selected: selectedAnswers.map((answer) => answer.text),
    selectedIds: selectedAnswers.map((answer) => answer.id),
    mode: output.mode,
    confidence: output.confidence,
    scores: answers.map((answer) => ({
      id: answer.id,
      variant: answer.text,
      score: output.scores[answer.id] ?? 0,
      raw: output.rawScores[answer.id] ?? 0,
    })),
    raw: output,
    evidence: output.evidence,
    meta: output.meta,
  };
}
