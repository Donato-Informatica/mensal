import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema/index.ts";

/**
 * The one Drizzle connection shared by the app and Better-Auth.
 * Columns are camelCase in TypeScript and snake_case in Postgres.
 * Call `db.$client.end()` to close the pool.
 */
export function createDatabase(connectionString: string) {
  return drizzle(connectionString, { schema, casing: "snake_case" });
}

export type Database = ReturnType<typeof createDatabase>;
