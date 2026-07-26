import {describe, expect, it} from "vitest";
import {defineScorerFunctionContract} from "../../../../__test__/scorer-test-support.js";
import {ordinalValueToNumber, romanStageVariants} from "./index.js";

defineScorerFunctionContract(import.meta.url, {
  "index.ts": [
    "ordinalValueToNumber",
    "romanStageVariants",
  ],
});

describe("ordinal normalization", () => {
  it("normalizes Arabic and Roman stages without inventing unsupported values", () => {
    expect(ordinalValueToNumber("IV")).toBe(4);
    expect(ordinalValueToNumber("11")).toBe(11);
    expect(ordinalValueToNumber("XI")).toBeNull();
    expect(new Set(romanStageVariants("3"))).toEqual(new Set(["3", "iii"]));
  });
});
