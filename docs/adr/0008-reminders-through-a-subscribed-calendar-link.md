# Reminders through a subscribed calendar link

_Superseded in part by [ADR-0009](0009-reminders-through-web-push-and-a-daily-job.md): Mensal now also sends reminders of its own, by Web Push from a daily job. The calendar link stays, and what follows about the feed still holds._

Users want to be reminded of pending occurrences before they become overdue. Mensal sends no reminders of its own in the MVP. Instead it serves a read-only iCalendar feed at `GET /api/calendar.ics?key=…`, which the user subscribes to in Google Calendar, Apple Calendar or any other client. Each pending occurrence with a due date becomes an all-day event on that date, with an alarm at 09:00 on the day. The user's calendar fetches the feed whenever it refreshes, so Mensal needs no scheduled job, and no reminder exists that Mensal could have to retract. This fits [ADR-0001](0001-virtual-occurrences.md): every event is projected at read time.

## Considered Options

- **Email reminders:** a scheduled job, delivery and unsubscribe handling, and an exception to the "no notifications" non-goal (PRD §1.3).
- **PWA push notifications:** the better long-term channel, planned as a future feature. Like email, it needs a scheduled job and a store of push subscriptions.
- **The feed authenticated by an access token:** a token reads and writes everything and is valid only on `/api/mcp` ([ADR-0004](0004-remote-mcp-with-access-tokens.md)). A URL kept on a calendar provider's servers must grant as little as possible, so the calendar link is a separate, read-only secret, one per user.
- **The secret in the path** (`/api/calendar/<key>.ics`): telemetry keeps `url.path` and drops only the query string (PRD §8.7.2), so the key would have reached exported spans.

## Consequences

- The alarm is a bonus, not a guarantee. Google Calendar and Outlook ignore alarms in subscribed feeds, and Apple Calendar strips them unless the user turns off "Remove Alerts". The guide tells Google users to set the subscribed calendar's own all-day notifications, and Apple users to keep its alerts.
- Calendars refresh on their own schedule, about every 8–24 hours on Google. An occurrence that was settled or skipped can stay in the calendar, and still trigger its reminder, until the next refresh.
- Changing the URL's shape breaks every existing subscription. Event UIDs must stay stable across materialization: a recurrence's occurrence is identified by its recurrence and period, never by its virtual or persisted id.
- The key passes through nginx, whose access log records the query string. The feed's location therefore logs `$uri` only.
