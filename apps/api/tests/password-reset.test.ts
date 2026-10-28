import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Email } from "../src/email.ts";
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

const logged: string[] = [];
const sent: Email[] = [];
/** Makes the next email fail to send, as Resend would. */
let failNextEmail = false;
let api: TestApi;
beforeAll(async () => {
  api = await startApi({
    log: (message) => logged.push(message),
    email: async (email) => {
      if (failNextEmail) {
        failNextEmail = false;
        throw new Error("Resend answered 500");
      }
      sent.push(email);
    },
  });
});
afterAll(async () => {
  await api.close();
});
beforeEach(() => {
  logged.length = 0;
  sent.length = 0;
});

/** Requests a reset for `email` and returns the link it emailed. */
async function requestReset(email: string): Promise<URL> {
  const response = await request(api, "/api/auth/request-password-reset", {
    body: { email, redirectTo: "/redefinir-senha" },
  });
  expect(response.status).toBe(200);
  const message = sent.find((each) => each.to === email);
  const [url] = /https?:\/\/\S+/.exec(message?.text ?? "") ?? [];
  if (!url) throw new Error(`no link emailed to ${email}`);
  return new URL(url);
}

/** Follows an emailed link to the token the reset screen receives. */
async function tokenFrom(link: URL): Promise<string> {
  const opened = await fetch(link, { redirect: "manual" });
  const screen = new URL(opened.headers.get("location") ?? "", api.url);
  expect(opened.status).toBe(302);
  expect(screen.pathname).toBe("/redefinir-senha");
  return screen.searchParams.get("token") ?? "";
}

function resetPassword(token: string, newPassword: string) {
  return request(api, "/api/auth/reset-password", {
    body: { token, newPassword },
  });
}

function signIn(email: string, withPassword: string) {
  return request(api, "/api/auth/sign-in/email", {
    body: { email, password: withPassword },
  });
}

describe("password reset", () => {
  it("emails a link that opens the reset screen with a token that sets a new password", async () => {
    const { email } = await signUp(api);
    await approve(api, email);

    const link = await requestReset(email);
    const reset = await resetPassword(
      await tokenFrom(link),
      "a brand new passphrase"
    );

    expect(link.origin).toBe(api.url);
    expect(sent[0]).toMatchObject({
      to: email,
      subject: "Redefinir sua senha do Mensal",
    });
    expect(sent[0]?.html).toContain(link.href.replaceAll("&", "&amp;"));
    expect(reset.status).toBe(200);
    expect((await signIn(email, "a brand new passphrase")).status).toBe(200);
    expect((await signIn(email, password)).status).toBe(401);
  });

  it("never writes the link to the log", async () => {
    const { email } = await signUp(api);

    const link = await requestReset(email);

    expect(logged.join("\n")).not.toContain(link.href);
  });

  it("emails a user who is still awaiting approval too", async () => {
    const { email } = await signUp(api);

    await requestReset(email);

    expect(sent.map((each) => each.to)).toEqual([email]);
  });

  it("emails nothing for an unknown email, and answers as if it had", async () => {
    const response = await request(api, "/api/auth/request-password-reset", {
      body: { email: newEmail(), redirectTo: "/redefinir-senha" },
    });

    expect(response.status).toBe(200);
    expect(sent).toEqual([]);
  });

  it("answers as usual when the email fails to send, logging the failure without the link", async () => {
    const { email } = await signUp(api);
    failNextEmail = true;

    const response = await request(api, "/api/auth/request-password-reset", {
      body: { email, redirectTo: "/redefinir-senha" },
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(response.status).toBe(200);
    expect(logged).toEqual([expect.stringContaining("Resend answered 500")]);
    expect(logged.join("\n")).not.toMatch(/https?:\/\//);
  });

  it("then emails the user that their password was changed", async () => {
    const { email } = await signUp(api);
    const link = await requestReset(email);
    sent.length = 0;

    await resetPassword(await tokenFrom(link), "a brand new passphrase");

    expect(sent).toEqual([
      expect.objectContaining({
        to: email,
        subject: "Sua senha do Mensal foi alterada",
      }),
    ]);
    for (const body of [sent[0]?.text, sent[0]?.html]) {
      expect(body).toContain(
        "revogados todos os tokens de acesso e o link do calendário"
      );
    }
  });

  it("signs the user out of every device", async () => {
    const { email } = await signUp(api);
    const device = cookieFrom(await signIn(email, password));

    const link = await requestReset(email);
    await resetPassword(await tokenFrom(link), "a brand new passphrase");
    const session = await request(api, "/api/auth/get-session", {
      cookie: device,
    });

    expect(await session.json()).toBeNull();
  });

  it("deactivates the user's calendar link, and only theirs", async () => {
    const { email, cookie } = await signUp(api);
    await approve(api, email);
    const other = await signUp(api);
    await approve(api, other.email);
    const link = await calendarLink(cookie);
    const otherLink = await calendarLink(other.cookie);
    expect((await fetch(link)).status).toBe(200);

    const reset = await requestReset(email);
    await resetPassword(await tokenFrom(reset), "a brand new passphrase");

    expect((await fetch(link)).status).toBe(404);
    expect((await fetch(otherLink)).status).toBe(200);
  });
});

/** Generates the user's calendar link and returns its URL. */
async function calendarLink(cookie: string): Promise<string> {
  const response = await request(api, "/api/v1/calendar-link", {
    cookie,
    body: { password },
  });
  expect(response.status).toBe(201);
  return (await response.json()).link.url;
}
