# 06: Create a recurrence

**What to build:** from the monthly screen, the user creates a recurrence and immediately sees it projected as a virtual occurrence in the current and later periods. Source: `docs/prd.md` §3.1, §5.10, §6.1, §7.7.

**Blocked by:** 05

**Status:** ready-for-agent

- [x] `POST /api/v1/recurrences` validates input with the `@shared` Zod schema (description ≤ 120 chars, `defaultAmount` > 0 or null, `dueDay` 1–31 or null, `endPeriod` ≥ `startPeriod`)
- [x] A `startPeriod` before the current period (São Paulo) is rejected with `START_PERIOD_IN_PAST`
- [x] Recurrence dialog on the monthly screen (direction, description, amount or "a definir", due day, start period defaulting to the shown period when not in the past, optional end period, notes)
- [x] After creating, the monthly screen shows the new virtual occurrence without a reload
- [x] Integration tests for validation and `START_PERIOD_IN_PAST`

## Comments

- Implemented. `@mensal/shared` exports `NewRecurrenceSchema` / `NewRecurrence`, the body of `POST /recurrences`. Besides the ticket's bounds it trims the description (which must then be non-empty) and turns blank notes into `null`.
- `POST /api/v1/recurrences` lives in `apps/api/src/recurrences.ts` and answers `201` with the created recurrence. An invalid body gets `400 { code: "INVALID_INPUT", fields: [...] }`, naming the offending top-level fields. This is a new generic code; later routes can reuse it. A start before the current period gets `400 START_PERIOD_IN_PAST`. The `endPeriod ≥ startPeriod` refine only runs once every field parses, so a body with several errors may not list `endPeriod`.
- The dialog is `apps/web/src/new-recurrence.tsx`, opened by "Nova recorrência" above the list. Start and end periods use `MonthPickerInput` from the new `@mantine/dates` dependency, with `dayjs` and a pt-br `DatesProvider` in `app.tsx`. Native `<input type="month">` is unsupported in Firefox and desktop Safari. The start picker cannot go before the current period, and moving the start past the end clears the end. Required fields carry no asterisk (the theme's convention); optional ones say "Opcional".
- After creating, `invalidatePeriods` (in `period-query.ts`) marks every cached period stale, since the new recurrence reaches every period from its start on.
- The period navigator's ←/→ now ignore keys pressed inside any `[role="dialog"]` (modals and picker dropdowns), so arrows in a dialog never change the month behind it. Tickets 07–10 get this for free.
- The web tests' fake API answers `POST /api/v1/recurrences` with the same rules, and exposes `recurrencesOf(email)`. `tests/setup.ts` stubs `document.fonts` for `Textarea autosize`.
