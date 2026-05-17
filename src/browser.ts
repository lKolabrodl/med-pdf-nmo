/**
 * Точка входа для браузерной сборки.
 *
 * Скрипт сборки превращает этот файл в:
 * - `dist/nmo-pdf-easy.browser.js` с глобальным объектом `NmoPdfEasy`
 * - `dist/nmo-pdf-easy.browser.mjs` как браузерный ESM-бандл
 */
import "./browser-shims/globals.js";

export { answerQuestion, predict, clearPredictorCache, setPdfJsLib } from "./index.js";
