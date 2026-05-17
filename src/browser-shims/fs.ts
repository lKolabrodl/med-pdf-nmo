import * as promises from "./fs-promises.js";

/**
 * Browser shim для `node:fs`.
 *
 * Runtime predictor принимает PDF как bytes/File/Blob/URL и не требует доступа к файловой системе.
 * Эти exports нужны для bundler alias-ов, когда optional Node branches попадают в dependency graph.
 */
function unavailable(name: string): never {
  throw new Error(`node:fs ${name}() is not available in the browser.`);
}

export { promises };

export function readFileSync(): never {
  return unavailable("readFileSync");
}

export function writeFileSync(): never {
  return unavailable("writeFileSync");
}

export function existsSync(): false {
  return false;
}

export function statSync(): never {
  return unavailable("statSync");
}

export default { promises, readFileSync, writeFileSync, existsSync, statSync };
