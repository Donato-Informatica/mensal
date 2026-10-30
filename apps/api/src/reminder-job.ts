import { schema, type Database } from "@mensal/database";
import { currentPeriod, monthOf, today } from "@mensal/shared";
import { trace } from "@opentelemetry/api";
import { and, eq, exists, notExists } from "drizzle-orm";
import { describeError, type Log } from "./log.ts";
import { readPeriod } from "./operations.ts";
import { PushRefused, type ReminderMessage } from "./push.ts";
import type { Reminders } from "./reminder-operations.ts";
import { reminderMessage } from "./reminder-message.ts";

const { reminderDevices, reminderSends, users } = schema;

/** How often the job looks for users to remind (PRD §6.8). */
export const REMINDER_JOB_INTERVAL = 5 * 60 * 1000;

/** The São Paulo hour from which the day's reminders go out. */
const SEND_FROM_HOUR = 9;

export interface ReminderJobOptions {
  db: Database;
  /** Undefined without the VAPID keys: the job then does nothing. */
  reminders: Reminders | undefined;
  /** The clock the day and the hour are read from. */
  now: () => Date;
  /** Where failures are written. */
  log: Log;
  /** Where each run's counts are written (PRD §8.7.3). */
  info: Log;
}

/**
 * Runs the daily job every {@link REMINDER_JOB_INTERVAL}, and once now, so a
 * run missed while the API was down is caught up the same day. Started by the
 * API process, never in tests. Returns what stops it.
 */
export function startReminderJob(options: ReminderJobOptions): () => void {
  const tick = () => {
    runReminders(options).catch((error: unknown) =>
      options.log(`Reminder job failed: ${describeError(error)}`)
    );
  };
  tick();
  const timer = setInterval(tick, REMINDER_JOB_INTERVAL);
  timer.unref();
  return () => clearInterval(timer);
}

/**
 * One run of the daily job (PRD §6.8, ADR-0009). From 09:00 in São Paulo, it
 * handles each approved user with a device and no reminder today: it records
 * the day first, and only the run that recorded it sends, so a user gets at
 * most one reminder a day. Read-only on occurrences: it never materializes.
 */
export async function runReminders({
  db,
  reminders,
  now,
  log,
  info,
}: ReminderJobOptions): Promise<void> {
  if (!reminders) return;
  const at = now();
  if (hourInSaoPaulo(at) < SEND_FROM_HOUR) return;
  const date = today(at);
  const due = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.approved, true),
        exists(
          db
            .select()
            .from(reminderDevices)
            .where(eq(reminderDevices.userId, users.id))
        ),
        notExists(
          db
            .select()
            .from(reminderSends)
            .where(
              and(
                eq(reminderSends.userId, users.id),
                eq(reminderSends.date, date)
              )
            )
        )
      )
    );
  // Most runs of the day find nobody left: they leave no span and no line.
  if (due.length === 0) return;

  await trace
    .getTracer("mensal-api")
    .startActiveSpan("reminders.run", async (span) => {
      const counts = { reminded: 0, sent: 0, failed: 0, dropped: 0 };
      try {
        for (const { id: userId } of due) {
          const claimed = await db
            .insert(reminderSends)
            .values({ userId, date })
            .onConflictDoNothing()
            .returning({ userId: reminderSends.userId });
          if (claimed.length === 0) continue;

          const message = await todaysMessage(db, userId, at);
          if (!message) continue;

          counts.reminded++;
          await sendToDevices({ db, reminders, log }, userId, message, counts);
        }
      } finally {
        span.setAttributes({
          "reminders.users_reminded": counts.reminded,
          "reminders.devices_sent": counts.sent,
          "reminders.devices_failed": counts.failed,
          "reminders.devices_dropped": counts.dropped,
        });
        span.end();
        info(
          `Reminders: ${counts.reminded} users reminded, ${counts.sent} devices sent, ${counts.failed} failed, ${counts.dropped} dropped`
        );
      }
    });
}

/** How a run's devices fared: sent to, failed, and dropped as gone. */
interface DeviceCounts {
  sent: number;
  failed: number;
  dropped: number;
}

/**
 * The user's reminder for `at`'s day, from the current period as the monthly
 * screen shows it, or null when nothing is due today or overdue.
 */
async function todaysMessage(
  db: Database,
  userId: string,
  at: Date
): Promise<ReminderMessage | null> {
  const date = today(at);
  const payload = await readPeriod(
    { db, userId, now: () => at, record: () => {} },
    monthOf(currentPeriod(at))
  );
  return reminderMessage(
    payload.items.filter(
      (item) => item.status === "PENDING" && item.dueDate === date
    ),
    [
      ...payload.overdueFromPreviousPeriods,
      ...payload.items.filter((item) => item.overdue),
    ]
  );
}

/**
 * Sends `message` to each of the user's devices, counting each outcome. A
 * device whose push service says it is gone is deleted; any other failure is
 * logged, and the device kept.
 */
async function sendToDevices(
  { db, reminders, log }: { db: Database; reminders: Reminders; log: Log },
  userId: string,
  message: ReminderMessage,
  counts: DeviceCounts
): Promise<void> {
  const devices = await db
    .select()
    .from(reminderDevices)
    .where(eq(reminderDevices.userId, userId));
  for (const { id, endpoint, p256dh, auth } of devices) {
    try {
      await reminders.push({ endpoint, keys: { p256dh, auth } }, message);
      counts.sent++;
    } catch (error) {
      if (error instanceof PushRefused && error.gone) {
        await db.delete(reminderDevices).where(eq(reminderDevices.id, id));
        counts.dropped++;
      } else {
        log(`Reminder send failed: ${describeError(error)}`);
        counts.failed++;
      }
    }
  }
}

const hourFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  hourCycle: "h23",
});

function hourInSaoPaulo(at: Date): number {
  return Number(hourFormat.format(at));
}
