import { defineConfig } from "vitest/config";

// The API's tests run against Postgres, except the pure ones under tests/unit/.
const integration = "apps/api/tests/**/*.test.ts";
const apiUnit = "apps/api/tests/unit/**";
const integrationOutsideUnit = [
  "apps/api/tests/*.test.ts",
  "apps/api/tests/!(unit)/**",
];
const web = "apps/web/tests/**/*.test.{ts,tsx}";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["{apps,packages}/*/tests/**/*.test.{ts,tsx}"],
          exclude: [...integrationOutsideUnit, web],
        },
      },
      {
        // Integration tests against the docker-compose Postgres (`docker compose up -d`).
        test: {
          name: "api",
          include: [integration],
          exclude: [apiUnit],
          globalSetup: ["apps/api/tests/global-setup.ts"],
          // A test's sign-ups and password checks take it to ~3 s when every
          // worker runs at once, and over the 5 s default on a busy machine.
          testTimeout: 15_000,
          // The telemetry tests load the app in `beforeAll`, behind the module
          // hooks, whose own thread each import waits on: ~3 s on an idle
          // machine, but a minute with every core taken.
          hookTimeout: 120_000,
        },
      },
      {
        // The web app rendered in jsdom, with only the network faked.
        test: {
          name: "web",
          include: [web],
          environment: "jsdom",
          setupFiles: ["apps/web/tests/setup.ts"],
          // A whole-app render through a dialog takes ~3 s in jsdom alone, and
          // over the 5 s default when every worker runs at once.
          testTimeout: 15_000,
        },
      },
    ],
  },
});
