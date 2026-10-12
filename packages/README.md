# Packages

Every package here is a **deep module**: a lot of behaviour behind a small interface. Its public surface is its **entry points**, the files at the package root. Everything in a subfolder is private.

```
packages/
  <name>/
    package.json   ← "exports" maps to the entry points
    index.ts       ← an entry point (public). Import this from outside.
    lib/           ← implementation: hidden from outside, free to import each other.
    tests/         ← tests, importing only entry points.
```

Vitest only picks up `*.test.ts` files under a workspace's `tests/` folder; tests placed elsewhere are not run.

Packages are consumed as TypeScript source (no build step). Import them by package name (`@mensal/shared`), never by a path into their folders.

**Prefer several small entry points over a barrel.** When a package grows a distinct surface, add another root file (`client.ts`, `server.ts`) instead of re-exporting a whole subtree through one `index.ts`.

## Rules

`npm run lint:boundaries` (dependency-cruiser, configured in [`.dependency-cruiser.cjs`](../.dependency-cruiser.cjs)) enforces them, and it runs in `npm run check` and on every commit. It cruises `packages/` and `apps/`, so rule 1 covers app code too.

1. **Entry-point boundary**: code outside a package (apps or other packages) imports only its entry points, never anything in its subfolders.
2. **Intra-package freedom**: a package's own files import each other freely.
3. **Tests through the entry points**: files under `<pkg>/tests/` import entry points and their own `tests/` fixtures, never any package's internals, not even their own.
4. **Fixtures stay in tests**: nothing outside a `tests/` folder imports from one.
5. **No cycles**: no dependency cycles.
