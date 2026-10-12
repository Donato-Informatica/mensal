# 02: resolvePeriod in @shared

**What to build:** the pure function that turns persisted occurrences, recurrences, a period and "today" into the full period payload of PRD §4 and §6.2. It is the primary test seam of the product. Source: `docs/prd.md` §3, §4, §5, §8.5; `docs/adr/0001-virtual-occurrences.md`.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] Types and Zod schemas for Recurrence, Occurrence and Virtual occurrence as in PRD §3 (amounts in cents, periods as `YYYY-MM-01`, dates as `YYYY-MM-DD`)
- [x] A recurrence in effect for the period (`startPeriod <= P` and `endPeriod` null or `>= P`) with no persisted occurrence in it is projected as a virtual occurrence with id `virtual_<recurrenceId>_<period>`, the recurrence's current description and `defaultAmount`, status PENDING and a clamped due date
- [x] A recurrence that already has a persisted occurrence in the period is not projected again
- [x] Items are ordered by due date ascending, items without a due date last
- [x] Summary per direction: expected = PENDING + SETTLED, settled = SETTLED only; SKIPPED excluded; null amount counts as 0; no balance is returned
- [x] Each item carries the derived `overdue` flag (PENDING, has a due date, due date before today)
- [x] Only when the period is the current one, overdue occurrences from earlier periods are listed (persisted PENDING and virtual ones within each recurrence's start..end), and they do not enter the summary
- [x] All of the above covered by unit tests through the package entry point

## Comments

- Implemented: `resolvePeriod({ period, today, occurrences, recurrences })` and `RecurrenceSchema`, `OccurrenceSchema`, `VirtualOccurrenceSchema` (with inferred types) are exported from `@mensal/shared`. `today` is the São Paulo date string (`today()`), and the current period is derived from it.
- Items carry `notes` (PRD §3.3 includes it on virtual occurrences, the §6.2 example omits it); the ticket 09 edit form needs it.
- The schemas encode field-level rules only. The cross-field invariants of §3.2 (settledAt iff SETTLED, SETTLED requires an amount, due date within period, `endPeriod >= startPeriod`) are left to the DB CHECKs and the API rules of tickets 05, 07, 09 and 12. Zod 4 refinements would also block `.pick()`/`.omit()` for derived request schemas.
- Caller contract: when the period is the current one, `occurrences` must include **every** persisted occurrence of earlier periods, whatever its status, or a settled or skipped earlier month is projected again as an overdue virtual occurrence. See the `ResolvePeriodInput` JSDoc.
