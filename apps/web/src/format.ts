// Amounts and dates as a Brazilian reader expects them (PRD §7).

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Cents as BRL, e.g. 220000 → "R$ 2.200,00". */
export function formatAmount(cents: number): string {
  return brl.format(cents / 100);
}

// Dates are calendar dates, so they are read and formatted in UTC to keep the
// browser's time zone from shifting the day.
const dayAndMonth = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

const monthName = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: "UTC",
});

/** 'YYYY-MM-DD' as day and month, e.g. "10/10". */
export function formatDayAndMonth(date: string): string {
  return dayAndMonth.format(new Date(date));
}

/** A period ('YYYY-MM-01') as month and year, e.g. "Outubro 2026". */
export function formatPeriod(period: string): string {
  const month = monthName.format(new Date(period));
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${period.slice(0, 4)}`;
}
