import { predict, clearPredictorCache } from "./predictor.js";
import { setPdfJsLib } from "./pdf.js";

export { predict, clearPredictorCache, setPdfJsLib };

/**
 * PDF-вход, который принимает высокоуровневый API.
 *
 * В Node.js обычно передается Buffer/Uint8Array или ArrayBuffer. В браузере
 * можно передавать File или Blob. Строка считается URL и загружается через
 * fetch.
 */
export type PdfInput =
  | string
  | ArrayBuffer
  | Uint8Array
  | Blob
  | {
      arrayBuffer(): Promise<ArrayBuffer>;
    };

/**
 * Вариант ответа, который принимает {@link answerQuestion}.
 *
 * Для строковых вариантов автоматически создаются id: A, B, C и далее.
 * Объектные варианты могут передавать стабильные id, которые вернутся в
 * `selectedIds`.
 */
export type AnswerVariant =
  | string
  | {
      id?: string | number;
      text?: string;
    };

/**
 * Параметры ответа на один вопрос НМО по одному PDF с медицинскими
 * рекомендациями.
 */
export interface AnswerQuestionOptions {
  /** Текст вопроса из задания НМО. */
  question: string;
  /** Варианты ответа. Алиас: `answers`. */
  variants?: AnswerVariant[];
  /** Альтернативное имя для `variants`. */
  answers?: AnswerVariant[];
  /** Режим вопроса: один ответ или точное множество нескольких ответов. */
  type?: "single" | "multi" | string;
  /** Альтернативное имя для `type`. */
  mode?: "single" | "multi" | string;
  /** Необязательный ключ кеша для повторного использования текста PDF. */
  cacheKey?: string;
  /** Явно переданный модуль PDF.js, полезно для браузерного окружения. */
  pdfjsLib?: any;
}

/**
 * Высокоуровневый результат, который возвращает {@link answerQuestion}.
 */
export interface AnswerQuestionResult {
  /** Тексты выбранных ответов. */
  selected: string[];
  /** ID выбранных ответов. */
  selectedIds: string[];
  /** Итоговый режим, использованный predictor. */
  mode: string;
  /** Относительная уверенность выбранного ответа или набора ответов. */
  confidence: number;
  /** Калиброванные и сырые score по каждому варианту. */
  scores: Array<{
    id: string;
    variant: string;
    score: number;
    raw: number;
  }>;
  /** Исходный низкоуровневый результат predictor. */
  raw: any;
  /** Фрагменты PDF и evidence, использованные при скоринге. */
  evidence: any;
  /** Runtime-метаданные, например число страниц и признак необходимости OCR. */
  meta: any;
}

/**
 * Отвечает на один вопрос НМО по содержимому PDF с медицинскими рекомендациями.
 *
 * Удобная обертка принимает варианты строками или объектами `{ id, text }`,
 * вызывает локальный non-LLM predictor и сопоставляет выбранные id обратно с
 * пользовательскими текстами ответов.
 *
 * @param pdf PDF-файл, байты, Blob/File, ArrayBuffer, Uint8Array или URL.
 * @param options Текст вопроса, варианты ответа и необязательные runtime-настройки.
 * @returns Выбранные ответы, id, confidence, score по вариантам и evidence.
 */
export async function answerQuestion(
  pdf: PdfInput,
  options: AnswerQuestionOptions = { question: "" },
): Promise<AnswerQuestionResult> {
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
