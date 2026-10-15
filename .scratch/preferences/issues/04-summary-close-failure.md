# 04: A failed save after closing the summary brings it back with a retry

**Parent:** 01 (Account-wide preferences)

**What to build:** when the user closes the summary bar on the monthly screen and saving that preference fails, the bar comes back with an inline **"Alteração não salva."** line (followed by `errorMessage(error)`) and a **"Tentar de novo"** button that retries the save, as the occurrence rows do on a failed change.

**Blocked by:** 02 (Preferences travel with the account)

**Status:** ready-for-agent

- [ ] A failed save after closing the summary bar brings the bar back with the inline failure line and "Tentar de novo".
- [ ] "Tentar de novo" resends the save; on success the bar closes and the failure line goes away.
- [ ] The failure styling matches the occurrence rows' failure block.
- [ ] Web test covering the failure and the retry (the fake API can make `update-user` fail, as in 03).
- [ ] `npm run check` green.
