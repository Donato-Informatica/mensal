# Reminders through Web Push and a daily in-process job

Supersedes in part [ADR-0008](0008-reminders-through-a-subscribed-calendar-link.md): Mensal now sends reminders of its own. Once a day at 09:00 America/Sao_Paulo, a job inside the API process sends each approved user one Web Push reminder about their pending occurrences due that day and those overdue, to every device on which they turned reminders on (PRD §6.8). The calendar link stays as an independent channel, and ADR-0008's reasoning about the feed still holds. We chose push because the calendar link's alarm is ignored by Google Calendar and Outlook and stripped by Apple Calendar by default, and because a calendar refreshes on its own schedule, so it can remind about something already settled. Web Push needs no third-party account: the server signs with its own VAPID keys.

## Considered Options

- **A separate `worker` service** running the job: a second container, healthcheck and Coolify setting for one short run a day. The job keeps its state in Postgres, so it can move there later without changing the data model.
- **Coolify's scheduled tasks or an external cron calling an endpoint:** the schedule would live outside the repository, and the endpoint would need its own credential.
- **A device's opt-in tied to its session:** sign-out and session revocation would end it for free. But sessions expire after 7 idle days, so a user who stops opening the app would stop getting reminders just when they need them. The opt-in belongs to the user, and sign-out, password reset and "Desconectar dos outros dispositivos" end it explicitly (PRD §8.2).
- **At-least-once delivery with retries:** a crash mid-run would send some users the same reminder twice. A missed day is the lesser harm.
- **A user-chosen time:** it would turn the job into a sweep every few minutes and add a preference. The calendar feed's alarm is fixed at 09:00 too.
- **An account-wide preference:** a push registration exists per browser, so a shared on/off would disagree with what each device can actually receive. Reminders are turned on per device and are not a preference (PRD §3.5).

## Consequences

- At-most-once: the job records each user's reminder for the day before sending it, and never retries. A transient failure of a push service loses that user's reminder for the day. A run missed while the API was down is caught up later the same day, never the next.
- Running in-process, every API replica and every preview deployment runs the job. The per-user daily record keeps replicas from sending twice. Previews hold only demo users, who have no devices.
- A browser that changes hands could show the previous user's reminders, because the opt-in outlives the session. A push endpoint therefore belongs to one user at a time, and signing in on a browser that holds someone else's endpoint removes it.
- The lock screen shows what the reminder says, so it names occurrences by description only: no amounts and no notes.
- The service worker is now hand-written (Workbox `injectManifest`) to handle `push` and `notificationclick`. It still caches only the shell ([ADR-0006](0006-app-shell-service-worker-no-offline-data.md)).
- Push endpoints are capability URLs: they are never logged or exported in telemetry, and never included in "Baixar meus dados".
