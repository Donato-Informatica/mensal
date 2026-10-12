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
