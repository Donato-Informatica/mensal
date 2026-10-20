import type { PeriodRangeItem } from "@mensal/shared";

/** One period of the trend, with what the client derives from its summary. */
export interface TrendRow {
  period: string;
  inflowExpected: number;
  /** Null after the current period: nothing could have been settled yet. */
  inflowSettled: number | null;
  outflowExpected: number;
  outflowSettled: number | null;
  /** Sobra prevista: expected inflows minus expected outflows. */
  leftOver: number;
  /** Sobra acumulada: the running sum of `leftOver` from the first period. */
  accumulatedLeftOver: number;
}

/** A value of a trend row: every field but its period. */
export type TrendValue = Exclude<keyof TrendRow, "period">;

/**
 * Each value's label, in the order the Ver valores table shows them; the
 * charts' series and legends use the same labels.
 */
export const trendLabels: Readonly<Record<TrendValue, string>> = {
  inflowExpected: "Entradas Previsto",
  inflowSettled: "Entradas Realizado",
  outflowExpected: "Saídas Previsto",
  outflowSettled: "Saídas Realizado",
  leftOver: "Sobra prevista",
  accumulatedLeftOver: "Sobra acumulada",
};

/**
 * The trend's rows from the summaries of its range (PRD §7.11). Sobra prevista
 * and Sobra acumulada are derived here, never sent by the API.
 */
export function trendRows(
  items: readonly PeriodRangeItem[],
  currentPeriod: string
): TrendRow[] {
  let accumulatedLeftOver = 0;
  return items.map(({ period, summary }) => {
    const leftOver = summary.inflowExpected - summary.outflowExpected;
    accumulatedLeftOver += leftOver;
    const future = period > currentPeriod;
    return {
      period,
      inflowExpected: summary.inflowExpected,
      inflowSettled: future ? null : summary.inflowSettled,
      outflowExpected: summary.outflowExpected,
      outflowSettled: future ? null : summary.outflowSettled,
      leftOver,
      accumulatedLeftOver,
    };
  });
}

/** Whether nothing at all happens in the range: every total is zero. */
export function isEmptyTrend(items: readonly PeriodRangeItem[]): boolean {
  return items.every(({ summary }) =>
    Object.values(summary).every((cents) => cents === 0)
  );
}
