import type { Recurrence } from "./schemas.ts";

/** Whether `recurrence` projects an occurrence in `period` ('YYYY-MM-01'). */
export function isInEffect(
  recurrence: Pick<Recurrence, "startPeriod" | "endPeriod">,
  period: string
): boolean {
  return (
    recurrence.startPeriod <= period &&
    (recurrence.endPeriod === null || recurrence.endPeriod >= period)
  );
}

/**
 * Whether `recurrence` is active in `currentPeriod`: not ended before it,
 * those starting later included (PRD §3.1).
 */
export function isActive(
  recurrence: Pick<Recurrence, "endPeriod">,
  currentPeriod: string
): boolean {
  return recurrence.endPeriod === null || recurrence.endPeriod >= currentPeriod;
}
