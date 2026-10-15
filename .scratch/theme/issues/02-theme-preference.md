# 02: Theme preference

**What to build:** a third preference of the account, `colorScheme` (PRD §3.5): Escuro, Claro or Automático, default Escuro. It is chosen from a "Tema" segmented control at the top of Configurações, applies at once, saves in the background like the other preferences, and is shared by every device the user signs in on.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `apps/api/src/auth.ts`: add `colorScheme` to `user.additionalFields`: `type: "string"`, `required: true`, `defaultValue: "dark"`, `input: true`. Values other than `"dark"`, `"light"` and `"auto"` are rejected.
- [ ] Regenerate the Better-Auth schema with `npm run -w @mensal/api auth:generate` (no `--adapter`), then `npm run -w @mensal/database generate`. Never hand-edit `migrations/`.
- [ ] API tests (real app, real Postgres): a new user gets `"dark"`. A signed-in user can set each of the three values through `POST /api/auth/update-user`, and `get-session` returns the new value. An invalid value (e.g. `"sepia"`) is rejected and leaves the stored value unchanged.
- [ ] `apps/web/src/session.ts`: generalise `usePreference` (`Preference`, `Save`, `Saves`, `show`, `setValue`) from `boolean` to each preference's own value type. Keep the "newest save decides" behaviour and the `[value, setValue, failure]` shape. `useShowSummary` and `useConfirmStatusChanges` are unchanged for their callers.
- [ ] `apps/web/src/app.tsx`: `forceColorScheme="dark"` goes. The applied scheme follows the session's `colorScheme` (via `useMantineColorScheme().setColorScheme` or equivalent). Automático follows the OS live, with no reload.
- [ ] `apps/web/src/settings.tsx`: a "Tema" row first in `SettingsForm`, a `SegmentedControl` labelled Escuro · Claro · Automático, styled as a settings row (DESIGN.md, Dialogs). Its save failure joins the existing single "Alteração não salva." alert ("the latest change only": starting one change dismisses the other failures).
- [ ] `apps/web/tests/fake-api.ts`: the fake user carries `colorScheme` (default `"dark"`), `get-session` returns it, `update-user` updates it. Tests can start a user with a given scheme.
- [ ] Web tests: choosing Claro applies the light scheme at once (Mantine's `data-mantine-color-scheme` on the document element) and survives a reload (new `openApp()` against the same fake API). A failed save rolls back to the previous scheme and shows the alert. Automático resolves through `matchMedia` (stubbed in jsdom).
- [ ] `npm run check` green.
