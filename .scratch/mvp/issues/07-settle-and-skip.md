# 07: Settle and skip, with materialization

**What to build:** the user settles an occurrence with one click (or skips it), including virtual ones, which are materialized on that first touch with a snapshot of the recurrence. Source: `docs/prd.md` §5.1, §5.2, §5.3, §5.6, §5.7, §6.3, §7.3, §7.5; `docs/adr/0001-virtual-occurrences.md`.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] `PATCH /api/v1/occurrences/:id/status` accepts a persisted or virtual id; a virtual id is materialized by an idempotent upsert on the unique index, copying direction, description, `defaultAmount` and the clamped due date from the recurrence
- [ ] Settling requires an amount > 0 (`AMOUNT_REQUIRED_TO_SETTLE`, an amount may be sent with the request); `settledAt` defaults to today (São Paulo); leaving SETTLED clears `settledAt`; any transition between PENDING, SETTLED and SKIPPED is allowed
- [ ] Monthly screen: a checkbox / quick action toggles PENDING ↔ SETTLED; when the amount is null, it opens an inline popover asking only for the amount; a skip action is available
- [ ] Status changes are optimistic through TanStack Query, with rollback on failure
- [ ] Integration tests: materializing the same virtual id twice yields one row; materialization snapshots the recurrence; settle without amount fails; settledAt invariant holds; another user's occurrence or recurrence cannot be touched
