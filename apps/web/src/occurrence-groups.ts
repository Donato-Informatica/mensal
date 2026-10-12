import type { PeriodItem, PeriodPayload } from "@mensal/shared";

export interface OccurrenceGroup {
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
  const groups = [
    {
      title: "Atrasadas",
      // Earlier periods come first, as their due dates do.
      items: [
        ...overdueFromPreviousPeriods,
        ...items.filter((item) => item.overdue),
      ],
    },
    {
      title: "Vencem hoje",
      items: upcoming.filter((item) => item.dueDate === today),
    },
    {
      title: "A vencer no mês",
      items: upcoming.filter((item) => item.dueDate !== today),
    },
    {
      title: "Liquidadas e puladas",
      items: items.filter((item) => item.status !== "PENDING"),
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}
