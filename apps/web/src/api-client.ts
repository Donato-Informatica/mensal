import {
  dataArchiveName,
  monthOf,
  today,
  type AccessToken,
  type CreatedAccessToken,
  type NewAccessToken,
  type NewOneOff,
  type NewRecurrence,
  type Occurrence,
  type OccurrenceEdit,
  type PeriodPayload,
  type Recurrence,
  type RecurrenceEdit,
  type RecurrenceListQuery,
  type StatusChange,
  type SummariesPayload,
} from "@mensal/shared";
import { ApiError } from "./api-error.ts";

/** A file the API answered with, and the name it gives it. */
export interface DownloadedFile {
  blob: Blob;
  fileName: string;
}

/** The app's own API (`/api/v1`), on the page's origin. */
export function createApiClient(fetchImpl: typeof fetch = fetch) {
  /** The answer to `path`, once it is known to be a success. */
  async function fetchOk(path: string, init?: RequestInit): Promise<Response> {
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
    return response;
  }

  async function send<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchOk(path, init);
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
    /** The user's access tokens, never their secrets (PRD §8.9). */
    accessTokens: () => send<AccessToken[]>("/access-tokens"),

    /** Creates a token, proven with the current password; the only call that returns its secret. */
    createAccessToken: (token: NewAccessToken) =>
      sendJson<CreatedAccessToken>("POST", "/access-tokens", token),

    /** Revokes access token `id` for good. */
    revokeAccessToken: (id: string) =>
      send<void>(`/access-tokens/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),

    /**
     * The archive of everything the user entered (PRD §6.5), with the file
     * name the API gives it, or, should it give none, the one it gives today.
     */
    downloadData: async (): Promise<DownloadedFile> => {
      const response = await fetchOk("/data");
      const fileName =
        /filename="([^"]+)"/.exec(
          response.headers.get("content-disposition") ?? ""
        )?.[1] ?? dataArchiveName(today());
      return { blob: await response.blob(), fileName };
    },

    /** The payload of `period` ('YYYY-MM-01'). */
    period: (period: string) =>
      send<PeriodPayload>(`/periods/${monthOf(period)}`),

    /** The summary of each period from `from` to `to` ('YYYY-MM-01'), inclusive. */
    summaries: (from: string, to: string) =>
      send<SummariesPayload>(
        `/summaries?from=${monthOf(from)}&to=${monthOf(to)}`
      ),

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

    /**
     * Deletes recurrence `id` for good. One with persisted occurrences is
     * refused with RECURRENCE_HAS_OCCURRENCES, to be ended instead.
     */
    deleteRecurrence: (id: string) =>
      send<void>(`/recurrences/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),

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
