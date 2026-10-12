import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  approve,
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

describe("/api/v1", () => {
  it("rejects a request without a session with 401", async () => {
    const response = await request(api, "/api/v1/me");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "UNAUTHENTICATED" });
  });

  it("rejects a signed-in user awaiting approval with 403 USER_NOT_APPROVED", async () => {
    const { cookie } = await signUp(api);

    const response = await request(api, "/api/v1/me", { cookie });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: "USER_NOT_APPROVED" });
  });

  it("lets an approved user through as themselves", async () => {
    const { cookie, userId, email } = await signUp(api);
    await approve(api, email);

    const response = await request(api, "/api/v1/me", { cookie });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId });
  });
});

describe("sign-up", () => {
  it("cannot approve the new user", async () => {
    const response = await request(api, "/api/auth/sign-up/email", {
      body: { name: "Test User", email: newEmail(), password, approved: true },
    });
    const cookie = cookieFrom(response);

    const me = await request(api, "/api/v1/me", { cookie });

    expect(response.status).toBe(200);
    expect(me.status).toBe(403);
  });
});

describe("sign-in", () => {
  it("opens a session in an HttpOnly, SameSite=Lax cookie", async () => {
    const { email } = await signUp(api);
    await approve(api, email);

    const response = await request(api, "/api/auth/sign-in/email", {
      body: { email, password },
    });

    expect(response.status).toBe(200);
    const [sessionCookie] = response.headers.getSetCookie();
    expect(sessionCookie).toMatch(/; HttpOnly/);
    expect(sessionCookie).toMatch(/; SameSite=Lax/);
    const me = await request(api, "/api/v1/me", {
      cookie: cookieFrom(response),
    });
    expect(me.status).toBe(200);
  });
});

describe("session", () => {
  it("tells whether the user is approved", async () => {
    const { cookie, email } = await signUp(api);

    const before = await request(api, "/api/auth/get-session", { cookie });
    await approve(api, email);
    const after = await request(api, "/api/auth/get-session", { cookie });

    expect((await before.json()).user.approved).toBe(false);
    expect((await after.json()).user.approved).toBe(true);
  });
});
