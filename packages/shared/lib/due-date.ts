/**
 * The due date in `period` ('YYYY-MM-01') for a recurrence's `dueDay`. A day
 * past the end of the month is clamped to the month's last day:
 * `min(dueDay, daysInMonth(period))`. A null `dueDay` gives no due date.
 */
export function clampDueDate(
  period: string,
  dueDay: number | null
): string | null {
  if (dueDay === null) return null;
  const [year, month] = period.split("-").map(Number) as [number, number];
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(dueDay, daysInMonth);
  return `${period.slice(0, 8)}${String(day).padStart(2, "0")}`;
}
