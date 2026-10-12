import { createDatabase, migrate } from "@mensal/database";
import { testDatabaseUrl } from "./database.ts";

/** Creates the test database if needed, migrates it and starts from no users. */
export default async function setup() {
  const url = new URL(testDatabaseUrl);
  const name = url.pathname.slice(1);
  const maintenanceDb = createDatabase(new URL("/postgres", url).href);
  try {
    const { rowCount } = await maintenanceDb.$client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [name]
    );
    if (rowCount === 0)
      await maintenanceDb.$client.query(`CREATE DATABASE "${name}"`);
  } catch (error) {
    throw new Error(
      `Cannot reach Postgres at ${url.host}. Start it with \`docker compose up -d\`.`,
      { cause: error }
    );
  } finally {
    await maintenanceDb.$client.end();
  }

  const db = createDatabase(testDatabaseUrl);
  try {
    await migrate(db);
    await db.$client.query("TRUNCATE users CASCADE");
  } finally {
    await db.$client.end();
  }
}
