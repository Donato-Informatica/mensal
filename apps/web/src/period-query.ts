import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "./api-client.ts";

const periodsKey = ["period"];

/** The payload of `period` ('YYYY-MM-01'). */
export function periodQuery(api: ApiClient, period: string) {
  return queryOptions({
    queryKey: [...periodsKey, period],
    queryFn: () => api.period(period),
  });
}

/** Marks every period stale and refetches the one on screen. */
export function invalidatePeriods(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: periodsKey });
}
