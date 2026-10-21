import type { Database } from "@mensal/database";
import { toNodeHandler } from "better-auth/node";
import express from "express";
import helmet from "helmet";
import {
  activityRecorder,
  consoleActivity,
  type Activity,
} from "./activity.ts";
import type { Auth } from "./auth.ts";
import { docsRouter } from "./docs.ts";
import { errorHandler } from "./error-handler.ts";
import { healthRouter } from "./health.ts";
import type { Log } from "./log.ts";
import { occurrencesRouter } from "./occurrences.ts";
import { periodsRouter } from "./periods.ts";
import { recurrencesRouter } from "./recurrences.ts";
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
}

export function createApp({
  auth,
  db,
  now = () => new Date(),
  log = console.error,
  activity = consoleActivity,
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

  const v1 = express.Router();
  v1.use(requireApprovedUser(auth));
  v1.use(express.json());
  v1.get("/me", (_req, res) => {
    res.json({ userId: res.locals.userId });
  });
  v1.use("/occurrences", occurrencesRouter({ db, now, record }));
  v1.use("/periods", periodsRouter({ db, now, record }));
  v1.use("/recurrences", recurrencesRouter({ db, now, record }));
  v1.use("/summaries", summariesRouter({ db, now, record }));
  app.use("/api/v1", v1);

  app.use(errorHandler(log));

  return app;
}
