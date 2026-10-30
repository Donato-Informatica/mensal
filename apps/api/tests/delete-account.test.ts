import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
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
import { insertOccurrence, insertRecurrence } from "./fixtures.ts";

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

function deleteAccount(cookie: string, body: Record<string, unknown>) {
  return request(api, "/api/auth/delete-user", { cookie, body });
}

function signIn(email: string) {
  return request(api, "/api/auth/sign-in/email", {
    body: { email, password },
  });
}

describe("deleting the account (PRD §5.13, ADR-0005)", () => {
  it("deletes the user at once, given the current password", async () => {
    const { cookie, email } = await signUp(api);
    await approve(api, email);

    const response = await deleteAccount(cookie, { password });

    expect(response.status).toBe(200);
    expect((await signIn(email)).status).toBe(401);
  });

  it("refuses a wrong password with 400 INVALID_PASSWORD, deleting nothing", async () => {
    const { cookie, email } = await signUp(api);

    const response = await deleteAccount(cookie, {
      password: "not my password",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_PASSWORD" });
    expect((await signIn(email)).status).toBe(200);
    expect(sent).toEqual([]);
    expect(events.filter(({ action }) => action === "user.deleted")).toEqual(
      []
    );
  });

  it("requires the password: a fresh session alone deletes nothing", async () => {
    const { cookie, email } = await signUp(api);

    for (const body of [{}, { password: "" }]) {
      const response = await deleteAccount(cookie, body);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "INVALID_PASSWORD" });
    }
    expect((await signIn(email)).status).toBe(200);
  });

  /**
   * An approved user with a second device, an access token, a calendar link,
   * reminders on for one device, a recurrence with a persisted occurrence of its own, and a one-off.
   */
  async function userWithEverything() {
    const user = await signUp(api);
    await approve(api, user.email);
    const elsewhere = cookieFrom(await signIn(user.email));
    const created = await request(api, "/api/v1/access-tokens", {
      cookie: user.cookie,
      body: { name: "Claude Code", currentPassword: password },
    });
    expect(created.status).toBe(201);
    const { token } = (await created.json()) as { token: string };
    const generated = await request(api, "/api/v1/calendar-link", {
      cookie: user.cookie,
      body: { password },
    });
    expect(generated.status).toBe(201);
    const calendarLink: string = (await generated.json()).link.url;
    const turnedOn = await request(api, "/api/v1/reminders/device", {
      cookie: user.cookie,
      method: "PUT",
      body: {
        endpoint: `https://push.example/send/${user.userId}`,
        keys: { p256dh: "p256dh", auth: "auth" },
      },
    });
    expect(turnedOn.status).toBe(200);
    const recurrence = await insertRecurrence(api.db, { userId: user.userId });
    await insertOccurrence(api.db, {
      userId: user.userId,
      recurrenceId: recurrence.id,
    });
    await insertOccurrence(api.db, { userId: user.userId });
    return { ...user, elsewhere, token, calendarLink };
  }

  /** How many rows of each table belong to the user. */
  async function rowsOf(userId: string) {
    const { rows } = await api.db.$client.query(
      `SELECT
         (SELECT count(*)::int FROM users WHERE id = $1) AS users,
         (SELECT count(*)::int FROM sessions WHERE user_id = $1) AS sessions,
         (SELECT count(*)::int FROM accounts WHERE user_id = $1) AS accounts,
         (SELECT count(*)::int FROM recurrences WHERE user_id = $1) AS recurrences,
         (SELECT count(*)::int FROM occurrences WHERE user_id = $1) AS occurrences,
         (SELECT count(*)::int FROM apikeys WHERE reference_id = $1) AS apikeys,
         (SELECT count(*)::int FROM calendar_links WHERE user_id = $1) AS "calendarLinks",
         (SELECT count(*)::int FROM reminder_devices WHERE user_id = $1) AS "reminderDevices"`,
      [userId]
    );
    return rows[0];
  }

  it("leaves no row of the user in any table, and leaves another user's untouched", async () => {
    const leaving = await userWithEverything();
    const staying = await userWithEverything();
    const before = await rowsOf(staying.userId);

    const response = await deleteAccount(leaving.cookie, { password });

    expect(response.status).toBe(200);
    expect(await rowsOf(leaving.userId)).toEqual({
      users: 0,
      sessions: 0,
      accounts: 0,
      recurrences: 0,
      occurrences: 0,
      apikeys: 0,
      calendarLinks: 0,
      reminderDevices: 0,
    });
    expect(await rowsOf(staying.userId)).toEqual(before);
    expect(before).toEqual({
      users: 1,
      sessions: 2,
      accounts: 1,
      recurrences: 1,
      occurrences: 2,
      apikeys: 1,
      calendarLinks: 1,
      reminderDevices: 1,
    });
  });

  it("signs the user out of every device", async () => {
    const { cookie, elsewhere } = await userWithEverything();

    await deleteAccount(cookie, { password });

    for (const device of [cookie, elsewhere]) {
      const session = await request(api, "/api/auth/get-session", {
        cookie: device,
      });
      expect(await session.json()).toBeNull();
      const period = await request(api, "/api/v1/periods/2026-10", {
        cookie: device,
      });
      expect(period.status).toBe(401);
    }
  });

  it("stops the user's access token working on /api/mcp", async () => {
    const { cookie, token } = await userWithEverything();
    expect((await mcpPing(token)).status).toBe(200);

    await deleteAccount(cookie, { password });

    expect((await mcpPing(token)).status).toBe(401);
  });

  it("stops the user's calendar link working", async () => {
    const { cookie, calendarLink } = await userWithEverything();
    expect((await fetch(calendarLink)).status).toBe(200);

    await deleteAccount(cookie, { password });

    expect((await fetch(calendarLink)).status).toBe(404);
  });

  it("lets the same email sign up again, as a new user awaiting approval", async () => {
    const { cookie, email, userId } = await userWithEverything();
    await deleteAccount(cookie, { password });

    const again = await signUp(api, email);

    expect(again.userId).not.toBe(userId);
    const session = await request(api, "/api/auth/get-session", {
      cookie: again.cookie,
    });
    expect(await session.json()).toMatchObject({
      user: { email, approved: false },
    });
    const period = await request(api, "/api/v1/periods/2026-10", {
      cookie: again.cookie,
    });
    expect(period.status).toBe(403);
  });

  it("logs user.deleted with the user's id only (PRD §8.7)", async () => {
    const { cookie, userId } = await userWithEverything();
    events.length = 0;

    await deleteAccount(cookie, { password });

    expect(events).toEqual([
      { at: "2026-10-17T17:03:00.000Z", user: userId, action: "user.deleted" },
    ]);
  });

  it("emails the user a goodbye, saying when and what was erased, with no links", async () => {
    const { cookie, email } = await userWithEverything();

    await deleteAccount(cookie, { password });

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const [goodbye] = sent as [Email];
    expect(goodbye).toMatchObject({
      to: email,
      subject: "Sua conta do Mensal foi excluída",
    });
    for (const body of [goodbye.text, goodbye.html]) {
      expect(body).toContain("17/10/2026 às 14:03");
      expect(body).toContain("recorrências");
      expect(body).toContain("tokens de acesso");
      expect(body).toContain("link do calendário");
      expect(body).toContain("Se não foi você, responda este e-mail");
      expect(body).not.toMatch(/https?:\/\//);
    }
    expect(goodbye.html).not.toContain("<a ");
  });
});

describe("the goodbye email", () => {
  it("is not waited for, and a failure to send it is logged and deletes the account all the same", async () => {
    const logged: string[] = [];
    let fail: (error: Error) => void = () => {};
    const failing = await startApi({
      log: (line) => logged.push(line),
      // Never answers until told to fail.
      email: () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    });
    try {
      const { cookie, email } = await signUp(failing);

      const response = await request(failing, "/api/auth/delete-user", {
        cookie,
        body: { password },
      });
      expect(response.status).toBe(200);
      fail(new Error("Resend is down"));

      await vi.waitFor(() =>
        expect(logged.join("\n")).toContain("Resend is down")
      );
      const signIn = await request(failing, "/api/auth/sign-in/email", {
        body: { email, password },
      });
      expect(signIn.status).toBe(401);
    } finally {
      await failing.close();
    }
  });
});

function mcpPing(token: string) {
  return fetch(`${api.url}/api/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
  });
}
