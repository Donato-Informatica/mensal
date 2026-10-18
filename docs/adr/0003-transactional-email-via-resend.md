# Transactional email through Resend, behind an injectable sink

The MVP sent no email: password-reset links went to the server log and the administrator forwarded them by hand (PRD §1.3, §8.2). We now send two transactional emails, the reset link and a "password changed" alert, through Resend's REST API, called with a small `fetch` wrapper instead of its SDK. We chose this because forwarding links by hand doesn't scale beyond a few users, and it puts a live credential in the operator log. Sending goes through an injectable `email` sink, like the activity log (PRD §8.7): with `RESEND_API_KEY` and `EMAIL_FROM` unset it writes to the console, in any environment. Local development, the seed and the test suites therefore never call Resend.

## Consequences

- Whoever controls a user's inbox can take over their account. Email is now part of the security boundary, so the "password changed" alert exists to give a victim a way back in.
- With Resend configured, reset URLs never reach the log, not even when sending fails. The user requests a new link instead; the administrator no longer has a fallback.
- The reset email is sent without awaiting it, and a failure is only logged, so the response doesn't reveal whether an account exists.
- Email stays transactional only. Verification, approval notices and notifications remain out of scope.
