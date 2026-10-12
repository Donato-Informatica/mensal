import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  approve,
  newEmail,
  password,
  request,
  signUp,
  startApi,
  type TestApi,
} from "./api.ts";

const logged: string[] = [];
let api: TestApi;
beforeAll(async () => {
  api = await startApi({ log: (message) => logged.push(message) });
});
afterAll(async () => {
  await api.close();
});

/** Requests a reset for `email` and returns the URL it wrote to the log. */
async function requestReset(email: string): Promise<URL> {
  const before = logged.length;
  const response = await request(api, "/api/auth/request-password-reset", {
    body: { email, redirectTo: "/redefinir-senha" },
  });
  expect(response.status).toBe(200);
  const [message] = logged.slice(before);
  expect(message).toContain(email);
  const [url] = /https?:\/\/\S+/.exec(message ?? "") ?? [];
  if (!url) throw new Error(`no URL in the log: ${message}`);
  return new URL(url);
}

function signIn(email: string, withPassword: string) {
  return request(api, "/api/auth/sign-in/email", {
    body: { email, password: withPassword },
  });
}

describe("password reset", () => {
  it("logs a link that opens the reset screen with a token that sets a new password", async () => {
    const { email } = await signUp(api);
    await approve(api, email);

    const link = await requestReset(email);
    const opened = await fetch(link, { redirect: "manual" });
    const screen = new URL(opened.headers.get("location") ?? "", api.url);
    const token = screen.searchParams.get("token");
    const reset = await request(api, "/api/auth/reset-password", {
      body: { token, newPassword: "a brand new passphrase" },
    });

    expect(link.origin).toBe(api.url);
    expect(opened.status).toBe(302);
    expect(screen.pathname).toBe("/redefinir-senha");
    expect(reset.status).toBe(200);
    expect((await signIn(email, "a brand new passphrase")).status).toBe(200);
    expect((await signIn(email, password)).status).toBe(401);
  });

  it("logs nothing for an unknown email, and answers as if it had", async () => {
    const before = logged.length;

    const response = await request(api, "/api/auth/request-password-reset", {
      body: { email: newEmail(), redirectTo: "/redefinir-senha" },
    });

    expect(response.status).toBe(200);
    expect(logged.slice(before)).toEqual([]);
  });
});
