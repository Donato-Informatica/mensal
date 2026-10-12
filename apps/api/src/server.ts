import { createDatabase } from "@mensal/database";
import { createApp } from "./app.ts";
import { createAuth } from "./auth.ts";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

const db = createDatabase(required("DATABASE_URL"));
const auth = createAuth({
  db,
  baseURL: required("BETTER_AUTH_URL"),
  secret: required("BETTER_AUTH_SECRET"),
});
const port = Number(process.env.PORT ?? 3000);

const server = createApp({ auth, db }).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

// In the container Node is PID 1, which ignores SIGTERM unless it is handled.
process.on("SIGTERM", () => {
  server.close(() => void db.$client.end());
});
