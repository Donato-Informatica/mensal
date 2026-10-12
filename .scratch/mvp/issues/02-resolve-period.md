# 02: resolvePeriod in @shared

**What to build:** the pure function that turns persisted occurrences, recurrences, a period and "today" into the full period payload of PRD §4 and §6.2. It is the primary test seam of the product. Source: `docs/prd.md` §3, §4, §5, §8.5; `docs/adr/0001-virtual-occurrences.md`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Types and Zod schemas for Recurrence, Occurrence and Virtual occurrence as in PRD §3 (amounts in cents, periods as `YYYY-MM-01`, dates as `YYYY-MM-DD`)
- [ ] A recurrence in effect for the period (`startPeriod <= P` and `endPeriod` null or `>= P`) with no persisted occurrence in it is projected as a virtual occurrence with id `virtual_<recurrenceId>_<period>`, the recurrence's current description and `defaultAmount`, status PENDING and a clamped due date
- [ ] A recurrence that already has a persisted occurrence in the period is not projected again
- [ ] Items are ordered by due date ascending, items without a due date last
- [ ] Summary per direction: expected = PENDING + SETTLED, settled = SETTLED only; SKIPPED excluded; null amount counts as 0; no balance is returned
- [ ] Each item carries the derived `overdue` flag (PENDING, has a due date, due date before today)
- [ ] Only when the period is the current one, overdue occurrences from earlier periods are listed (persisted PENDING and virtual ones within each recurrence's start..end), and they do not enter the summary
- [ ] All of the above covered by unit tests through the package entry point
