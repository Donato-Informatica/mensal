import { schema, type Database } from "@mensal/database";
import {
  applyStatusChange,
  clampDueDate,
  currentPeriod,
  editRefusal,
  isInEffect,
  parseSummariesQuery,
  parseVirtualId,
  periodOfMonth,
  resolvePeriod,
  summarizeRange,
  today,
  type NewOneOff,
  type NewRecurrence,
  type OccurrenceEdit,
  type OccurrenceStatus,
  type RecurrenceEdit,
  type RecurrenceListQuery,
  type StatusChange,
} from "@mensal/shared";
import { and, asc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import type { RecordActivity } from "./activity.ts";
import { changedFields } from "./changed-fields.ts";
import { Refusal } from "./refusal.ts";
import { UUID } from "./uuid.ts";

/**
 * The domain operations of `/api/v1` (PRD §6), shared by the REST routers and
 * the MCP server (PRD §8.9). Each takes an {@link OperationContext} and its
 * already-validated input, resolves to the JSON the route answers with, and
 * throws a {@link Refusal} (with its `code`, and `fields` for `INVALID_INPUT`)
 * when the request or the stored state turns it down. Writes log their
 * activity (PRD §8.7) through `record`; the caller picks its extra fields when
 * it builds the recorder (`activityRecorder`).
 */
export interface OperationContext {
  db: Database;
  userId: string;
  /** The clock "today" is read from. */
  now: () => Date;
  record: RecordActivity;
}

const { occurrences, recurrences } = schema;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

type PersistedOccurrence = typeof occurrences.$inferSelect;

/** Fields to set on an occurrence; one left undefined is left as it is. */
type OccurrenceChanges = {
  [Field in keyof PersistedOccurrence]?: PersistedOccurrence[Field] | undefined;
};

/** What the activity log tells of a change, besides who and which occurrence. */
type ChangeDetail =
  | { action: "occurrence.edit"; fields: (keyof OccurrenceEdit)[] }
  | { action: "occurrence.status"; status: OccurrenceStatus };

// --- Periods and summaries ---------------------------------------------

/** The user's period payload for `month` ("yyyy-mm"; PRD §4, §6.2). */
export async function readPeriod(
  { db, userId, now }: OperationContext,
  month: string
) {
  const period = periodOfMonth(month);
  if (!period) throw new Refusal(400, "INVALID_PERIOD");
  const date = now();
  // For the current period, every earlier occurrence too, whatever its
  // status: resolvePeriod needs them to tell which are still overdue.
  const isCurrent = period === currentPeriod(date);
  const [periodRecurrences, periodOccurrences] = await Promise.all([
    db
      .select()
      .from(recurrences)
      .where(
        and(
          eq(recurrences.userId, userId),
          lte(recurrences.startPeriod, period)
        )
      ),
    db
      .select()
      .from(occurrences)
      .where(
        and(
          eq(occurrences.userId, userId),
          isCurrent
            ? lte(occurrences.period, period)
            : eq(occurrences.period, period)
        )
      ),
  ]);
  return resolvePeriod({
    period,
    today: today(date),
    occurrences: periodOccurrences,
    recurrences: periodRecurrences,
  });
}

/** The summary of each period of the `from`/`to` range in `query` (PRD §6.4). */
export async function readSummaries(
  { db, userId }: OperationContext,
  query: unknown
) {
  const parsed = parseSummariesQuery(query);
  if ("code" in parsed) throw new Refusal(400, parsed.code);
  const { from, to } = parsed.query;
  // Read-only: virtual occurrences are projected, never materialized
  // (ADR 0001).
  const [rangeRecurrences, rangeOccurrences] = await Promise.all([
    db
      .select()
      .from(recurrences)
      .where(
        and(eq(recurrences.userId, userId), lte(recurrences.startPeriod, to))
      ),
    db
      .select()
      .from(occurrences)
      .where(
        and(
          eq(occurrences.userId, userId),
          gte(occurrences.period, from),
          lte(occurrences.period, to)
        )
      ),
  ]);
  return summarizeRange({
    from,
    to,
    occurrences: rangeOccurrences,
    recurrences: rangeRecurrences,
  });
}

// --- Recurrences ---------------------------------------------------------

/** The user's recurrences, active ones only when asked (PRD §6.1). */
export async function listRecurrences(
  { db, userId, now }: OperationContext,
  query: RecurrenceListQuery
) {
  // Active: not ended before the current period, future starts included.
  const active = or(
    isNull(recurrences.endPeriod),
    gte(recurrences.endPeriod, currentPeriod(now()))
  );
  return db
    .select()
    .from(recurrences)
    .where(
      and(
        eq(recurrences.userId, userId),
        query.status === "active" ? active : undefined
      )
    )
    .orderBy(asc(recurrences.description), asc(recurrences.createdAt));
}

/** The user's recurrence `id`; refuses with 404 `RECURRENCE_NOT_FOUND`. */
export async function getRecurrence(
  { db, userId }: OperationContext,
  id: string
) {
  const recurrence = await findRecurrence(db, userId, id);
  if (!recurrence) throw new Refusal(404, "RECURRENCE_NOT_FOUND");
  return recurrence;
}

/** Creates a recurrence starting no earlier than this period (PRD §5.10). */
export async function createRecurrence(
  { db, userId, now, record }: OperationContext,
  input: NewRecurrence
) {
  // Earlier history is entered as one-off occurrences (PRD §5.10).
  if (input.startPeriod < currentPeriod(now())) {
    throw new Refusal(400, "START_PERIOD_IN_PAST");
  }
  const [recurrence] = await db
    .insert(recurrences)
    .values({ ...input, userId })
    .returning();
  if (recurrence) {
    record({ user: userId, action: "recurrence.create", id: recurrence.id });
  }
  return recurrence;
}

/**
 * Edits the editable fields (PRD §6.1). The recurrence's virtual occurrences
 * follow it; its persisted ones keep their snapshot (PRD §5.3).
 */
export async function editRecurrence(
  { db, userId, record }: OperationContext,
  id: string,
  input: RecurrenceEdit
) {
  const recurrence = await findRecurrence(db, userId, id);
  if (!recurrence) throw new Refusal(404, "RECURRENCE_NOT_FOUND");
  const { endPeriod } = input;
  // The start is immutable, so the stored one decides.
  if (endPeriod && endPeriod < recurrence.startPeriod) {
    throw new Refusal(400, "END_PERIOD_BEFORE_START");
  }
  const fields = changedFields(recurrence, input);
  // Nothing changes: the recurrence as it is.
  if (fields.length === 0) return recurrence;
  const [updated] = await db
    .update(recurrences)
    .set(input)
    .where(
      and(
        eq(recurrences.userId, recurrence.userId),
        eq(recurrences.id, recurrence.id)
      )
    )
    .returning();
  record({
    user: userId,
    action: "recurrence.edit",
    id: recurrence.id,
    fields,
  });
  return updated;
}

/**
 * Deletes a recurrence without history, for good; one with persisted
 * occurrences is refused with 409 and ended instead (PRD §5.4).
 */
export async function deleteRecurrence(
  { db, userId, record }: OperationContext,
  id: string
) {
  if (!UUID.test(id)) throw new Refusal(404, "RECURRENCE_NOT_FOUND");
  const mine = and(eq(recurrences.userId, userId), eq(recurrences.id, id));
  await db.transaction(async (tx) => {
    // The lock holds back an occurrence being materialized meanwhile,
    // since its foreign key needs a share lock on the recurrence.
    const [recurrence] = await tx
      .select({ id: recurrences.id })
      .from(recurrences)
      .where(mine)
      .for("update");
    if (!recurrence) throw new Refusal(404, "RECURRENCE_NOT_FOUND");
    const [persisted] = await tx
      .select({ id: occurrences.id })
      .from(occurrences)
      .where(
        and(eq(occurrences.userId, userId), eq(occurrences.recurrenceId, id))
      )
      .limit(1);
    if (persisted) throw new Refusal(409, "RECURRENCE_HAS_OCCURRENCES");
    await tx.delete(recurrences).where(mine);
  });
  record({ user: userId, action: "recurrence.delete", id });
}

/** The user's recurrence `id`, if they have one. */
async function findRecurrence(db: Database, userId: string, id: string) {
  if (!UUID.test(id)) return undefined;
  const [recurrence] = await db
    .select()
    .from(recurrences)
    .where(and(eq(recurrences.userId, userId), eq(recurrences.id, id)));
  return recurrence;
}

// --- Occurrences ---------------------------------------------------------

/** Creates a one-off occurrence (PRD §5.9). */
export async function createOneOff(
  { db, userId, record }: OperationContext,
  input: NewOneOff
) {
  const [occurrence] = await db
    .insert(occurrences)
    .values({ ...input, userId, status: "PENDING" })
    .returning();
  if (occurrence) {
    record({ user: userId, action: "occurrence.create", id: occurrence.id });
  }
  return occurrence;
}

/** Edits the editable fields of occurrence `id`, persisted or virtual (PRD §5.8). */
export function editOccurrence(
  ctx: OperationContext,
  id: string,
  input: OccurrenceEdit
) {
  return changeOccurrence(
    ctx,
    id,
    (occurrence) => {
      const refusal = editRefusal(occurrence, input);
      if (refusal) throw new Refusal(400, refusal);
      return input;
    },
    (_, fields) => ({ action: "occurrence.edit", fields })
  );
}

/** Changes the status of occurrence `id`; any transition is allowed (PRD §5.7). */
export function changeOccurrenceStatus(
  ctx: OperationContext,
  id: string,
  input: StatusChange
) {
  return changeOccurrence(
    ctx,
    id,
    (occurrence) => {
      const changed = applyStatusChange(occurrence, input, today(ctx.now()));
      if (changed.status === "SETTLED" && changed.amount === null) {
        throw new Refusal(400, "AMOUNT_REQUIRED_TO_SETTLE");
      }
      return changed;
    },
    ({ status }) => ({ action: "occurrence.status", status })
  );
}

/**
 * Deletes a one-off occurrence, for good; one of a recurrence is refused with
 * 409 and skipped instead (PRD §5.9).
 */
export async function deleteOccurrence(
  { db, userId, record }: OperationContext,
  id: string
) {
  const deleted = UUID.test(id)
    ? await db
        .delete(occurrences)
        .where(
          and(
            eq(occurrences.userId, userId),
            eq(occurrences.id, id),
            isNull(occurrences.recurrenceId)
          )
        )
        .returning({ id: occurrences.id })
    : [];
  if (deleted.length > 0) {
    record({ user: userId, action: "occurrence.delete", id });
  } else if (await occurrenceExists(db, userId, id)) {
    throw new Refusal(409, "ONLY_ONE_OFF_DELETABLE");
  } else {
    throw new Refusal(404, "OCCURRENCE_NOT_FOUND");
  }
}

/**
 * Resolves to the user's occurrence `id` once the fields `change` returns
 * are set, all in one transaction: a Refusal it throws rolls everything
 * back, the materialization of a virtual occurrence included. A change that
 * sets nothing new is no mutation, so a virtual occurrence stays virtual
 * (ADR-0001). Once it commits, the change is logged as `describe` tells.
 */
async function changeOccurrence<Changes extends OccurrenceChanges>(
  { db, userId, record }: OperationContext,
  id: string,
  change: (occurrence: PersistedOccurrence) => Changes,
  describe: (changes: Changes, fields: (keyof Changes)[]) => ChangeDetail
) {
  try {
    const { changed, logged } = await db.transaction(async (tx) => {
      const { occurrence, materialized } = await occurrenceToChange(
        tx,
        userId,
        id
      );
      const changes = change(occurrence);
      const fields = changedFields(occurrence, changes);
      if (fields.length === 0) {
        if (materialized) throw new Unchanged(asVirtual(id, occurrence));
        return { changed: occurrence };
      }
      const [updated] = await tx
        .update(occurrences)
        .set(changes)
        .where(eq(occurrences.id, occurrence.id))
        .returning();
      return {
        changed: updated,
        logged: {
          user: userId,
          id: occurrence.id,
          ...(materialized && { from: id }),
          ...describe(changes, fields),
        },
      };
    });
    if (logged) record(logged);
    return changed;
  } catch (error) {
    if (error instanceof Unchanged) return error.virtual;
    throw error;
  }
}

/**
 * The user's occurrence `id`, locked for the change. A virtual id is
 * materialized first (PRD §5.2).
 */
async function occurrenceToChange(tx: Transaction, userId: string, id: string) {
  const virtual = parseVirtualId(id);
  const materialized = virtual ? await materialize(tx, userId, virtual) : false;
  const [occurrence] = await tx
    .select()
    .from(occurrences)
    .where(
      virtual
        ? and(
            eq(occurrences.userId, userId),
            eq(occurrences.recurrenceId, virtual.recurrenceId),
            eq(occurrences.period, virtual.period)
          )
        : UUID.test(id)
          ? and(eq(occurrences.userId, userId), eq(occurrences.id, id))
          : sql`false`
    )
    .for("update");
  if (!occurrence) throw new Refusal(404, "OCCURRENCE_NOT_FOUND");
  return { occurrence, materialized };
}

/**
 * Thrown to roll back the materialization of a virtual occurrence that a
 * write left as it was, answering with it still virtual.
 */
class Unchanged extends Error {
  readonly virtual: ReturnType<typeof asVirtual>;
  constructor(virtual: ReturnType<typeof asVirtual>) {
    super("unchanged");
    this.virtual = virtual;
  }
}

/** `occurrence`, just materialized from `id`, as the virtual one it was. */
function asVirtual(
  id: string,
  {
    recurrenceId,
    direction,
    description,
    status,
    amount,
    period,
    dueDate,
    settledAt,
    notes,
  }: PersistedOccurrence
) {
  return {
    id,
    isVirtual: true,
    recurrenceId,
    direction,
    description,
    status,
    amount,
    period,
    dueDate,
    settledAt,
    notes,
  };
}

/** Whether the user has an occurrence `id`, persisted or virtual. */
async function occurrenceExists(db: Database, userId: string, id: string) {
  const virtual = parseVirtualId(id);
  if (!virtual) {
    if (!UUID.test(id)) return false;
    const [persisted] = await db
      .select({ id: occurrences.id })
      .from(occurrences)
      .where(and(eq(occurrences.userId, userId), eq(occurrences.id, id)));
    return persisted !== undefined;
  }
  const [recurrence] = await db
    .select()
    .from(recurrences)
    .where(
      and(
        eq(recurrences.id, virtual.recurrenceId),
        eq(recurrences.userId, userId)
      )
    );
  if (!recurrence) return false;
  if (isInEffect(recurrence, virtual.period)) return true;
  // Ending a recurrence keeps the occurrences it already had (PRD §5.4).
  const [persisted] = await db
    .select({ id: occurrences.id })
    .from(occurrences)
    .where(
      and(
        eq(occurrences.userId, userId),
        eq(occurrences.recurrenceId, virtual.recurrenceId),
        eq(occurrences.period, virtual.period)
      )
    );
  return persisted !== undefined;
}

/**
 * Inserts the occurrence of the user's recurrence in `period`, a snapshot of
 * the recurrence as it is now, unless it is already persisted; whether it
 * inserted it. Idempotent: the unique index on (user, recurrence, period)
 * keeps a second insert out.
 */
async function materialize(
  tx: Transaction,
  userId: string,
  { recurrenceId, period }: { recurrenceId: string; period: string }
) {
  const [recurrence] = await tx
    .select()
    .from(recurrences)
    .where(
      and(eq(recurrences.id, recurrenceId), eq(recurrences.userId, userId))
    );
  if (!recurrence || !isInEffect(recurrence, period)) return false;
  const inserted = await tx
    .insert(occurrences)
    .values({
      userId,
      recurrenceId,
      direction: recurrence.direction,
      description: recurrence.description,
      status: "PENDING",
      amount: recurrence.defaultAmount,
      period,
      dueDate: clampDueDate(period, recurrence.dueDay),
    })
    .onConflictDoNothing({
      target: [
        occurrences.userId,
        occurrences.recurrenceId,
        occurrences.period,
      ],
      where: sql`${occurrences.recurrenceId} IS NOT NULL`,
    })
    .returning({ id: occurrences.id });
  return inserted.length > 0;
}
