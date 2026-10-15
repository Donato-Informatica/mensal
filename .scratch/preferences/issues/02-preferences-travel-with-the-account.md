# 02: Preferences travel with the account

**Parent:** 01 (Account-wide preferences)

**What to build:** the two Configurações switches ("Mostrar resumo de entradas e saídas" and "Confirmar antes de liquidar, pular ou voltar uma conta para pendente") stop being per-device `localStorage` values and become **preferences** of the account (PRD §3.5, [ADR-0002](../../../docs/adr/0002-preferences-on-auth-user.md)). They are stored on the Better-Auth user, arrive with the session, and are saved through `authClient.updateUser`, so a user who turns one off on one device finds it off on every device after the session reloads. A failed save quietly restores the old value; the visible failure states are tickets 03 and 04.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] `showSummary` and `confirmStatusChanges` are Better-Auth `user.additionalFields`: `type: "boolean"`, `required: true`, `defaultValue: true`, `input: true`. `approved` is unchanged (`input: false`).
- [x] Both columns land in one migration: Better-Auth schema regenerated with `npm run -w @mensal/api auth:generate` (no `--adapter`), then `npm run -w @mensal/database generate`. `migrations/` is never hand-edited.
- [x] API test (real app, real Postgres): a new user gets `true` for both; a signed-in user changes both through `POST /api/auth/update-user`, and `get-session` returns the new values.
- [x] API test: `update-user` cannot change `approved`. Sending `approved: true` leaves the user unapproved, whether the request is rejected or the field is ignored.
- [x] The web hooks `useShowSummary` and `useConfirmStatusChanges` read from the session and keep their `[value, setValue]` shape, so the monthly screen and the settings form barely change. The "Per-device" doc comment is replaced.
- [x] Optimistic save: a change cancels any in-flight session refetch, patches the cached `["session"]` data at once, and sends **only the field that changed** to `updateUser`. A successful response does not overwrite the cache, so quick repeated toggles don't flicker. A failed save restores the old value.
- [x] Old `mensal:show-summary` / `mensal:confirm-status-changes` localStorage values are ignored, with no migration or upload. Everyone starts from the server value.
- [x] The fake API's user carries both preferences (default `true`), `get-session` returns them, and `POST /api/auth/update-user` updates them. Tests can start a user with given preferences.
- [x] Web tests that seed `localStorage` (settle, groups, settings) seed the fake user's preferences instead.
- [x] Web test: a preference changed in Configurações survives a reload (a new `openApp()` against the same fake API).
- [x] `npm run check` green.
