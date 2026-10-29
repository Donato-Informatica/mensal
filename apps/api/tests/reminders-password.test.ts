import { randomUUID } from "node:crypto";
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

// What a password reset or change does to reminder devices (PRD §8.2, §6.8).

const sent: Email[] = [];
let api: TestApi;
beforeAll(async () => {
  api = await startApi({
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

const next = "a brand new passphrase";

function signIn(email: string, withPassword = password) {
  return request(api, "/api/auth/sign-in/email", {
    body: { email, password: withPassword },
  });
}

/** Turns reminders on for a new browser registration; returns its endpoint. */
async function turnOn(cookie: string): Promise<string> {
  const endpoint = `https://push.example/send/${randomUUID()}`;
  const response = await request(api, "/api/v1/reminders/device", {
    cookie,
    method: "PUT",
    body: {
      endpoint,
      keys: { p256dh: `p256dh-${randomUUID()}`, auth: `auth-${randomUUID()}` },
    },
  });
  expect(response.status).toBe(200);
  return endpoint;
}

async function deviceCount(cookie: string): Promise<number> {
  const response = await request(api, "/api/v1/reminders", { cookie });
  expect(response.status).toBe(200);
  return (await response.json()).deviceCount;
}

async function isMine(cookie: string, endpoint: string): Promise<boolean> {
  const response = await request(api, "/api/v1/reminders/device/check", {
    cookie,
    body: { endpoint },
  });
  expect(response.status).toBe(200);
  return (await response.json()).mine;
}

/** An approved user with reminders on in two browsers, each signed in. */
async function withTwoDevices() {
  const { email } = await signUp(api);
  await approve(api, email);
  const here = cookieFrom(await signIn(email));
  const elsewhere = cookieFrom(await signIn(email));
  const hereEndpoint = await turnOn(here);
  const elsewhereEndpoint = await turnOn(elsewhere);
  return { email, here, elsewhere, hereEndpoint, elsewhereEndpoint };
}

function changePassword(cookie: string, revokeOtherSessions: boolean) {
  return request(api, "/api/auth/change-password", {
    cookie,
    body: { currentPassword: password, newPassword: next, revokeOtherSessions },
  });
}

/** The cookie this browser holds after a change, which may start a session. */
function cookieAfter(response: Response, before: string): string {
  return response.headers.get("set-cookie") ? cookieFrom(response) : before;
}

describe("a password reset", () => {
  async function resetPassword(email: string) {
    const requested = await request(api, "/api/auth/request-password-reset", {
      body: { email, redirectTo: "/redefinir-senha" },
    });
    expect(requested.status).toBe(200);
    const text = sent.find((each) => each.to === email)?.text ?? "";
    const link = /https?:\/\/\S+/.exec(text)?.[0] ?? "";
    const opened = await fetch(link, { redirect: "manual" });
    const screen = new URL(opened.headers.get("location") ?? "", api.url);
    const token = screen.searchParams.get("token") ?? "";
    const reset = await request(api, "/api/auth/reset-password", {
      body: { token, newPassword: next },
    });
    expect(reset.status).toBe(200);
  }

  it("turns reminders off on every device of the user", async () => {
    const { email } = await withTwoDevices();

    await resetPassword(email);

    const signedIn = cookieFrom(await signIn(email, next));
    expect(await deviceCount(signedIn)).toBe(0);
  });
});

describe("a password change", () => {
  it("with Desconectar dos outros dispositivos checked keeps reminders only on this device", async () => {
    const { here, hereEndpoint, elsewhereEndpoint } = await withTwoDevices();

    const response = await changePassword(here, true);

    expect(response.status).toBe(200);
    const current = cookieAfter(response, here);
    expect(await deviceCount(current)).toBe(1);
    expect(await isMine(current, hereEndpoint)).toBe(true);
    expect(await isMine(current, elsewhereEndpoint)).toBe(false);
  });

  it("binds this device's reminders to the session the change starts", async () => {
    const { here, hereEndpoint } = await withTwoDevices();
    const first = await changePassword(here, true);
    const current = cookieAfter(first, here);

    // A second change from the new session, before any check rebinds it.
    const second = await request(api, "/api/auth/change-password", {
      cookie: current,
      body: {
        currentPassword: next,
        newPassword: "yet another passphrase",
        revokeOtherSessions: true,
      },
    });

    expect(second.status).toBe(200);
    const latest = cookieAfter(second, current);
    expect(await deviceCount(latest)).toBe(1);
    expect(await isMine(latest, hereEndpoint)).toBe(true);
  });

  it("with the box unchecked keeps reminders on every device", async () => {
    const { here } = await withTwoDevices();

    const response = await changePassword(here, false);

    expect(response.status).toBe(200);
    expect(await deviceCount(here)).toBe(2);
  });
});
