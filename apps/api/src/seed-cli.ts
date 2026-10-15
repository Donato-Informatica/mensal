import { createDatabase } from "@mensal/database";
import { createAuth } from "./auth.ts";
import { assertLocalDatabase, demoUser, seed } from "./seed.ts";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://mensal:mensal@localhost:5432/mensal";
assertLocalDatabase(databaseUrl);

const db = createDatabase(databaseUrl);
const auth = createAuth({
  db,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:5173",
  secret:
    process.env.BETTER_AUTH_SECRET ?? "local-seed-secret-0123456789abcdef-xx",
});

try {
  await seed(db, auth);
  console.log(`Seeded. Sign in as ${demoUser.email} / ${demoUser.password}`);
} finally {
  await db.$client.end();
}
