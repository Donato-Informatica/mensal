import type { Database } from "@mensal/database";
import { Router } from "express";
import type { RecordActivity } from "./activity.ts";
import { answer } from "./answer.ts";
import { readPeriod } from "./operations.ts";

/** `GET /periods/:yyyy-mm`: the user's period payload (PRD §4, §6.2). */
export function periodsRouter({
  db,
  now,
  record,
}: {
  db: Database;
  now: () => Date;
  record: RecordActivity;
}) {
  const router = Router();

  router.get("/:month", (req, res) =>
    answer(res, 200, () =>
      readPeriod(
        { db, now, record, userId: res.locals.userId },
        req.params.month
      )
    )
  );

  return router;
}
