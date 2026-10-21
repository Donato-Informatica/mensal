# Remote MCP server authenticated by access tokens, not OAuth

Users want their own agents (Claude Code, Codex, …) to read and change their Mensal data. We serve an MCP server from the API itself, as stateless Streamable HTTP on `/api/mcp`, and authenticate it with **access tokens**: secrets a user creates in the app and pastes into the agent's configuration as a `Bearer` header (PRD §8.9). We chose this because it reaches every client that lets the user set a header, needs no consent screen, client registration or token refresh, and a token is revoked from one list. The token is valid only on `/api/mcp`. `/api/v1` stays cookie-only, so the CSRF and rate-limit reasoning of PRD §8.6 does not change.

## Considered Options

- **OAuth 2.1 authorization server** (what claude.ai custom connectors require): a "Conectar" button with no secret to copy. It needs dynamic client registration, a consent screen, refresh tokens and their revocation, which is far more surface to secure for a handful of users. It stays a non-goal (PRD §1.3).
- **A local stdio package** (`npx @mensal/mcp`) calling the REST API: users would need Node on their machine, and we would have to publish and version it. It would still need a token for `/api/v1`.
- **A hand-rolled token table**: the `@better-auth/api-key` plugin already hashes, prefixes, rate-limits and verifies keys inside the Better-Auth schema we generate.

## Consequences

- A token is a long-lived secret stored in plain-text config files. It therefore has a per-token rate limit, it can only be created after re-entering the password, and a password reset revokes every token. A password change offers to revoke them.
- Moving to OAuth later would break every configured client. Their users would have to reconnect.
- The domain operations live in a module shared by the REST routers and the MCP tools, so the business rules of PRD §5 have one implementation. A test fails when a `/api/v1` operation has no MCP tool.
