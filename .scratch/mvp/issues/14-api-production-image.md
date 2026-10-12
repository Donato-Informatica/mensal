# 14: API production image

**What to build:** a production-ready API container and web build, runnable locally against the compose Postgres, ready for Coolify. Source: `docs/prd.md` §8.1, §8.3, §8.4.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Dockerfile builds the API image copying only the `api`, `shared` and `database` workspaces
- [ ] Migrations are applied by drizzle-kit on start (never `auth migrate`)
- [ ] Production build script for the web app's static files
- [ ] Verified by running the image locally against the compose Postgres and hitting an authenticated route
