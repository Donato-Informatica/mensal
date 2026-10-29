import type { Database } from "@mensal/database";
import {
  ReminderDeviceCheckSchema,
  ReminderDeviceSchema,
} from "@mensal/shared";
import { Router, type Response } from "express";
import type { RecordActivity } from "./activity.ts";
import { answer } from "./answer.ts";
import { invalidInput } from "./invalid-input.ts";
import type { Log } from "./log.ts";
import {
  checkReminderDevice,
  readReminders,
  turnRemindersOff,
  turnRemindersOffEverywhere,
  turnRemindersOn,
  type Reminders,
} from "./reminder-operations.ts";

/**
 * `/reminders`: the user's reminder devices (PRD §6.8, ADR-0009),
 * cookie-only, with no MCP tool. Endpoints travel in the body, never the URL:
 * an endpoint is a capability URL, and nginx logs query strings.
 */
export function remindersRouter({
  db,
  reminders,
  record,
  log,
}: {
  db: Database;
  /** Undefined when reminders are not configured on this server. */
  reminders: Reminders | undefined;
  record: RecordActivity;
  log: Log;
}) {
  const router = Router();
  const context = (res: Response) => ({
    db,
    userId: res.locals.userId,
    sessionId: res.locals.sessionId,
    reminders,
    record,
    log,
  });

  router.get("/", async (_req, res) => {
    res.json(await readReminders(context(res)));
  });

  router.put("/device", async (req, res) => {
    const parsed = ReminderDeviceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(invalidInput(parsed.error));
      return;
    }
    return answer(res, 200, () => turnRemindersOn(context(res), parsed.data));
  });

  router.post("/device/check", async (req, res) => {
    const parsed = ReminderDeviceCheckSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(invalidInput(parsed.error));
      return;
    }
    res.json(await checkReminderDevice(context(res), parsed.data.endpoint));
  });

  router.delete("/", async (_req, res) => {
    await turnRemindersOffEverywhere(context(res));
    res.status(204).end();
  });

  router.delete("/device", async (req, res) => {
    const parsed = ReminderDeviceCheckSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(invalidInput(parsed.error));
      return;
    }
    await turnRemindersOff(context(res), parsed.data.endpoint);
    res.status(204).end();
  });

  return router;
}
