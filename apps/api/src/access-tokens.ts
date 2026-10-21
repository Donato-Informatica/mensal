import { schema, type Database } from "@mensal/database";
import { NewAccessTokenSchema } from "@mensal/shared";
import { isAPIError } from "better-auth/api";
import { fromNodeHeaders } from "better-auth/node";
import { and, desc, eq } from "drizzle-orm";
import { Router } from "express";
import type { RecordActivity } from "./activity.ts";
import { passwordGuessLimit, type Auth } from "./auth.ts";
import { invalidInput } from "./invalid-input.ts";

const { apikeys } = schema;

const MAX_WRONG_PASSWORDS = passwordGuessLimit.max;
const WRONG_PASSWORD_WINDOW_MS = passwordGuessLimit.window * 1000;

/**
 * `/access-tokens`: the user's access tokens (PRD §8.9), cookie-only. Creating
 * one asks for the current password, so a stolen session alone cannot mint a
 * lasting credential; wrong ones are throttled per user like a password change
 * (PRD §8.6). The full token is returned only by the create.
 */
export function accessTokensRouter({
  auth,
  db,
  now,
  record,
}: {
  auth: Auth;
  db: Database;
  now: () => Date;
  record: RecordActivity;
}) {
  const router = Router();
  /** When each user last sent a wrong password (epoch ms). */
  const wrongPasswords = new Map<string, number[]>();

  /** The user's wrong passwords still inside the window. */
  function recentWrongPasswords(userId: string): number[] {
    const since = now().getTime() - WRONG_PASSWORD_WINDOW_MS;
    return (wrongPasswords.get(userId) ?? []).filter((at) => at > since);
  }

  /** True when the user has sent too many wrong passwords lately. */
  function isThrottled(userId: string): boolean {
    return recentWrongPasswords(userId).length >= MAX_WRONG_PASSWORDS;
  }

  function recordWrongPassword(userId: string): void {
    wrongPasswords.set(userId, [
      ...recentWrongPasswords(userId),
      now().getTime(),
    ]);
  }

  router.get("/", async (_req, res) => {
    const rows = await db
      .select()
      .from(apikeys)
      .where(eq(apikeys.referenceId, res.locals.userId))
      .orderBy(desc(apikeys.createdAt), desc(apikeys.id));
    res.json(rows.map(describe));
  });

  router.post("/", async (req, res) => {
    const parsed = NewAccessTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(invalidInput(parsed.error));
      return;
    }
    const { userId } = res.locals;
    if (isThrottled(userId)) {
      res.status(429).json({ code: "TOO_MANY_ATTEMPTS" });
      return;
    }
    try {
      await auth.api.verifyPassword({
        headers: fromNodeHeaders(req.headers),
        body: { password: parsed.data.currentPassword },
      });
    } catch (error) {
      if (isAPIError(error) && error.body?.code === "INVALID_PASSWORD") {
        recordWrongPassword(userId);
        res.status(400).json({ code: "INVALID_PASSWORD" });
        return;
      }
      throw error;
    }
    const created = await auth.api.createApiKey({
      body: { name: parsed.data.name, userId },
    });
    record({
      user: userId,
      action: "user.access-token-created",
      id: created.id,
    });
    res.status(201).json({ ...describe(created), token: created.key });
  });

  router.delete("/:id", async (req, res) => {
    const { userId } = res.locals;
    const [revoked] = await db
      .delete(apikeys)
      .where(
        and(eq(apikeys.id, req.params.id), eq(apikeys.referenceId, userId))
      )
      .returning({ id: apikeys.id });
    if (!revoked) {
      res.status(404).json({ code: "ACCESS_TOKEN_NOT_FOUND" });
      return;
    }
    record({
      user: userId,
      action: "user.access-token-revoked",
      id: revoked.id,
    });
    res.status(204).end();
  });

  return router;
}

/** A stored key as the API shows it: no secret, no plugin internals. */
function describe(key: {
  id: string;
  name: string | null;
  start: string | null;
  createdAt: Date;
  lastRequest: Date | null;
}) {
  return {
    id: key.id,
    name: key.name ?? "",
    prefix: key.start ?? "",
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastRequest?.toISOString() ?? null,
  };
}
