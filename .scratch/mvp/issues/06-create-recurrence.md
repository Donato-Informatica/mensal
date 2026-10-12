# 06: Create a recurrence

**What to build:** from the monthly screen, the user creates a recurrence and immediately sees it projected as a virtual occurrence in the current and later periods. Source: `docs/prd.md` §3.1, §5.10, §6.1, §7.7.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] `POST /api/v1/recurrences` validates input with the `@shared` Zod schema (description ≤ 120 chars, `defaultAmount` > 0 or null, `dueDay` 1–31 or null, `endPeriod` ≥ `startPeriod`)
- [ ] A `startPeriod` before the current period (São Paulo) is rejected with `START_PERIOD_IN_PAST`
- [ ] Recurrence dialog on the monthly screen (direction, description, amount or "a definir", due day, start period defaulting to the shown period when not in the past, optional end period, notes)
- [ ] After creating, the monthly screen shows the new virtual occurrence without a reload
- [ ] Integration tests for validation and `START_PERIOD_IN_PAST`
