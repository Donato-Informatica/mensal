import { isAPIError } from "better-auth/api";
import { fromNodeHeaders } from "better-auth/node";
import type { IncomingHttpHeaders } from "node:http";
import { passwordGuessLimit, type Auth } from "./auth.ts";
import { Refusal } from "./refusal.ts";
import { slidingWindow } from "./sliding-window.ts";

const MAX_WRONG_PASSWORDS = passwordGuessLimit.max;
const WRONG_PASSWORD_WINDOW_MS = passwordGuessLimit.window * 1000;

/**
 * Proves the signed-in user knows their current password before a route mints
 * a lasting credential, so a stolen session alone cannot (PRD §8.6). Resolves
 * when it is right; throws a {@link Refusal}: `400 INVALID_PASSWORD` when it is
 * wrong, `429 TOO_MANY_ATTEMPTS` after too many wrong ones lately, per user,
 * like a password change.
 */
export type ConfirmPassword = (attempt: {
  userId: string;
  /** The request's headers, carrying the session the password is for. */
  headers: IncomingHttpHeaders;
  password: string;
}) => Promise<void>;

/**
 * One {@link ConfirmPassword} with its own record of wrong passwords; every
 * route that shares it shares the throttle.
 */
export function passwordConfirmation({
  auth,
  now,
}: {
  auth: Auth;
  now: () => Date;
}): ConfirmPassword {
  /** Each user's recent wrong passwords. */
  const wrongPasswords = slidingWindow({
    max: MAX_WRONG_PASSWORDS,
    windowMs: WRONG_PASSWORD_WINDOW_MS,
    now,
  });

  return async ({ userId, headers, password }) => {
    if (wrongPasswords.isFull(userId)) {
      throw new Refusal(429, "TOO_MANY_ATTEMPTS");
    }
    try {
      await auth.api.verifyPassword({
        headers: fromNodeHeaders(headers),
        body: { password },
      });
    } catch (error) {
      if (isAPIError(error) && error.body?.code === "INVALID_PASSWORD") {
        wrongPasswords.add(userId);
        throw new Refusal(400, "INVALID_PASSWORD");
      }
      throw error;
    }
  };
}
