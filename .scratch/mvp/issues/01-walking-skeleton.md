# 01: Walking skeleton: monorepo tooling and first domain helpers

**What to build:** a monorepo where every check (format, lint, boundaries, typecheck, test) runs green from the root and on every commit, proven by the first real behaviour in `@shared`: due-date clamping and the `America/Sao_Paulo` "today". Source: `docs/prd.md` §2, §4 (Due Date Clamping), §8.1, §8.5.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] npm workspaces declared for the `apps/*` and `packages/*` layout of PRD §8.1; only `packages/shared` is created now (other workspaces arrive with the tickets that need them)
- [ ] One shared TypeScript base config that every workspace extends, replacing the stock root config; `@shared` is consumed as source, with no build step (drop unused build tooling)
- [ ] One Prettier config and one ESLint flat config at the root cover every workspace; lint/format devDependencies live in the root package
- [ ] Vitest runs across the monorepo from one root `test` script
- [ ] `/setup-ts-deep-modules` applied: packages expose their root files as entry points, internals live in subfolders, and the boundary check is part of the umbrella check script alongside typecheck
- [ ] `/setup-pre-commit` applied: Husky + lint-staged run Prettier on staged files, plus typecheck and tests on commit
- [ ] `@shared` exposes due-date clamping: `effectiveDay = min(dueDay, daysInMonth(period))`, null `dueDay` gives no due date; unit-tested for 30-day months, February and leap years
- [ ] `@shared` exposes "today" and "current period" computed in `America/Sao_Paulo`; unit-tested around the UTC midnight boundary (e.g. 01:00 UTC on the 1st is still the previous month in São Paulo)
- [ ] `format:check`, `lint`, `lint:boundaries`, `typecheck` and `test` all pass from the root
