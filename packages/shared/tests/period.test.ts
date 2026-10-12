import { describe, expect, it } from "vitest";
import { monthOf, periodOfMonth, shiftPeriod } from "../index.ts";

describe("shiftPeriod", () => {
  it.each([
    ["2026-10-01", 1, "2026-11-01"],
    ["2026-10-01", -1, "2026-09-01"],
    ["2026-12-01", 1, "2027-01-01"],
    ["2026-01-01", -1, "2025-12-01"],
    ["2026-10-01", 15, "2028-01-01"],
  ])("moves %s by %i months to %s", (period, months, shifted) => {
    expect(shiftPeriod(period, months)).toBe(shifted);
  });
});

describe("periodOfMonth", () => {
  it("reads 'YYYY-MM' as its period", () => {
    expect(periodOfMonth("2026-10")).toBe("2026-10-01");
  });

  it.each(["2026-13", "2026-00", "2026-1", "202610", "2026-10-01", "outubro"])(
    "rejects %s",
    (month) => {
      expect(periodOfMonth(month)).toBeUndefined();
    }
  );
});

describe("monthOf", () => {
  it("writes a period as 'YYYY-MM'", () => {
    expect(monthOf("2026-10-01")).toBe("2026-10");
  });
});
