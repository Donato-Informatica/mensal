import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ActivityEvent } from "../src/activity.ts";
import type { PushDevice, PushMessage } from "../src/push.ts";
import {
  approve,
  cookieFrom,
  password,
  request,
  signUp,
  startApi,
  type TestApi,
} from "./api.ts";

const publicKey = "BTestVapidPublicKey";
const events: ActivityEvent[] = [];
const pushed: { device: PushDevice; message: PushMessage }[] = [];
let api: TestApi;
let unconfigured: TestApi;
beforeAll(async () => {
  api = await startApi({
    activity: (event) => events.push(event),
    reminders: {
      publicKey,
      push: async (device, message) => {
        pushed.push({ device, message });
      },
    },
  });
  unconfigured = await startApi({ reminders: null });
});
afterAll(async () => {
  await api.close();
  await unconfigured.close();
});
beforeEach(() => {
  events.length = 0;
  pushed.length = 0;
});

async function approvedUser(on = api) {
  const user = await signUp(on);
  await approve(on, user.email);
  return user;
}

/** A browser's push registration, as its `PushManager` hands it out. */
function newDevice() {
  return {
    endpoint: `https://push.example/send/${randomUUID()}`,
    keys: { p256dh: `p256dh-${randomUUID()}`, auth: `auth-${randomUUID()}` },
  };
}

function turnOn(cookie: string, device = newDevice(), on = api) {
  return request(on, "/api/v1/reminders/device", {
    cookie,
    method: "PUT",
    body: device,
  });
}

function check(cookie: string, endpoint: string) {
  return request(api, "/api/v1/reminders/device/check", {
    cookie,
    body: { endpoint },
  });
}

async function remindersOf(cookie: string, on = api) {
  const response = await request(on, "/api/v1/reminders", { cookie });
  expect(response.status).toBe(200);
  return response.json();
}

const confirmation = {
  title: "Lembretes ativados",
  body: "Todo dia às 9h, neste dispositivo, sobre as contas que vencem no dia e as atrasadas.",
};

describe("GET /api/v1/reminders", () => {
  it("gives the server's public key and no devices for a new user", async () => {
    const { cookie } = await approvedUser();

    expect(await remindersOf(cookie)).toEqual({ publicKey, deviceCount: 0 });
  });

  it("gives a null key when reminders are not configured", async () => {
    const { cookie } = await approvedUser(unconfigured);

    expect(await remindersOf(cookie, unconfigured)).toEqual({
      publicKey: null,
      deviceCount: 0,
    });
  });
});

describe("PUT /api/v1/reminders/device", () => {
  it("turns reminders on for the device and sends it the confirmation", async () => {
    const { cookie, userId } = await approvedUser();
    const device = newDevice();
    events.length = 0;

    const response = await turnOn(cookie, device);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deviceCount: 1 });
    expect(pushed).toEqual([{ device, message: confirmation }]);
    expect(await remindersOf(cookie)).toEqual({ publicKey, deviceCount: 1 });
    expect(events).toEqual([
      {
        at: expect.any(String),
        user: userId,
        action: "user.reminders-on",
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      },
    ]);
  });

  it("is idempotent on the endpoint: the confirmation goes once per new device", async () => {
    const { cookie } = await approvedUser();
    const device = newDevice();
    await turnOn(cookie, device);
    pushed.length = 0;
    events.length = 0;

    const again = await turnOn(cookie, device);

    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ deviceCount: 1 });
    expect(pushed).toEqual([]);
    expect(events).toEqual([]);

    const second = newDevice();
    expect(await (await turnOn(cookie, second)).json()).toEqual({
      deviceCount: 2,
    });
    expect(pushed).toEqual([{ device: second, message: confirmation }]);
  });

  it("takes over an endpoint registered to another user", async () => {
    const previous = await approvedUser();
    const next = await approvedUser();
    const device = newDevice();
    await turnOn(previous.cookie, device);
    pushed.length = 0;

    const response = await turnOn(next.cookie, device);

    expect(await response.json()).toEqual({ deviceCount: 1 });
    expect(pushed).toEqual([{ device, message: confirmation }]);
    expect((await remindersOf(previous.cookie)).deviceCount).toBe(0);
    expect((await remindersOf(next.cookie)).deviceCount).toBe(1);
  });

  it("answers 409 REMINDERS_UNAVAILABLE when reminders are not configured", async () => {
    const { cookie } = await approvedUser(unconfigured);

    const response = await turnOn(cookie, newDevice(), unconfigured);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "REMINDERS_UNAVAILABLE" });
    expect(await remindersOf(cookie, unconfigured)).toEqual({
      publicKey: null,
      deviceCount: 0,
    });
  });

  it("refuses a registration without its endpoint or keys", async () => {
    const { cookie } = await approvedUser();

    const response = await request(api, "/api/v1/reminders/device", {
      cookie,
      method: "PUT",
      body: { endpoint: "not a url", keys: { p256dh: "x" } },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "INVALID_INPUT",
      fields: ["endpoint", "keys"],
    });
    expect(pushed).toEqual([]);
  });

  it("still turns reminders on when the confirmation cannot be sent", async () => {
    const lines: string[] = [];
    const failing = await startApi({
      log: (line) => lines.push(line),
      reminders: {
        publicKey,
        push: async () => {
          throw new Error("push service answered 500");
        },
      },
    });
    try {
      const { cookie } = await approvedUser(failing);
      const device = newDevice();

      const response = await turnOn(cookie, device, failing);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ deviceCount: 1 });
      expect(lines.join("\n")).toMatch(/confirmation/);
      expect(lines.join("\n")).not.toContain(device.endpoint);
    } finally {
      await failing.close();
    }
  });
});

describe("POST /api/v1/reminders/device/check", () => {
  it("answers mine: true for the user's own device", async () => {
    const { cookie } = await approvedUser();
    const device = newDevice();
    await turnOn(cookie, device);

    const response = await check(cookie, device.endpoint);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ mine: true });
  });

  it("answers mine: false for an endpoint no one registered", async () => {
    const { cookie } = await approvedUser();

    expect(await (await check(cookie, newDevice().endpoint)).json()).toEqual({
      mine: false,
    });
  });

  it("deletes another user's registration of the endpoint and answers mine: false", async () => {
    const previous = await approvedUser();
    const next = await approvedUser();
    const device = newDevice();
    await turnOn(previous.cookie, device);

    const response = await check(next.cookie, device.endpoint);

    expect(await response.json()).toEqual({ mine: false });
    expect((await remindersOf(previous.cookie)).deviceCount).toBe(0);
    expect((await remindersOf(next.cookie)).deviceCount).toBe(0);
  });

  it("binds the user's own device to the current session", async () => {
    const { cookie, email } = await approvedUser();
    const device = newDevice();
    await turnOn(cookie, device);
    const signIn = await request(api, "/api/auth/sign-in/email", {
      body: { email, password },
    });
    const laterCookie = cookieFrom(signIn);

    await check(laterCookie, device.endpoint);

    expect(await sessionOf(device.endpoint)).toBe(
      await sessionIdOf(laterCookie)
    );
  });

  it("binds a device turned on to the session that turned it on", async () => {
    const { cookie } = await approvedUser();
    const device = newDevice();

    await turnOn(cookie, device);

    expect(await sessionOf(device.endpoint)).toBe(await sessionIdOf(cookie));
  });

  it("refuses a body without an endpoint", async () => {
    const { cookie } = await approvedUser();

    const response = await request(api, "/api/v1/reminders/device/check", {
      cookie,
      body: {},
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "INVALID_INPUT",
      fields: ["endpoint"],
    });
  });
});

function turnOffHere(cookie: string, endpoint: string) {
  return request(api, "/api/v1/reminders/device", {
    cookie,
    method: "DELETE",
    body: { endpoint },
  });
}

function turnOffEverywhere(cookie: string) {
  return request(api, "/api/v1/reminders", { cookie, method: "DELETE" });
}

describe("DELETE /api/v1/reminders/device", () => {
  it("turns reminders off for that device only", async () => {
    const { cookie, userId } = await approvedUser();
    const device = newDevice();
    await turnOn(cookie, device);
    await turnOn(cookie);
    const turnedOn = events.find((e) => e.action === "user.reminders-on");
    const id = turnedOn && "id" in turnedOn ? turnedOn.id : undefined;
    expect(id).toBeTypeOf("string");
    events.length = 0;

    const response = await turnOffHere(cookie, device.endpoint);

    expect(response.status).toBe(204);
    expect(await remindersOf(cookie)).toEqual({ publicKey, deviceCount: 1 });
    expect(await (await check(cookie, device.endpoint)).json()).toEqual({
      mine: false,
    });
    expect(events).toEqual([
      {
        at: expect.any(String),
        user: userId,
        action: "user.reminders-off",
        id,
      },
    ]);
  });

  it("answers 204 also when the device had none, logging nothing", async () => {
    const { cookie } = await approvedUser();
    events.length = 0;

    const response = await turnOffHere(cookie, newDevice().endpoint);

    expect(response.status).toBe(204);
    expect(events).toEqual([]);
  });

  it("never turns off another user's registration of the endpoint", async () => {
    const owner = await approvedUser();
    const other = await approvedUser();
    const device = newDevice();
    await turnOn(owner.cookie, device);

    const response = await turnOffHere(other.cookie, device.endpoint);

    expect(response.status).toBe(204);
    expect((await remindersOf(owner.cookie)).deviceCount).toBe(1);
  });

  it("refuses a body without an endpoint", async () => {
    const { cookie } = await approvedUser();

    const response = await request(api, "/api/v1/reminders/device", {
      cookie,
      method: "DELETE",
      body: {},
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "INVALID_INPUT",
      fields: ["endpoint"],
    });
  });
});

describe("DELETE /api/v1/reminders", () => {
  it("turns reminders off on every device of the user, and none of another's", async () => {
    const { cookie, userId } = await approvedUser();
    const other = await approvedUser();
    await turnOn(cookie);
    await turnOn(cookie);
    await turnOn(other.cookie);
    events.length = 0;

    const response = await turnOffEverywhere(cookie);

    expect(response.status).toBe(204);
    expect(await remindersOf(cookie)).toEqual({ publicKey, deviceCount: 0 });
    expect((await remindersOf(other.cookie)).deviceCount).toBe(1);
    expect(events).toEqual([
      { at: expect.any(String), user: userId, action: "user.reminders-off" },
    ]);
  });
});

describe("the reminders routes", () => {
  it("never show one user's devices to another", async () => {
    const owner = await approvedUser();
    const other = await approvedUser();
    await turnOn(owner.cookie);
    await turnOn(owner.cookie);

    expect((await remindersOf(other.cookie)).deviceCount).toBe(0);
    expect((await remindersOf(owner.cookie)).deviceCount).toBe(2);
  });

  it("are behind the approval gate", async () => {
    const { cookie } = await signUp(api);

    const responses = [
      await request(api, "/api/v1/reminders", { cookie }),
      await turnOn(cookie),
      await check(cookie, newDevice().endpoint),
      await turnOffHere(cookie, newDevice().endpoint),
      await turnOffEverywhere(cookie),
    ];

    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ code: "USER_NOT_APPROVED" });
    }
    expect(pushed).toEqual([]);
  });
});

/** The session a device is bound to, as stored. */
async function sessionOf(endpoint: string): Promise<string | undefined> {
  const { rows } = await api.db.$client.query<{ session_id: string }>(
    "SELECT session_id FROM reminder_devices WHERE endpoint = $1",
    [endpoint]
  );
  return rows[0]?.session_id;
}

async function sessionIdOf(cookie: string): Promise<string> {
  const response = await request(api, "/api/auth/get-session", { cookie });
  const { session } = (await response.json()) as { session: { id: string } };
  return session.id;
}
