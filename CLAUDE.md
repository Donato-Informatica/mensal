# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Workspaces

- `apps/api` — Express on :3000, Better-Auth + Drizzle, serves `/api/v1`.
- `apps/web` — React + Mantine + Vite on :5173.
- `apps/guide` — the static guide at `/guia/` (plain HTML and CSS, Vite on :5174); exports its section ids as `@mensal/guide`.
- `packages/database` — Drizzle schema and migrations (Postgres 17).
- `packages/shared` — shared domain types and the period-resolution logic (`resolvePeriod`, also used by the web test fake API).
