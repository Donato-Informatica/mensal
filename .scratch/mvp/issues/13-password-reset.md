# 13: Password reset via logged link

**What to build:** a user who forgot their password requests a reset; the reset URL is written to the server log, the administrator forwards it manually, and the user sets a new password through it. No email is sent. Source: `docs/prd.md` §1.3, §8.2.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Better-Auth `sendResetPassword` writes the reset URL to the server log
- [ ] "Esqueci a senha" screen requesting the reset, and a reset-password screen opened from the link
- [ ] Integration test: requesting a reset logs a usable URL, and the token sets a new password that signs in
