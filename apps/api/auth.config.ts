// Read only by the Better-Auth CLI (`npm run -w @mensal/api auth:generate`) to
// generate the Drizzle schema in @mensal/database. The server builds its own
// instance with createAuth; this one never connects.
import { createDatabase } from "@mensal/database";
import { createAuth } from "./src/auth.ts";

export const auth = createAuth({
  db: createDatabase("postgres://unused"),
  baseURL: "http://localhost",
  secret: "better-auth-cli-schema-generation-only",
});
