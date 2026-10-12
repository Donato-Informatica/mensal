import { describe, expect, it } from "vitest";
import {
  NewRecurrenceSchema,
  OccurrenceSchema,
  RecurrenceSchema,
  VirtualOccurrenceSchema,
} from "../index.ts";

const recurrence = {
  id: "5d2c8a4b-1e3f-4b6a-8c9d-2a7e6f1b3c40",
  userId: "user-1",
  direction: "OUTFLOW",
  description: "Aluguel",
  defaultAmount: 220000,
  dueDay: 10,
  startPeriod: "2026-10-01",
  endPeriod: null,
  notes: null,
  createdAt: "2026-10-01T12:00:00.000Z",
  updatedAt: "2026-10-01T12:00:00.000Z",
};

const occurrence = {
  id: "0b6f6c1e-7a51-4d1a-9a8e-3f1f4c2d9b10",
  userId: "user-1",
  recurrenceId: null,
  direction: "OUTFLOW",
  description: "Conserto do carro",
  status: "SETTLED",
  amount: 85000,
  period: "2026-10-01",
  dueDate: "2026-10-15",
  settledAt: "2026-10-14",
  notes: null,
  createdAt: "2026-10-01T12:00:00.000Z",
  updatedAt: "2026-10-14T12:00:00.000Z",
};

describe("RecurrenceSchema", () => {
  it("accepts a valid recurrence", () => {
    expect(RecurrenceSchema.parse(recurrence)).toEqual(recurrence);
  });

  it("rejects a start period that is not the 1st of a month", () => {
    expect(
      RecurrenceSchema.safeParse({ ...recurrence, startPeriod: "2026-10-05" })
        .success
    ).toBe(false);
  });

  it("rejects a due day outside 1 to 31", () => {
    expect(
      RecurrenceSchema.safeParse({ ...recurrence, dueDay: 32 }).success
    ).toBe(false);
  });

  it("rejects a description longer than 120 characters", () => {
    expect(
      RecurrenceSchema.safeParse({
        ...recurrence,
        description: "x".repeat(121),
      }).success
    ).toBe(false);
  });
});

describe("NewRecurrenceSchema", () => {
  const newRecurrence = {
    direction: "OUTFLOW",
    description: "Aluguel",
    defaultAmount: 220000,
    dueDay: 10,
    startPeriod: "2026-10-01",
    endPeriod: "2027-09-01",
    notes: "Contrato de 12 meses",
  };

  it("accepts a recurrence to create", () => {
    expect(NewRecurrenceSchema.parse(newRecurrence)).toEqual(newRecurrence);
  });

  it("accepts a variable amount, no due day, no end and no notes", () => {
    const open = {
      ...newRecurrence,
      defaultAmount: null,
      dueDay: null,
      endPeriod: null,
      notes: null,
    };
    expect(NewRecurrenceSchema.parse(open)).toEqual(open);
  });

  it("accepts an end period equal to the start period", () => {
    expect(
      NewRecurrenceSchema.safeParse({
        ...newRecurrence,
        endPeriod: "2026-10-01",
      }).success
    ).toBe(true);
  });

  it("rejects an end period before the start period, on endPeriod", () => {
    const result = NewRecurrenceSchema.safeParse({
      ...newRecurrence,
      endPeriod: "2026-09-01",
    });
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["endPeriod"],
    ]);
  });

  it.each([
    ["an empty description", { description: "   " }],
    [
      "a description longer than 120 characters",
      { description: "x".repeat(121) },
    ],
    ["a zero amount", { defaultAmount: 0 }],
    ["a due day of 0", { dueDay: 0 }],
    ["a due day of 32", { dueDay: 32 }],
    ["a start period that is not the 1st", { startPeriod: "2026-10-05" }],
    ["an unknown direction", { direction: "SIDEWAYS" }],
  ])("rejects %s", (_, override) => {
    expect(
      NewRecurrenceSchema.safeParse({ ...newRecurrence, ...override }).success
    ).toBe(false);
  });

  it("trims the description and keeps blank notes as none", () => {
    expect(
      NewRecurrenceSchema.parse({
        ...newRecurrence,
        description: "  Aluguel  ",
        notes: "  ",
      })
    ).toMatchObject({ description: "Aluguel", notes: null });
  });
});

describe("OccurrenceSchema", () => {
  it("accepts a valid occurrence", () => {
    expect(OccurrenceSchema.parse(occurrence)).toEqual(occurrence);
  });

  it("rejects an amount that is not a positive integer of cents", () => {
    for (const amount of [0, -100, 10.5]) {
      expect(
        OccurrenceSchema.safeParse({ ...occurrence, amount }).success
      ).toBe(false);
    }
  });

  it("rejects an unknown status", () => {
    expect(
      OccurrenceSchema.safeParse({ ...occurrence, status: "OVERDUE" }).success
    ).toBe(false);
  });

  it("rejects a due date that is not a calendar date", () => {
    expect(
      OccurrenceSchema.safeParse({ ...occurrence, dueDate: "2026-02-30" })
        .success
    ).toBe(false);
  });
});

describe("VirtualOccurrenceSchema", () => {
  const virtual = {
    id: "virtual_5d2c8a4b-1e3f-4b6a-8c9d-2a7e6f1b3c40_2026-10-01",
    recurrenceId: "5d2c8a4b-1e3f-4b6a-8c9d-2a7e6f1b3c40",
    isVirtual: true,
    direction: "OUTFLOW",
    description: "Aluguel",
    status: "PENDING",
    amount: null,
    period: "2026-10-01",
    dueDate: "2026-10-10",
    settledAt: null,
    notes: null,
  };

  it("accepts a pending virtual occurrence", () => {
    expect(VirtualOccurrenceSchema.parse(virtual)).toEqual(virtual);
  });

  it("rejects a virtual occurrence that is not pending", () => {
    expect(
      VirtualOccurrenceSchema.safeParse({ ...virtual, status: "SETTLED" })
        .success
    ).toBe(false);
  });
});
