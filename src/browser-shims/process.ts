/**
 * Минимальный browser shim для `process`.
 *
 * Важно: объект не маскируется под настоящий Node.js process, чтобы PDF.js не считал браузер Node-средой.
 */
export const env: Record<string, string | undefined> = {};
export const versions: Record<string, string | undefined> = {};
export const browser = true;

/**
 * Возвращает browser shim для редких вызовов `process.getBuiltinModule(...)`.
 *
 * @param name Имя Node built-in модуля.
 * @returns Объект shim-а для известных модулей или пустой объект.
 */
export function getBuiltinModule(name: string) {
  const normalized = name.replace(/^node:/u, "");
  if (normalized === "fs") return {};
  if (normalized === "fs/promises") return {};
  if (normalized === "path" || normalized === "url" || normalized === "module" || normalized === "stream") return {};
  if (normalized === "crypto") return globalThis.crypto ?? {};
  return {};
}

export default { env, versions, browser, getBuiltinModule };
