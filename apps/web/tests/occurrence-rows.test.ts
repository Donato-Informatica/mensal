import type { PeriodItem, PeriodPayload } from "@mensal/shared";
import { describe, expect, it } from "vitest";
import { occurrenceRows } from "../src/occurrence-rows.ts";

const today = "2026-10-12";

function item(id: string, overrides: Partial<PeriodItem> = {}): PeriodItem {
  return {
    id,
    isVirtual: false,
    recurrenceId: null,
    direction: "OUTFLOW",
    description: id,
    status: "PENDING",
    amount: 1000,
    period: "2026-10-01",
    dueDate: "2026-10-20",
    settledAt: null,
    notes: null,
    overdue: false,
    ...overrides,
  };
}

function payload(
  items: PeriodItem[],
  overdueFromPreviousPeriods: PeriodItem[] = []
): PeriodPayload {
  return {
    period: "2026-10-01",
    summary: {
      inflowExpected: 0,
      inflowSettled: 0,
      outflowExpected: 0,
      outflowSettled: 0,
    },
    items,
    overdueFromPreviousPeriods,
  };
}

const view = (rows: ReturnType<typeof occurrenceRows>) =>
  rows.map((row) => [row.item.id, row.situation]);

describe("occurrenceRows", () => {
  const items = [
    item("settled", { status: "SETTLED", dueDate: "2026-10-03" }),
    item("skipped", { status: "SKIPPED", dueDate: "2026-10-04" }),
    item("later", { dueDate: "2026-10-25" }),
    item("undated", { dueDate: null }),
    item("soon", { dueDate: "2026-10-15" }),
    item("today", { dueDate: today }),
    item("late", { dueDate: "2026-10-05", overdue: true }),
  ];
  const earlier = item("earlier", {
    period: "2026-09-01",
    dueDate: "2026-09-10",
    overdue: true,
  });

  it("gives each row its Situação, in the list's group order", () => {
    expect(view(occurrenceRows(payload(items), today))).toEqual([
      ["late", "Atrasada"],
      ["today", "Vence hoje"],
      ["later", "A vencer"],
      ["undated", "A vencer"],
      ["soon", "A vencer"],
      ["settled", "Liquidada"],
      ["skipped", "Pulada"],
    ]);
  });

  it("keeps the payload's order within a group, with undated occurrences last in A vencer", () => {
    const ordered = [
      item("a", { dueDate: "2026-10-15" }),
      item("b", { dueDate: "2026-10-25" }),
      item("c", { dueDate: null }),
    ];
    expect(view(occurrenceRows(payload(ordered), today))).toEqual([
      ["a", "A vencer"],
      ["b", "A vencer"],
      ["c", "A vencer"],
    ]);
  });

  it("puts overdue occurrences of earlier periods first", () => {
    expect(view(occurrenceRows(payload(items, [earlier]), today))).toEqual([
      ["earlier", "Atrasada"],
      ["late", "Atrasada"],
      ["today", "Vence hoje"],
      ["later", "A vencer"],
      ["undated", "A vencer"],
      ["soon", "A vencer"],
      ["settled", "Liquidada"],
      ["skipped", "Pulada"],
    ]);
  });

  it("can leave out the overdue occurrences of earlier periods", () => {
    const rows = occurrenceRows(payload(items, [earlier]), today, {
      includePreviousPeriods: false,
    });
    expect(rows.map((row) => row.item.id)).not.toContain("earlier");
    expect(rows).toHaveLength(items.length);
  });

  it("is empty for an empty month", () => {
    expect(occurrenceRows(payload([]), today)).toEqual([]);
  });
});
