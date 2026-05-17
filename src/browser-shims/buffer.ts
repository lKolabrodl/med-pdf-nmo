function from(input: string | ArrayBuffer | ArrayBufferView | ArrayLike<number>, encoding = "utf8") {
  if (typeof input === "string") {
    if (encoding && !/^utf-?8$/iu.test(encoding)) {
      throw new Error(`Browser Buffer shim supports only utf8 strings, got "${encoding}".`);
    }
    return new Uint8Array(new TextEncoder().encode(input));
  }

  if (input instanceof ArrayBuffer) return new Uint8Array(input.slice(0));

  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength));
  }

  return new Uint8Array(Array.from(input));
}

/**
 * Минимальный browser-compatible `Buffer`, достаточный для `Buffer.from(...)` в пользовательском коде.
 *
 * Это не полный polyfill Node.js Buffer. Для runtime predictor достаточно `Uint8Array`, поэтому shim
 * намеренно покрывает только безопасное преобразование строк, ArrayBuffer и array-like данных в bytes.
 */
export const Buffer = {
  /**
   * Создает byte buffer из строки, ArrayBuffer, TypedArray или массива чисел.
   *
   * @param input Данные, которые нужно представить как `Uint8Array`.
   * @param encoding Поддерживается только `utf8`/`utf-8` для строк.
   * @returns Uint8Array-совместимый объект с именем `Buffer`.
   */
  from,
};

export default { Buffer };
