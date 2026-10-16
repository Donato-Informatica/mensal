import type {
  OccurrenceEdit,
  OccurrenceStatus,
  RecurrenceEdit,
} from "@mensal/shared";
import type { Log } from "./log.ts";

/**
 * Who did what to which item, and when (PRD §8.7): one line of the operator's
 * activity log. Only ids and field names: never the user's email or name, nor
 * an item's description, amount or dates, which are their financial data.
 */
export type ActivityEvent = OccurrenceEvent | RecurrenceEvent | AccountEvent;

/** Where activity events go: the console unless a caller redirects them. */
export type Activity = (event: ActivityEvent) => void;

/** The default sink: each event as one JSON line on stdout. */
export const consoleActivity: Activity = (event) => {
  console.log(JSON.stringify(event));
};

/** An event as its writer reports it, before the clock stamps it with `at`. */
export type UnstampedEvent = Unstamped<ActivityEvent>;

type Unstamped<Event> = Event extends unknown ? Omit<Event, "at"> : never;

/**
 * `activity`, stamping each event with the time `now` reads, in UTC ISO. It
 * never throws: the write it reports has already succeeded, so a failure is
 * written to `log` instead.
 */
export function stamping(activity: Activity, now: () => Date, log: Log) {
  return (event: UnstampedEvent) => {
    try {
      activity({ at: now().toISOString(), ...event });
    } catch (error) {
      log(
        `Activity log failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`
      );
    }
  };
}

/** What every event starts with: when (UTC ISO) and by whom (the user id). */
interface Stamp {
  at: string;
  user: string;
}

/** Something done to one item, named by its kind and id only. */
interface ItemEvent<Kind extends string, Verb extends string> extends Stamp {
  action: `${Kind}.${Verb}`;
  kind: Kind;
  id: string;
}

/** A write that may have materialized a virtual occurrence (ADR-0001). */
interface Materializing {
  /** The virtual id the write was sent to; `id` is then the persisted one. */
  from?: string;
}

type OccurrenceEvent =
  | ItemEvent<"occurrence", "create">
  | (ItemEvent<"occurrence", "edit"> &
      Materializing & { fields: (keyof OccurrenceEdit)[] })
  | (ItemEvent<"occurrence", "status"> &
      Materializing & { status: OccurrenceStatus })
  | ItemEvent<"occurrence", "delete">;

type RecurrenceEvent =
  | ItemEvent<"recurrence", "create">
  | (ItemEvent<"recurrence", "edit"> & { fields: (keyof RecurrenceEdit)[] })
  | ItemEvent<"recurrence", "delete">;

/**
 * Signing up or in, by the user's id. A failed sign-in has no user: it names
 * the attempted email and the client's address instead, to spot credential
 * stuffing.
 */
type AccountEvent =
  | (Stamp & { action: "user.sign-up" | "user.sign-in" })
  | {
      at: string;
      action: "user.sign-in-failed";
      email: string;
      /**
       * From `X-Forwarded-For`, read as the rate limiter reads it (PRD §8.6);
       * null when it names no single trustworthy address.
       */
      ip: string | null;
    };
