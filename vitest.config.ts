import { defineConfig } from "vitest/config";

const integration = "apps/api/tests/**/*.test.ts";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["{apps,packages}/*/tests/**/*.test.{ts,tsx}"],
          exclude: [integration],
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
    ],
  },
});
