import { schema, type Database } from "@mensal/database";
import { NewAccessTokenSchema } from "@mensal/shared";
import { and, desc, eq } from "drizzle-orm";
import { Router } from "express";
import type { RecordActivity } from "./activity.ts";
import { answer } from "./answer.ts";
import type { Auth } from "./auth.ts";
import { invalidInput } from "./invalid-input.ts";
import type { ConfirmPassword } from "./password-confirmation.ts";

const { apikeys } = schema;

/**
 * `/access-tokens`: the user's access tokens (PRD §8.9), cookie-only. Creating
 * one asks for the current password (`confirmPassword`, throttled per user),
 * so a stolen session alone cannot mint a lasting credential (PRD §8.6). The
 * full token is returned only by the create.
 */
export function accessTokensRouter({
  auth,
  confirmPassword,
  db,
  record,
}: {
  auth: Auth;
  confirmPassword: ConfirmPassword;
  db: Database;
  record: RecordActivity;
}) {
  const router = Router();

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
    return answer(res, 201, async () => {
      await confirmPassword({
        userId,
        headers: req.headers,
        password: parsed.data.currentPassword,
      });
      const created = await auth.api.createApiKey({
        body: { name: parsed.data.name, userId },
      });
      record({
        user: userId,
        action: "user.access-token-created",
        id: created.id,
      });
      return { ...describe(created), token: created.key };
    });
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
