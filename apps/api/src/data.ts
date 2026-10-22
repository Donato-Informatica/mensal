import { pipeline } from "node:stream/promises";
import type { Database } from "@mensal/database";
import { today } from "@mensal/shared";
import { Router } from "express";
import { dataArchive, dataArchiveName } from "./data-archive.ts";
import { describeError, type Log } from "./log.ts";

/** `GET /data`: the user's own data as a ZIP download (PRD §6.5). */
export function dataRouter({
  db,
  now,
  log,
}: {
  db: Database;
  now: () => Date;
  log: Log;
}) {
  const router = Router();

  router.get("/", async (_req, res) => {
    const date = now();
    const archive = await dataArchive(db, res.locals.userId, { now: date });
    res.status(200).set({
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${dataArchiveName(today(date))}"`,
    });
    try {
      await pipeline(archive, res);
    } catch (error) {
      // The answer has begun, so nothing more can be said to the client, and
      // pipeline has already cut it off. A client that leaves early is no
      // fault of ours.
      if ((error as { code?: unknown }).code !== "ERR_STREAM_PREMATURE_CLOSE") {
        log(describeError(error));
      }
    }
  });

  return router;
}
