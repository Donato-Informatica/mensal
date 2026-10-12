import { schema, type Database } from "@mensal/database";
import { currentPeriod, NewRecurrenceSchema } from "@mensal/shared";
import { Router } from "express";
import { invalidInput } from "./invalid-input.ts";

/** `/recurrences`: the user's recurrences (PRD §6.1). */
export function recurrencesRouter({
  db,
  now,
}: {
  db: Database;
  now: () => Date;
}) {
  const router = Router();

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
      .insert(schema.recurrences)
      .values({ ...input.data, userId: res.locals.userId })
      .returning();
    res.status(201).json(recurrence);
  });

  return router;
}
