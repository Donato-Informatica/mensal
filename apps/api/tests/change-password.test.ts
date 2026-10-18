import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  approve,
  cookieFrom,
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

function signIn(email: string, withPassword: string) {
  return request(api, "/api/auth/sign-in/email", {
    body: { email, password: withPassword },
  });
}

function changePassword(cookie: string, body: Record<string, unknown>) {
  return request(api, "/api/auth/change-password", { cookie, body });
}

async function sessionOf(cookie: string) {
  return (await request(api, "/api/auth/get-session", { cookie })).json();
}

describe("changing the password", () => {
  it("replaces it, given the current one", async () => {
    const { cookie, email } = await signUp(api);
    await approve(api, email);

    const response = await changePassword(cookie, {
      currentPassword: password,
      newPassword: "a brand new passphrase",
    });

    expect(response.status).toBe(200);
    expect((await signIn(email, "a brand new passphrase")).status).toBe(200);
    expect((await signIn(email, password)).status).toBe(401);
  });

  it("refuses a wrong current password with 400 INVALID_PASSWORD, keeping the old one", async () => {
    const { cookie, email } = await signUp(api);

    const response = await changePassword(cookie, {
      currentPassword: "not my password",
      newPassword: "a brand new passphrase",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_PASSWORD" });
    expect((await signIn(email, password)).status).toBe(200);
  });

  it("signs the user out of their other devices, keeping this one, even when not asked to", async () => {
    const { email } = await signUp(api);
    const here = cookieFrom(await signIn(email, password));
    const elsewhere = cookieFrom(await signIn(email, password));

    const response = await changePassword(here, {
      currentPassword: password,
      newPassword: "a brand new passphrase",
      revokeOtherSessions: false,
    });

    expect(response.status).toBe(200);
    expect(await sessionOf(cookieFrom(response))).toMatchObject({
      user: { email },
    });
    expect(await sessionOf(elsewhere)).toBeNull();
  });
});
