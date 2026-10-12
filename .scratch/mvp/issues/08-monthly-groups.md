# 08: Monthly screen groups

**What to build:** the monthly screen's flat list becomes the four groups, so the user sees at a glance what is late, due today, still to come, and done. Source: `docs/prd.md` §4 (Overdue from Earlier Periods), §5.5, §7.4.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] Groups in this order: **Atrasadas** (including overdue occurrences from earlier periods, current period only, each labeled with its period), **Vencem hoje**, **A vencer no mês** (pending without a due date at the end), **Liquidadas e puladas**
- [ ] Empty groups are hidden
- [ ] Settling or skipping an item moves it between groups optimistically
- [ ] The grouping rule is unit-tested at the highest seam available
