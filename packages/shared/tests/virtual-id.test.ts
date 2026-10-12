import { describe, expect, it } from "vitest";
import { parseVirtualId, resolvePeriod } from "../index.ts";

const recurrenceId = "5d2c8a4b-1e3f-4b6a-8c9d-2a7e6f1b3c40";

describe("parseVirtualId", () => {
  it("reads the recurrence and period of a virtual occurrence's id", () => {
    const [virtual] = resolvePeriod({
      period: "2026-10-01",
      today: "2026-10-12",
      occurrences: [],
      recurrences: [
        {
          id: recurrenceId,
          direction: "OUTFLOW",
          description: "Aluguel",
          defaultAmount: 220000,
          dueDay: 10,
          startPeriod: "2026-10-01",
          endPeriod: null,
        },
      ],
    }).items;

    expect(parseVirtualId(virtual!.id)).toEqual({
      recurrenceId,
      period: "2026-10-01",
    });
  });

  it.each([
    ["a persisted occurrence's uuid", "0b6f6c1e-7a51-4d1a-9a8e-3f1f4c2d9b10"],
    ["a recurrence id that is not a uuid", "virtual_rent_2026-10-01"],
    ["a period that is not the 1st", `virtual_${recurrenceId}_2026-10-15`],
    ["a month that does not exist", `virtual_${recurrenceId}_2026-13-01`],
    ["trailing text", `virtual_${recurrenceId}_2026-10-01x`],
  ])("rejects %s", (_, id) => {
    expect(parseVirtualId(id)).toBeUndefined();
  });
});
