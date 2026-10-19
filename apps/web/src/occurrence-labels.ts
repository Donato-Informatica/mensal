import type { PeriodItem } from "@mensal/shared";

/** The table's column headers, which the CSV repeats (PRD §7.9). */
export const columns = {
  description: "Descrição",
  dueDate: "Vencimento",
  direction: "Tipo",
  amount: "Valor",
  situation: "Situação",
  settledAt: "Liquidada em",
  origin: "Origem",
  notes: "Notas",
} as const;

export const directionLabel = (item: PeriodItem) =>
  item.direction === "INFLOW" ? "Entrada" : "Saída";

export const originLabel = (item: PeriodItem) =>
  item.recurrenceId === null ? "Avulsa" : "Recorrência";
