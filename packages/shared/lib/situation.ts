import type { Occurrence } from "./schemas.ts";

/** Where an occurrence stands, as the table and the CSV files name it (PRD §7.9). */
export type Situation =
  "Atrasada" | "Vence hoje" | "A vencer" | "Liquidada" | "Pulada";

/**
 * Where `occurrence` stands on `today` ('YYYY-MM-DD' in America/Sao_Paulo):
 * settled, skipped, or, while pending, overdue (rule 5.5), due today, or yet
 * to come (no due date included).
 */
export function situationOf(
  { status, dueDate }: Pick<Occurrence, "status" | "dueDate">,
  today: string
): Situation {
  if (status === "SETTLED") return "Liquidada";
  if (status === "SKIPPED") return "Pulada";
  if (dueDate === null || dueDate > today) return "A vencer";
  return dueDate === today ? "Vence hoje" : "Atrasada";
}
