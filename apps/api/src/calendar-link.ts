import type { Database } from "@mensal/database";
import { NewCalendarLinkSchema } from "@mensal/shared";
import { Router } from "express";
import type { RecordActivity } from "./activity.ts";
import { answer } from "./answer.ts";
import type { Auth } from "./auth.ts";
import {
  generateCalendarLink,
  readCalendarLink,
  revokeCalendarLink,
} from "./calendar-link-operations.ts";
import { invalidInput } from "./invalid-input.ts";
import type { ConfirmPassword } from "./password-confirmation.ts";

/**
 * `/calendar-link`: the user's calendar link (PRD §6.6), cookie-only, with no
 * MCP tool. Generating one asks for the current password (`confirmPassword`,
 * throttled per user), so a stolen session alone cannot mint a lasting
 * address. The URL is built on the app's public origin, Better-Auth's
 * `baseURL`.
 */
export function calendarLinkRouter({
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
  const context = (userId: string) => ({
    db,
    userId,
    origin: publicOrigin(auth),
    record,
  });

  router.get("/", async (_req, res) => {
    res.json(await readCalendarLink(context(res.locals.userId)));
  });

  router.post("/", async (req, res) => {
    const parsed = NewCalendarLinkSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(invalidInput(parsed.error));
      return;
    }
    const { userId } = res.locals;
    return answer(res, 201, async () => {
      await confirmPassword({
        userId,
        headers: req.headers,
        password: parsed.data.password,
      });
      return generateCalendarLink(context(userId));
    });
  });

  router.delete("/", async (_req, res) => {
    await revokeCalendarLink(context(res.locals.userId));
    res.status(204).end();
  });

  return router;
}

/** The origin the app is served from, as Better-Auth was configured with. */
export function publicOrigin(auth: Auth): string {
  const { baseURL } = auth.options;
  if (typeof baseURL !== "string") throw new Error("No public origin");
  return baseURL;
}
