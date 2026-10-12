# 07: Settle and skip, with materialization

**What to build:** the user settles an occurrence with one click (or skips it), including virtual ones, which are materialized on that first touch with a snapshot of the recurrence. Source: `docs/prd.md` §5.1, §5.2, §5.3, §5.6, §5.7, §6.3, §7.3, §7.5; `docs/adr/0001-virtual-occurrences.md`.

**Blocked by:** 06

**Status:** ready-for-agent

- [x] `PATCH /api/v1/occurrences/:id/status` accepts a persisted or virtual id; a virtual id is materialized by an idempotent upsert on the unique index, copying direction, description, `defaultAmount` and the clamped due date from the recurrence
- [x] Settling requires an amount > 0 (`AMOUNT_REQUIRED_TO_SETTLE`, an amount may be sent with the request); `settledAt` defaults to today (São Paulo); leaving SETTLED clears `settledAt`; any transition between PENDING, SETTLED and SKIPPED is allowed
- [x] Monthly screen: a checkbox / quick action toggles PENDING ↔ SETTLED; when the amount is null, it opens an inline popover asking only for the amount; a skip action is available
- [x] Status changes are optimistic through TanStack Query, with rollback on failure
- [x] Integration tests: materializing the same virtual id twice yields one row; materialization snapshots the recurrence; settle without amount fails; settledAt invariant holds; another user's occurrence or recurrence cannot be touched

## Comments

- Implemented. `PATCH /api/v1/occurrences/:id/status` lives in `apps/api/src/occurrences.ts`. The body is `StatusChangeSchema` from `@mensal/shared`: `{ status, amount?, settledAt? }`, where `settledAt` is only accepted with SETTLED (`400 INVALID_INPUT` otherwise). It answers `200` with the persisted occurrence. Unknown ids, another user's ids, and virtual ids outside their recurrence's `startPeriod`..`endPeriod` all get `404 OCCURRENCE_NOT_FOUND`.
- Materialization and the change run in one transaction:
  - `INSERT ... ON CONFLICT DO NOTHING` on the partial unique index, then `SELECT ... FOR UPDATE`, so concurrent first touches meet on one row.
  - A refusal (`AMOUNT_REQUIRED_TO_SETTLE`) rolls the materialization back. A virtual occurrence that cannot be settled stays virtual.
- `@mensal/shared` now exports:
  - `parseVirtualId`, the inverse of the deterministic virtual id.
  - `isInEffect(recurrence, period)`.
  - `applyStatusChange`, the PRD §5.7 rule shared by the API, the optimistic update and the web fake. Settling keeps an existing `settledAt` when re-settling an already settled occurrence; otherwise it defaults to today in São Paulo.
  - `withStatusChange(payload, id, change, today)`, which re-derives overdue and the summary for optimistic updates.
- Monthly screen, via `apps/web/src/status-controls.tsx`:
  - Each row has a "Liquidar <descrição>" checkbox. It toggles PENDING ↔ SETTLED; from SKIPPED it settles.
  - When the amount is null, the checkbox opens a popover (a `role="dialog"`) asking only for "Valor". Dismissing it settles nothing.
  - A "Pular" / "Retomar" button toggles SKIPPED ↔ PENDING.
- Optimistic updates:
  - `updatePeriods` (in `period-query.ts`) rewrites every cached period and returns its undo.
  - Every period is refetched only after the last in-flight status change settles. It is not awaited, so a failure shows at once ("Algo deu errado…" alert above the list).
- The Popover sets `hideDetached={false}`. Its focus is trapped inside, so it must not vanish while its row is scrolled away (it also keeps jsdom from hiding it).
- The web fake API answers the PATCH with the same rules, and gained `occurrencesOf(email)` and `stall()` / `resume()` to hold requests in flight. The API test helper `request` takes a `method`.
- `overdueFromPreviousPeriods` items get the same optimistic update but are still not rendered; ticket 08 should give their rows these same controls.
