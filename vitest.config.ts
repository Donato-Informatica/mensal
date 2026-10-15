import { defineConfig } from "vitest/config";

const integration = "apps/api/tests/**/*.test.ts";
const web = "apps/web/tests/**/*.test.{ts,tsx}";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["{apps,packages}/*/tests/**/*.test.{ts,tsx}"],
          exclude: [integration, web],
        },
      },
      {
        // Integration tests against the docker-compose Postgres (`docker compose up -d`).
        test: {
          name: "api",
          include: [integration],
          globalSetup: ["apps/api/tests/global-setup.ts"],
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
