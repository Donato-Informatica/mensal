import { describe, expect, it } from "vitest";
import { clampDueDate } from "../index.ts";

describe("clampDueDate", () => {
  it("clamps a due day past the end of a 30-day month to its last day", () => {
    expect(clampDueDate("2026-04-01", 31)).toBe("2026-04-30");
  });

  it("clamps to the 28th in February of a common year", () => {
    expect(clampDueDate("2026-02-01", 30)).toBe("2026-02-28");
  });

  it("clamps to the 29th in February of a leap year", () => {
    expect(clampDueDate("2028-02-01", 31)).toBe("2028-02-29");
  });

  it("keeps a due day that fits in the month", () => {
    expect(clampDueDate("2026-02-01", 5)).toBe("2026-02-05");
  });

  it("gives no due date when the due day is null", () => {
    expect(clampDueDate("2026-04-01", null)).toBeNull();
  });
});
