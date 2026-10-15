# 04: Offline session fallback

**What to build:** Opening the app offline with a previously signed-in account lands in the read-only app instead of the sign-in screen. When the session check fails for a network reason, the app trusts the last known session; when the server actually answers with a rejection (401, or 403 such as `USER_NOT_APPROVED`) while online, behavior is unchanged. This completes the cold-start-offline path end to end.

**Blocked by:** 03: Persisted last-known data.

**Status:** ready-for-human

- [ ] Cold start offline with a stored session opens read-only on the last known data
- [ ] A network failure never signs the user out or redirects to sign-in
- [ ] A real 401/403 answer while online still signs out / shows the approval screen as today
- [ ] With no stored session and no connection, the app shows a clear offline state rather than a blank or spinning screen
- [ ] `web` tests cover the network-failure fallback and the unchanged rejection paths
- [ ] Manually verified cold-start offline with `vite build && vite preview`
- [ ] `npm run check` passes
