import { createDatabase } from "@mensal/database";
import { createAuth } from "./auth.ts";
import {
  assertLocalDatabase,
  assertNoRealUsers,
  demoUser,
  seed,
} from "./seed.ts";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://mensal:mensal@localhost:5432/mensal";
// SEED_DEMO_DATA=true is set only for Coolify preview deployments, whose
// database is not local; it swaps the local-host check for a no-real-users one.
const previewSeed = process.env.SEED_DEMO_DATA === "true";
if (!previewSeed) assertLocalDatabase(databaseUrl);

const db = createDatabase(databaseUrl);
const auth = createAuth({
  db,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:5173",
  secret:
    process.env.BETTER_AUTH_SECRET ?? "local-seed-secret-0123456789abcdef-xx",
});

try {
  if (previewSeed) await assertNoRealUsers(db);
  await seed(db, auth);
  console.log(`Seeded. Sign in as ${demoUser.email} / ${demoUser.password}`);
} finally {
  await db.$client.end();
}
