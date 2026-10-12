import { queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "./api-client.ts";

/** The payload of `period` ('YYYY-MM-01'). */
export function periodQuery(api: ApiClient, period: string) {
  return queryOptions({
    queryKey: ["period", period],
    queryFn: () => api.period(period),
  });
}
