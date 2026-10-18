import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

/**
 * The month ('YYYY-MM') last viewed away from the current period, so leaving
 * the monthly screen and coming back finds it again (PRD §7.1). Kept in memory
 * per app, never saved: a fresh load starts on the current period.
 */
interface Viewed {
  mes: string | undefined;
  listeners: Set<() => void>;
}

const viewedByClient = new WeakMap<QueryClient, Viewed>();

function viewedOf(queryClient: QueryClient): Viewed {
  const viewed = viewedByClient.get(queryClient) ?? {
    mes: undefined,
    listeners: new Set(),
  };
  viewedByClient.set(queryClient, viewed);
  return viewed;
}

/** Remembers `mes`, or with `undefined` that the current period was the last. */
export function rememberViewedMonth(
  queryClient: QueryClient,
  mes: string | undefined
) {
  const viewed = viewedOf(queryClient);
  if (viewed.mes === mes) return;
  viewed.mes = mes;
  viewed.listeners.forEach((listener) => listener());
}

/** The month last viewed away from the current period, if any. */
export function useViewedMonth(): string | undefined {
  const viewed = viewedOf(useQueryClient());
  return useSyncExternalStore(
    (listener) => {
      viewed.listeners.add(listener);
      return () => viewed.listeners.delete(listener);
    },
    () => viewed.mes
  );
}
