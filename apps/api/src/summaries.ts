import { schema, type Database } from "@mensal/database";
import { parseSummariesQuery, summarizeRange } from "@mensal/shared";
import { and, eq, gte, lte } from "drizzle-orm";
import { Router } from "express";

/** `GET /summaries?from&to`: the summary of each period of a range (PRD §6.4). */
export function summariesRouter({ db }: { db: Database }) {
  const router = Router();

  router.get("/", async (req, res) => {
    const parsed = parseSummariesQuery(req.query);
    if ("code" in parsed) {
      res.status(400).json({ code: parsed.code });
      return;
    }
    const { from, to } = parsed.query;
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
