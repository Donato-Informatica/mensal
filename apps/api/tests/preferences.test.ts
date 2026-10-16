import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cookieFrom,
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

async function sessionUser(cookie: string) {
  const response = await request(api, "/api/auth/get-session", { cookie });
  return (await response.json()).user;
}

describe("preferences (PRD §3.5)", () => {
  it("are all on, in the dark theme, for a new user", async () => {
    const { cookie } = await signUp(api);

    expect(await sessionUser(cookie)).toMatchObject({
      showSummary: true,
      confirmStatusChanges: true,
      colorScheme: "dark",
    });
  });

  it("are changed by the user through update-user", async () => {
    const { cookie } = await signUp(api);

    const response = await request(api, "/api/auth/update-user", {
      cookie,
      body: { showSummary: false, confirmStatusChanges: false },
    });

    expect(response.status).toBe(200);
    expect(await sessionUser(cookie)).toMatchObject({
      showSummary: false,
      confirmStatusChanges: false,
    });
  });

  it.each(["light", "auto", "dark"])(
    "include the theme, which the user can set to %s",
    async (colorScheme) => {
      const { cookie } = await signUp(api);
      // From another value, so "dark" too is a change.
      await request(api, "/api/auth/update-user", {
        cookie,
        body: { colorScheme: colorScheme === "light" ? "auto" : "light" },
      });

      const response = await request(api, "/api/auth/update-user", {
        cookie,
        body: { colorScheme },
      });

      expect(response.status).toBe(200);
      expect((await sessionUser(cookie)).colorScheme).toBe(colorScheme);
    }
  );

  it("reject a theme that is not dark, light or auto", async () => {
    const { cookie } = await signUp(api);
    await request(api, "/api/auth/update-user", {
      cookie,
      body: { colorScheme: "light" },
    });

    const response = await request(api, "/api/auth/update-user", {
      cookie,
      body: { colorScheme: "sepia" },
    });

    expect(response.status).toBe(400);
    expect((await sessionUser(cookie)).colorScheme).toBe("light");
  });

  it("leave approval out of the user's reach", async () => {
    const { cookie } = await signUp(api);

    await request(api, "/api/auth/update-user", {
      cookie,
      body: { approved: true },
    });

    expect((await sessionUser(cookie)).approved).toBe(false);
    const me = await request(api, "/api/v1/me", { cookie });
    expect(me.status).toBe(403);
  });

  it("leave approval out of reach at sign-up too", async () => {
    const response = await request(api, "/api/auth/sign-up/email", {
      body: { name: "Test User", email: newEmail(), password, approved: true },
    });
    const cookie = cookieFrom(response);

    expect((await sessionUser(cookie)).approved).toBe(false);
    const me = await request(api, "/api/v1/me", { cookie });
    expect(me.status).toBe(403);
  });
});
