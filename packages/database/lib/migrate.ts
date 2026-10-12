import { fileURLToPath } from "node:url";
import { migrate as runMigrations } from "drizzle-orm/node-postgres/migrator";
import type { Database } from "./connection.ts";

const migrationsFolder = fileURLToPath(
  new URL("../migrations", import.meta.url)
);

/**
 * Applies the drizzle-kit migrations not yet applied, tracked in the same
 * journal as `drizzle-kit migrate`. Migrations are only ever written by
 * `drizzle-kit generate`.
 */
export async function migrate(db: Database): Promise<void> {
  await runMigrations(db, { migrationsFolder });
}
