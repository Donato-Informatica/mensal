import { createDatabase } from "@mensal/database";
import { consoleActivity } from "./activity.ts";
import { createApp } from "./app.ts";
import { createAuth } from "./auth.ts";
import { readConfig } from "./config.ts";
import { consoleEmail, resendEmail } from "./email.ts";
import { exportedLog } from "./log.ts";
import { webPushSender } from "./push.ts";
import { startReminderJob } from "./reminder-job.ts";

const { databaseURL, baseURL, secret, port, email, vapid } = readConfig(
  process.env
);
const db = createDatabase(databaseURL);
// One activity log (PRD §8.7) for the app's writes and Better-Auth's sign-ins.
const activity = consoleActivity;
const auth = createAuth({
  db,
  baseURL,
  secret,
  activity,
  email: email ? resendEmail(email) : consoleEmail(console.log),
});

const reminders = vapid && {
  publicKey: vapid.publicKey,
  push: webPushSender(vapid),
};
const info = exportedLog((message) => console.log(message), "INFO");
const log = exportedLog((message) => console.error(message));

const server = createApp({
  auth,
  db,
  activity,
  ...(reminders && { reminders }),
}).listen(port, () => {
  info(`API listening on http://localhost:${port}`);
  info(
    email
      ? `Email: Resend, from ${email.from}`
      : "Email: console (no RESEND_API_KEY)"
  );
  info(
    vapid
      ? "Reminders: Web Push, signed with the VAPID keys"
      : "Reminders: off (no VAPID_PUBLIC_KEY)"
  );
});

// The daily reminders (PRD §6.8); without the VAPID keys there is none.
const stopReminders = reminders
  ? startReminderJob({ db, reminders, now: () => new Date(), log, info })
  : () => {};

// In the container Node is PID 1, which ignores SIGTERM unless it is handled.
process.on("SIGTERM", () => {
  stopReminders();
  server.close(() => void db.$client.end());
});
