# 09: Edit an occurrence

**What to build:** the user edits an occurrence's description, amount, due date, settlement date and notes; editing a virtual occurrence materializes it. Source: `docs/prd.md` §5.2, §5.8, §6.3.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] `PATCH /api/v1/occurrences/:id` accepts a persisted or virtual id and updates `description`, `amount`, `dueDate`, `settledAt` and `notes`; virtual ids are materialized with the same upsert as status changes
- [ ] A due date outside the period → `DUE_DATE_OUTSIDE_PERIOD`; `settledAt` only accepted when SETTLED; `direction`, `period` and `recurrenceId` cannot be changed
- [ ] Edit form reachable from an occurrence row on the monthly screen
- [ ] Integration tests for each rule above, and that editing a virtual occurrence leaves the recurrence untouched
