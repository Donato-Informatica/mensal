import type { Occurrence, Recurrence } from "../index.ts";

let sequence = 0;

/** A uuid that is unique within a test run. */
function uuid(): string {
  sequence += 1;
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

export function aRecurrence(overrides: Partial<Recurrence> = {}): Recurrence {
  return {
    id: uuid(),
    userId: "user-1",
    direction: "OUTFLOW",
    description: "Aluguel",
    defaultAmount: 220000,
    dueDay: 10,
    startPeriod: "2026-01-01",
    endPeriod: null,
    notes: null,
    createdAt: "2026-01-01T12:00:00.000Z",
    updatedAt: "2026-01-01T12:00:00.000Z",
    ...overrides,
  };
}

export function anOccurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    id: uuid(),
    userId: "user-1",
    recurrenceId: null,
    direction: "OUTFLOW",
    description: "Conserto do carro",
    status: "PENDING",
    amount: 85000,
    period: "2026-10-01",
    dueDate: "2026-10-20",
    settledAt: null,
    notes: null,
    createdAt: "2026-10-01T12:00:00.000Z",
    updatedAt: "2026-10-01T12:00:00.000Z",
    ...overrides,
  };
}
