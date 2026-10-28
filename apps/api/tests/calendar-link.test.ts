import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ActivityEvent } from "../src/activity.ts";
import {
  approve,
  password,
  request,
  signUp,
  startApi,
  type TestApi,
} from "./api.ts";

const events: ActivityEvent[] = [];
let api: TestApi;
beforeAll(async () => {
  api = await startApi({ activity: (event) => events.push(event) });
});
afterAll(async () => {
  await api.close();
});
beforeEach(() => {
  events.length = 0;
});

async function approvedUser() {
  const user = await signUp(api);
  await approve(api, user.email);
  return user;
}

describe("the calendar link", () => {
  it("is null until the user generates one", async () => {
    const { cookie } = await approvedUser();

    const response = await request(api, "/api/v1/calendar-link", { cookie });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ link: null });
  });

  it("is generated with the current password, on the app's origin, and shown again afterwards", async () => {
    const { cookie } = await approvedUser();

    const response = await generate(cookie);

    expect(response.status).toBe(201);
    const { link } = await response.json();
    expect(link).toEqual({
      url: expect.stringMatching(
        new RegExp(`^${api.url}/api/calendar\\.ics\\?key=[\\w-]{43}$`)
      ),
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    const again = await request(api, "/api/v1/calendar-link", { cookie });
    expect(await again.json()).toEqual({ link });
  });

  it("refuses a wrong password with 400 INVALID_PASSWORD, generating nothing", async () => {
    const { cookie } = await approvedUser();
    events.length = 0;

    const response = await generate(cookie, { password: "not my password" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "INVALID_PASSWORD" });
    expect(await linkOf(cookie)).toBeNull();
    expect(events).toEqual([]);
  });

  it("refuses a missing password with 400 INVALID_INPUT", async () => {
    const { cookie } = await approvedUser();

    const response = await request(api, "/api/v1/calendar-link", {
      cookie,
      body: {},
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "INVALID_INPUT",
      fields: ["password"],
    });
  });

  it("answers 429 TOO_MANY_ATTEMPTS after 5 wrong passwords in a minute, even for the right one", async () => {
    const { cookie } = await approvedUser();

    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push(
        (await generate(cookie, { password: "not my password" })).status
      );
    }
    const blocked = await generate(cookie);

    expect(statuses).toEqual([400, 400, 400, 400, 400]);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ code: "TOO_MANY_ATTEMPTS" });
    expect(await linkOf(cookie)).toBeNull();
  });

  it("is replaced by generating it again", async () => {
    const { cookie } = await approvedUser();
    const first = await (await generate(cookie)).json();

    const second = await (await generate(cookie)).json();

    expect(second.link.url).not.toBe(first.link.url);
    expect(await linkOf(cookie)).toEqual(second.link);
  });

  it("is deactivated by DELETE, which answers 204 also when there is none", async () => {
    const { cookie } = await approvedUser();
    await generate(cookie);

    const deleted = await deactivate(cookie);
    const again = await deactivate(cookie);

    expect(deleted.status).toBe(204);
    expect(again.status).toBe(204);
    expect(await linkOf(cookie)).toBeNull();
  });

  it("logs generating, regenerating and deactivating by user id only, never the key", async () => {
    const { cookie, userId } = await approvedUser();
    events.length = 0;

    const { link } = await (await generate(cookie)).json();
    await generate(cookie);
    await deactivate(cookie);
    await deactivate(cookie);

    expect(events).toEqual([
      {
        at: expect.any(String),
        user: userId,
        action: "user.calendar-link-created",
      },
      {
        at: expect.any(String),
        user: userId,
        action: "user.calendar-link-created",
      },
      {
        at: expect.any(String),
        user: userId,
        action: "user.calendar-link-revoked",
      },
    ]);
    const key = new URL(link.url).searchParams.get("key")!;
    expect(JSON.stringify(events)).not.toContain(key);
  });

  it("is refused to an unapproved user with 403 and to a signed-out one with 401", async () => {
    const { cookie } = await signUp(api);

    for (const method of ["GET", "POST", "DELETE"]) {
      const unapproved = await request(api, "/api/v1/calendar-link", {
        cookie,
        method,
        ...(method === "POST" && { body: { password } }),
      });
      const signedOut = await request(api, "/api/v1/calendar-link", {
        method,
      });
      expect(unapproved.status).toBe(403);
      expect(await unapproved.json()).toEqual({ code: "USER_NOT_APPROVED" });
      expect(signedOut.status).toBe(401);
    }
  });
});

async function linkOf(cookie: string) {
  const response = await request(api, "/api/v1/calendar-link", { cookie });
  expect(response.status).toBe(200);
  return (await response.json()).link;
}

function deactivate(cookie: string) {
  return request(api, "/api/v1/calendar-link", { cookie, method: "DELETE" });
}

function generate(cookie: string, body: Record<string, unknown> = {}) {
  return request(api, "/api/v1/calendar-link", {
    cookie,
    body: { password, ...body },
  });
}
