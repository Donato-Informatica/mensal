import type { Database } from "@mensal/database";
import { Router } from "express";
import { publicOrigin, type Auth } from "./auth.ts";
import { calendarDocument } from "./calendar-document.ts";
import { calendarLinkOwner } from "./calendar-link-operations.ts";
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

const MAX_READS = 60;
const READ_WINDOW_MS = 60 * 60 * 1000;

/**
 * Whether a link may be read now: at most {@link MAX_READS} reads of each link
 * in the last hour (PRD §6.7). In memory, as the app runs as one container;
 * only existing links are counted, so unknown keys cannot fill it.
 */
function readLimiter(now: () => Date): (key: string) => boolean {
  /** When each link was read lately (epoch ms), by key. */
  const reads = new Map<string, number[]>();
  return (key) => {
    const at = now().getTime();
    const recent = (reads.get(key) ?? []).filter(
      (readAt) => readAt > at - READ_WINDOW_MS
    );
    const allowed = recent.length < MAX_READS;
    reads.set(key, allowed ? [...recent, at] : recent);
    return allowed;
  };
}
