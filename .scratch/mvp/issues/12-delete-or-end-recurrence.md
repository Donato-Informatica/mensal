# 12: Delete or end a recurrence

**What to build:** the user deletes a recurrence that has no history; when it has persisted occurrences, they are offered to **end** it instead, keeping everything that already exists. Source: `docs/prd.md` §2, §5.4, §6.1, §7.6.

**Blocked by:** 07, 11

**Status:** ready-for-agent

- [ ] `DELETE /api/v1/recurrences/:id` hard-deletes when no occurrence is persisted; otherwise `409 RECURRENCE_HAS_OCCURRENCES`
- [ ] Ending is a `PATCH` of `endPeriod`; the UI asks for the last period (inclusive), defaulting to the current period
- [ ] On the 409 the UI offers to end the recurrence instead
- [ ] Delete and end actions on the recurrences screen and from an occurrence row
- [ ] Integration tests: delete without history; 409 with history; after ending, no virtual occurrences are projected after `endPeriod` while persisted ones (even later ones) remain
