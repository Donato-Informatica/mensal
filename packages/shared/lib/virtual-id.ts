// A virtual occurrence's id is deterministic (PRD §3.3), so the API can tell
// which recurrence and period to materialize from the id alone.

const VIRTUAL_ID =
  /^virtual_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_(\d{4}-(?:0[1-9]|1[0-2])-01)$/i;

/** The id of the virtual occurrence of `recurrenceId` in `period`. */
export function virtualId(recurrenceId: string, period: string): string {
  return `virtual_${recurrenceId}_${period}`;
}

/** The recurrence and period a virtual id names, or undefined when it is not one. */
export function parseVirtualId(
  id: string
): { recurrenceId: string; period: string } | undefined {
  const match = VIRTUAL_ID.exec(id);
  return match ? { recurrenceId: match[1]!, period: match[2]! } : undefined;
}
