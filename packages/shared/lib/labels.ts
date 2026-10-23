import type { Occurrence } from "./schemas.ts";

/** The occurrence table's column headers, which its CSV files repeat (PRD §7.9). */
export const occurrenceColumns = {
  description: "Descrição",
  dueDate: "Vencimento",
  direction: "Tipo",
  amount: "Valor",
  situation: "Situação",
  settledAt: "Liquidada em",
  origin: "Origem",
  notes: "Notas",
} as const;

/** A recurrence's or occurrence's direction, as the table and the CSV files name it. */
export const directionLabel = ({ direction }: Pick<Occurrence, "direction">) =>
  direction === "INFLOW" ? "Entrada" : "Saída";

/** Whether an occurrence stands alone or comes from a recurrence, as the table and the CSV files name it. */
export const originLabel = ({
  recurrenceId,
}: Pick<Occurrence, "recurrenceId">) =>
  recurrenceId === null ? "Avulsa" : "Recorrência";
