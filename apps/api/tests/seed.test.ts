import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuth } from "../src/auth.ts";
import {
  assertLocalDatabase,
  assertNoRealUsers,
  demoUser,
  seed,
} from "../src/seed.ts";
import { request, startApi, type TestApi } from "./api.ts";

let api: TestApi;
beforeAll(async () => {
  api = await startApi();
});
afterAll(async () => {
  await api.close();
});

async function counts() {
  const { rows } = await api.db.$client.query<{ r: string; o: string }>(
    `SELECT (SELECT count(*) FROM recurrences WHERE user_id = u.id) AS r,
            (SELECT count(*) FROM occurrences WHERE user_id = u.id) AS o
     FROM users u WHERE u.email = $1`,
    [demoUser.email]
  );
  return { recurrences: Number(rows[0]!.r), occurrences: Number(rows[0]!.o) };
}

describe("seed", () => {
  it("creates an approved demo user who can sign in, and is re-runnable", async () => {
    const auth = createAuth({
      db: api.db,
      baseURL: api.url,
      secret: "integration-tests-secret-0123456789abcdef",
    });
    await seed(api.db, auth);
    const first = await counts();
    expect(first.recurrences).toBeGreaterThan(0);
    expect(first.occurrences).toBeGreaterThan(0);

    await seed(api.db, auth);
    expect(await counts()).toEqual(first);

    const signIn = await request(api, "/api/auth/sign-in/email", {
      body: { email: demoUser.email, password: demoUser.password },
    });
    expect(signIn.ok).toBe(true);
    const { rows } = await api.db.$client.query(
      "SELECT approved FROM users WHERE email = $1",
      [demoUser.email]
    );
    expect(rows).toEqual([{ approved: true }]);
  });

  it("refuses a non-local or production database", () => {
    expect(() =>
      assertLocalDatabase("postgres://u:p@db.example.com/x")
    ).toThrow(/local development only/);
    expect(() =>
      assertLocalDatabase("postgres://u:p@localhost/x", "production")
    ).toThrow(/local development only/);
    expect(() =>
      assertLocalDatabase("postgres://u:p@localhost/x", "development")
    ).not.toThrow();
  });

  it("refuses the preview opt-in once real users exist", async () => {
    await request(api, "/api/auth/sign-up/email", {
      body: {
        name: "Real",
        email: "real@example.com",
        password: "a-long-enough-password",
      },
    });
    await expect(assertNoRealUsers(api.db)).rejects.toThrow(
      /other than the demo/
    );
  });
});
