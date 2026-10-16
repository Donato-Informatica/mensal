import type {
  OccurrenceEdit,
  OccurrenceStatus,
  RecurrenceEdit,
} from "@mensal/shared";

/**
 * Who did what to which item, and when (PRD §8.7): one line of the operator's
 * activity log. Only ids and field names: never the user's email or name, nor
 * an item's description, amount or dates, which are their financial data.
 */
export type ActivityEvent = OccurrenceEvent | RecurrenceEvent;

/** Where activity events go: the console unless a caller redirects them. */
export type Activity = (event: ActivityEvent) => void;

/** The default sink: each event as one JSON line on stdout. */
export const consoleActivity: Activity = (event) => {
  console.log(JSON.stringify(event));
};

/** An event as its writer reports it, before the clock stamps it with `at`. */
export type UnstampedEvent = Unstamped<ActivityEvent>;

type Unstamped<Event> = Event extends unknown ? Omit<Event, "at"> : never;

/** `activity`, stamping each event with the time `now` reads, in UTC ISO. */
export function stamping(activity: Activity, now: () => Date) {
  return (event: UnstampedEvent) => {
    activity({ at: now().toISOString(), ...event });
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
