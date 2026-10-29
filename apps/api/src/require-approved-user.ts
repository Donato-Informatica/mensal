import { fromNodeHeaders } from "better-auth/node";
import type { RequestHandler } from "express";
import type { Auth } from "./auth.ts";
import { identifyRequest } from "./telemetry-context.ts";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      /** The verified, approved user making the request. Set by requireApprovedUser. */
      userId: string;
      /** The session the request came with. Set by requireApprovedUser. */
      sessionId: string;
    }
  }
}

/**
 * Lets through only signed-in users an administrator has approved, and puts
 * their id in `res.locals.userId` (and their session's in `sessionId`). Everyone else gets 401 or 403.
 */
export function requireApprovedUser(auth: Auth): RequestHandler {
  return async (req, res, next) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      res.status(401).json({ code: "UNAUTHENTICATED" });
      return;
    }
    if (!session.user.approved) {
      res.status(403).json({ code: "USER_NOT_APPROVED" });
      return;
    }
    res.locals.userId = session.user.id;
    res.locals.sessionId = session.session.id;
    identifyRequest(req, session.user.id);
    next();
  };
}
