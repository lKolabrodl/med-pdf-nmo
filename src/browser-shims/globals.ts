import { Buffer } from "./buffer.js";
import processShim from "./process.js";

type MutableBrowserProcess = {
  env?: Record<string, string | undefined>;
  versions?: Record<string, string>;
  browser?: boolean;
  getBuiltinModule?: typeof processShim.getBuiltinModule;
};

type BrowserGlobal = {
  process?: MutableBrowserProcess;
  Buffer?: typeof Buffer;
};

/**
 * Устанавливает минимальные browser globals, которые часто ожидают Node-oriented dependency branches.
 *
 * Функция не делает браузер Node-средой: `process` остается обычным object, без Node toStringTag.
 */
export function installBrowserNodeGlobals() {
  const target = globalThis as unknown as BrowserGlobal;
  if (!target.process) {
    target.process = processShim;
  } else {
    target.process.env ??= {};
    target.process.versions ??= {};
    target.process.browser ??= true;
    target.process.getBuiltinModule ??= processShim.getBuiltinModule;
  }

  if (!target.Buffer) target.Buffer = Buffer;
}

installBrowserNodeGlobals();

export { Buffer, processShim as process };
