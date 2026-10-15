# 01: Account-wide preferences

**What to build:** the two Configurações switches ("Mostrar resumo de entradas e saídas" and "Confirmar antes de liquidar, pular ou voltar uma conta para pendente") stop being per-device `localStorage` values and become **preferences** of the account (PRD §3.5, [ADR-0002](../../../docs/adr/0002-preferences-on-auth-user.md)). They are stored on the Better-Auth user, travel with the session, and are saved through `authClient.updateUser`, so every device the user signs in on shares them.

**Blocked by:** none

**Status:** resolved

- [x] `apps/api/src/auth.ts`: add `showSummary` and `confirmStatusChanges` to `user.additionalFields`, each `type: "boolean"`, `required: true`, `defaultValue: true`, `input: true`. `approved` is unchanged.
- [x] Regenerate the Better-Auth schema with `npm run -w @mensal/api auth:generate` (no `--adapter`), then `npm run -w @mensal/database generate` for the migration. Never hand-edit `migrations/`.
- [x] API test (real app, real Postgres): a signed-in user can change both preferences through `POST /api/auth/update-user`, and `get-session` returns the new values. A new user gets `true` for both.
- [x] API test: `update-user` **cannot** change `approved`. Sending `approved: true` leaves the user unapproved, whether the request is rejected or the field is ignored.
- [x] `apps/web/src/settings.tsx`: `useShowSummary` and `useConfirmStatusChanges` read from the session (`useSession().user`) and keep their `[value, setValue]` shape, so `month.tsx` and `SettingsForm` barely change. Replace the "Per-device" doc comment.
- [x] Optimistic save: a change patches the cached `["session"]` data at once, cancels any in-flight session refetch first, and sends **only the field that changed** to `updateUser`. If the save fails, the old value is restored. A successful response does not overwrite the cache, so quick repeated toggles don't flicker.
- [x] If a save fails in the settings modal, the switch flips back and a red `Alert` (`variant="light"`) above the switches says **"Alteração não salva."** followed by `errorMessage(error)`, as the other modals do.
- [x] If a save fails after closing the summary bar on the monthly screen, the bar comes back with an inline **"Alteração não salva."** line and a **"Tentar de novo"** button, as the occurrence rows do (`month.tsx`, the `failure` block).
- [x] Old `mensal:show-summary` / `mensal:confirm-status-changes` localStorage values are ignored, with no migration or upload. Everyone starts from the server value.
- [x] `apps/web/tests/fake-api.ts`: the fake user carries both preferences (default `true`), `get-session` returns them, and `POST /api/auth/update-user` updates them. Tests can start a user with given preferences.
- [x] Web tests that seed `localStorage` (`settle.test.tsx`, `groups.test.tsx`, `settings.test.tsx`) seed the fake user's preferences instead. Add tests for a preference surviving a reload (a new `openApp()` against the same fake API) and for the two failure states above.
- [x] `npm run check` green.

## Comments

- Settled in a grilling session (2026-10-15). Decisions:
  - Preferences are **account-wide**, and every existing preference moves. Sync happens on session reload (React Query already refetches on window focus); there is no live push.
  - Stored as typed `additionalFields` columns rather than a JSON column or a `/api/v1` table (ADR-0002).
  - Old localStorage values are dropped rather than uploaded.
  - "Preference" added to `GLOSSARY.md` (UI: Configurações; avoid setting/config/option).
- Resolved on branch `preferences` (2026-10-15): built by tickets 02 (4c0236c), 03 (b21f885) and 04 (81d3a28), plus code-review fixes (8998246).
