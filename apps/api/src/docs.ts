import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Router } from "express";
import type { Auth } from "./auth.ts";
import { buildOpenApiSpec } from "./openapi.ts";

// Scalar's browser bundle is served from here, not from a CDN, so the page
// works offline and under the default Content-Security-Policy (PRD §8.6).
const scalarBundle = join(
  dirname(createRequire(import.meta.url).resolve("@scalar/api-reference")),
  "browser",
  "standalone.js"
);

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mensal API</title>
  </head>
  <body>
    <script id="api-reference" type="application/json" data-url="/api/openapi.json"></script>
    <script src="/api/docs/scalar.js"></script>
  </body>
</html>
`;

/**
 * `GET /openapi.json` and `GET /docs`: the API description and its reference
 * page, where the endpoints can be tried and the description downloaded for
 * Postman. Unauthenticated: they hold no data.
 */
export function docsRouter({ auth }: { auth: Auth }): Router {
  const router = Router();
  let spec: Promise<object> | undefined;
  router.get("/openapi.json", async (_req, res) => {
    spec ??= withAuthRoutes(buildOpenApiSpec(), auth);
    res.json(await spec);
  });
  router.get("/docs", (_req, res) => {
    res.type("html").send(page);
  });
  router.get("/docs/scalar.js", (_req, res) => {
    res.sendFile(scalarBundle);
  });
  return router;
}

/** The spec with Better-Auth's sign-in routes, which it describes itself. */
async function withAuthRoutes(
  spec: ReturnType<typeof buildOpenApiSpec>,
  auth: Auth
) {
  const { paths, tags = [] } = await auth.api.generateOpenAPISchema();
  const authPaths = Object.fromEntries(
    Object.entries(paths).map(([path, item]) => [`/api/auth${path}`, item])
  );
  return {
    ...spec,
    tags: [...tags],
    paths: { ...authPaths, ...spec.paths },
  };
}
