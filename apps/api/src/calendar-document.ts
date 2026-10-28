import { schema, type Database } from "@mensal/database";
import {
  currentPeriod,
  monthOf,
  resolvePeriod,
  shiftPeriod,
  today,
  type PeriodItem,
} from "@mensal/shared";
import { and, eq, lte } from "drizzle-orm";
import { text, writeICalendar, type ICalendarComponent } from "./icalendar.ts";

const { occurrences, recurrences } = schema;

/** What the calendar is read for: whose, and when "today" is. */
export interface CalendarContext {
  db: Database;
  userId: string;
  /** The clock "today" is read from. */
  now: () => Date;
  /** The app's public origin, which each event links back to. */
  origin: string;
}

/** How many periods after the current one the calendar covers. */
const PERIODS_AHEAD = 3;

/**
 * The calendar a user's calendar link serves (PRD §6.7, ADR-0008), as
 * iCalendar text, knowing nothing of HTTP. Named "Mensal"; every event is
 * all-day, so the time zone is for information only. Read-only: virtual
 * occurrences are projected by `resolvePeriod`, never materialized.
 */
export async function calendarDocument(
  context: CalendarContext
): Promise<string> {
  const stamp = dateTime(context.now());
  const pending = await pendingOccurrences(context);
  return writeICalendar({
    name: "VCALENDAR",
    properties: [
      ["VERSION", "2.0"],
      ["PRODID", "-//Mensal//Link do calendario//PT-BR"],
      ["CALSCALE", "GREGORIAN"],
      ["METHOD", "PUBLISH"],
      ["X-WR-CALNAME", "Mensal"],
      ["X-WR-TIMEZONE", "America/Sao_Paulo"],
    ],
    components: pending.map((occurrence) =>
      event(occurrence, { stamp, origin: context.origin })
    ),
  });
}

/** A pending occurrence the calendar shows, and when it last changed. */
interface PendingOccurrence {
  item: PeriodItem;
  /** The occurrence's `updatedAt`, or its recurrence's for a virtual one. */
  updatedAt: Date;
}

/**
 * Every pending occurrence with a due date that the calendar shows: the
 * overdue ones of earlier periods, as the current period lists them (PRD §4),
 * and those of the current period and the next {@link PERIODS_AHEAD}.
 */
async function pendingOccurrences({
  db,
  userId,
  now,
}: CalendarContext): Promise<PendingOccurrence[]> {
  const date = now();
  const first = currentPeriod(date);
  const last = shiftPeriod(first, PERIODS_AHEAD);
  // Every earlier occurrence too, whatever its status: resolvePeriod needs
  // them to tell which are still overdue.
  const [userRecurrences, userOccurrences] = await Promise.all([
    db
      .select()
      .from(recurrences)
      .where(
        and(eq(recurrences.userId, userId), lte(recurrences.startPeriod, last))
      ),
    db
      .select()
      .from(occurrences)
      .where(
        and(eq(occurrences.userId, userId), lte(occurrences.period, last))
      ),
  ]);
  const updatedAt = new Map(
    [...userRecurrences, ...userOccurrences].map((row) => [
      row.id,
      row.updatedAt,
    ])
  );
  return Array.from({ length: PERIODS_AHEAD + 1 }, (_, n) =>
    resolvePeriod({
      period: shiftPeriod(first, n),
      today: today(date),
      occurrences: userOccurrences,
      recurrences: userRecurrences,
    })
  )
    .flatMap((payload) => [
      ...payload.overdueFromPreviousPeriods,
      ...payload.items,
    ])
    .filter((item) => item.status === "PENDING" && item.dueDate !== null)
    .map((item) => ({
      item,
      updatedAt: updatedAt.get(item.isVirtual ? item.recurrenceId! : item.id)!,
    }));
}

/**
 * An all-day event on the occurrence's due date, reminding at 09:00 that day.
 * It names the period and links to it in the app; notes are never included.
 */
function event(
  { item, updatedAt }: PendingOccurrence,
  { stamp, origin }: { stamp: string; origin: string }
): ICalendarComponent {
  const dueDate = item.dueDate!;
  const title = text(summary(item));
  return {
    name: "VEVENT",
    properties: [
      ["UID", uid(item)],
      ["DTSTAMP", stamp],
      ["LAST-MODIFIED", dateTime(updatedAt)],
      ["SEQUENCE", String(sequence(updatedAt))],
      ["DTSTART;VALUE=DATE", compactDate(dueDate)],
      ["DTEND;VALUE=DATE", compactDate(nextDay(dueDate))],
      ["SUMMARY", title],
      ["DESCRIPTION", text(description(item.period, origin))],
      ["TRANSP", "TRANSPARENT"],
    ],
    components: [
      {
        name: "VALARM",
        properties: [
          ["ACTION", "DISPLAY"],
          ["TRIGGER", "PT9H"],
          ["DESCRIPTION", title],
        ],
      },
    ],
  };
}

/** Where {@link sequence} counts from: before any occurrence was stored. */
const SEQUENCE_EPOCH = Date.UTC(2020, 0, 1);

/**
 * The event's revision: the seconds from {@link SEQUENCE_EPOCH} to its last
 * change, so it grows with each edit, materializing included, and fits
 * iCalendar's 32-bit INTEGER until 2088.
 */
function sequence(updatedAt: Date): number {
  return Math.floor((updatedAt.getTime() - SEQUENCE_EPOCH) / 1000);
}

/** An instant as an iCalendar UTC DATE-TIME, e.g. '20261012T150000Z'. */
function dateTime(instant: Date): string {
  return instant.toISOString().replace(/\.\d+/, "").replace(/[-:]/g, "");
}

/**
 * The same for a recurrence's occurrence before and after it is materialized,
 * so the calendar keeps one event; a one-off's id otherwise.
 */
function uid({ id, recurrenceId, period }: PeriodItem): string {
  return `${recurrenceId === null ? id : `${recurrenceId}_${period}`}@mensal`;
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** "Aluguel · R$ 2.200,00", "Entrada: Salário · A definir". */
function summary({ direction, description, amount }: PeriodItem): string {
  const prefix = direction === "INFLOW" ? "Entrada: " : "";
  // Intl puts a no-break space after "R$"; the summary has a plain one.
  const value =
    amount === null
      ? "A definir"
      : brl.format(amount / 100).replace(/\s/g, " ");
  return `${prefix}${description} · ${value}`;
}

const monthName = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: "UTC",
});

/** "Competência: outubro de 2026", then that month's address in the app. */
function description(period: string, origin: string): string {
  const month = monthName.format(new Date(`${period}T00:00:00Z`));
  const url = new URL("/", origin);
  url.searchParams.set("mes", monthOf(period));
  return `Competência: ${month} de ${period.slice(0, 4)}\n${url.href}`;
}

/** 'YYYY-MM-DD' as an iCalendar DATE, 'YYYYMMDD'. */
function compactDate(date: string): string {
  return date.replaceAll("-", "");
}

/** The day after 'YYYY-MM-DD'. */
function nextDay(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}
