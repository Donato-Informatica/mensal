# 13: Password reset via logged link

**What to build:** a user who forgot their password requests a reset; the reset URL is written to the server log, the administrator forwards it manually, and the user sets a new password through it. No email is sent. Source: `docs/prd.md` §1.3, §8.2.

**Blocked by:** 04

**Status:** ready-for-agent

- [x] Better-Auth `sendResetPassword` writes the reset URL to the server log
- [x] "Esqueci a senha" screen requesting the reset, and a reset-password screen opened from the link
- [x] Integration test: requesting a reset logs a usable URL, and the token sets a new password that signs in

## Comments

- `createAuth` takes an optional `log` (default `console.log`); `sendResetPassword` writes `Password reset link for <email>: <url>` through it. Nothing is logged for an unknown email, and the API answers the same either way.
- The logged URL is Better-Auth's `<BETTER_AUTH_URL>/api/auth/reset-password/<token>?callbackURL=%2Fredefinir-senha`. Since `BETTER_AUTH_URL` is the web origin, opening it goes through `/api` to the API, which redirects to `/redefinir-senha?token=…`, or to `/redefinir-senha?error=INVALID_TOKEN` when the token is invalid or expired (1 hour).
- Screens: `/esqueci-a-senha` ("Esqueci a senha", linked from sign-in) and `/redefinir-senha`, both in the `anonymous` area. A reset leaves existing sessions open.
- Tests: `apps/api/tests/password-reset.test.ts` (the logged link opens the reset screen with a token that sets a new password that signs in) and `apps/web/tests/password-reset.test.tsx`, with the fake API's `resetLinkFor(email)` standing in for the administrator reading the log.
