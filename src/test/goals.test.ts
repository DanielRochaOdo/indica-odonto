import { describe, expect, it } from "vitest";
import { goalFor, goalStatus, achievement, type Goal } from "@/lib/goals";

const g = (o: Partial<Goal>): Goal => ({ id: "x", indicator_id: "i", period: "", company: "", target: 100, direction: "up", tolerance: 0.05, note: null, ...o });

describe("goals", () => {
  it("increase: at goal green, within 5% yellow, below red", () => {
    expect(goalStatus(100, g({}))).toBe("green");
    expect(goalStatus(96, g({}))).toBe("yellow");
    expect(goalStatus(90, g({}))).toBe("red");
  });
  it("decrease: below goal green, above red", () => {
    const d = g({ direction: "down" });
    expect(goalStatus(80, d)).toBe("green");
    expect(goalStatus(104, d)).toBe("yellow");
    expect(goalStatus(120, d)).toBe("red");
  });
  it("no goal or empty value is gray", () => {
    expect(goalStatus(50, null)).toBe("none");
    expect(goalStatus(null, g({}))).toBe("none");
  });
  it("month goal beats year beats general; company goal beats any company", () => {
    const list = [g({ id: "all" }), g({ id: "y", period: "2026" }), g({ id: "m", period: "2026-03" }), g({ id: "c", period: "2026", company: "New Odonto" })];
    expect(goalFor(list, "i", "2026-03-01", null)?.id).toBe("m");
    expect(goalFor(list, "i", "2026-04-01", null)?.id).toBe("y");
    expect(goalFor(list, "i", "2026-04-01", "New Odonto")?.id).toBe("c");
    expect(goalFor(list, "i", "2025-12-01", null)?.id).toBe("all");
  });
  it("achievement for decrease goals is target/value", () => {
    expect(achievement(50, g({}))).toBeCloseTo(0.5);
    expect(achievement(200, g({ direction: "down" }))).toBeCloseTo(0.5);
  });
});
