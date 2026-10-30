import type { PeriodItem } from "@mensal/shared";
import type { ReminderMessage } from "./push.ts";

/** What a reminder reads of an occurrence: never its amount or notes. */
export type RemindedOccurrence = Pick<PeriodItem, "direction" | "description">;

const LISTED = 3;

/**
 * The day's reminder (PRD §6.8, pt-BR) for the occurrences due today and the
 * overdue ones, each in the order it is listed, or null when both are empty.
 * The lock screen shows it, so it names occurrences by description only.
 */
export function reminderMessage(
  dueToday: readonly RemindedOccurrence[],
  overdue: readonly RemindedOccurrence[]
): ReminderMessage | null {
  const all = [...dueToday, ...overdue];
  if (all.length === 0) return null;
  const title =
    dueToday.length === 1
      ? `Vence hoje: ${named(dueToday[0]!)}`
      : dueToday.length > 1
        ? `${dueToday.length} contas vencem hoje`
        : overdue.length === 1
          ? "1 conta atrasada"
          : `${overdue.length} contas atrasadas`;
  const lines = [listed(all.map(named))];
  if (dueToday.length > 0 && overdue.length > 0)
    lines.push(
      overdue.length === 1 ? "+ 1 atrasada" : `+ ${overdue.length} atrasadas`
    );
  return { title, body: lines.join("\n") };
}

/** An inflow's description is prefixed, as in the calendar feed (§6.7). */
function named({ direction, description }: RemindedOccurrence): string {
  return direction === "INFLOW" ? `Entrada: ${description}` : description;
}

/** "Aluguel", "Aluguel e Luz", "Aluguel, Luz, Internet e mais 2". */
function listed(descriptions: readonly string[]): string {
  if (descriptions.length > LISTED)
    return `${descriptions.slice(0, LISTED).join(", ")} e mais ${descriptions.length - LISTED}`;
  if (descriptions.length === 1) return descriptions[0]!;
  return `${descriptions.slice(0, -1).join(", ")} e ${descriptions.at(-1)}`;
}
