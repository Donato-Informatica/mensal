import { schema, type Database } from "@mensal/database";
import {
  currentPeriod,
  NewRecurrenceSchema,
  RecurrenceEditSchema,
  RecurrenceListQuerySchema,
} from "@mensal/shared";
import { and, asc, eq, gte, isNull, or } from "drizzle-orm";
import { Router } from "express";
import { invalidInput } from "./invalid-input.ts";
import { UUID } from "./uuid.ts";

/** `/recurrences`: the user's recurrences (PRD §6.1). */
export function recurrencesRouter({
  db,
  now,
}: {
  db: Database;
  now: () => Date;
}) {
  const router = Router();
  const { recurrences } = schema;

  router.get("/", async (req, res) => {
    const query = RecurrenceListQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json(invalidInput(query.error));
      return;
    }
    // Active: not ended before the current period, future starts included.
    const active = or(
      isNull(recurrences.endPeriod),
      gte(recurrences.endPeriod, currentPeriod(now()))
    );
    res.json(
      await db
        .select()
        .from(recurrences)
        .where(
          and(
            eq(recurrences.userId, res.locals.userId),
            query.data.status === "active" ? active : undefined
          )
        )
        .orderBy(asc(recurrences.description), asc(recurrences.createdAt))
    );
  });

  router.get("/:id", async (req, res) => {
    const recurrence = await findRecurrence(res.locals.userId, req.params.id);
    if (!recurrence) {
      res.status(404).json({ code: "RECURRENCE_NOT_FOUND" });
      return;
    }
    res.json(recurrence);
  });

  router.post("/", async (req, res) => {
    const input = NewRecurrenceSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json(invalidInput(input.error));
      return;
    }
    // Earlier history is entered as one-off occurrences (PRD §5.10).
    if (input.data.startPeriod < currentPeriod(now())) {
      res.status(400).json({ code: "START_PERIOD_IN_PAST" });
      return;
    }
    const [recurrence] = await db
      .insert(recurrences)
      .values({ ...input.data, userId: res.locals.userId })
      .returning();
    res.status(201).json(recurrence);
  });

  // The editable fields (PRD §6.1). The recurrence's virtual occurrences
  // follow it; its persisted ones keep their snapshot (PRD §5.3).
  router.patch("/:id", async (req, res) => {
    const input = RecurrenceEditSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json(invalidInput(input.error));
      return;
    }
    const recurrence = await findRecurrence(res.locals.userId, req.params.id);
    if (!recurrence) {
      res.status(404).json({ code: "RECURRENCE_NOT_FOUND" });
      return;
    }
    const { endPeriod } = input.data;
    // The start is immutable, so the stored one decides.
    if (endPeriod && endPeriod < recurrence.startPeriod) {
      res.status(400).json({ code: "END_PERIOD_BEFORE_START" });
      return;
    }
    if (Object.values(input.data).every((value) => value === undefined)) {
      res.json(recurrence);
      return;
    }
    const [updated] = await db
      .update(recurrences)
      .set(input.data)
      .where(
        and(
          eq(recurrences.userId, recurrence.userId),
          eq(recurrences.id, recurrence.id)
        )
      )
      .returning();
    res.json(updated);
  });

  /** The user's recurrence `id`, if they have one. */
  async function findRecurrence(userId: string, id: string) {
    if (!UUID.test(id)) return undefined;
    const [recurrence] = await db
      .select()
      .from(recurrences)
      .where(and(eq(recurrences.userId, userId), eq(recurrences.id, id)));
    return recurrence;
  }

  return router;
}
