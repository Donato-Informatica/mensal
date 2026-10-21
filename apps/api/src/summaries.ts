import type { Database } from "@mensal/database";
import { Router } from "express";
import type { RecordActivity } from "./activity.ts";
import { answer } from "./answer.ts";
import { readSummaries } from "./operations.ts";

/** `GET /summaries?from&to`: the summary of each period of a range (PRD §6.4). */
export function summariesRouter({
  db,
  now,
  record,
}: {
  db: Database;
  now: () => Date;
  record: RecordActivity;
}) {
  const router = Router();

  router.get("/", (req, res) =>
    answer(res, 200, () =>
      readSummaries({ db, now, record, userId: res.locals.userId }, req.query)
    )
  );

  return router;
}
