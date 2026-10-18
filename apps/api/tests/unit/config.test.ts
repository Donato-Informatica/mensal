import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { readConfig } from "../../src/config.ts";

/** The placeholder `BETTER_AUTH_SECRET` a developer copies from `.env.example`. */
const exampleSecret = await (async () => {
  const example = await readFile(
    new URL("../../.env.example", import.meta.url),
    "utf8"
  );
  const [, secret] = /^BETTER_AUTH_SECRET=(.+)$/m.exec(example) ?? [];
  if (!secret) throw new Error(".env.example sets no BETTER_AUTH_SECRET");
  return secret;
})();

const development = {
  DATABASE_URL: "postgres://mensal:mensal@localhost:5432/mensal",
  BETTER_AUTH_URL: "http://localhost:5173",
  BETTER_AUTH_SECRET: exampleSecret,
};

describe("readConfig", () => {
  it("reads the database, the public origin, the secret and the port", () => {
    expect(readConfig({ ...development, PORT: "4000" })).toEqual({
      databaseURL: "postgres://mensal:mensal@localhost:5432/mensal",
      baseURL: "http://localhost:5173",
      secret: exampleSecret,
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

    it("refuses the secret from .env.example", () => {
      expect(() =>
        readConfig({ ...production, BETTER_AUTH_SECRET: exampleSecret })
      ).toThrow("BETTER_AUTH_SECRET must be");
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

  describe("email", () => {
    it("sends through Resend when both its key and the sender are set", () => {
      expect(
        readConfig({
          ...development,
          RESEND_API_KEY: "re_123",
          EMAIL_FROM: "Mensal <nao-responda@mensal.example>",
        }).email
      ).toEqual({
        apiKey: "re_123",
        from: "Mensal <nao-responda@mensal.example>",
      });
    });

    it("falls back to the console when neither is set, even in production", () => {
      expect(readConfig(development).email).toBeUndefined();
      expect(
        readConfig({
          NODE_ENV: "production",
          DATABASE_URL: "postgres://mensal:secret@db:5432/mensal",
          BETTER_AUTH_URL: "https://mensal.example",
          BETTER_AUTH_SECRET: "q3Vn8yJx0cR2tLw5ZbKp7HdMf9SgAe1U",
        }).email
      ).toBeUndefined();
    });

    it("refuses one without the other", () => {
      expect(() =>
        readConfig({ ...development, RESEND_API_KEY: "re_123" })
      ).toThrow("EMAIL_FROM is not set");
      expect(() =>
        readConfig({
          ...development,
          EMAIL_FROM: "Mensal <nao-responda@mensal.example>",
        })
      ).toThrow("RESEND_API_KEY is not set");
    });
  });

  it("lets development and test use the .env.example secret and plain http", () => {
    for (const NODE_ENV of [undefined, "development", "test"])
      expect(() => readConfig({ ...development, NODE_ENV })).not.toThrow();
  });
});
