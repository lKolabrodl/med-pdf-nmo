/**
 * Точка входа для браузерной сборки.
 *
 * Скрипт сборки превращает этот файл в:
 * - `dist/med-pdf-nmo.browser.js` с глобальным объектом `MedPdfNmo`
 * - `dist/med-pdf-nmo.browser.mjs` как браузерный ESM-бандл
 */
import "./browser-shims/globals.js";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { setPdfJsLib } from "./pdf.js";

setPdfJsLib(pdfjsLib);

export {
  PredictorEngine,
  answerQuestion,
  predict,
  createPredictorEngine,
  clearPredictorCache,
  setPdfJsLib,
} from "./index.js";
export type {
  AnswerQuestionOptions,
  AnswerQuestionResult,
  AnswerVariant,
  AnswerMode,
  AnswerOption,
  AnswerSources,
  EvidenceItem,
  PdfInput,
  PredictionSource,
  PredictionSources,
  PredictorMeta,
  PredictorInput,
  PredictorOptions,
  PredictorResult,
  SourceExcerpt,
  SourceHighlight,
  SourcePage,
} from "./index.js";
