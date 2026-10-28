import { randomBytes } from "node:crypto";
import { schema, type Database } from "@mensal/database";
import type { CalendarLinkPayload } from "@mensal/shared";
import { eq, sql } from "drizzle-orm";
import type { RecordActivity } from "./activity.ts";

const { calendarLinks, users } = schema;

/**
 * The domain operations on the user's calendar link (PRD §6.6, ADR-0008),
 * knowing nothing of HTTP. Writes log their activity (PRD §8.7.1) through
 * `record`, never with the key.
 */
export interface CalendarLinkContext {
  db: Database;
  userId: string;
  /** The app's public origin, which the link's URL is built on. */
  origin: string;
  record: RecordActivity;
}

/** The user's calendar link, or null when they have none. */
export async function readCalendarLink({
  db,
  userId,
  origin,
}: CalendarLinkContext): Promise<CalendarLinkPayload> {
  const [link] = await db
    .select()
    .from(calendarLinks)
    .where(eq(calendarLinks.userId, userId));
  return { link: link ? describe(link, origin) : null };
}

/**
 * Generates a new link for the user, replacing the current one, which stops
 * working at once. The caller has already proven the user's password.
 */
export async function generateCalendarLink({
  db,
  userId,
  origin,
  record,
}: CalendarLinkContext): Promise<CalendarLinkPayload> {
  const key = randomBytes(32).toString("base64url");
  const [link] = await db
    .insert(calendarLinks)
    .values({ userId, key })
    .onConflictDoUpdate({
      target: calendarLinks.userId,
      set: { key, createdAt: sql`now()` },
    })
    .returning();
  record({ user: userId, action: "user.calendar-link-created" });
  return { link: describe(link!, origin) };
}

/**
 * Deactivates the user's link, if they have one; reading it answers 404 from
 * then on. Logged only when there was a link to deactivate.
 */
export async function revokeCalendarLink({
  db,
  userId,
  record,
}: CalendarLinkContext): Promise<void> {
  if (await deleteCalendarLink(db, userId)) {
    record({ user: userId, action: "user.calendar-link-revoked" });
  }
}

/**
 * Deletes the user's link, if they have one, logging nothing; whether there
 * was one. For callers whose own event reports it, as a password change or
 * reset does in its `revoked`.
 */
export async function deleteCalendarLink(
  db: Database,
  userId: string
): Promise<boolean> {
  const deleted = await db
    .delete(calendarLinks)
    .where(eq(calendarLinks.userId, userId))
    .returning({ userId: calendarLinks.userId });
  return deleted.length > 0;
}

/**
 * Whose link `key` is, and whether that user is approved; undefined for a key
 * that is unknown, replaced or deactivated.
 */
export async function calendarLinkOwner(
  db: Database,
  key: string
): Promise<{ userId: string; approved: boolean } | undefined> {
  const [owner] = await db
    .select({ userId: users.id, approved: users.approved })
    .from(calendarLinks)
    .innerJoin(users, eq(users.id, calendarLinks.userId))
    .where(eq(calendarLinks.key, key));
  return owner;
}

/** A stored link as the API shows it: its URL, with its key. */
function describe(
  link: typeof calendarLinks.$inferSelect,
  origin: string
): NonNullable<CalendarLinkPayload["link"]> {
  const url = new URL("/api/calendar.ics", origin);
  url.searchParams.set("key", link.key);
  return { url: url.href, createdAt: link.createdAt.toISOString() };
}
