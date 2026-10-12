import { schema, type Database } from "@mensal/database";
import {
  currentPeriod,
  periodOfMonth,
  resolvePeriod,
  today,
} from "@mensal/shared";
import { and, eq, lte } from "drizzle-orm";
import { Router } from "express";

/** `GET /periods/:yyyy-mm`: the user's period payload (PRD §4, §6.2). */
export function periodsRouter({ db, now }: { db: Database; now: () => Date }) {
  const router = Router();

  router.get("/:month", async (req, res) => {
    const period = periodOfMonth(req.params.month);
    if (!period) {
      res.status(400).json({ code: "INVALID_PERIOD" });
      return;
    }
    const { userId } = res.locals;
    const date = now();
    // For the current period, every earlier occurrence too, whatever its
    // status: resolvePeriod needs them to tell which are still overdue.
    const isCurrent = period === currentPeriod(date);
    const [recurrences, occurrences] = await Promise.all([
      db
        .select()
        .from(schema.recurrences)
        .where(
          and(
            eq(schema.recurrences.userId, userId),
            lte(schema.recurrences.startPeriod, period)
          )
        ),
      db
        .select()
        .from(schema.occurrences)
        .where(
          and(
            eq(schema.occurrences.userId, userId),
            isCurrent
              ? lte(schema.occurrences.period, period)
              : eq(schema.occurrences.period, period)
          )
        ),
    ]);
    res.json(
      resolvePeriod({ period, today: today(date), occurrences, recurrences })
    );
  });

  return router;
}
