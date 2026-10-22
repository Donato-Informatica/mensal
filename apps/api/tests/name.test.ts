import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  newEmail,
  password,
  request,
  signUp,
  startApi,
  type TestApi,
} from "./api.ts";

let api: TestApi;
beforeAll(async () => {
  api = await startApi();
});
afterAll(async () => {
  await api.close();
});

async function nameOf(cookie: string) {
  const response = await request(api, "/api/auth/get-session", { cookie });
  return (await response.json()).user.name;
}

async function accountExists(email: string) {
  const { rowCount } = await api.db.$client.query(
    "SELECT 1 FROM users WHERE email = $1",
    [email]
  );
  return rowCount === 1;
}

const refusedNames = [
  ["blank", "   "],
  ["empty", ""],
  ["longer than 100 characters", "a".repeat(101)],
];

describe("the user's name (PRD §8.2)", () => {
  it("is trimmed at sign-up", async () => {
    const response = await request(api, "/api/auth/sign-up/email", {
      body: { name: "  Ana Paula  ", email: newEmail(), password },
    });

    expect(response.status).toBe(200);
    expect((await response.json()).user.name).toBe("Ana Paula");
  });

  it("may be 100 characters long", async () => {
    const response = await request(api, "/api/auth/sign-up/email", {
      body: { name: "a".repeat(100), email: newEmail(), password },
    });

    expect(response.status).toBe(200);
  });

  it.each(refusedNames)(
    "refuses a sign-up with a name that is %s",
    async (_, name) => {
      const email = newEmail();

      const response = await request(api, "/api/auth/sign-up/email", {
        body: { name, email, password },
      });

      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("INVALID_NAME");
      expect(await accountExists(email)).toBe(false);
    }
  );

  it("is changed by the user through update-user, trimmed", async () => {
    const { cookie } = await signUp(api);

    const response = await request(api, "/api/auth/update-user", {
      cookie,
      body: { name: "  Ana Paula Souza " },
    });

    expect(response.status).toBe(200);
    expect(await nameOf(cookie)).toBe("Ana Paula Souza");
  });

  it.each(refusedNames)(
    "refuses a change to a name that is %s",
    async (_, name) => {
      const { cookie } = await signUp(api);

      const response = await request(api, "/api/auth/update-user", {
        cookie,
        body: { name },
      });

      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("INVALID_NAME");
      expect(await nameOf(cookie)).toBe("Test User");
    }
  );

  it("stays as it is when update-user changes only a preference", async () => {
    const { cookie } = await signUp(api);

    const response = await request(api, "/api/auth/update-user", {
      cookie,
      body: { showSummary: false },
    });

    expect(response.status).toBe(200);
    expect(await nameOf(cookie)).toBe("Test User");
  });
});
