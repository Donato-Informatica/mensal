import type { Occurrence, OccurrenceEdit } from "./schemas.ts";
import { periodOf } from "./today.ts";

/**
 * Why `edit` cannot apply to `occurrence` (PRD §5.8), as the API's error code,
 * or undefined when it can. The edit never changes the status, so a settled
 * occurrence keeps needing an amount, and only a settled one has a date.
 */
export function editRefusal(
  occurrence: Pick<Occurrence, "period" | "status">,
  { dueDate, amount, settledAt }: OccurrenceEdit
):
  | "DUE_DATE_OUTSIDE_PERIOD"
  | "OCCURRENCE_NOT_SETTLED"
  | "AMOUNT_REQUIRED_TO_SETTLE"
  | undefined {
  if (dueDate && periodOf(dueDate) !== occurrence.period) {
    return "DUE_DATE_OUTSIDE_PERIOD";
  }
  if (settledAt !== undefined && occurrence.status !== "SETTLED") {
    return "OCCURRENCE_NOT_SETTLED";
  }
  if (amount === null && occurrence.status === "SETTLED") {
    return "AMOUNT_REQUIRED_TO_SETTLE";
  }
  return undefined;
}
