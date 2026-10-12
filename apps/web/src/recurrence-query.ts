import type { RecurrenceListQuery } from "@mensal/shared";
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "./api-client.ts";

const recurrencesKey = ["recurrences"];

/** The user's recurrences: the active ones, or all of them. */
export function recurrencesQuery(
  api: ApiClient,
  status: RecurrenceListQuery["status"]
) {
  return queryOptions({
    queryKey: [...recurrencesKey, "list", status],
    queryFn: () => api.recurrences(status),
  });
}

/** The user's recurrence `id`. */
export function recurrenceQuery(api: ApiClient, id: string) {
  return queryOptions({
    queryKey: [...recurrencesKey, "detail", id],
    queryFn: () => api.recurrence(id),
  });
}

/**
 * Marks the cached recurrence lists stale and refetches those on screen,
 * leaving each recurrence's own entry alone: for one just deleted, whose
 * entry would only refetch into a 404.
 */
export function invalidateRecurrenceLists(
  queryClient: QueryClient
): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: [...recurrencesKey, "list"],
  });
}

/** Marks every cached recurrence stale and refetches those on screen. */
export function invalidateRecurrences(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: recurrencesKey });
}
