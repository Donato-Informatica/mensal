import type { PeriodPayload } from "@mensal/shared";
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

/**
 * Rewrites every cached period with `update` at once, so a change shows before
 * the API confirms it. Resolves to what undoes the rewrite.
 */
export async function updatePeriods(
  queryClient: QueryClient,
  update: (payload: PeriodPayload) => PeriodPayload
): Promise<() => void> {
  await queryClient.cancelQueries({ queryKey: periodsKey });
  const previous = queryClient.getQueriesData<PeriodPayload>({
    queryKey: periodsKey,
  });
  queryClient.setQueriesData<PeriodPayload>(
    { queryKey: periodsKey },
    (payload) => payload && update(payload)
  );
  return () => {
    for (const [queryKey, payload] of previous) {
      queryClient.setQueryData(queryKey, payload);
    }
  };
}
