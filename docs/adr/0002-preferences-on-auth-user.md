# Preferences stored on the Better-Auth user, outside `/api/v1`

A user's preferences (PRD §3.5) are typed columns on the Better-Auth `users` row, declared as `user.additionalFields` with `input: true`. They are read from the session and written through Better-Auth's `update-user`, not through a `/api/v1` endpoint. We chose this because the values then arrive with the session the app already loads, and saving them needs no new endpoint, query or fake-API route, which suits a handful of booleans. A `user_preferences` table behind `/api/v1` would match where the rest of the user's data lives, but would cost all of that plumbing for no gain.

## Considered Options

- **One JSON `preferences` column** in `additionalFields`: adding a preference would need no migration, but the column is untyped, needs its own validation, and every write replaces the whole object.
- **A `user_preferences` table behind `/api/v1`**: covered by the approval gate and part of the domain API, but needs a new endpoint, a separate query and fake-API support.

## Consequences

- Writes skip the `/api/v1` approval gate, so an unapproved user can save their own preferences. This is harmless: they never reach the UI that shows them.
- Because `input: true` also lets sign-up set them, every preference must be safe to choose freely. Anything an administrator controls (like `approved`) stays `input: false`, and an API test guards that `update-user` cannot change `approved`.
- Each new preference is a schema change through `auth:generate` and `generate`.
