import { MAX_SUMMARY_PERIODS } from "@mensal/shared";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

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

interface Store {
  settings: TrendSettings;
  listeners: Set<() => void>;
}

const storeByClient = new WeakMap<QueryClient, Store>();

function storeOf(queryClient: QueryClient): Store {
  const store = storeByClient.get(queryClient) ?? {
    settings: defaults,
    listeners: new Set(),
  };
  storeByClient.set(queryClient, store);
  return store;
}

function write(queryClient: QueryClient, settings: TrendSettings) {
  const store = storeOf(queryClient);
  store.settings = settings;
  store.listeners.forEach((listener) => listener());
}

/** Back to the defaults, as on a fresh load. */
export function forgetTrendSettings(queryClient: QueryClient) {
  write(queryClient, defaults);
}

/**
 * One of the modal's choices (range: default 6; chartType: default Linhas) and
 * what changes it.
 */
export function useTrendSetting<Key extends keyof TrendSettings>(
  key: Key
): [TrendSettings[Key], (value: TrendSettings[Key]) => void] {
  const queryClient = useQueryClient();
  const store = storeOf(queryClient);
  const settings = useSyncExternalStore(
    (listener) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    () => store.settings
  );
  return [
    settings[key],
    (value) =>
      write(queryClient, { ...storeOf(queryClient).settings, [key]: value }),
  ];
}
