import {
  csvAmount,
  csvDate,
  directionLabel,
  occurrenceColumns,
  originLabel,
  toCsv,
  type PeriodPayload,
} from "@mensal/shared";
import { occurrenceRows } from "./occurrence-rows.ts";

/** The period's own occurrences, in table order (PRD §7.9). */
export function periodCsvRows(payload: PeriodPayload, today: string) {
  return occurrenceRows(payload, today, { includePreviousPeriods: false });
}

/**
 * The period's own occurrences as a CSV for a pt-BR spreadsheet (PRD §7.10).
 * Earlier periods' overdue occurrences are left out so that joining months
 * never counts one twice.
 */
export function occurrenceCsv(payload: PeriodPayload, today: string): string {
  return toCsv(
    Object.values(occurrenceColumns),
    periodCsvRows(payload, today).map(({ item, situation }) => [
      item.description,
      csvDate(item.dueDate),
      directionLabel(item),
      csvAmount(item.amount),
      situation,
      csvDate(item.settledAt),
      originLabel(item),
      item.notes ?? "",
    ])
  );
}
