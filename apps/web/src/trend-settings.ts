import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

/** How many periods the trend covers, ending at the period on screen. */
export type TrendRange = 3 | 6 | 12;

export const trendRanges: readonly TrendRange[] = [3, 6, 12];

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

function useTrendSettings(): [TrendSettings, QueryClient] {
  const queryClient = useQueryClient();
  const store = storeOf(queryClient);
  const settings = useSyncExternalStore(
    (listener) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    () => store.settings
  );
  return [settings, queryClient];
}

/** The trend's range in periods (default 6) and what changes it. */
export function useTrendRange(): [TrendRange, (range: TrendRange) => void] {
  const [settings, queryClient] = useTrendSettings();
  return [
    settings.range,
    (range) => write(queryClient, { ...storeOf(queryClient).settings, range }),
  ];
}

/** The main chart's type (default Linhas) and what changes it. */
export function useTrendChartType(): [
  TrendChartType,
  (chartType: TrendChartType) => void,
] {
  const [settings, queryClient] = useTrendSettings();
  return [
    settings.chartType,
    (chartType) =>
      write(queryClient, { ...storeOf(queryClient).settings, chartType }),
  ];
}
