import type { Database } from "@mensal/database";
import { toNodeHandler } from "better-auth/node";
import express from "express";
import helmet from "helmet";
import {
  activityRecorder,
  consoleActivity,
  type Activity,
} from "./activity.ts";
import { accessTokensRouter } from "./access-tokens.ts";
import type { Auth } from "./auth.ts";
import { calendarIcsRouter } from "./calendar-ics.ts";
import { calendarLinkRouter } from "./calendar-link.ts";
import { dataRouter } from "./data.ts";
import { docsRouter } from "./docs.ts";
import { errorHandler } from "./error-handler.ts";
import { healthRouter } from "./health.ts";
import { exportedLog, type Log } from "./log.ts";
import { mcpRouter } from "./mcp.ts";
import { occurrencesRouter } from "./occurrences.ts";
import { passwordConfirmation } from "./password-confirmation.ts";
import { periodsRouter } from "./periods.ts";
import { recurrencesRouter } from "./recurrences.ts";
import type { Reminders } from "./reminder-operations.ts";
import { remindersRouter } from "./reminders.ts";
import { summariesRouter } from "./summaries.ts";
import { requireApprovedUser } from "./require-approved-user.ts";

export interface AppOptions {
  auth: Auth;
  db: Database;
  /** The clock "today" is read from. */
  now?: () => Date;
  /** Where unexpected errors are written; the console by default. */
  log?: Log;
  /** Where the activity log goes (PRD §8.7); the console by default. */
  activity?: Activity;
  /**
   * The VAPID public key and the `push` sink reminders go through (PRD §6.8);
   * off when omitted. The server signs with its VAPID keys, tests capture.
   */
  reminders?: Reminders;
}

export function createApp({
  auth,
  db,
  now = () => new Date(),
  log = exportedLog((message) => console.error(message)),
  activity = consoleActivity,
  reminders,
}: AppOptions) {
  const record = activityRecorder(activity, now, log);
  const app = express();

  // Security headers on every response, and no X-Powered-By (PRD §8.6).
  app.use(helmet());

  // Better-Auth reads the raw body, so it goes before any body parser.
  app.all("/api/auth/*splat", toNodeHandler(auth));

  // Unauthenticated, for the deployment healthcheck (PRD §8.4).
  app.use("/api/health", healthRouter({ db, log }));

  // Unauthenticated: the API description and its reference UI.
  app.use("/api", docsRouter({ auth }));

  // Authenticated by access token, not by session (PRD §8.9, ADR-0004).
  app.use(
    "/api/mcp",
    mcpRouter({
      auth,
      db,
      now,
      log,
      record: activityRecorder(activity, now, log, { via: "mcp" }),
    })
  );

  // Authenticated by the calendar link's key alone (PRD §6.7, ADR-0008).
  app.use("/api/calendar.ics", calendarIcsRouter({ auth, db, now }));

  const v1 = express.Router();
  v1.use(requireApprovedUser(auth));
  v1.use(express.json());
  v1.get("/me", (_req, res) => {
    res.json({ userId: res.locals.userId });
  });
  // One throttle for every route that mints a lasting credential.
  const confirmPassword = passwordConfirmation({ auth, now });
  v1.use(
    "/access-tokens",
    accessTokensRouter({ auth, confirmPassword, db, record })
  );
  v1.use(
    "/calendar-link",
    calendarLinkRouter({ auth, confirmPassword, db, record })
  );
  v1.use("/data", dataRouter({ db, now, log }));
  v1.use("/occurrences", occurrencesRouter({ db, now, record }));
  v1.use("/periods", periodsRouter({ db, now, record }));
  v1.use("/recurrences", recurrencesRouter({ db, now, record }));
  v1.use("/reminders", remindersRouter({ db, reminders, record, log }));
  v1.use("/summaries", summariesRouter({ db, now, record }));
  app.use("/api/v1", v1);

  app.use(errorHandler(log));

  return app;
}
