// The CSV dialect a pt-BR spreadsheet opens as is (PRD §7.10): UTF-8 with a
// BOM, `;` separators, CRLF line endings, amounts with a decimal comma.

const BOM = "﻿";

/**
 * `header` and `rows` as a CSV file's text, BOM first and every line ended by
 * CRLF. A field holding `;`, `"`, CR or LF is quoted, with `"` doubled.
 */
export function toCsv(
  header: readonly string[],
  rows: readonly (readonly string[])[]
): string {
  return (
    BOM +
    [header, ...rows]
      .map((fields) => `${fields.map(csvField).join(";")}\r\n`)
      .join("")
  );
}

function csvField(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Cents as '1234,56': absolute, no thousands separator, no symbol; '' for none. */
export function csvAmount(cents: number | null): string {
  if (cents === null) return "";
  const abs = Math.abs(cents);
  return `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

/** A 'YYYY-MM-DD' date as 'DD/MM/AAAA'; '' for none. */
export function csvDate(date: string | null): string {
  if (date === null) return "";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

/** A period ('YYYY-MM-01') as 'AAAA-MM'; '' for none. */
export function csvPeriod(period: string | null): string {
  return period === null ? "" : period.slice(0, 7);
}
