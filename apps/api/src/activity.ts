import type {
  OccurrenceEdit,
  OccurrenceStatus,
  RecurrenceEdit,
} from "@mensal/shared";
import type { Log } from "./log.ts";

/**
 * Who did what to which item (PRD §8.7), as the write reports it. Only ids and
 * field names: never the user's email or name, nor an item's description,
 * amount or dates, which are their financial data.
 */
export type ActivityReport = ItemReport | AccountReport;

/**
 * One line of the operator's activity log: a report stamped with when it
 * happened (UTC ISO) and, for an item, the kind its action names.
 */
export type ActivityEvent = { at: string } & ExtraFields &
  (AccountReport | (ItemReport & { kind: ItemKind }));

/** Where activity events go: the console unless a caller redirects them. */
export type Activity = (event: ActivityEvent) => void;

/** Logs a write once it has succeeded. Never throws. */
export type RecordActivity = (report: ActivityReport) => void;

/** The default sink: each event as one JSON line on stdout. */
export const consoleActivity: Activity = (event) => {
  console.log(JSON.stringify(event));
};

/**
 * Records to `activity`, stamping each report with the time `now` reads. The
 * write it reports has already succeeded, so a failure to record it is
 * written to `log` instead of thrown.
 */
export function activityRecorder(
  activity: Activity,
  now: () => Date,
  log: Log,
  extra: ExtraFields = {}
): RecordActivity {
  return (report) => {
    try {
      activity(stamped(report, now(), extra));
    } catch (error) {
      log(
        `Activity log failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`
      );
    }
  };
}

function stamped(
  report: ActivityReport,
  date: Date,
  extra: ExtraFields
): ActivityEvent {
  const at = date.toISOString();
  if (!isItemReport(report)) return { at, ...extra, ...report };
  const kind = report.action.startsWith("recurrence.")
    ? "recurrence"
    : "occurrence";
  return { at, ...extra, ...report, kind };
}

/**
 * Fields a caller adds to every event it logs: `via` names the channel a
 * write came through other than the REST API (the MCP server, PRD §8.9).
 */
export interface ExtraFields {
  via?: "mcp";
}

function isItemReport(report: ActivityReport): report is ItemReport {
  return (
    report.action.startsWith("occurrence.") ||
    report.action.startsWith("recurrence.")
  );
}

type ItemKind = "occurrence" | "recurrence";

/** Something `user` did to one item, named by its id only. */
interface ItemWrite {
  user: string;
  id: string;
}

type ItemReport = ItemWrite &
  (
    | { action: `${ItemKind}.${"create" | "delete"}` }
    | (Materializing & {
        action: "occurrence.edit";
        fields: (keyof OccurrenceEdit)[];
      })
    | (Materializing & {
        action: "occurrence.status";
        status: OccurrenceStatus;
      })
    | { action: "recurrence.edit"; fields: (keyof RecurrenceEdit)[] }
  );

interface Materializing {
  /**
   * The virtual id of the occurrence this write materialized (ADR-0001);
   * `id` is then the persisted one.
   */
  from?: string;
}

/** The account actions that start a session for the user. */
export type SessionAction = "user.sign-up" | "user.sign-in";

/** The account actions that replace the user's password. */
export type PasswordAction = "user.password-changed" | "user.password-reset";

/** The account actions on one access token (PRD §8.9). */
export type AccessTokenAction =
  "user.access-token-created" | "user.access-token-revoked";

/**
 * Signing up or in, replacing the password, or creating or revoking an access
 * token (named by its id, never its secret), by the user's id. A failed
 * sign-in has no user: it names the attempted email and the client's address
 * instead, to spot credential stuffing.
 */
type AccountReport =
  | { user: string; action: SessionAction | PasswordAction }
  | { user: string; action: AccessTokenAction; id: string }
  | {
      action: "user.sign-in-failed";
      email: string;
      /**
       * From `X-Forwarded-For`, read as the rate limiter reads it (PRD §8.6);
       * null when it names no single trustworthy address.
       */
      ip: string | null;
    };
