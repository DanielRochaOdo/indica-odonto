import { describe, expect, it } from "vitest";
import { evaluate, type Val } from "@/lib/formula";
import { variation, parseInput, formatValue } from "@/lib/format";

const res = (cells: Record<string, Val>) => ({
  get: (c: string, r: number) => cells[`${c}${r}`] ?? null,
  colIndex: (c: string) => c.charCodeAt(0) - 64,
  colAt: (i: number) => String.fromCharCode(64 + i),
});

describe("rules", () => {
  it("formula over only empty cells stays empty, not zero", () => {
    expect(evaluate("=B6+B7", res({}))).toBeNull();
  });
  it("sum of totals uses the referenced cells", () => {
    expect(evaluate("=B6+B7", res({ B6: 10, B7: 5 }))).toBe(15);
  });
  it("division by zero is invalid", () => {
    expect(evaluate("=B5/B23", res({ B5: 10, B23: 0 }))).toBe("err");
  });
  it("variation requires valid values", () => {
    expect(variation(110, null)).toBeNull();
    expect(variation(110, 0)).toBeNull();
    expect(variation(90, 100)).toBeCloseTo(-0.1);
  });
  it("percent input 12,5 is stored as 0.125", () => {
    expect(parseInput("12,5", "percentual")).toEqual({ num: 0.125 });
  });
  it("empty value is not zero", () => {
    expect(parseInput("", "moeda")).toBeNull();
    expect(formatValue(null, "moeda", 2)).toBe("");
  });
});
