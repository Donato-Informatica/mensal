import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ReminderDevice } from "@mensal/shared";
import { PushRefused, type ReminderMessage } from "../src/push.ts";
import { runReminders } from "../src/reminder-job.ts";
import type { Reminders } from "../src/reminder-operations.ts";
import { approve, request, signUp, startApi, type TestApi } from "./api.ts";

// The daily job (PRD §6.8) at fixed São Paulo times, against the real
// database. Every run handles every approved user of the test database, so
// each test looks only at the pushes to its own devices.
let api: TestApi;
beforeAll(async () => {
  api = await startApi();
});
afterAll(async () => {
  await api.close();
});

/** `time` ('HH:MM') of `date` ('YYYY-MM-DD') in São Paulo (UTC-3, no DST). */
function saoPaulo(date: string, time: string): Date {
  return new Date(`${date}T${time}:00-03:00`);
}

type Pushed = { device: ReminderDevice; message: ReminderMessage };

/** Reminders sending to a capturing sink; `fail` decides a device's fate. */
function capturing(fail?: (device: ReminderDevice) => Error | undefined) {
  const pushed: Pushed[] = [];
  const reminders: Reminders = {
    publicKey: "BTestVapidPublicKey",
    push: async (device, message) => {
      const error = fail?.(device);
      if (error) throw error;
      pushed.push({ device, message });
    },
  };
  return { pushed, reminders };
}

const lines: string[] = [];

function run(reminders: Reminders | undefined, at: Date) {
  return runReminders({
    db: api.db,
    reminders,
    now: () => at,
    log: (line) => lines.push(line),
    info: () => {},
  });
}

async function approvedUser() {
  const user = await signUp(api);
  await approve(api, user.email);
  return user;
}

/** Turns reminders on for a new device of the user; returns its endpoint. */
async function turnOn(cookie: string): Promise<string> {
  const endpoint = `https://push.example/send/${randomUUID()}`;
  const response = await request(api, "/api/v1/reminders/device", {
    cookie,
    method: "PUT",
    body: { endpoint, keys: { p256dh: "p256dh", auth: "auth" } },
  });
  expect(response.status).toBe(200);
  return endpoint;
}

async function oneOff(
  cookie: string,
  description: string,
  dueDate: string,
  direction: "INFLOW" | "OUTFLOW" = "OUTFLOW"
) {
  const response = await request(api, "/api/v1/occurrences", {
    cookie,
    body: {
      direction,
      description,
      amount: 10000,
      period: `${dueDate.slice(0, 8)}01`,
      dueDate,
      notes: "Nota que não vai no lembrete",
    },
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

const to = (pushed: Pushed[], endpoint: string) =>
  pushed.filter((p) => p.device.endpoint === endpoint).map((p) => p.message);

describe("the daily reminder job", () => {
  it("sends nothing before 09:00 in São Paulo", async () => {
    const { cookie } = await approvedUser();
    const device = await turnOn(cookie);
    await oneOff(cookie, "Aluguel", "2026-11-03");
    const { pushed, reminders } = capturing();

    await run(reminders, saoPaulo("2026-11-03", "08:59"));

    expect(to(pushed, device)).toEqual([]);
  });

  it("sends each device the day's reminder at 09:00", async () => {
    const { cookie } = await approvedUser();
    const phone = await turnOn(cookie);
    const laptop = await turnOn(cookie);
    await oneOff(cookie, "Aluguel", "2026-11-03");
    await oneOff(cookie, "Luz", "2026-11-01");
    await oneOff(cookie, "Internet", "2026-11-20");
    const { pushed, reminders } = capturing();

    await run(reminders, saoPaulo("2026-11-03", "09:00"));

    const reminder = {
      title: "Vence hoje: Aluguel",
      body: "Aluguel e Luz\n+ 1 atrasada",
    };
    expect(to(pushed, phone)).toEqual([reminder]);
    expect(to(pushed, laptop)).toEqual([reminder]);
  });

  it("sends once a day: not again on a later run, nor when two runs race", async () => {
    const { cookie } = await approvedUser();
    const device = await turnOn(cookie);
    await oneOff(cookie, "Aluguel", "2026-11-04");
    const { pushed, reminders } = capturing();

    await Promise.all([
      run(reminders, saoPaulo("2026-11-04", "09:00")),
      run(reminders, saoPaulo("2026-11-04", "09:00")),
    ]);
    await run(reminders, saoPaulo("2026-11-04", "09:05"));
    expect(to(pushed, device)).toHaveLength(1);

    // An overdue occurrence keeps reminding, the next day.
    await run(reminders, saoPaulo("2026-11-05", "09:00"));
    expect(to(pushed, device)).toEqual([
      { title: "Vence hoje: Aluguel", body: "Aluguel" },
      { title: "1 conta atrasada", body: "Aluguel" },
    ]);
  });

  it("catches a missed 09:00 run up later the same day", async () => {
    const { cookie } = await approvedUser();
    const device = await turnOn(cookie);
    await oneOff(cookie, "Aluguel", "2026-11-06");
    const { pushed, reminders } = capturing();

    await run(reminders, saoPaulo("2026-11-06", "15:00"));

    expect(to(pushed, device)).toEqual([
      { title: "Vence hoje: Aluguel", body: "Aluguel" },
    ]);
  });

  it("sends nothing on a day with nothing due or overdue, and the day counts as handled", async () => {
    const { cookie } = await approvedUser();
    const device = await turnOn(cookie);
    const later = await oneOff(cookie, "Aluguel", "2026-11-20");
    const settled = await oneOff(cookie, "Luz", "2026-11-07");
    const skipped = await oneOff(cookie, "Gás", "2026-11-02");
    for (const [id, status] of [
      [settled, "SETTLED"],
      [skipped, "SKIPPED"],
    ] as const)
      expect(
        (
          await request(api, `/api/v1/occurrences/${id}/status`, {
            cookie,
            method: "PATCH",
            body: { status },
          })
        ).status
      ).toBe(200);
    const { pushed, reminders } = capturing();
    await run(reminders, saoPaulo("2026-11-07", "09:00"));
    expect(to(pushed, device)).toEqual([]);

    // Something due later that day still waits for tomorrow.
    const moved = await request(api, `/api/v1/occurrences/${later}`, {
      cookie,
      method: "PATCH",
      body: { dueDate: "2026-11-07" },
    });
    expect(moved.status).toBe(200);
    await run(reminders, saoPaulo("2026-11-07", "09:05"));
    expect(to(pushed, device)).toEqual([]);
  });

  it("skips unapproved users and keeps their devices", async () => {
    const user = await approvedUser();
    const device = await turnOn(user.cookie);
    await oneOff(user.cookie, "Aluguel", "2026-11-09");
    await api.db.$client.query(
      "UPDATE users SET approved = false WHERE id = $1",
      [user.userId]
    );
    const { pushed, reminders } = capturing();

    await run(reminders, saoPaulo("2026-11-09", "09:00"));
    expect(to(pushed, device)).toEqual([]);

    await approve(api, user.email);
    await run(reminders, saoPaulo("2026-11-09", "09:05"));
    expect(to(pushed, device)).toEqual([
      { title: "Vence hoje: Aluguel", body: "Aluguel" },
    ]);
  });

  it("drops a device its push service says is gone (404, 410) and keeps one that failed otherwise", async () => {
    const { cookie } = await approvedUser();
    const missing = await turnOn(cookie);
    const gone = await turnOn(cookie);
    const flaky = await turnOn(cookie);
    const fine = await turnOn(cookie);
    const failures: Record<string, Error> = {
      [missing]: new PushRefused(404),
      [gone]: new PushRefused(410),
      [flaky]: new PushRefused(500),
    };
    const { pushed, reminders } = capturing(
      (device) => failures[device.endpoint]
    );
    lines.length = 0;

    await oneOff(cookie, "Aluguel", "2026-11-10");
    await run(reminders, saoPaulo("2026-11-10", "09:00"));

    expect(to(pushed, fine)).toHaveLength(1);
    expect(lines).toEqual([
      expect.stringContaining("Push service answered 500"),
    ]);
    expect(lines.join()).not.toContain(flaky);
    const { deviceCount } = (await (
      await request(api, "/api/v1/reminders", { cookie })
    ).json()) as { deviceCount: number };
    expect(deviceCount).toBe(2);
  });

  it("covers virtual and earlier periods' occurrences, inflows too, and never materializes them", async () => {
    const { cookie } = await approvedUser();
    const device = await turnOn(cookie);
    const created = await request(api, "/api/v1/recurrences", {
      cookie,
      body: {
        direction: "INFLOW",
        description: "Salário",
        defaultAmount: 500000,
        dueDay: 11,
        startPeriod: "2026-11-01",
        endPeriod: null,
        notes: null,
      },
    });
    expect(created.status).toBe(201);
    await oneOff(cookie, "Cartão", "2026-10-25");
    const { pushed, reminders } = capturing();

    await run(reminders, saoPaulo("2026-11-11", "09:00"));

    expect(to(pushed, device)).toEqual([
      {
        title: "Vence hoje: Entrada: Salário",
        body: "Entrada: Salário e Cartão\n+ 1 atrasada",
      },
    ]);
    const period = (await (
      await request(api, "/api/v1/periods/2026-11", { cookie })
    ).json()) as { items: { isVirtual: boolean }[] };
    expect(period.items).toEqual([
      expect.objectContaining({ isVirtual: true }),
    ]);
  });

  it("does nothing without the VAPID keys", async () => {
    const { cookie } = await approvedUser();
    const device = await turnOn(cookie);
    await oneOff(cookie, "Aluguel", "2026-11-12");

    await run(undefined, saoPaulo("2026-11-12", "09:00"));

    // The day was not taken: with keys, the user is still reminded.
    const { pushed, reminders } = capturing();
    await run(reminders, saoPaulo("2026-11-12", "09:05"));
    expect(to(pushed, device)).toHaveLength(1);
  });
});
