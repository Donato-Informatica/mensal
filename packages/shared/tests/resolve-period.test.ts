import { describe, expect, it } from "vitest";
import { resolvePeriod } from "../index.ts";
import { aRecurrence, anOccurrence } from "./builders.ts";

describe("resolvePeriod", () => {
  it("lists the period's persisted occurrences as non-virtual items", () => {
    const occurrence = anOccurrence({
      period: "2026-10-01",
      dueDate: "2026-10-20",
      notes: "Oficina do João",
    });

    const payload = resolvePeriod({
      period: "2026-10-01",
      today: "2026-10-12",
      occurrences: [occurrence],
      recurrences: [],
    });

    expect(payload.period).toBe("2026-10-01");
    expect(payload.items).toEqual([
      {
        id: occurrence.id,
        isVirtual: false,
        recurrenceId: null,
        direction: "OUTFLOW",
        description: "Conserto do carro",
        status: "PENDING",
        amount: 85000,
        period: "2026-10-01",
        dueDate: "2026-10-20",
        settledAt: null,
        notes: "Oficina do João",
        overdue: false,
      },
    ]);
  });

  it("projects a recurrence in effect with no occurrence in the period as a virtual occurrence", () => {
    const recurrence = aRecurrence({
      direction: "INFLOW",
      description: "Salário",
      defaultAmount: 650000,
      dueDay: 31,
      startPeriod: "2026-10-01",
      endPeriod: "2026-11-01",
      notes: "Empresa X",
    });

    const payload = resolvePeriod({
      period: "2026-11-01",
      today: "2026-10-12",
      occurrences: [],
      recurrences: [recurrence],
    });

    expect(payload.items).toEqual([
      {
        id: `virtual_${recurrence.id}_2026-11-01`,
        isVirtual: true,
        recurrenceId: recurrence.id,
        direction: "INFLOW",
        description: "Salário",
        status: "PENDING",
        amount: 650000,
        period: "2026-11-01",
        dueDate: "2026-11-30",
        settledAt: null,
        notes: null,
        overdue: false,
      },
    ]);
  });

  it("projects only recurrences in effect for the period, end period inclusive", () => {
    const startsLater = aRecurrence({ startPeriod: "2026-11-01" });
    const endedBefore = aRecurrence({
      startPeriod: "2026-01-01",
      endPeriod: "2026-09-01",
    });
    const startsNow = aRecurrence({ startPeriod: "2026-10-01" });
    const endsNow = aRecurrence({
      startPeriod: "2026-01-01",
      endPeriod: "2026-10-01",
    });

    const payload = resolvePeriod({
      period: "2026-10-01",
      today: "2026-10-01",
      occurrences: [],
      recurrences: [startsLater, endedBefore, startsNow, endsNow],
    });

    expect(payload.items.map((item) => item.recurrenceId)).toEqual([
      startsNow.id,
      endsNow.id,
    ]);
  });

  it("does not project a recurrence that already has a persisted occurrence in the period", () => {
    const recurrence = aRecurrence({ description: "Aluguel" });
    const materialized = anOccurrence({
      recurrenceId: recurrence.id,
      description: "Aluguel (outubro)",
      period: "2026-10-01",
      status: "SKIPPED",
    });
    const elsewhere = anOccurrence({
      recurrenceId: recurrence.id,
      period: "2026-09-01",
      dueDate: "2026-09-10",
      status: "SETTLED",
      settledAt: "2026-09-10",
    });

    const payload = resolvePeriod({
      period: "2026-10-01",
      today: "2026-10-01",
      occurrences: [materialized, elsewhere],
      recurrences: [recurrence],
    });

    expect(payload.items.map((item) => item.id)).toEqual([materialized.id]);
  });

  it("orders items by due date ascending, items without a due date last", () => {
    const noDueDate = anOccurrence({ dueDate: null });
    const dueLast = anOccurrence({ dueDate: "2026-10-28" });
    const dueFirst = anOccurrence({ dueDate: "2026-10-03" });
    const virtualMid = aRecurrence({ dueDay: 15 });
    const virtualNoDueDay = aRecurrence({ dueDay: null });

    const payload = resolvePeriod({
      period: "2026-10-01",
      today: "2026-10-01",
      occurrences: [noDueDate, dueLast, dueFirst],
      recurrences: [virtualNoDueDay, virtualMid],
    });

    expect(payload.items.map((item) => item.dueDate)).toEqual([
      "2026-10-03",
      "2026-10-15",
      "2026-10-28",
      null,
      null,
    ]);
  });

  it("sums expected (pending + settled) and settled per direction, excluding skipped", () => {
    const payload = resolvePeriod({
      period: "2026-10-01",
      today: "2026-10-12",
      occurrences: [
        anOccurrence({
          direction: "INFLOW",
          status: "SETTLED",
          amount: 650000,
          settledAt: "2026-10-05",
        }),
        anOccurrence({ direction: "INFLOW", status: "SKIPPED", amount: 10000 }),
        anOccurrence({
          direction: "OUTFLOW",
          status: "SETTLED",
          amount: 220000,
          settledAt: "2026-10-09",
        }),
        anOccurrence({
          direction: "OUTFLOW",
          status: "PENDING",
          amount: 30000,
        }),
        anOccurrence({ direction: "OUTFLOW", status: "PENDING", amount: null }),
        anOccurrence({ direction: "OUTFLOW", status: "SKIPPED", amount: 5000 }),
      ],
      recurrences: [
        aRecurrence({ direction: "OUTFLOW", defaultAmount: 18000 }),
        aRecurrence({ direction: "INFLOW", defaultAmount: null }),
      ],
    });

    expect(payload.summary).toEqual({
      inflowExpected: 650000,
      inflowSettled: 650000,
      outflowExpected: 268000,
      outflowSettled: 220000,
    });
    expect(payload).not.toHaveProperty("balance");
  });

  it("flags as overdue only pending items whose due date is before today", () => {
    const pendingPast = anOccurrence({
      status: "PENDING",
      dueDate: "2026-10-11",
    });
    const pendingToday = anOccurrence({
      status: "PENDING",
      dueDate: "2026-10-12",
    });
    const pendingNoDueDate = anOccurrence({ status: "PENDING", dueDate: null });
    const settledPast = anOccurrence({
      status: "SETTLED",
      dueDate: "2026-10-05",
      settledAt: "2026-10-06",
    });
    const skippedPast = anOccurrence({
      status: "SKIPPED",
      dueDate: "2026-10-06",
    });
    const virtualPast = aRecurrence({ dueDay: 1 });

    const payload = resolvePeriod({
      period: "2026-10-01",
      today: "2026-10-12",
      occurrences: [
        pendingPast,
        pendingToday,
        pendingNoDueDate,
        settledPast,
        skippedPast,
      ],
      recurrences: [virtualPast],
    });

    const overdue = Object.fromEntries(
      payload.items.map((item) => [item.id, item.overdue])
    );
    expect(overdue).toEqual({
      [pendingPast.id]: true,
      [pendingToday.id]: false,
      [pendingNoDueDate.id]: false,
      [settledPast.id]: false,
      [skippedPast.id]: false,
      [`virtual_${virtualPast.id}_2026-10-01`]: true,
    });
  });

  describe("overdue from previous periods", () => {
    it("lists earlier pending occurrences past their due date, outside the summary", () => {
      const september = anOccurrence({
        period: "2026-09-01",
        dueDate: "2026-09-20",
        status: "PENDING",
        amount: 30000,
      });
      const august = anOccurrence({
        period: "2026-08-01",
        dueDate: "2026-08-05",
        status: "PENDING",
        amount: 12000,
      });
      const notListed = [
        anOccurrence({
          period: "2026-09-01",
          dueDate: "2026-09-10",
          status: "SETTLED",
          settledAt: "2026-09-10",
        }),
        anOccurrence({
          period: "2026-09-01",
          dueDate: "2026-09-10",
          status: "SKIPPED",
        }),
        anOccurrence({
          period: "2026-09-01",
          dueDate: null,
          status: "PENDING",
        }),
      ];

      const payload = resolvePeriod({
        period: "2026-10-01",
        today: "2026-10-12",
        occurrences: [september, ...notListed, august],
        recurrences: [],
      });

      expect(
        payload.overdueFromPreviousPeriods.map((item) => [
          item.id,
          item.period,
          item.overdue,
        ])
      ).toEqual([
        [august.id, "2026-08-01", true],
        [september.id, "2026-09-01", true],
      ]);
      expect(payload.items).toEqual([]);
      expect(payload.summary).toEqual({
        inflowExpected: 0,
        inflowSettled: 0,
        outflowExpected: 0,
        outflowSettled: 0,
      });
    });

    it("lists virtual occurrences of earlier periods within each recurrence's start and end", () => {
      const rent = aRecurrence({ startPeriod: "2026-07-01", dueDay: 31 });
      const julyRent = anOccurrence({
        recurrenceId: rent.id,
        period: "2026-07-01",
        dueDate: "2026-07-31",
        status: "SETTLED",
        settledAt: "2026-07-30",
      });
      const septemberRent = anOccurrence({
        recurrenceId: rent.id,
        period: "2026-09-01",
        dueDate: "2026-09-30",
        status: "PENDING",
      });
      const installments = aRecurrence({
        startPeriod: "2025-12-01",
        endPeriod: "2026-01-01",
        dueDay: 15,
      });
      const noDueDay = aRecurrence({ startPeriod: "2026-08-01", dueDay: null });
      const future = aRecurrence({ startPeriod: "2026-11-01", dueDay: 1 });

      const payload = resolvePeriod({
        period: "2026-10-01",
        today: "2026-10-12",
        occurrences: [julyRent, septemberRent],
        recurrences: [rent, installments, noDueDay, future],
      });

      expect(
        payload.overdueFromPreviousPeriods.map((item) => [
          item.id,
          item.dueDate,
          item.overdue,
        ])
      ).toEqual([
        [`virtual_${installments.id}_2025-12-01`, "2025-12-15", true],
        [`virtual_${installments.id}_2026-01-01`, "2026-01-15", true],
        [`virtual_${rent.id}_2026-08-01`, "2026-08-31", true],
        [septemberRent.id, "2026-09-30", true],
      ]);
    });

    it("lists nothing when the period is not the current one", () => {
      const overdueInAugust = anOccurrence({
        period: "2026-08-01",
        dueDate: "2026-08-05",
        status: "PENDING",
      });
      const recurrence = aRecurrence({ startPeriod: "2026-07-01", dueDay: 5 });

      for (const period of ["2026-09-01", "2026-11-01"]) {
        const payload = resolvePeriod({
          period,
          today: "2026-10-12",
          occurrences: [overdueInAugust],
          recurrences: [recurrence],
        });
        expect(payload.overdueFromPreviousPeriods).toEqual([]);
      }
    });

    it("reaches back across the year boundary when the current period is January", () => {
      const recurrence = aRecurrence({ startPeriod: "2026-11-01", dueDay: 20 });
      const november = anOccurrence({
        recurrenceId: recurrence.id,
        period: "2026-11-01",
        dueDate: "2026-11-20",
        status: "SETTLED",
        settledAt: "2026-11-20",
      });

      const payload = resolvePeriod({
        period: "2027-01-01",
        today: "2027-01-08",
        occurrences: [november],
        recurrences: [recurrence],
      });

      expect(payload.overdueFromPreviousPeriods.map((item) => item.id)).toEqual(
        [`virtual_${recurrence.id}_2026-12-01`]
      );
    });
  });
});
