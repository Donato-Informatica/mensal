import { apiKey } from "@better-auth/api-key";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { schema, type Database } from "@mensal/database";
import {
  ColorSchemeSchema,
  defaultColorScheme,
  defaultOccurrenceView,
  OccurrenceViewSchema,
} from "@mensal/shared";
import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { createAuthMiddleware, getIP, isAPIError } from "better-auth/api";
import { openAPI } from "better-auth/plugins";
import {
  activityRecorder,
  consoleActivity,
  type Activity,
  type PasswordAction,
  type RecordActivity,
  type SessionAction,
} from "./activity.ts";
import { consoleEmail, type Email, type SendEmail } from "./email.ts";
import { passwordChangedEmail, resetPasswordEmail } from "./emails.ts";
import type { Log } from "./log.ts";

/** What every access token starts with, so a leaked one is recognizable. */
export const accessTokenPrefix = "mensal_";

export interface AuthOptions {
  db: Database;
  /** Public origin the API is served from, e.g. `https://mensal.example`. */
  baseURL: string;
  secret: string;
  /**
   * Where failures to send an email or to record activity are written; the
   * console by default.
   */
  log?: Log;
  /** Where emails go (ADR-0003); written to `log` by default. */
  email?: SendEmail;
  /** Better-Auth's per-IP rate limiter on `/api/auth`; on by default. */
  rateLimit?: boolean;
  /** The clock that stamps activity events; the system clock by default. */
  now?: () => Date;
  /** Where sign-ups and sign-ins are logged (PRD §8.7); the console by default. */
  activity?: Activity;
}

/**
 * Better-Auth on the app's own `db`: email + password, sessions in HttpOnly
 * SameSite=Lax cookies, and password-reset links sent by `email` (PRD §8.2,
 * ADR-0003); a reset signs the user out everywhere. The anonymous endpoints are
 * rate limited per client IP, read from the proxy's `X-Forwarded-For`
 * (PRD §8.6). Sign-ups, sign-ins and failed sign-ins go to the activity log
 * (PRD §8.7).
 */
export function createAuth({
  db,
  baseURL,
  secret,
  log = console.log,
  email = consoleEmail(log),
  rateLimit = true,
  now = () => new Date(),
  activity = consoleActivity,
}: AuthOptions) {
  const record: RecordActivity = activityRecorder(activity, now, log);
  /**
   * Sends without waiting, so an answer neither slows down nor fails for an
   * email that exists. A failure is logged without the email's content, which
   * may hold a reset link.
   */
  function sendInBackground(message: Email) {
    email(message).catch((error: unknown) => {
      log(
        `Email "${message.subject}" to ${message.to} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    });
  }
  /** Logs and alerts a password replaced by a change or a reset (PRD §8.2). */
  function passwordReplaced(
    user: { id: string; email: string; name: string },
    action: PasswordAction
  ) {
    record({ user: user.id, action });
    sendInBackground(
      passwordChangedEmail({
        to: user.email,
        name: user.name,
        at: now(),
        forgotPasswordURL: `${baseURL}/esqueci-a-senha`,
      })
    );
  }
  return betterAuth({
    baseURL,
    secret,
    database: drizzleAdapter(db, { provider: "pg", usePlural: true, schema }),
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url }) => {
        sendInBackground(
          resetPasswordEmail({ to: user.email, name: user.name, url })
        );
      },
      onPasswordReset: async ({ user }) => {
        // How a user takes a stolen account back (PRD §8.9).
        await db
          .delete(schema.apikeys)
          .where(eq(schema.apikeys.referenceId, user.id));
        passwordReplaced(user, "user.password-reset");
      },
      revokeSessionsOnPasswordReset: true,
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
        // It checks the current password, so a stolen session could guess it.
        "/change-password": { window: 60, max: 5 },
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
          defaultValue: defaultColorScheme,
          input: true,
          validator: { input: ColorSchemeSchema },
        },
        // "list" or "table"; anything else is rejected.
        occurrenceView: {
          type: "string",
          required: true,
          defaultValue: defaultOccurrenceView,
          input: true,
          validator: { input: OccurrenceViewSchema },
        },
      },
    },
    // Describes the sign-in routes for /api/openapi.json; its own reference
    // page loads scripts from a CDN, so it is off.
    plugins: [
      openAPI({ disableDefaultReference: true }),
      // Access tokens (PRD §8.9, ADR-0004), hashed in the `apikeys` table.
      // `enableSessionForAPIKeys` stays off: a token never becomes a session.
      apiKey({
        defaultPrefix: accessTokenPrefix,
        // Prefix plus four characters, to tell tokens apart in the list.
        startingCharactersConfig: {
          shouldStore: true,
          charactersLength: accessTokenPrefix.length + 4,
        },
        maximumNameLength: 32,
        requireName: true,
        enableSessionForAPIKeys: false,
        rateLimit: {
          enabled: true,
          timeWindow: 60_000,
          maxRequests: 120,
        },
      }),
    ],
    // The plugin's own HTTP routes would let a session mint a token without
    // the password the app's `/access-tokens` routes ask for; they stay
    // reachable only through `auth.api`.
    disabledPaths: [
      "/api-key/create",
      "/api-key/get",
      "/api-key/update",
      "/api-key/delete",
      "/api-key/list",
      "/api-key/delete-all-expired-api-keys",
    ],
    advanced: {
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      // Own cookie name: another app on a sibling subdomain can set a
      // `better-auth.*` cookie for the shared parent domain, and the browser
      // sends that one first, so the session reads as signed out.
      cookiePrefix: "mensal",
      // Without `trustedProxies` Better-Auth accepts only a single-value
      // X-Forwarded-For: a chain or a missing header puts every client in one
      // shared bucket, so the proxy must overwrite the header (ticket 02).
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    },
    hooks: {
      // A password change always signs the user's other devices out, whatever
      // the client asks (PRD §8.2).
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/change-password") return;
        return {
          context: { body: { ...ctx.body, revokeOtherSessions: true } },
        };
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/change-password") {
          // Forced to revoke the other sessions, it always starts a new one.
          const user = ctx.context.newSession?.user;
          if (user && !isAPIError(ctx.context.returned))
            passwordReplaced(user, "user.password-changed");
          return;
        }
        const action = sessionActions[ctx.path];
        if (!action) return;
        const user = ctx.context.newSession?.user.id;
        if (user) {
          record({ user, action });
        } else if (isInvalidCredentials(ctx.context.returned)) {
          // Only sign-in answers so, and only to a valid email.
          record({
            action: "user.sign-in-failed",
            email: (ctx.body as { email: string }).email,
            // The client as the rate limiter tells it (PRD §8.6).
            ip: ctx.headers ? getIP(ctx.headers, ctx.context.options) : null,
          });
        }
      }),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

/**
 * The endpoints whose new session the activity log reports. Others that also
 * set a session cookie (a session refresh, update-user) log nothing.
 */
const sessionActions: Record<string, SessionAction | undefined> = {
  "/sign-up/email": "user.sign-up",
  "/sign-in/email": "user.sign-in",
};

/** Better-Auth's answer to a wrong email or password, and nothing else. */
function isInvalidCredentials(returned: unknown) {
  return (
    isAPIError(returned) && returned.body?.code === "INVALID_EMAIL_OR_PASSWORD"
  );
}
