import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ActivityEvent } from "../src/activity.ts";
import type { Email } from "../src/email.ts";
import {
  approve,
  password,
  request,
  signUp,
  startApi,
  type TestApi,
} from "./api.ts";

const events: ActivityEvent[] = [];
const sent: Email[] = [];
let api: TestApi;
beforeAll(async () => {
  api = await startApi({
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
  events.length = 0;
  sent.length = 0;
});

async function approvedUser() {
  const user = await signUp(api);
  await approve(api, user.email);
  return user;
}

function createToken(cookie: string, body: Record<string, unknown> = {}) {
  return request(api, "/api/v1/access-tokens", {
    cookie,
    body: { name: "Claude Code", currentPassword: password, ...body },
  });
}

async function created(cookie: string, name = "Claude Code") {
  const response = await createToken(cookie, { name });
  expect(response.status).toBe(201);
  return (await response.json()) as {
    id: string;
    name: string;
    prefix: string;
    createdAt: string;
    lastUsedAt: string | null;
    token: string;
  };
}

async function listed(cookie: string) {
  const response = await request(api, "/api/v1/access-tokens", { cookie });
  expect(response.status).toBe(200);
  return (await response.json()) as { id: string }[];
}

async function tokensOf(userId: string): Promise<number> {
  const { rows } = await api.db.$client.query(
    "SELECT count(*)::int AS n FROM apikeys WHERE reference_id = $1",
    [userId]
  );
  return rows[0].n;
}

describe("creating an access token", () => {
  it("answers 201 with the token's fields and the full secret, given the password", async () => {
    const { cookie } = await approvedUser();

    const response = await createToken(cookie, { name: "Claude Code" });

    expect(response.status).toBe(201);
    const token = await response.json();
    expect(token).toEqual({
      id: expect.any(String),
      name: "Claude Code",
      prefix: expect.stringMatching(/^mensal_\w{4}$/),
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      lastUsedAt: null,
      token: expect.stringMatching(/^mensal_\w{20,}$/),
    });
    expect(token.token.startsWith(token.prefix)).toBe(true);
  });

  it("refuses a wrong current password with 400 INVALID_PASSWORD, creating nothing", async () => {
    const { cookie, userId } = await approvedUser();
    events.length = 0;

    const response = await createToken(cookie, {
      currentPassword: "not my password",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "INVALID_PASSWORD" });
    expect(await tokensOf(userId)).toBe(0);
    expect(events).toEqual([]);
  });

  it("answers 429 TOO_MANY_ATTEMPTS after 5 wrong passwords in a minute, even for the right one, and only for that user", async () => {
    const { cookie, userId } = await approvedUser();
    const other = await approvedUser();

    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push(
        (await createToken(cookie, { currentPassword: "not my password" }))
          .status
      );
    }
    const blocked = await createToken(cookie);

    expect(statuses).toEqual([400, 400, 400, 400, 400]);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ code: "TOO_MANY_ATTEMPTS" });
    expect(await tokensOf(userId)).toBe(0);
    expect((await createToken(other.cookie)).status).toBe(201);
  });

  it("refuses a name that is missing, empty or too long with 400 INVALID_INPUT", async () => {
    const { cookie, userId } = await approvedUser();

    for (const body of [
      { currentPassword: password },
      { name: "   ", currentPassword: password },
      { name: "x".repeat(33), currentPassword: password },
      { name: "ok" },
    ]) {
      const response = await request(api, "/api/v1/access-tokens", {
        cookie,
        body,
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "INVALID_INPUT" });
    }
    expect(await tokensOf(userId)).toBe(0);
  });

  it("limits each token to 120 requests a minute", async () => {
    const { cookie } = await approvedUser();

    const { id } = await created(cookie);

    const { rows } = await api.db.$client.query(
      "SELECT rate_limit_enabled, rate_limit_max, rate_limit_time_window FROM apikeys WHERE id = $1",
      [id]
    );
    expect(rows).toEqual([
      {
        rate_limit_enabled: true,
        rate_limit_max: 120,
        rate_limit_time_window: 60_000,
      },
    ]);
  });

  it("logs user.access-token-created with the token's id and never the secret", async () => {
    const { cookie, userId } = await approvedUser();
    events.length = 0;

    const { id, token } = await created(cookie);

    expect(events).toEqual([
      {
        at: expect.any(String),
        user: userId,
        action: "user.access-token-created",
        id,
      },
    ]);
    expect(JSON.stringify(events)).not.toContain(token);
  });
});

describe("listing access tokens", () => {
  it("shows each token without its secret", async () => {
    const { cookie } = await approvedUser();
    const first = await created(cookie, "Claude Code");
    const second = await created(cookie, "Codex");

    const response = await request(api, "/api/v1/access-tokens", { cookie });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(2);
    expect(body).toEqual(
      expect.arrayContaining([
        {
          id: first.id,
          name: "Claude Code",
          prefix: first.prefix,
          createdAt: first.createdAt,
          lastUsedAt: null,
        },
        {
          id: second.id,
          name: "Codex",
          prefix: second.prefix,
          createdAt: second.createdAt,
          lastUsedAt: null,
        },
      ])
    );
    const text = JSON.stringify(body);
    expect(text).not.toContain(first.token);
    expect(text).not.toContain(second.token);
  });

  it("shows only the user's own tokens", async () => {
    const mine = await approvedUser();
    const theirs = await approvedUser();
    const mineToken = await created(mine.cookie);
    await created(theirs.cookie);

    expect((await listed(mine.cookie)).map(({ id }) => id)).toEqual([
      mineToken.id,
    ]);
  });
});

describe("revoking an access token", () => {
  it("deletes it, answering 204", async () => {
    const { cookie, userId } = await approvedUser();
    const { id } = await created(cookie);
    events.length = 0;

    const response = await request(api, `/api/v1/access-tokens/${id}`, {
      cookie,
      method: "DELETE",
    });

    expect(response.status).toBe(204);
    expect(await listed(cookie)).toEqual([]);
    expect(await tokensOf(userId)).toBe(0);
    expect(events).toEqual([
      {
        at: expect.any(String),
        user: userId,
        action: "user.access-token-revoked",
        id,
      },
    ]);
  });

  it("answers 404 for an unknown token, logging nothing", async () => {
    const { cookie } = await approvedUser();

    const response = await request(api, "/api/v1/access-tokens/nope", {
      cookie,
      method: "DELETE",
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "ACCESS_TOKEN_NOT_FOUND" });
    expect(
      events.filter((e) => "action" in e && e.action.includes("token"))
    ).toEqual([]);
  });

  it("answers 404 for another user's token and leaves it alone", async () => {
    const mine = await approvedUser();
    const theirs = await approvedUser();
    const { id } = await created(theirs.cookie);

    const response = await request(api, `/api/v1/access-tokens/${id}`, {
      cookie: mine.cookie,
      method: "DELETE",
    });

    expect(response.status).toBe(404);
    expect((await listed(theirs.cookie)).map((each) => each.id)).toEqual([id]);
  });
});

describe("the access-token routes' gate", () => {
  it("answers 403 USER_NOT_APPROVED to an unapproved user", async () => {
    const { cookie } = await signUp(api);

    for (const [path, method] of [
      ["/api/v1/access-tokens", "GET"],
      ["/api/v1/access-tokens", "POST"],
      ["/api/v1/access-tokens/x", "DELETE"],
    ] as const) {
      const response = await request(api, path, { cookie, method });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ code: "USER_NOT_APPROVED" });
    }
  });

  it("answers 401 when signed out", async () => {
    for (const [path, method] of [
      ["/api/v1/access-tokens", "GET"],
      ["/api/v1/access-tokens", "POST"],
      ["/api/v1/access-tokens/x", "DELETE"],
    ] as const) {
      expect((await request(api, path, { method })).status).toBe(401);
    }
  });
});

describe("a token is not a session", () => {
  it("is refused as a Bearer on /api/v1, however it is sent", async () => {
    const { cookie } = await approvedUser();
    const { token } = await created(cookie);

    for (const headers of [
      { authorization: `Bearer ${token}` },
      { "x-api-key": token },
    ]) {
      const response = await fetch(`${api.url}/api/v1/me`, { headers });
      expect(response.status).toBe(401);
    }
    const session = await fetch(`${api.url}/api/auth/get-session`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(await session.json()).toBeNull();
  });

  it("cannot be minted, listed or deleted through the plugin's own routes", async () => {
    const { cookie } = await approvedUser();
    const { id } = await created(cookie);

    const attempts = [
      request(api, "/api/auth/api-key/create", {
        cookie,
        body: { name: "sneaky" },
      }),
      request(api, "/api/auth/api-key/list", { cookie }),
      request(api, "/api/auth/api-key/delete", { cookie, body: { keyId: id } }),
    ];

    for (const response of await Promise.all(attempts)) {
      expect(response.status).toBe(404);
    }
    expect(await listed(cookie)).toHaveLength(1);
  });
});

describe("a password reset", () => {
  it("revokes every access token of the user, and only theirs", async () => {
    const { cookie, email, userId } = await approvedUser();
    const other = await approvedUser();
    await created(cookie, "one");
    await created(cookie, "two");
    await created(other.cookie);

    const asked = await request(api, "/api/auth/request-password-reset", {
      body: { email, redirectTo: "/redefinir-senha" },
    });
    expect(asked.status).toBe(200);
    const [link] = /https?:\/\/\S+/.exec(sent[0]?.text ?? "") ?? [];
    const opened = await fetch(link!, { redirect: "manual" });
    const reset = new URL(opened.headers.get("location") ?? "", api.url);
    const response = await request(api, "/api/auth/reset-password", {
      body: {
        token: reset.searchParams.get("token"),
        newPassword: "a brand new passphrase",
      },
    });

    expect(response.status).toBe(200);
    expect(await tokensOf(userId)).toBe(0);
    expect(await listed(other.cookie)).toHaveLength(1);
  });
});
