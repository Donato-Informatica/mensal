import { apiKey } from "@better-auth/api-key";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { schema, type Database } from "@mensal/database";
import {
  ColorSchemeSchema,
  defaultColorScheme,
  defaultOccurrenceView,
  MAX_NAME_LENGTH,
  NameSchema,
  OccurrenceViewSchema,
} from "@mensal/shared";
import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getIP,
  isAPIError,
} from "better-auth/api";
import { openAPI } from "better-auth/plugins";
import {
  activityRecorder,
  consoleActivity,
  type Activity,
  type PasswordAction,
  type Revocable,
  type RecordActivity,
  type SessionAction,
} from "./activity.ts";
import { consoleEmail, type Email, type SendEmail } from "./email.ts";
import {
  accountDeletedEmail,
  passwordChangedEmail,
  resetPasswordEmail,
} from "./emails.ts";
import { exportedLog, type Log } from "./log.ts";

/** What every access token starts with, so a leaked one is recognizable. */
export const accessTokenPrefix = "mensal_";

/**
 * How often a current password may be tried (it could be guessed with a stolen
 * session): `max` per `window` seconds. Better-Auth enforces it per IP on
 * `/change-password` and `/delete-user`; `/access-tokens` applies it per user.
 */
export const passwordGuessLimit = { window: 60, max: 5 };

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
 * ADR-0003); a reset signs the user out everywhere and revokes every access
 * token and the calendar link, while a password change revokes what the user
 * chose (PRD §8.2). The anonymous endpoints are
 * rate limited per client IP, read from the proxy's `X-Forwarded-For`
 * (PRD §8.6). The user's name is trimmed and checked (PRD §8.2). A user can
 * delete their own account at once with the current password, and is emailed
 * afterwards (ADR-0005). Sign-ups, sign-ins, failed sign-ins, name changes and
 * deletions go to the activity log (PRD §8.7).
 */
export function createAuth({
  db,
  baseURL,
  secret,
  log: customLog,
  email = consoleEmail(customLog ?? console.log),
  rateLimit = true,
  now = () => new Date(),
  activity = consoleActivity,
}: AuthOptions) {
  // The email text holds reset links: `consoleEmail` above writes to stdout
  // only, never through the exporting log.
  const log = customLog ?? exportedLog((message) => console.log(message));
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
  /**
   * Logs and alerts a password replaced by a change or a reset, with what that
   * revoked (PRD §8.2).
   */
  function passwordReplaced(
    user: { id: string; email: string; name: string },
    action: PasswordAction,
    revoked: Revocable[]
  ) {
    if (action === "user.password-changed") {
      record({ user: user.id, action, revoked });
    } else {
      record({ user: user.id, action });
    }
    sendInBackground(
      passwordChangedEmail({
        to: user.email,
        name: user.name,
        at: now(),
        forgotPasswordURL: `${baseURL}/esqueci-a-senha`,
        revoked,
        reset: action === "user.password-reset",
      })
    );
  }
  async function revokeAccessTokens(userId: string) {
    await db
      .delete(schema.apikeys)
      .where(eq(schema.apikeys.referenceId, userId));
  }
  /**
   * Deactivates the user's calendar link (PRD §6.6). The password event's
   * `revoked` reports it, so it logs no `user.calendar-link-revoked` of its
   * own, as revoked access tokens log none.
   */
  async function revokeCalendarLink(userId: string) {
    await db
      .delete(schema.calendarLinks)
      .where(eq(schema.calendarLinks.userId, userId));
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
        await revokeAccessTokens(user.id);
        await revokeCalendarLink(user.id);
        passwordReplaced(user, "user.password-reset", [
          "sessions",
          "access-tokens",
          "calendar-link",
        ]);
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
        "/change-password": passwordGuessLimit,
        "/delete-user": passwordGuessLimit,
      },
    },
    user: {
      // Immediate and permanent, proven with the current password (PRD §8.2,
      // ADR-0005); no email-link verification.
      deleteUser: {
        enabled: true,
        // The foreign keys cascade everything else (PRD §5.13), but `apikeys`
        // names its user only by `reference_id`.
        beforeDelete: async (user) => {
          await revokeAccessTokens(user.id);
        },
        // Once the deletion has committed; a failed goodbye undoes nothing.
        afterDelete: async (user) => {
          record({ user: user.id, action: "user.deleted" });
          sendInBackground(
            accountDeletedEmail({ to: user.email, name: user.name, at: now() })
          );
        },
      },
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
      // Deletion is confirmed by the password, never by an emailed link
      // (ADR-0005).
      "/delete-user/callback",
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
      // The name, trimmed, must be NameSchema's (PRD §8.2): at sign-up, and on
      // an update-user that changes it.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/delete-user") {
          // Without one, Better-Auth settles for a fresh session (ADR-0005).
          const { password } = (ctx.body ?? {}) as { password?: unknown };
          if (typeof password !== "string" || password === "") {
            throw new APIError("BAD_REQUEST", {
              code: "INVALID_PASSWORD",
              message: "Invalid password",
            });
          }
          return;
        }
        const body = ctx.body as { name?: unknown } | undefined;
        if (
          ctx.path !== "/sign-up/email" &&
          !(ctx.path === "/update-user" && body?.name !== undefined)
        ) {
          return;
        }
        const name = NameSchema.safeParse(body?.name);
        if (!name.success) {
          throw new APIError("BAD_REQUEST", {
            code: "INVALID_NAME",
            message: `Name must be 1 to ${MAX_NAME_LENGTH} characters`,
          });
        }
        return { context: { ...ctx, body: { ...body, name: name.data } } };
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/update-user") {
          if (isAPIError(ctx.context.returned)) return;
          const { name } = ctx.body as { name?: string };
          // The session as it was before the change.
          const user = ctx.context.session?.user;
          if (user && name !== undefined && name !== user.name) {
            record({ user: user.id, action: "user.name-changed" });
          }
          return;
        }
        if (ctx.path === "/change-password") {
          if (isAPIError(ctx.context.returned)) return;
          // Revoking the other sessions starts a new one for this device.
          const user = (ctx.context.newSession ?? ctx.context.session)?.user;
          if (!user) return;
          const body = ctx.body as {
            revokeOtherSessions?: boolean;
            revokeAccessTokens?: boolean;
          };
          const revoked: Revocable[] = [];
          if (body.revokeOtherSessions === true) revoked.push("sessions");
          // One box revokes every lasting credential (PRD §8.2).
          if (body.revokeAccessTokens === true) {
            await revokeAccessTokens(user.id);
            await revokeCalendarLink(user.id);
            revoked.push("access-tokens", "calendar-link");
          }
          passwordReplaced(user, "user.password-changed", revoked);
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
 * set a session cookie (a session refresh, update-user) log nothing, but for
 * an update-user that changes the name.
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
