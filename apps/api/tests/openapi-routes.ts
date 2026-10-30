import type { Express } from "express";

interface Layer {
  name: string;
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: Layer[] };
  matchers: ((input: string) => false | { path: string })[];
}

/** An operation the app serves, e.g. `GET /api/v1/recurrences/{id}`. */
export type Operation =
  `${"GET" | "POST" | "PUT" | "PATCH" | "DELETE"} ${string}`;

/**
 * Every operation mounted on the app, found by walking its router stack.
 * Express drops the path an `app.use(path, router)` is mounted at, so each
 * router's prefix is recovered by matching it against the prefixes of the
 * given paths; a router none of them resolves is reported as `unresolved`.
 */
export function mountedOperations(
  app: Express,
  documentedPaths: string[]
): { operations: Operation[]; unresolved: number } {
  const operations: Operation[] = [];
  let unresolved = 0;

  const walk = (stack: Layer[], prefix: string, remaining: string[]) => {
    for (const layer of stack) {
      if (layer.route) {
        for (const method of Object.keys(layer.route.methods)) {
          if (method === "_all") continue;
          const path = `${prefix}${layer.route.path}`
            .replace(/:(\w+)/g, "{$1}")
            .replace(/(.)\/$/, "$1");
          operations.push(`${method.toUpperCase()} ${path}` as Operation);
        }
      } else if (layer.name === "router" && layer.handle?.stack) {
        const mount = resolveMount(layer, remaining);
        if (mount === undefined) {
          unresolved++;
          continue;
        }
        walk(
          layer.handle.stack,
          prefix + mount,
          remaining
            .filter((path) => path.startsWith(mount))
            .map((path) => path.slice(mount.length))
        );
      }
    }
  };

  const resolveMount = (layer: Layer, paths: string[]) => {
    const candidates = new Set<string>([""]);
    for (const path of paths) {
      let prefix = "";
      for (const segment of path.split("/").slice(1)) {
        prefix += `/${segment}`;
        candidates.add(prefix.replace(/\{(\w+)\}/g, "x"));
      }
    }
    return [...candidates]
      .sort((a, b) => a.length - b.length)
      .find((candidate) => {
        const match = layer.matchers[0]?.(candidate || "/");
        return match && (match.path === candidate || candidate === "");
      });
  };

  walk(
    (app as unknown as { router: { stack: Layer[] } }).router.stack,
    "",
    documentedPaths
  );
  return { operations, unresolved };
}
