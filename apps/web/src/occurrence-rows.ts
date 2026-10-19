import type { PeriodItem, PeriodPayload } from "@mensal/shared";
import { groupOccurrences } from "./occurrence-groups.ts";

/** Where an occurrence stands, as the table and the CSV name it (PRD §7.4). */
export type Situation =
  "Atrasada" | "Vence hoje" | "A vencer" | "Liquidada" | "Pulada";

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
      situation: situationOf(title, item),
    }))
  );
}

function situationOf(group: string, item: PeriodItem): Situation {
  switch (group) {
    case "Atrasadas":
      return "Atrasada";
    case "Vencem hoje":
      return "Vence hoje";
    case "A vencer no mês":
      return "A vencer";
    default:
      return item.status === "SKIPPED" ? "Pulada" : "Liquidada";
  }
}
