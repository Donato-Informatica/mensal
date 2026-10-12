import type { DateFormatter } from "@mantine/dates";
import { formatDate, formatPeriod } from "./format.ts";

const formatMonthPickerValue: DateFormatter = ({ date }) =>
  typeof date === "string" ? formatPeriod(date) : "";

/** Months read as the period navigator writes them, e.g. "Outubro 2026". */
export const monthPickerProps = {
  valueFormatter: formatMonthPickerValue,
  getMonthControlProps: (date: string) => ({
    "aria-label": formatPeriod(date),
  }),
  nextLabel: "Próximo ano",
  previousLabel: "Ano anterior",
};

const formatDatePickerValue: DateFormatter = ({ date }) =>
  typeof date === "string" ? formatDate(date) : "";

/** Dates read as "28/10/2026", in the picker's days too. */
export const datePickerProps = {
  valueFormatter: formatDatePickerValue,
  getDayProps: (date: string) => ({ "aria-label": formatDate(date) }),
  nextLabel: "Próximo mês",
  previousLabel: "Mês anterior",
};
