import type { QueryClient } from "@tanstack/react-query";
import { clientStore } from "./client-store.ts";

/**
 * The month ('YYYY-MM') last viewed away from the current period, so leaving
 * the monthly screen and coming back finds it again (PRD §7.1). Kept in memory
 * per app, never saved: a fresh load starts on the current period.
 */
const viewed = clientStore<string | undefined>(undefined);

/** Remembers `mes`, or with `undefined` that the current period was the last. */
export function rememberViewedMonth(
  queryClient: QueryClient,
  mes: string | undefined
) {
  viewed.write(queryClient, mes);
}

/** The month last viewed away from the current period, if any. */
export function useViewedMonth(): string | undefined {
  return viewed.useValue();
}
