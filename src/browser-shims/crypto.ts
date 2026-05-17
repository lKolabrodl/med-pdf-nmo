/**
 * Browser shim для небольшого подмножества `node:crypto`.
 *
 * Predictor использует Web Crypto через browser/PDF.js окружение. Этот файл нужен как alias target
 * для bundler-ов, которые встречают `crypto` или `node:crypto` в optional browser dependency branches.
 */
export const webcrypto = globalThis.crypto;

/**
 * Заполняет TypedArray криптографически случайными байтами через Web Crypto.
 *
 * @param array TypedArray, который нужно заполнить.
 * @returns Тот же TypedArray после заполнения.
 */
export function getRandomValues<T extends ArrayBufferView>(array: T): T {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Web Crypto getRandomValues() is not available in this browser.");
  }
  (globalThis.crypto.getRandomValues as any)(array);
  return array;
}

/**
 * Возвращает UUID через Web Crypto, либо генерирует RFC4122 v4 fallback из случайных байтов.
 *
 * @returns UUID string.
 */
export function randomUUID() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex
    .slice(8, 10)
    .join("")}-${hex.slice(10, 16).join("")}`;
}

/**
 * Заглушка для Node-only hashing API.
 *
 * @throws Всегда, потому что `createHash` не имеет совместимого синхронного browser API.
 */
export function createHash() {
  throw new Error("node:crypto createHash() is not available in the browser shim.");
}

export default { webcrypto, getRandomValues, randomUUID, createHash };
