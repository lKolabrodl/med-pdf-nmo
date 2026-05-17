/**
 * Browser shim для `node:fs/promises`.
 *
 * Файловая система недоступна в браузере. Экспортируемые функции существуют только как alias target,
 * чтобы optional Node branches в зависимостях не ломали сборку приложения.
 */
function unavailable(name: string): never {
  throw new Error(`node:fs/promises ${name}() is not available in the browser.`);
}

export async function readFile(): Promise<never> {
  return unavailable("readFile");
}

export async function writeFile(): Promise<never> {
  return unavailable("writeFile");
}

export async function mkdir(): Promise<never> {
  return unavailable("mkdir");
}

export async function rm(): Promise<never> {
  return unavailable("rm");
}

export async function stat(): Promise<never> {
  return unavailable("stat");
}

export default { readFile, writeFile, mkdir, rm, stat };
