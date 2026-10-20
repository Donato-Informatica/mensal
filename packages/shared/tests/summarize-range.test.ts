import { describe, expect, it } from "vitest";
import { summarizeRange } from "../index.ts";
import { aRecurrence, anOccurrence } from "./builders.ts";

const zero = {
  inflowExpected: 0,
  inflowSettled: 0,
  outflowExpected: 0,
  outflowSettled: 0,
};

describe("summarizeRange", () => {
  it("gives every period of the range, ascending, with zeros when it has no occurrences", () => {
    const repair = anOccurrence({
      period: "2026-09-01",
      dueDate: "2026-09-20",
      amount: 85000,
    });

    const payload = summarizeRange({
      from: "2026-08-01",
      to: "2026-10-01",
      occurrences: [repair],
      recurrences: [],
    });

    expect(payload).toEqual({
      items: [
        { period: "2026-08-01", summary: zero },
        {
          period: "2026-09-01",
          summary: { ...zero, outflowExpected: 85000 },
        },
        { period: "2026-10-01", summary: zero },
      ],
    });
  });

  it("counts a recurrence's virtual occurrences only in the periods it is in effect", () => {
    const gym = aRecurrence({
      defaultAmount: 12000,
      startPeriod: "2026-09-01",
      endPeriod: "2026-10-01",
    });

    const payload = summarizeRange({
      from: "2026-08-01",
      to: "2026-11-01",
      occurrences: [],
      recurrences: [gym],
    });

    expect(payload.items.map(({ summary }) => summary.outflowExpected)).toEqual(
      [0, 12000, 12000, 0]
    );
  });

  it("totals each period as its summary does: skipped excluded, a missing amount as zero, a materialized occurrence in place of its virtual", () => {
    const salary = aRecurrence({
      direction: "INFLOW",
      defaultAmount: 650000,
      startPeriod: "2026-09-01",
    });
    const power = aRecurrence({
      defaultAmount: null,
      startPeriod: "2026-09-01",
    });

    const payload = summarizeRange({
      from: "2026-09-01",
      to: "2026-10-01",
      occurrences: [
        // September's salary was settled for a different amount.
        anOccurrence({
          recurrenceId: salary.id,
          direction: "INFLOW",
          status: "SETTLED",
          amount: 700000,
          period: "2026-09-01",
          dueDate: "2026-09-10",
          settledAt: "2026-09-10",
        }),
        anOccurrence({
          status: "SETTLED",
          amount: 30000,
          period: "2026-09-01",
          dueDate: "2026-09-05",
          settledAt: "2026-09-05",
        }),
        anOccurrence({
          status: "SKIPPED",
          amount: 99000,
          period: "2026-10-01",
          dueDate: "2026-10-02",
        }),
        // October's power bill had no amount yet.
        anOccurrence({
          recurrenceId: power.id,
          amount: null,
          period: "2026-10-01",
          dueDate: "2026-10-10",
        }),
      ],
      recurrences: [salary, power],
    });

    expect(payload.items).toEqual([
      {
        period: "2026-09-01",
        summary: {
          inflowExpected: 700000,
          inflowSettled: 700000,
          outflowExpected: 30000,
          outflowSettled: 30000,
        },
      },
      {
        period: "2026-10-01",
        summary: { ...zero, inflowExpected: 650000 },
      },
    ]);
  });

  it("never counts an overdue occurrence of an earlier period in a later one", () => {
    const internet = aRecurrence({
      defaultAmount: 10000,
      startPeriod: "2026-10-01",
    });

    const payload = summarizeRange({
      from: "2026-10-01",
      to: "2026-11-01",
      occurrences: [
        anOccurrence({
          amount: 85000,
          period: "2026-09-01",
          dueDate: "2026-09-20",
        }),
      ],
      recurrences: [internet],
    });

    expect(payload.items).toEqual([
      { period: "2026-10-01", summary: { ...zero, outflowExpected: 10000 } },
      { period: "2026-11-01", summary: { ...zero, outflowExpected: 10000 } },
    ]);
  });
});
