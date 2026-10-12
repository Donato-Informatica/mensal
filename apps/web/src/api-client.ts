import { monthOf, type PeriodPayload } from "@mensal/shared";
import { ApiError } from "./api-error.ts";

/** The app's own API (`/api/v1`), on the page's origin. */
export function createApiClient(fetchImpl: typeof fetch = fetch) {
  async function get<T>(path: string): Promise<T> {
    const response = await fetchImpl(
      new URL(`/api/v1${path}`, window.location.origin)
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

  return {
    /** The payload of `period` ('YYYY-MM-01'). */
    period: (period: string) =>
      get<PeriodPayload>(`/periods/${monthOf(period)}`),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
