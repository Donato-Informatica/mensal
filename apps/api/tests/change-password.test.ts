import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ActivityEvent } from "../src/activity.ts";
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
const events: ActivityEvent[] = [];
let api: TestApi;
beforeAll(async () => {
  api = await startApi({
    // 14:03 in São Paulo.
    now: () => new Date("2026-10-17T17:03:00.000Z"),
    activity: (event) => events.push(event),
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
  events.length = 0;
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

  describe("what it revokes, as the user chooses", () => {
    const next = "a brand new passphrase";

    /** A user with a second device, two access tokens and a calendar link. */
    async function withDeviceAndTokens() {
      const { email, userId } = await signUp(api);
      await approve(api, email);
      const here = cookieFrom(await signIn(email, password));
      const elsewhere = cookieFrom(await signIn(email, password));
      for (const name of ["one", "two"]) {
        const created = await request(api, "/api/v1/access-tokens", {
          cookie: here,
          body: { name, currentPassword: password },
        });
        expect(created.status).toBe(201);
      }
      const generated = await request(api, "/api/v1/calendar-link", {
        cookie: here,
        body: { password },
      });
      expect(generated.status).toBe(201);
      const calendarLink: string = (await generated.json()).link.url;
      return { email, userId, here, elsewhere, calendarLink };
    }

    /** Whether the calendar link still answers. */
    async function calendarLinkWorks(calendarLink: string): Promise<boolean> {
      const { status } = await fetch(calendarLink);
      expect([200, 404]).toContain(status);
      return status === 200;
    }

    async function tokensOf(userId: string): Promise<number> {
      const { rows } = await api.db.$client.query(
        "SELECT count(*)::int AS n FROM apikeys WHERE reference_id = $1",
        [userId]
      );
      return rows[0].n;
    }

    const combinations = [
      {
        sessions: true,
        tokens: true,
        revoked: ["sessions", "access-tokens", "calendar-link"],
      },
      { sessions: true, tokens: false, revoked: ["sessions"] },
      {
        sessions: false,
        tokens: true,
        revoked: ["access-tokens", "calendar-link"],
      },
      { sessions: false, tokens: false, revoked: [] },
    ];
    it.each(combinations)(
      "sessions $sessions, tokens and calendar link $tokens: only that is revoked, this device stays signed in, and the activity says so",
      async ({ sessions, tokens, revoked }) => {
        const { email, userId, here, elsewhere, calendarLink } =
          await withDeviceAndTokens();

        const response = await changePassword(here, {
          currentPassword: password,
          newPassword: next,
          revokeOtherSessions: sessions,
          revokeAccessTokens: tokens,
        });

        expect(response.status).toBe(200);
        const current = response.headers.get("set-cookie")
          ? cookieFrom(response)
          : here;
        expect(await sessionOf(current)).toMatchObject({ user: { email } });
        expect((await sessionOf(elsewhere)) === null).toBe(sessions);
        expect(await tokensOf(userId)).toBe(tokens ? 0 : 2);
        expect(await calendarLinkWorks(calendarLink)).toBe(!tokens);
        expect(
          events.filter((event) => event.action === "user.password-changed")
        ).toEqual([
          expect.objectContaining({
            user: userId,
            action: "user.password-changed",
            revoked,
          }),
        ]);
      }
    );

    it.each([
      [
        true,
        true,
        "desconectados os outros dispositivos e revogados todos os tokens de acesso e o link do calendário",
      ],
      [
        true,
        false,
        "desconectados os outros dispositivos. Os tokens de acesso e o link do calendário continuam valendo",
      ],
      [
        false,
        true,
        "revogados todos os tokens de acesso e o link do calendário",
      ],
      [false, false, "Nada foi revogado"],
    ])(
      "emails what was revoked (sessions %s, tokens and calendar link %s)",
      async (sessions, tokens, phrase) => {
        const { here } = await withDeviceAndTokens();
        sent.length = 0;

        await changePassword(here, {
          currentPassword: password,
          newPassword: next,
          revokeOtherSessions: sessions,
          revokeAccessTokens: tokens,
        });

        expect(sent).toHaveLength(1);
        expect(sent[0]?.text).toContain(phrase);
        expect(sent[0]?.html).toContain(phrase);
        expect(sent[0]?.text).toContain(`${api.url}/esqueci-a-senha`);
      }
    );

    it("revokes nothing unless asked", async () => {
      const { userId, here, elsewhere, email, calendarLink } =
        await withDeviceAndTokens();

      await changePassword(here, {
        currentPassword: password,
        newPassword: next,
      });

      expect(await sessionOf(elsewhere)).toMatchObject({ user: { email } });
      expect(await tokensOf(userId)).toBe(2);
      expect(await calendarLinkWorks(calendarLink)).toBe(true);
    });

    it("keeps everything when the current password is wrong", async () => {
      const { userId, here, elsewhere, email, calendarLink } =
        await withDeviceAndTokens();

      const response = await changePassword(here, {
        currentPassword: "not my password",
        newPassword: next,
        revokeOtherSessions: true,
        revokeAccessTokens: true,
      });

      expect(response.status).toBe(400);
      expect(await sessionOf(elsewhere)).toMatchObject({ user: { email } });
      expect(await tokensOf(userId)).toBe(2);
      expect(await calendarLinkWorks(calendarLink)).toBe(true);
    });
  });
});
