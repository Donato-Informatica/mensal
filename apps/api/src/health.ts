import type { Database } from "@mensal/database";
import { Router } from "express";
import type { Log } from "./log.ts";

const PING_TIMEOUT_MS = 2000;

/**
 * `GET /health`: 200 while the database answers a trivial query, 503 when it
 * fails or takes too long. Unauthenticated and minimal on purpose: the cause
 * goes to the log, never to the client (PRD §8.4, §8.6).
 */
export function healthRouter({ db, log }: { db: Database; log: Log }): Router {
  const router = Router();
  router.get("/", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        db.$client.query("SELECT 1"),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("database ping timed out")),
            PING_TIMEOUT_MS
          );
        }),
      ]);
      res.json({ status: "ok" });
    } catch (error) {
      log(
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      );
      res.status(503).json({ status: "unavailable" });
    } finally {
      clearTimeout(timer);
    }
  });
  return router;
}
