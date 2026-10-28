import type { Database } from "@mensal/database";
import { Router } from "express";
import { calendarDocument } from "./calendar-document.ts";
import { calendarLinkOwner } from "./calendar-link-operations.ts";
import { identifyRequest } from "./telemetry-context.ts";

/**
 * `GET /api/calendar.ics?key=…`: the calendar a calendar link serves
 * (PRD §6.7, ADR-0008). Outside `/api/v1`, with no cookie or session: the key
 * is the only credential, in the query string, which telemetry drops. A
 * missing, unknown or deactivated key answers 404 with no body; an unapproved
 * owner, 403, checked on every read.
 */
export function calendarFeedRouter({ db }: { db: Database }) {
  const router = Router();

  router.get("/", async (req, res) => {
    const { key } = req.query;
    const owner =
      typeof key === "string" && key !== ""
        ? await calendarLinkOwner(db, key)
        : undefined;
    if (!owner) {
      res.status(404).end();
      return;
    }
    if (!owner.approved) {
      res.status(403).json({ code: "USER_NOT_APPROVED" });
      return;
    }
    identifyRequest(req, owner.userId);
    res
      .status(200)
      .set({
        "content-type": "text/calendar; charset=utf-8",
        "cache-control": "no-store",
      })
      .send(calendarDocument());
  });

  return router;
}
