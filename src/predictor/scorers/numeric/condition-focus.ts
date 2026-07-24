import {uniqueTokens} from "./dependencies.js";

const CONDITION_NUMBER_GENERIC_FOCUS = new Set(
  [
    "\u0440\u0438\u0441\u043a",
    "\u0441\u043e\u0441\u0442\u0430\u0432\u043b\u044f\u0435\u0442",
    "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434",
    "\u043f\u0430\u0446\u0438\u0435\u043d\u0442",
    "\u043c\u0430\u0442\u0435\u0440\u0435\u0439",
    "\u043f\u043e\u043b\u043e\u0436\u0438\u0442\u0435\u043b\u044c\u043d",
    "\u043e\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043b\u044c\u043d",
    "\u0442\u044f\u0436\u0435\u043b\u044b\u043c",
    "\u0442\u044f\u0436\u0435\u043b\u043e\u043c",
    "\u0441\u0440\u0435\u0434\u043d\u0435\u0439",
    "\u0446\u0438\u0440\u0440\u043e\u0437",
    "hbeag",
  ].flatMap((item) => uniqueTokens(item)),
);

export function specificConditionNumberFocusTokens(focusTokens: string[]): string[] {
  return (focusTokens ?? []).filter((token) => token.length >= 4 && !/^\d/.test(token) && !CONDITION_NUMBER_GENERIC_FOCUS.has(token));
}
