import type { Database } from "@mensal/database";
import { Router } from "express";
import { publicOrigin, type Auth } from "./auth.ts";
import { calendarDocument } from "./calendar-document.ts";
import { calendarLinkOwner } from "./calendar-link-operations.ts";
import { slidingWindow } from "./sliding-window.ts";
import { identifyRequest } from "./telemetry-context.ts";

/**
 * `GET /api/calendar.ics?key=…`: the calendar a calendar link serves
 * (PRD §6.7, ADR-0008). Outside `/api/v1`, with no cookie or session: the key
 * is the only credential, in the query string, which telemetry drops. A
 * missing, unknown or deactivated key answers 404 with no body; a link read
 * too often, 429; an unapproved owner, 403, checked on every read.
 */
export function calendarFeedRouter({
  auth,
  db,
  now,
}: {
  auth: Auth;
  db: Database;
  now: () => Date;
}) {
  const router = Router();
  const allowRead = readLimiter(now);

  router.get("/", async (req, res) => {
    const key = typeof req.query.key === "string" ? req.query.key : "";
    const owner = key !== "" ? await calendarLinkOwner(db, key) : undefined;
    if (!owner) {
      res.status(404).end();
      return;
    }
    if (!allowRead(key)) {
      res.status(429).json({ code: "TOO_MANY_REQUESTS" });
      return;
    }
    if (!owner.approved) {
      res.status(403).json({ code: "USER_NOT_APPROVED" });
      return;
    }
    identifyRequest(req, owner.userId);
    const calendar = await calendarDocument({
      db,
      userId: owner.userId,
      now,
      origin: publicOrigin(auth),
    });
    res
      .status(200)
      .set({
        "content-type": "text/calendar; charset=utf-8",
        "cache-control": "no-store",
      })
      .send(calendar);
  });

  return router;
}

/**
 * Whether a link may be read now: at most 60 reads of each link in the last
 * hour (PRD §6.7). Only existing links are counted, so unknown keys cannot
 * fill it.
 */
function readLimiter(now: () => Date): (key: string) => boolean {
  const reads = slidingWindow({ max: 60, windowMs: 60 * 60 * 1000, now });
  return (key) => {
    if (reads.isFull(key)) return false;
    reads.add(key);
    return true;
  };
}
