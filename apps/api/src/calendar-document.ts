import { writeICalendar } from "./icalendar.ts";

/**
 * The calendar a user's calendar link serves (PRD §6.7, ADR-0008), as
 * iCalendar text, knowing nothing of HTTP. Named "Mensal"; every event is
 * all-day, so the time zone is for information only.
 */
export function calendarDocument(): string {
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
  });
}
