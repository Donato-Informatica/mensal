import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ActivityEvent } from "../src/activity.ts";
import {
  newEmail,
  password,
  request,
  signUp,
  startApi,
  type TestApi,
} from "./api.ts";

const at = "2026-10-16T14:03:00.000Z";

const events: ActivityEvent[] = [];
/** The free-text log, where password-reset links keep going. */
const logLines: string[] = [];
let api: TestApi;
beforeAll(async () => {
  api = await startApi({
    now: () => new Date(at),
    activity: (event) => events.push(event),
    log: (line) => logLines.push(line),
  });
});
afterAll(async () => {
  await api.close();
});

/** What gets logged while `act` runs. */
async function loggedBy(act: () => Promise<unknown>) {
  const before = events.length;
  await act();
  return events.slice(before);
}

describe("account events in the activity log (PRD §8.7)", () => {
  it("logs a sign-up with the new user's id", async () => {
    let userId = "";

    const logged = await loggedBy(async () => {
      const response = await request(api, "/api/auth/sign-up/email", {
        body: { name: "Test User", email: newEmail(), password },
      });
      ({
        user: { id: userId },
      } = await response.json());
    });

    expect(logged).toEqual([{ at, user: userId, action: "user.sign-up" }]);
  });

  it("logs a sign-in with the user's id", async () => {
    const { userId, email } = await signUp(api);

    const logged = await loggedBy(() =>
      request(api, "/api/auth/sign-in/email", { body: { email, password } })
    );

    expect(logged).toEqual([{ at, user: userId, action: "user.sign-in" }]);
  });

  it("logs a wrong password with the attempted email and the client's address", async () => {
    const { email } = await signUp(api);

    const logged = await loggedBy(() =>
      request(api, "/api/auth/sign-in/email", {
        body: { email, password: "not the password" },
        ip: "203.0.113.7",
      })
    );

    expect(logged).toEqual([
      { at, action: "user.sign-in-failed", email, ip: "203.0.113.7" },
    ]);
  });

  it("logs an unknown email as a failed sign-in too", async () => {
    const email = newEmail();

    const logged = await loggedBy(() =>
      request(api, "/api/auth/sign-in/email", {
        body: { email, password },
        ip: "203.0.113.7",
      })
    );

    expect(logged).toEqual([
      { at, action: "user.sign-in-failed", email, ip: "203.0.113.7" },
    ]);
  });

  it("logs nothing for a sign-in refused before any credential is checked", async () => {
    const statuses: number[] = [];

    const logged = await loggedBy(async () => {
      for (const body of [
        { email: "not an email", password },
        { password },
        { email: newEmail() },
      ]) {
        const response = await request(api, "/api/auth/sign-in/email", {
          body,
        });
        statuses.push(response.status);
      }
    });

    expect(statuses).toEqual([400, 400, 400]);
    expect(logged).toEqual([]);
  });

  it("logs nothing for the other auth endpoints", async () => {
    const { cookie, email } = await signUp(api);

    const statuses: number[] = [];
    const send = async (...args: Parameters<typeof request>) => {
      statuses.push((await request(...args)).status);
    };
    const logged = await loggedBy(async () => {
      await send(api, "/api/auth/get-session", { cookie });
      await send(api, "/api/auth/update-user", {
        cookie,
        body: { showSummary: false },
      });
      await send(api, "/api/auth/request-password-reset", {
        body: { email, redirectTo: "/redefinir-senha" },
      });
      await send(api, "/api/auth/sign-out", { cookie, body: {} });
    });

    expect(statuses).toEqual([200, 200, 200, 200]);
    expect(logged).toEqual([]);
    expect(logLines).toEqual([
      expect.stringContaining(
        `Email to ${email}: Redefinir sua senha do Mensal`
      ),
    ]);
  });
});
