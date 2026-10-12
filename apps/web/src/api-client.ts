import {
  monthOf,
  type NewOneOff,
  type NewRecurrence,
  type Occurrence,
  type OccurrenceEdit,
  type PeriodPayload,
  type Recurrence,
  type RecurrenceEdit,
  type RecurrenceListQuery,
  type StatusChange,
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
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  function sendJson<T>(
    method: "POST" | "PATCH",
    path: string,
    body: unknown
  ): Promise<T> {
    return send<T>(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  return {
    /** The payload of `period` ('YYYY-MM-01'). */
    period: (period: string) =>
      send<PeriodPayload>(`/periods/${monthOf(period)}`),

    /** The user's recurrences: the active ones, or all of them. */
    recurrences: (status: RecurrenceListQuery["status"]) =>
      send<Recurrence[]>(`/recurrences?status=${status}`),

    recurrence: (id: string) =>
      send<Recurrence>(`/recurrences/${encodeURIComponent(id)}`),

    createRecurrence: (recurrence: NewRecurrence) =>
      sendJson<Recurrence>("POST", "/recurrences", recurrence),

    /** Edits recurrence `id`, and with it its virtual occurrences. */
    editRecurrence: (id: string, edit: RecurrenceEdit) =>
      sendJson<Recurrence>(
        "PATCH",
        `/recurrences/${encodeURIComponent(id)}`,
        edit
      ),

    createOneOff: (oneOff: NewOneOff) =>
      sendJson<Occurrence>("POST", "/occurrences", oneOff),

    /** Changes the status of occurrence `id`, persisted or virtual. */
    changeStatus: (id: string, change: StatusChange) =>
      sendJson<Occurrence>(
        "PATCH",
        `/occurrences/${encodeURIComponent(id)}/status`,
        change
      ),

    /** Edits occurrence `id`, persisted or virtual. */
    editOccurrence: (id: string, edit: OccurrenceEdit) =>
      sendJson<Occurrence>(
        "PATCH",
        `/occurrences/${encodeURIComponent(id)}`,
        edit
      ),

    /** Deletes one-off occurrence `id` for good. */
    deleteOneOff: (id: string) =>
      send<void>(`/occurrences/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
