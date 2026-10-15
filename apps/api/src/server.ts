import { createDatabase } from "@mensal/database";
import { createApp } from "./app.ts";
import { createAuth } from "./auth.ts";
import { readConfig } from "./config.ts";

const { databaseUrl, baseURL, secret, port } = readConfig(process.env);
const db = createDatabase(databaseUrl);
const auth = createAuth({ db, baseURL, secret });

const server = createApp({ auth, db }).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

// In the container Node is PID 1, which ignores SIGTERM unless it is handled.
process.on("SIGTERM", () => {
  server.close(() => void db.$client.end());
});
