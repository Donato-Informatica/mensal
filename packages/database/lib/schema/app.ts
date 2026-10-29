import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./auth.ts";

// PRD §3. Amounts are BRL cents; periods are DATEs on the 1st of a month.

export const direction = pgEnum("direction", ["INFLOW", "OUTFLOW"]);

export const occurrenceStatus = pgEnum("occurrence_status", [
  "PENDING",
  "SETTLED",
  "SKIPPED",
]);

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const recurrences = pgTable(
  "recurrences",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    direction: direction().notNull(),
    description: varchar({ length: 120 }).notNull(),
    defaultAmount: integer(),
    dueDay: smallint(),
    startPeriod: date({ mode: "string" }).notNull(),
    endPeriod: date({ mode: "string" }),
    notes: text(),
    ...timestamps,
  },
  (table) => [
    index("recurrences_user_id_idx").on(table.userId),
    check(
      "recurrences_default_amount_positive",
      sql`${table.defaultAmount} IS NULL OR ${table.defaultAmount} > 0`
    ),
    check(
      "recurrences_due_day_in_month",
      sql`${table.dueDay} IS NULL OR ${table.dueDay} BETWEEN 1 AND 31`
    ),
    check(
      "recurrences_start_period_first_of_month",
      sql`extract(day FROM ${table.startPeriod}) = 1`
    ),
    check(
      "recurrences_end_period_first_of_month",
      sql`${table.endPeriod} IS NULL OR extract(day FROM ${table.endPeriod}) = 1`
    ),
    check(
      "recurrences_end_period_not_before_start",
      sql`${table.endPeriod} IS NULL OR ${table.endPeriod} >= ${table.startPeriod}`
    ),
  ]
);

export const occurrences = pgTable(
  "occurrences",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // A recurrence with persisted occurrences is ended, never deleted (PRD §5.4).
    // NO ACTION, not RESTRICT, so deleting a user can cascade to both tables.
    recurrenceId: uuid().references(() => recurrences.id, {
      onDelete: "no action",
    }),
    direction: direction().notNull(),
    description: varchar({ length: 120 }).notNull(),
    status: occurrenceStatus().notNull(),
    amount: integer(),
    period: date({ mode: "string" }).notNull(),
    dueDate: date({ mode: "string" }),
    settledAt: date({ mode: "string" }),
    notes: text(),
    ...timestamps,
  },
  (table) => [
    // One occurrence per recurrence per period (PRD §5.1).
    uniqueIndex("occurrences_user_id_recurrence_id_period_idx")
      .on(table.userId, table.recurrenceId, table.period)
      .where(sql`${table.recurrenceId} IS NOT NULL`),
    index("occurrences_user_id_period_idx").on(table.userId, table.period),
    check(
      "occurrences_amount_positive",
      sql`${table.amount} IS NULL OR ${table.amount} > 0`
    ),
    check(
      "occurrences_settled_has_amount",
      sql`${table.status} <> 'SETTLED' OR ${table.amount} IS NOT NULL`
    ),
    check(
      "occurrences_settled_at_iff_settled",
      sql`(${table.status} = 'SETTLED') = (${table.settledAt} IS NOT NULL)`
    ),
    check(
      "occurrences_due_date_within_period",
      sql`${table.dueDate} IS NULL OR date_trunc('month', ${table.dueDate})::date = ${table.period}`
    ),
    check(
      "occurrences_period_first_of_month",
      sql`extract(day FROM ${table.period}) = 1`
    ),
  ]
);

/**
 * The user's calendar link (PRD §6.6, ADR-0008): at most one per user, its key
 * in plain text, since whoever reads the database already reads what the
 * link exposes. Not a Better-Auth field: it never travels with the
 * session.
 */
export const calendarLinks = pgTable("calendar_links", {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  key: text().notNull().unique(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

/**
 * A reminder device (PRD §6.8, ADR-0009): one browser's push registration,
 * belonging to one user at a time (`endpoint` is unique across users). Kept
 * in plain text: a registration only lets its holder send to that browser.
 * `sessionId` is the session that last registered or checked it, without a
 * foreign key, so the device outlives that session.
 */
export const reminderDevices = pgTable("reminder_devices", {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text().notNull().unique(),
  p256dh: text().notNull(),
  auth: text().notNull(),
  sessionId: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});
