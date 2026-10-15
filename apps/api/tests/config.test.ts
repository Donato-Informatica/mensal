import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { readConfig } from "../src/config.ts";

const development = {
  DATABASE_URL: "postgres://mensal:mensal@localhost:5432/mensal",
  BETTER_AUTH_URL: "http://localhost:5173",
  BETTER_AUTH_SECRET: "change-me-to-a-long-random-string",
};

describe("readConfig", () => {
  it("reads the database, the public origin, the secret and the port", () => {
    expect(readConfig({ ...development, PORT: "4000" })).toEqual({
      databaseUrl: "postgres://mensal:mensal@localhost:5432/mensal",
      baseURL: "http://localhost:5173",
      secret: "change-me-to-a-long-random-string",
      port: 4000,
    });
  });

  it("names a variable that is not set", () => {
    expect(() => readConfig({ ...development, DATABASE_URL: "" })).toThrow(
      "DATABASE_URL is not set"
    );
  });

  describe("in production", () => {
    const production = {
      NODE_ENV: "production",
      DATABASE_URL: "postgres://mensal:secret@db:5432/mensal",
      BETTER_AUTH_URL: "https://mensal.example",
      BETTER_AUTH_SECRET: "q3Vn8yJx0cR2tLw5ZbKp7HdMf9SgAe1U",
    };

    it("accepts an https origin and a secret of 32 characters", () => {
      expect(readConfig(production)).toMatchObject({
        baseURL: "https://mensal.example",
        secret: "q3Vn8yJx0cR2tLw5ZbKp7HdMf9SgAe1U",
      });
    });

    it("refuses the secret from .env.example", async () => {
      const example = await readFile(
        new URL("../.env.example", import.meta.url),
        "utf8"
      );
      const [, secret] = /^BETTER_AUTH_SECRET=(.*)$/m.exec(example) ?? [];

      expect(() =>
        readConfig({ ...production, BETTER_AUTH_SECRET: secret })
      ).toThrow("BETTER_AUTH_SECRET");
    });

    it("refuses a secret shorter than 32 characters", () => {
      expect(() =>
        readConfig({ ...production, BETTER_AUTH_SECRET: "x".repeat(31) })
      ).toThrow("BETTER_AUTH_SECRET");
    });

    it("refuses an origin that is not https", () => {
      expect(() =>
        readConfig({ ...production, BETTER_AUTH_URL: "http://mensal.example" })
      ).toThrow("BETTER_AUTH_URL");
    });
  });

  it("lets development and test use the .env.example secret and plain http", () => {
    for (const NODE_ENV of [undefined, "development", "test"])
      expect(() => readConfig({ ...development, NODE_ENV })).not.toThrow();
  });
});
