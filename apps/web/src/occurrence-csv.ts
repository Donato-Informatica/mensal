import type { PeriodPayload } from "@mensal/shared";
import { formatDate } from "./format.ts";
import { occurrenceRows } from "./occurrence-rows.ts";

const BOM = String.fromCharCode(0xfeff);

const HEADER = [
  "Descrição",
  "Vencimento",
  "Tipo",
  "Valor",
  "Situação",
  "Liquidada em",
  "Origem",
  "Notas",
];

/** The period's own occurrences, in table order (PRD §7.9). */
export function periodCsvRows(payload: PeriodPayload, today: string) {
  return occurrenceRows(payload, today, { includePreviousPeriods: false });
}

/**
 * The period's own occurrences as a CSV for a pt-BR spreadsheet: BOM, `;`
 * separators, CRLF line endings, amounts with a decimal comma. Earlier
 * periods' overdue occurrences are left out so that joining months never
 * counts one twice.
 */
export function occurrenceCsv(payload: PeriodPayload, today: string): string {
  const lines = periodCsvRows(payload, today).map(({ item, situation }) =>
    [
      item.description,
      item.dueDate === null ? "" : formatDate(item.dueDate),
      item.direction === "INFLOW" ? "Entrada" : "Saída",
      item.amount === null ? "" : decimal(item.amount),
      situation,
      item.settledAt === null ? "" : formatDate(item.settledAt),
      item.recurrenceId === null ? "Avulsa" : "Recorrência",
      item.notes ?? "",
    ]
      .map(field)
      .join(";")
  );
  return `${BOM}${[HEADER.join(";"), ...lines].join("\r\n")}\r\n`;
}

/** Cents as '1234,56': absolute, no thousands separator, no symbol. */
function decimal(cents: number): string {
  const abs = Math.abs(cents);
  return `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

function field(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
