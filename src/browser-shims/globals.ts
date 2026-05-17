import { Buffer } from "./buffer.js";
import processShim from "./process.js";

/**
 * Устанавливает минимальные browser globals, которые часто ожидают Node-oriented dependency branches.
 *
 * Функция не делает браузер Node-средой: `process` остается обычным object, без Node toStringTag.
 */
export function installBrowserNodeGlobals() {
  const target = globalThis as any;
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
