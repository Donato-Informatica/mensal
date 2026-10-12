# 11: Recurrences screen: list and edit

**What to build:** a second screen where the user lists their recurrences (active or all) and edits them; edits change every virtual occurrence but never materialized ones. Source: `docs/prd.md` §3.1, §3.3, §5.3, §6.1, §7.6.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] `GET /api/v1/recurrences?status=active|all` (active = `endPeriod` null or ≥ current period, including future starts) and `GET /api/v1/recurrences/:id`
- [ ] `PATCH /api/v1/recurrences/:id` updates `description`, `defaultAmount`, `dueDay`, `endPeriod` and `notes`; changes to `direction` or `startPeriod` are rejected
- [ ] Recurrences screen with the active/all filter and an edit action; the edit is also reachable from an occurrence row on the monthly screen
- [ ] Integration tests: filter semantics; editing changes virtual occurrences but leaves materialized ones untouched; tenant isolation
