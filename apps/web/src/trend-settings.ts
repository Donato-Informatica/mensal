import { MAX_SUMMARY_PERIODS } from "@mensal/shared";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { clientStore } from "./client-store.ts";

/**
 * How many periods the trend covers, ending at the period on screen: at most
 * what one `GET /summaries` may cover.
 */
export type TrendRange = 3 | 6 | typeof MAX_SUMMARY_PERIODS;

export const trendRanges: readonly TrendRange[] = [3, 6, MAX_SUMMARY_PERIODS];

/** How the main chart draws its series: Linhas or Barras. */
export type TrendChartType = "lines" | "bars";

/**
 * The Evolução modal's choices, kept in memory per app like the month on
 * screen (PRD §7.1, §7.11): reopening the modal finds them again, but they are
 * never saved, so a fresh load or a sign-out starts from the defaults.
 */
interface TrendSettings {
  range: TrendRange;
  chartType: TrendChartType;
}

const defaults: TrendSettings = { range: 6, chartType: "lines" };

const store = clientStore(defaults);

/** Back to the defaults, as on a fresh load. */
export function forgetTrendSettings(queryClient: QueryClient) {
  store.write(queryClient, defaults);
}

/**
 * One of the modal's choices (range: default 6; chartType: default Linhas) and
 * what changes it.
 */
export function useTrendSetting<Key extends keyof TrendSettings>(
  key: Key
): [TrendSettings[Key], (value: TrendSettings[Key]) => void] {
  const queryClient = useQueryClient();
  const settings = store.useValue();
  return [
    settings[key],
    (value) =>
      store.write(queryClient, { ...store.read(queryClient), [key]: value }),
  ];
}
