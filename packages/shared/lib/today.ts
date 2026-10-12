const dateInSaoPaulo = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar date ('YYYY-MM-DD') of `now` in America/Sao_Paulo. */
export function today(now: Date = new Date()): string {
  const parts = Object.fromEntries(
    dateInSaoPaulo.formatToParts(now).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** The period ('YYYY-MM-01') containing `now` in America/Sao_Paulo. */
export function currentPeriod(now: Date = new Date()): string {
  return `${today(now).slice(0, 8)}01`;
}
