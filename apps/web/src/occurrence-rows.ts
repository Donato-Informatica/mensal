import type { PeriodItem, PeriodPayload, Situation } from "@mensal/shared";
import { groupOccurrences, type OccurrenceGroup } from "./occurrence-groups.ts";

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
  return groupOccurrences(source, today).flatMap(({ key, title, items }) =>
    items.map((item) => ({
      item,
      group: title,
      situation: situationOf(key, item),
    }))
  );
}

function situationOf(
  group: OccurrenceGroup["key"],
  item: PeriodItem
): Situation {
  switch (group) {
    case "overdue":
      return "Atrasada";
    case "today":
      return "Vence hoje";
    case "upcoming":
      return "A vencer";
    case "closed":
      return item.status === "SKIPPED" ? "Pulada" : "Liquidada";
  }
}
