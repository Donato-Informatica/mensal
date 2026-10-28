import { isAPIError } from "better-auth/api";
import { fromNodeHeaders } from "better-auth/node";
import type { IncomingHttpHeaders } from "node:http";
import { passwordGuessLimit, type Auth } from "./auth.ts";
import { Refusal } from "./refusal.ts";

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
  /** When each user last sent a wrong password (epoch ms). */
  const wrongPasswords = new Map<string, number[]>();

  /** The user's wrong passwords still inside the window. */
  function recentWrongPasswords(userId: string): number[] {
    const since = now().getTime() - WRONG_PASSWORD_WINDOW_MS;
    return (wrongPasswords.get(userId) ?? []).filter((at) => at > since);
  }

  return async ({ userId, headers, password }) => {
    if (recentWrongPasswords(userId).length >= MAX_WRONG_PASSWORDS) {
      throw new Refusal(429, "TOO_MANY_ATTEMPTS");
    }
    try {
      await auth.api.verifyPassword({
        headers: fromNodeHeaders(headers),
        body: { password },
      });
    } catch (error) {
      if (isAPIError(error) && error.body?.code === "INVALID_PASSWORD") {
        wrongPasswords.set(userId, [
          ...recentWrongPasswords(userId),
          now().getTime(),
        ]);
        throw new Refusal(400, "INVALID_PASSWORD");
      }
      throw error;
    }
  };
}
