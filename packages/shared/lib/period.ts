// A period is written 'YYYY-MM-01'; in URLs it is the month alone, 'YYYY-MM'.

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The period of a 'YYYY-MM' month, or undefined when it is not one. */
export function periodOfMonth(month: string): string | undefined {
  return MONTH.test(month) ? `${month}-01` : undefined;
}

/** A period ('YYYY-MM-01') as its 'YYYY-MM' month. */
export function monthOf(period: string): string {
  return period.slice(0, 7);
}

/** The period ('YYYY-MM-01') `months` months after `period`; negative goes back. */
export function shiftPeriod(period: string, months: number): string {
  const [year, month] = period.split("-").map(Number) as [number, number];
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
  return shifted.toISOString().slice(0, 10);
}
