import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { schema, type Database } from "@mensal/database";
import { betterAuth } from "better-auth";

export interface AuthOptions {
  db: Database;
  /** Public origin the API is served from, e.g. `https://mensal.example`. */
  baseURL: string;
  secret: string;
}

/** Better-Auth on the app's own `db`: email + password, sessions in HttpOnly SameSite=Lax cookies. */
export function createAuth({ db, baseURL, secret }: AuthOptions) {
  return betterAuth({
    baseURL,
    secret,
    database: drizzleAdapter(db, { provider: "pg", usePlural: true, schema }),
    emailAndPassword: { enabled: true },
    user: {
      additionalFields: {
        // Set to true by an administrator, directly in the database (PRD §3.4).
        approved: {
          type: "boolean",
          required: true,
          defaultValue: false,
          input: false,
        },
      },
    },
    advanced: {
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
