import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Email } from "../src/email.ts";
import {
  approve,
  cookieFrom,
  password,
  request,
  signUp,
  startApi,
  type TestApi,
} from "./api.ts";

const sent: Email[] = [];
let api: TestApi;
beforeAll(async () => {
  api = await startApi({
    // 14:03 in São Paulo.
    now: () => new Date("2026-10-17T17:03:00.000Z"),
    email: async (email) => {
      sent.push(email);
    },
  });
});
afterAll(async () => {
  await api.close();
});
beforeEach(() => {
  sent.length = 0;
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
    expect(sent).toEqual([]);
  });

  it("emails the user that their password was changed, when, and how to take it back", async () => {
    const { cookie, email } = await signUp(api);

    await changePassword(cookie, {
      currentPassword: password,
      newPassword: "a brand new passphrase",
    });

    expect(sent).toEqual([
      expect.objectContaining({
        to: email,
        subject: "Sua senha do Mensal foi alterada",
      }),
    ]);
    expect(sent[0]?.text).toContain("17/10/2026 às 14:03");
    expect(sent[0]?.text).toContain(`${api.url}/esqueci-a-senha`);
    expect(sent[0]?.html).toContain(`${api.url}/esqueci-a-senha`);
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
