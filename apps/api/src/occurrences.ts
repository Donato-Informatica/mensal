import { schema, type Database } from "@mensal/database";
import {
  applyStatusChange,
  clampDueDate,
  editRefusal,
  isInEffect,
  NewOneOffSchema,
  OccurrenceEditSchema,
  parseVirtualId,
  StatusChangeSchema,
  today,
} from "@mensal/shared";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Router, type Response } from "express";
import { invalidInput } from "./invalid-input.ts";
import { Refusal } from "./refusal.ts";
import { UUID } from "./uuid.ts";

const { occurrences, recurrences } = schema;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

type PersistedOccurrence = typeof occurrences.$inferSelect;

/** Fields to set on an occurrence; one left undefined is left as it is. */
type OccurrenceChanges = {
  [Field in keyof PersistedOccurrence]?: PersistedOccurrence[Field] | undefined;
};

/** `/occurrences`: the user's occurrences (PRD §6.3). */
export function occurrencesRouter({
  db,
  now,
}: {
  db: Database;
  now: () => Date;
}) {
  const router = Router();

  /**
   * Answers with the user's occurrence `id` once the fields `change` returns
   * are set, all in one transaction: a Refusal it throws rolls everything
   * back, the materialization of a virtual occurrence included.
   */
  async function changeOccurrence(
    res: Response,
    id: string,
    change: (occurrence: PersistedOccurrence) => OccurrenceChanges
  ) {
    try {
      const changed = await db.transaction(async (tx) => {
        const occurrence = await occurrenceToChange(tx, res.locals.userId, id);
        const values = change(occurrence);
        // Nothing to set: the occurrence as it is, if only just materialized.
        if (Object.values(values).every((value) => value === undefined)) {
          return occurrence;
        }
        const [updated] = await tx
          .update(occurrences)
          .set(values)
          .where(eq(occurrences.id, occurrence.id))
          .returning();
        return updated;
      });
      res.json(changed);
    } catch (error) {
      if (!(error instanceof Refusal)) throw error;
      res.status(error.status).json({ code: error.code });
    }
  }

  // A one-off occurrence (PRD §5.9).
  router.post("/", async (req, res) => {
    const input = NewOneOffSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json(invalidInput(input.error));
      return;
    }
    const [occurrence] = await db
      .insert(occurrences)
      .values({ ...input.data, userId: res.locals.userId, status: "PENDING" })
      .returning();
    res.status(201).json(occurrence);
  });

  // Any transition between the statuses is allowed (PRD §5.7).
  router.patch("/:id/status", async (req, res) => {
    const input = StatusChangeSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json(invalidInput(input.error));
      return;
    }
    await changeOccurrence(res, req.params.id, (occurrence) => {
      const changed = applyStatusChange(occurrence, input.data, today(now()));
      if (changed.status === "SETTLED" && changed.amount === null) {
        throw new Refusal(400, "AMOUNT_REQUIRED_TO_SETTLE");
      }
      return changed;
    });
  });

  // The editable fields (PRD §5.8).
  router.patch("/:id", async (req, res) => {
    const input = OccurrenceEditSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json(invalidInput(input.error));
      return;
    }
    await changeOccurrence(res, req.params.id, (occurrence) => {
      const refusal = editRefusal(occurrence, input.data);
      if (refusal) throw new Refusal(400, refusal);
      return input.data;
    });
  });

  // Only a one-off occurrence is deleted, for good; one of a recurrence is
  // skipped instead (PRD §5.9).
  router.delete("/:id", async (req, res) => {
    const { userId } = res.locals;
    const { id } = req.params;
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
      res.status(204).end();
    } else if (await occurrenceExists(db, userId, id)) {
      res.status(409).json({ code: "ONLY_ONE_OFF_DELETABLE" });
    } else {
      res.status(404).json({ code: "OCCURRENCE_NOT_FOUND" });
    }
  });

  return router;
}

/**
 * The user's occurrence `id`, locked for the change. A virtual id is
 * materialized first (PRD §5.2).
 */
async function occurrenceToChange(tx: Transaction, userId: string, id: string) {
  const virtual = parseVirtualId(id);
  if (virtual) await materialize(tx, userId, virtual);
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
  return occurrence;
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
 * the recurrence as it is now, unless it is already persisted. Idempotent: the
 * unique index on (user, recurrence, period) keeps a second insert out.
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
  if (!recurrence || !isInEffect(recurrence, period)) return;
  await tx
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
    });
}
