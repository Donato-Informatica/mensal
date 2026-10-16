import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { schema, type Database } from "@mensal/database";
import { ColorSchemeSchema } from "@mensal/shared";
import { betterAuth } from "better-auth";
import type { Log } from "./log.ts";

export interface AuthOptions {
  db: Database;
  /** Public origin the API is served from, e.g. `https://mensal.example`. */
  baseURL: string;
  secret: string;
  /** Where the password-reset links are written; the console by default. */
  log?: Log;
  /** Better-Auth's per-IP rate limiter on `/api/auth`; on by default. */
  rateLimit?: boolean;
}

/**
 * Better-Auth on the app's own `db`: email + password, sessions in HttpOnly
 * SameSite=Lax cookies, and password-reset links written to the log for the
 * administrator to forward by hand (PRD §8.2). The anonymous endpoints are
 * rate limited per client IP, read from the proxy's `X-Forwarded-For`
 * (PRD §8.6).
 */
export function createAuth({
  db,
  baseURL,
  secret,
  log = console.log,
  rateLimit = true,
}: AuthOptions) {
  return betterAuth({
    baseURL,
    secret,
    database: drizzleAdapter(db, { provider: "pg", usePlural: true, schema }),
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url }) => {
        log(`Password reset link for ${user.email}: ${url}`);
      },
    },
    rateLimit: {
      // Better-Auth's default is production only.
      enabled: rateLimit,
      storage: "memory",
      // Per IP; every other path keeps Better-Auth's own rules.
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 3600, max: 3 },
        "/request-password-reset": { window: 3600, max: 3 },
      },
    },
    user: {
      additionalFields: {
        // Set to true by an administrator, directly in the database (PRD §3.4).
        approved: {
          type: "boolean",
          required: true,
          defaultValue: false,
          input: false,
        },
        // Preferences (PRD §3.5, ADR-0002): the user's own choice, so `input`
        // lets update-user (and sign-up) set them. Each must stay safe to
        // choose freely.
        showSummary: {
          type: "boolean",
          required: true,
          defaultValue: true,
          input: true,
        },
        confirmStatusChanges: {
          type: "boolean",
          required: true,
          defaultValue: true,
          input: true,
        },
        // "dark", "light" or "auto"; anything else is rejected.
        colorScheme: {
          type: "string",
          required: true,
          defaultValue: "dark",
          input: true,
          validator: { input: ColorSchemeSchema },
        },
      },
    },
    advanced: {
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      // Without `trustedProxies` Better-Auth accepts only a single-value
      // X-Forwarded-For: a chain or a missing header puts every client in one
      // shared bucket, so the proxy must overwrite the header (ticket 02).
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
