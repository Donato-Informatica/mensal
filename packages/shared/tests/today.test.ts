import { describe, expect, it } from "vitest";
import { currentPeriod, today } from "../index.ts";

describe("today", () => {
  it("is still the previous day in São Paulo shortly after UTC midnight", () => {
    expect(today(new Date("2026-11-01T01:00:00Z"))).toBe("2026-10-31");
  });

  it("turns over at midnight in São Paulo (03:00 UTC)", () => {
    expect(today(new Date("2026-11-01T03:00:00Z"))).toBe("2026-11-01");
  });
});

describe("currentPeriod", () => {
  it("is still the previous month at 01:00 UTC on the 1st", () => {
    expect(currentPeriod(new Date("2026-11-01T01:00:00Z"))).toBe("2026-10-01");
  });

  it("is the new month once the 1st begins in São Paulo", () => {
    expect(currentPeriod(new Date("2026-11-01T03:00:00Z"))).toBe("2026-11-01");
  });

  it("is still December of the previous year at 01:00 UTC on New Year's Day", () => {
    expect(currentPeriod(new Date("2027-01-01T01:00:00Z"))).toBe("2026-12-01");
  });
});
