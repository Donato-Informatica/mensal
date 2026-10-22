import {
  situationOf,
  type PeriodItem,
  type PeriodPayload,
  type Situation,
} from "@mensal/shared";
import { groupOccurrences } from "./occurrence-groups.ts";

export interface OccurrenceRow {
  item: PeriodItem;
  situation: Situation;
  /** Title of the group the list shows it in. */
  group: string;
}

/**
 * The period's occurrences as one sequence, in the list's group order: overdue
 * (earlier periods first), due today, upcoming, then settled and skipped.
 * `today` is 'YYYY-MM-DD' in America/Sao_Paulo. With `includePreviousPeriods`
 * false, the overdue occurrences of earlier periods are left out.
 */
export function occurrenceRows(
  payload: PeriodPayload,
  today: string,
  { includePreviousPeriods = true }: { includePreviousPeriods?: boolean } = {}
): OccurrenceRow[] {
  const source = includePreviousPeriods
    ? payload
    : { ...payload, overdueFromPreviousPeriods: [] };
  return groupOccurrences(source, today).flatMap(({ title, items }) =>
    items.map((item) => ({
      item,
      group: title,
      situation: situationOf(item, today),
    }))
  );
}
