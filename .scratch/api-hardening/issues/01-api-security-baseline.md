# 01: API security baseline

**What to build:** the minimal hardening of the API process described in `docs/prd.md` §8.6: security headers, rate limits on the anonymous auth endpoints, JSON-only error responses and a production boot check. No new behaviour for approved users on `/api/v1`.

**Blocked by:** none

**Status:** resolved

- [x] `helmet` (new dependency of `@mensal/api`) with its defaults is the first middleware in `createApp` (`apps/api/src/app.ts`), before the Better-Auth handler. Responses carry Helmet's headers and no `X-Powered-By`.
- [x] Better-Auth's rate limiter in `createAuth` (`apps/api/src/auth.ts`): `enabled: true` in every environment (its default is production only), memory storage, `advanced.ipAddress.ipAddressHeaders: ["x-forwarded-for"]`. Custom rules per IP: sign-in 5 per 60 s, sign-up 3 per 3600 s, password-reset request 3 per 3600 s; every other path keeps Better-Auth's built-in rules (3 per 10 s on `/sign-in/*`, `/sign-up/*`, `/change-password` and `/change-email`, 3 per 60 s on `/send-verification-email`, 100 per 10 s on the rest). Check the exact endpoint paths against the installed Better-Auth 1.7 (e.g. `/sign-in/email`, `/sign-up/email`, and `/request-password-reset` vs the older `/forget-password`).
- [x] The existing api tests keep passing: their many sign-ups must not trip the limiter. If they do, make the limiter configurable through `AuthOptions` rather than turning it off by `NODE_ENV`.
- [x] A final error handler in `createApp`, after every router:
  - malformed JSON (`entity.parse.failed`) → `400 { code: "INVALID_INPUT", fields: [] }`
  - oversized body (`entity.too.large`) → `413 { code: "PAYLOAD_TOO_LARGE" }`
  - anything else → `500 { code: "INTERNAL_ERROR" }`, with the error logged server-side and no message or stack in the response
- [x] `server.ts` reads its environment through a pure `readConfig(env)` (replacing `required()`), which still names a missing variable and, when `NODE_ENV=production`, throws if `BETTER_AUTH_SECRET` equals the `.env.example` value or is shorter than 32 characters, or if `BETTER_AUTH_URL` does not start with `https://`. Dev and test are unaffected.
- [x] `apps/api/tests/security.test.ts` (api suite, real app and Postgres, no database mocks):
  - Helmet's headers present (e.g. `x-content-type-options: nosniff`), `x-powered-by` absent
  - the 6th sign-in within a minute from one `X-Forwarded-For` gets `429`; a different IP still gets through
  - a malformed JSON body gets `400 INVALID_INPUT`; a body over 100 kB gets `413 PAYLOAD_TOO_LARGE`
  - an unexpected throw gets `500 INTERNAL_ERROR` with no detail, triggered by giving `createApp` a `now()` that throws
- [x] A unit test for `readConfig` (unit suite, under `apps/api/tests/`).
- [x] `npm run check` green.

## Comments

- Settled in a grilling session (2026-10-14). The things we rejected:
  - **`express-rate-limit` on the whole app**: `/api/v1` is reached only by hand-approved users; the anonymous surface is `/api/auth`, which Better-Auth already limits.
  - **Headers only at the proxy**: Helmet travels with the container and is testable in the api suite. The frontend's CSP still belongs to the proxy (02).
  - **A `cors` package, CSRF tokens on `/api/v1`, a smaller body limit**: same origin, `SameSite=Lax` and the 100 kB default already cover them.
  - **2FA, lockout, audit logs, password policy, `npm audit` in the gate**: out of the MVP's scope.
- No glossary change and no ADR: none of this is domain vocabulary, and every piece is cheap to reverse.
- Implemented. Better-Auth 1.7.7's paths are `/sign-in/email`, `/sign-up/email` and `/request-password-reset` (`/forget-password` is gone). Its own special rules still apply to the paths not overridden (e.g. `/change-password`: 3 per 10 s).
- The limiter did trip the existing api tests: without `X-Forwarded-For`, Better-Auth keys every request in test and development on `127.0.0.1`, so the suite's sign-ups share one bucket of 3 per hour. `AuthOptions.rateLimit` (default `true`) turns it off; `startApi()` passes `false` unless given `{ rateLimit: true }`, and `request()` takes an `ip` that it sends as `X-Forwarded-For`. The memory store is module-global in Better-Auth (shared by every `createAuth` in a process), so `security.test.ts` uses a fresh random address per test.
- The error handler lives in `apps/api/src/error-handler.ts`. `createApp` takes a `log` for unexpected errors (`console.error` by default); `startApi`'s `log` now feeds both auth and the app.
- `readConfig(env)` lives in `apps/api/src/config.ts` and returns `{ databaseUrl, baseURL, secret, port }`. Its test reads the placeholder secret straight from `.env.example`, so the two stay in step.
- Deviation: `apps/api/tests/config.test.ts` runs in the `api` project, not `unit`: `vitest.config.ts` routes every `apps/api/tests/**/*.test.ts` to `api`. The test itself touches no app or database.
