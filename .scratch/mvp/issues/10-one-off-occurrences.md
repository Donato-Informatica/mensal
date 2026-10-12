# 10: One-off occurrences

**What to build:** the user records an occurrence that does not come from any recurrence, and can delete it; occurrences from a recurrence cannot be deleted, only skipped. Source: `docs/prd.md` §1.3, §5.9, §6.3, §7.7.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] `POST /api/v1/occurrences` creates a one-off occurrence (direction, description, amount or null, period, due date within the period, notes) validated by the `@shared` schema
- [ ] `DELETE /api/v1/occurrences/:id` hard-deletes a one-off; an occurrence with a recurrence → `409 ONLY_ONE_OFF_DELETABLE`
- [ ] One-off dialog on the monthly screen, and a delete action on one-off rows only
- [ ] Integration tests for creation, deletion, the 409, and tenant isolation
