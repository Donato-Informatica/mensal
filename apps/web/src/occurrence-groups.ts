import type { PeriodItem, PeriodPayload } from "@mensal/shared";

export interface OccurrenceGroup {
  /** Stable identity; the title is only what the list shows. */
  key: "overdue" | "today" | "upcoming" | "closed";
  title: string;
  items: PeriodItem[];
}

/**
 * The monthly screen's groups, in order, leaving out the empty ones (PRD §7.4).
 * Each keeps the payload's order: by due date, those without one last.
 * `today` is 'YYYY-MM-DD' in America/Sao_Paulo.
 */
export function groupOccurrences(
  { items, overdueFromPreviousPeriods }: PeriodPayload,
  today: string
): OccurrenceGroup[] {
  const upcoming = items.filter(
    (item) => item.status === "PENDING" && !item.overdue
  );
  const groups: OccurrenceGroup[] = [
    {
      key: "overdue",
      title: "Atrasadas",
      // Earlier periods come first, as their due dates do.
      items: [
        ...overdueFromPreviousPeriods,
        ...items.filter((item) => item.overdue),
      ],
    },
    {
      key: "today",
      title: "Vencem hoje",
      items: upcoming.filter((item) => item.dueDate === today),
    },
    {
      key: "upcoming",
      title: "A vencer no mês",
      items: upcoming.filter((item) => item.dueDate !== today),
    },
    {
      key: "closed",
      title: "Liquidadas e puladas",
      items: items.filter((item) => item.status !== "PENDING"),
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}
