import {
  monthOf,
  type NewRecurrence,
  type PeriodPayload,
  type Recurrence,
} from "@mensal/shared";
import { ApiError } from "./api-error.ts";

/** The app's own API (`/api/v1`), on the page's origin. */
export function createApiClient(fetchImpl: typeof fetch = fetch) {
  async function send<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(
      new URL(`/api/v1${path}`, window.location.origin),
      init
    );
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => undefined);
      const code =
        typeof body === "object" && body !== null && "code" in body
          ? String(body.code)
          : undefined;
      throw new ApiError(code);
    }
    return (await response.json()) as T;
  }

  function post<T>(path: string, body: unknown): Promise<T> {
    return send<T>(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  return {
    /** The payload of `period` ('YYYY-MM-01'). */
    period: (period: string) =>
      send<PeriodPayload>(`/periods/${monthOf(period)}`),

    createRecurrence: (recurrence: NewRecurrence) =>
      post<Recurrence>("/recurrences", recurrence),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
