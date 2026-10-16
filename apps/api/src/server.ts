import { createDatabase } from "@mensal/database";
import { consoleActivity } from "./activity.ts";
import { createApp } from "./app.ts";
import { createAuth } from "./auth.ts";
import { readConfig } from "./config.ts";

const { databaseURL, baseURL, secret, port } = readConfig(process.env);
const db = createDatabase(databaseURL);
// One activity log (PRD §8.7) for the app's writes and Better-Auth's sign-ins.
const activity = consoleActivity;
const auth = createAuth({ db, baseURL, secret, activity });

const server = createApp({ auth, db, activity }).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

// In the container Node is PID 1, which ignores SIGTERM unless it is handled.
process.on("SIGTERM", () => {
  server.close(() => void db.$client.end());
});
