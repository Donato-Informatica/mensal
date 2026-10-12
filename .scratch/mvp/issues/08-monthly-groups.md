# 08: Monthly screen groups

**What to build:** the monthly screen's flat list becomes the four groups, so the user sees at a glance what is late, due today, still to come, and done. Source: `docs/prd.md` §4 (Overdue from Earlier Periods), §5.5, §7.4.

**Blocked by:** 07

**Status:** ready-for-agent

- [x] Groups in this order: **Atrasadas** (including overdue occurrences from earlier periods, current period only, each labeled with its period), **Vencem hoje**, **A vencer no mês** (pending without a due date at the end), **Liquidadas e puladas**
- [x] Empty groups are hidden
- [x] Settling or skipping an item moves it between groups optimistically
- [x] The grouping rule is unit-tested at the highest seam available

## Comments

- Implemented. The rule is `groupOccurrences(payload, today)` in `apps/web/src/occurrence-groups.ts`. It returns the non-empty groups in order:
  - **Atrasadas**: `overdueFromPreviousPeriods` first, then the period's overdue items.
  - **Vencem hoje**: pending items due today.
  - **A vencer no mês**: the other pending items; those without a due date come last, as in the payload.
  - **Liquidadas e puladas**: settled and skipped items.
- The monthly screen renders them as a `region` "Contas do mês" that holds one `section` per group, each with an h2 and a `list` named after the group.
  - Rows from an earlier period carry a rose badge with their period ("Setembro 2026").
  - The "Atrasada" badge is gone, since the group heading says it.
  - "Nenhuma conta neste mês." shows only when every group is empty.
- Tests are at the monthly-screen seam, agreed with the user: `apps/web/tests/groups.test.tsx`, through `openApp` and the fake API.
  - The fake's `addRecurrence` now starts in `2026-10-01` by default. Earlier starts would make earlier overdue virtual occurrences show up in **Atrasadas**.
- Settling or skipping an earlier period's overdue row takes it off the screen; it does not move to **Liquidadas e puladas**, which only holds the shown period's items. `withStatusChange` already filtered `overdueFromPreviousPeriods` this way.
- A row that changes group is remounted, so keyboard focus on its checkbox is lost.
- Known gap: grouping reads `today()` on the client but trusts the payload's `overdue` flag. If the screen stays open past midnight, an item that just became overdue stays in **A vencer no mês** until the next refetch.
