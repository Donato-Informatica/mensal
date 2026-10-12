/** A database of its own, so integration tests never touch development data. */
export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgres://mensal:mensal@localhost:5432/mensal_test";
