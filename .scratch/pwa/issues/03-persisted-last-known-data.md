# 03: Persisted last-known data

**What to build:** The last data the user loaded survives reloads and cold starts, so opening the installed app offline shows the months and recurrences they looked at before. Only the read queries (periods, recurrences) are persisted, per user, behind a version buster so a deploy that changes response shapes never reads stale data; auth responses are never persisted. A month never loaded shows an "indisponível offline" state, and screens show when the data was last updated ("atualizado em …"); there is no expiry. Signing out wipes the stored data. The persister is injectable: IndexedDB in production, in-memory in tests.

**Blocked by:** 02: Offline read-only mode.

**Status:** ready-for-human

- [ ] After a reload while offline, previously opened months and the recurrences list render from the stored data
- [ ] A month never loaded offline shows the "indisponível offline" state
- [ ] The last-updated timestamp is shown for offline data
- [ ] Stored data is keyed per user; a different user never sees another's data
- [ ] Sign-out wipes the stored data
- [ ] A changed version buster discards the stored data
- [ ] No auth response is ever persisted
- [ ] `web` tests use an in-memory persister (no new test dependency); real IndexedDB manually verified via `vite preview`
- [ ] `npm run check` passes
