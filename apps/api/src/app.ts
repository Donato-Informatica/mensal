import { toNodeHandler } from "better-auth/node";
import express from "express";
import type { Auth } from "./auth.ts";
import { requireApprovedUser } from "./require-approved-user.ts";

export function createApp({ auth }: { auth: Auth }) {
  const app = express();

  // Better-Auth reads the raw body, so it goes before any body parser.
  app.all("/api/auth/*splat", toNodeHandler(auth));

  const v1 = express.Router();
  v1.use(requireApprovedUser(auth));
  v1.use(express.json());
  v1.get("/me", (_req, res) => {
    res.json({ userId: res.locals.userId });
  });
  app.use("/api/v1", v1);

  return app;
}
