import { createDatabase } from "@mensal/database";
import { consoleActivity } from "./activity.ts";
import { createApp } from "./app.ts";
import { createAuth } from "./auth.ts";
import { readConfig } from "./config.ts";
import { consoleEmail, resendEmail } from "./email.ts";
import { exportedLog } from "./log.ts";

const { databaseURL, baseURL, secret, port, email } = readConfig(process.env);
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

const server = createApp({ auth, db, activity }).listen(port, () => {
  const info = exportedLog((message) => console.log(message), "INFO");
  info(`API listening on http://localhost:${port}`);
  info(
    email
      ? `Email: Resend, from ${email.from}`
      : "Email: console (no RESEND_API_KEY)"
  );
});

// In the container Node is PID 1, which ignores SIGTERM unless it is handled.
process.on("SIGTERM", () => {
  server.close(() => void db.$client.end());
});
