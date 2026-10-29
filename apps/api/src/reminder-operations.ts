import { schema, type Database } from "@mensal/database";
import type {
  ReminderDevice,
  ReminderDeviceCheckResult,
  ReminderDeviceCount,
  RemindersPayload,
} from "@mensal/shared";
import { and, count, eq, ne, sql } from "drizzle-orm";
import type { RecordActivity } from "./activity.ts";
import { describeError, type Log } from "./log.ts";
import type { PushMessage, SendPush } from "./push.ts";
import { Refusal } from "./refusal.ts";

const { reminderDevices } = schema;

/** Reminders as this server has them: off without VAPID keys (PRD §8.4). */
export interface Reminders {
  /** The VAPID public key browsers register with. */
  publicKey: string;
  push: SendPush;
}

/**
 * The domain operations on a user's reminder devices (PRD §6.8, ADR-0009),
 * knowing nothing of HTTP. Writes log their activity (PRD §8.7.1) with the
 * device's id, never its endpoint.
 */
export interface ReminderContext {
  db: Database;
  userId: string;
  /** The session the request came with, which a device is bound to. */
  sessionId: string;
  /** Undefined when reminders are not configured on this server. */
  reminders: Reminders | undefined;
  record: RecordActivity;
  log: Log;
}

/** What a device is sent when the user turns reminders on there. */
export const confirmation: PushMessage = {
  title: "Lembretes ativados",
  body: "Todo dia às 9h, neste dispositivo, sobre as contas que vencem no dia e as atrasadas.",
};

/** The server's public key, or null, and how many devices the user has. */
export async function readReminders({
  db,
  userId,
  reminders,
}: ReminderContext): Promise<RemindersPayload> {
  return {
    publicKey: reminders?.publicKey ?? null,
    deviceCount: await deviceCount(db, userId),
  };
}

/**
 * Turns reminders on for the calling device, bound to the current session.
 * Idempotent on the endpoint; one registered to another user is taken over,
 * since holding it proves the caller is on that device. A device new to the
 * user is sent the confirmation; a failure to send it is logged, and the
 * device stays on.
 */
export async function turnRemindersOn(
  { db, userId, sessionId, reminders, record, log }: ReminderContext,
  device: ReminderDevice
): Promise<ReminderDeviceCount> {
  if (!reminders) throw new Refusal(409, "REMINDERS_UNAVAILABLE");
  const { endpoint, keys } = device;
  const { id, inserted } = await db.transaction(async (tx) => {
    await tx
      .delete(reminderDevices)
      .where(
        and(
          eq(reminderDevices.endpoint, endpoint),
          ne(reminderDevices.userId, userId)
        )
      );
    const [row] = await tx
      .insert(reminderDevices)
      .values({ userId, endpoint, ...keys, sessionId })
      .onConflictDoUpdate({
        target: reminderDevices.endpoint,
        set: { ...keys, sessionId },
      })
      .returning({
        id: reminderDevices.id,
        // A row the statement inserted has no xmax: the device is new.
        inserted: sql<boolean>`xmax = 0`,
      });
    return row!;
  });
  if (inserted) {
    record({ user: userId, action: "user.reminders-on", id });
    try {
      await reminders.push({ endpoint, keys }, confirmation);
    } catch (error) {
      log(`Reminders confirmation failed: ${describeError(error)}`);
    }
  }
  return { deviceCount: await deviceCount(db, userId) };
}

/**
 * Whether the browser's endpoint is the user's (PRD §8.2). Another user's
 * registration of it is deleted, so a shared browser never shows the previous
 * user's reminders; the user's own is bound to the current session.
 */
export async function checkReminderDevice(
  { db, userId, sessionId }: ReminderContext,
  endpoint: string
): Promise<ReminderDeviceCheckResult> {
  return db.transaction(async (tx) => {
    await tx
      .delete(reminderDevices)
      .where(
        and(
          eq(reminderDevices.endpoint, endpoint),
          ne(reminderDevices.userId, userId)
        )
      );
    const mine = await tx
      .update(reminderDevices)
      .set({ sessionId })
      .where(
        and(
          eq(reminderDevices.endpoint, endpoint),
          eq(reminderDevices.userId, userId)
        )
      )
      .returning({ id: reminderDevices.id });
    return { mine: mine.length > 0 };
  });
}

async function deviceCount(db: Database, userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(reminderDevices)
    .where(eq(reminderDevices.userId, userId));
  return row?.value ?? 0;
}
