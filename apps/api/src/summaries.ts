import { schema, type Database } from "@mensal/database";
import { periodOfMonth, shiftPeriod, summarizeRange } from "@mensal/shared";
import { and, eq, gte, lte } from "drizzle-orm";
import { Router } from "express";

/** The most periods one request may summarize (PRD §6.4). */
const MAX_PERIODS = 12;

/** `GET /summaries?from&to`: the summary of each period of a range (PRD §6.4). */
export function summariesRouter({ db }: { db: Database }) {
  const router = Router();

  router.get("/", async (req, res) => {
    const from = monthParameter(req.query.from);
    const to = monthParameter(req.query.to);
    if (!from || !to) {
      res.status(400).json({ code: "INVALID_PERIOD" });
      return;
    }
    if (from > to || to >= shiftPeriod(from, MAX_PERIODS)) {
      res.status(400).json({ code: "INVALID_PERIOD_RANGE" });
      return;
    }
    const { userId } = res.locals;
    // Read-only: virtual occurrences are projected, never materialized
    // (ADR 0001).
    const [recurrences, occurrences] = await Promise.all([
      db
        .select()
        .from(schema.recurrences)
        .where(
          and(
            eq(schema.recurrences.userId, userId),
            lte(schema.recurrences.startPeriod, to)
          )
        ),
      db
        .select()
        .from(schema.occurrences)
        .where(
          and(
            eq(schema.occurrences.userId, userId),
            gte(schema.occurrences.period, from),
            lte(schema.occurrences.period, to)
          )
        ),
    ]);
    res.json(summarizeRange({ from, to, occurrences, recurrences }));
  });

  return router;
}

/** The period of a 'YYYY-MM' query parameter, or undefined when it is not one. */
function monthParameter(value: unknown): string | undefined {
  return typeof value === "string" ? periodOfMonth(value) : undefined;
}
