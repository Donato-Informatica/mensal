import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "./api-client.ts";

const summariesKey = ["summaries"];

/** The summary of each period from `from` to `to` ('YYYY-MM-01'), inclusive. */
export function summariesQuery(api: ApiClient, from: string, to: string) {
  return queryOptions({
    queryKey: [...summariesKey, from, to],
    queryFn: () => api.summaries(from, to),
    // A failure says so at once, with its own "Tentar novamente".
    retry: false,
  });
}

/** Marks every range of summaries stale, refetching the one on screen. */
export function invalidateSummaries(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: summariesKey });
}
