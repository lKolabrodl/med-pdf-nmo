/**
 * Небольшой POSIX-like browser shim для `node:path`.
 *
 * Покрывает частые операции, которые bundler/dependency code может вызвать для URL-like путей.
 */
function cleanParts(parts: string[]) {
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out;
}

export const sep = "/";
export const delimiter = ":";

/**
 * Склеивает части пути через `/`.
 */
export function join(...parts: string[]) {
  return normalize(parts.filter(Boolean).join("/"));
}

/**
 * Нормализует `.` и `..` в POSIX-like пути.
 */
export function normalize(value: string) {
  const absolute = value.startsWith("/");
  const suffix = value.endsWith("/") ? "/" : "";
  const body = cleanParts(value.split("/")).join("/");
  return `${absolute ? "/" : ""}${body || (absolute ? "" : ".")}${body ? suffix : ""}`;
}

/**
 * Возвращает последнюю часть пути.
 */
export function basename(value: string, ext = "") {
  const base = value.split("/").filter(Boolean).pop() ?? "";
  return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
}

/**
 * Возвращает путь без последней части.
 */
export function dirname(value: string) {
  const parts = value.split("/").filter(Boolean);
  parts.pop();
  return value.startsWith("/") ? `/${parts.join("/")}` : parts.join("/") || ".";
}

/**
 * Возвращает расширение файла, включая точку.
 */
export function extname(value: string) {
  const base = basename(value);
  const index = base.lastIndexOf(".");
  return index > 0 ? base.slice(index) : "";
}

/**
 * Делает путь абсолютным относительно корня `/`.
 */
export function resolve(...parts: string[]) {
  return normalize(`/${join(...parts)}`);
}

export const posix = { sep, delimiter, join, normalize, basename, dirname, extname, resolve };

export default { sep, delimiter, join, normalize, basename, dirname, extname, resolve, posix };
