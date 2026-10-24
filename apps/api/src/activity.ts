import type {
  OccurrenceEdit,
  OccurrenceStatus,
  RecurrenceEdit,
} from "@mensal/shared";
import { describeError, emitLog, type Log, type LogAttributes } from "./log.ts";

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

/**
 * The default sink: each event as one JSON line on stdout and, when telemetry
 * is on, as an INFO log record whose fields are attributes (PRD §8.7.1).
 */
export const consoleActivity: Activity = (event) => {
  console.log(JSON.stringify(event));
  emitLog("INFO", event.action, exportedFields(event));
};

/**
 * The only fields of an event that leave the process (PRD §8.7.2): ids, field
 * names and the like. An allow-list, so a field added to an event later (an
 * email, an address) stays on stdout until someone decides it may be exported.
 */
const EXPORTED_FIELDS = [
  "action",
  "kind",
  "user",
  "id",
  "from",
  "fields",
  "status",
  "revoked",
  "via",
] as const;

function exportedFields(event: ActivityEvent): LogAttributes {
  const source: Record<string, unknown> = { ...event };
  const exported: Record<string, unknown> = {};
  for (const key of EXPORTED_FIELDS)
    if (source[key] !== undefined) exported[key] = source[key];
  return exported as LogAttributes;
}

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
      log(`Activity log failed: ${describeError(error)}`);
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

/** What a password change can revoke besides the password itself. */
export type Revocable = "sessions" | "access-tokens";

/** The account actions on one access token (PRD §8.9). */
export type AccessTokenAction =
  "user.access-token-created" | "user.access-token-revoked";

/**
 * Signing up or in, replacing the password, changing the name (never naming
 * it), creating or revoking an access token (named by its id, never its
 * secret), or deleting the account, by the user's id. A failed
 * sign-in has no user: it names the attempted email and the client's address
 * instead, to spot credential stuffing.
 */
type AccountReport =
  | {
      user: string;
      action:
        | SessionAction
        | "user.password-reset"
        | "user.name-changed"
        | "user.deleted";
    }
  | { user: string; action: "user.password-changed"; revoked: Revocable[] }
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
