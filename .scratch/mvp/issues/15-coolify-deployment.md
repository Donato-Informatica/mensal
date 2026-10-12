# 15: Coolify deployment and backups

**What to build:** Mensal runs on the VPS through Coolify, same-origin, with off-VPS daily backups. Steps only a human can take; a good fit for `/wizard`. Source: `docs/prd.md` §8.3, §8.4, §9 (M4).

**Blocked by:** 04, 14

**Status:** ready-for-human

- [ ] Coolify hosts the static frontend, the API container and Postgres 17 (same version as docker-compose)
- [ ] The proxy serves the frontend at `/` and forwards `/api` to Express; no CORS
- [ ] Production secrets (Better-Auth secret, database URL) set in Coolify, not in the repo
- [ ] Daily Postgres backups to S3-compatible storage outside the VPS, 30-day retention; one restore tested
- [ ] An administrator can approve a user directly in the production database
