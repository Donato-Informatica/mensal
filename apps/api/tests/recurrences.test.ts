import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { approve, request, signUp, startApi, type TestApi } from "./api.ts";

let api: TestApi;
beforeAll(async () => {
  // Today is 2026-10-12 in São Paulo.
  api = await startApi({ now: () => new Date("2026-10-12T15:00:00Z") });
});
afterAll(async () => {
  await api.close();
});

async function approvedUser() {
  const user = await signUp(api);
  await approve(api, user.email);
  return user;
}

const rent = {
  direction: "OUTFLOW",
  description: "Aluguel",
  defaultAmount: 220000,
  dueDay: 10,
  startPeriod: "2026-10-01",
  endPeriod: null,
  notes: null,
};

describe("POST /api/v1/recurrences", () => {
  it("creates the recurrence, projected from its start period on", async () => {
    const { cookie, userId } = await approvedUser();

    const response = await request(api, "/api/v1/recurrences", {
      cookie,
      body: rent,
    });

    expect(response.status).toBe(201);
    const recurrence = await response.json();
    expect(recurrence).toEqual({
      ...rent,
      id: expect.any(String),
      userId,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    const october = await request(api, "/api/v1/periods/2026-10", { cookie });
    const december = await request(api, "/api/v1/periods/2026-12", { cookie });
    expect((await october.json()).items).toEqual([
      expect.objectContaining({
        id: `virtual_${recurrence.id}_2026-10-01`,
        description: "Aluguel",
        amount: 220000,
        dueDate: "2026-10-10",
      }),
    ]);
    expect((await december.json()).items).toEqual([
      expect.objectContaining({ id: `virtual_${recurrence.id}_2026-12-01` }),
    ]);
  });

  it("creates a variable recurrence without a due day, ending in its start period", async () => {
    const { cookie } = await approvedUser();

    const response = await request(api, "/api/v1/recurrences", {
      cookie,
      body: {
        ...rent,
        description: "Cartão de crédito",
        defaultAmount: null,
        dueDay: null,
        startPeriod: "2026-11-01",
        endPeriod: "2026-11-01",
        notes: "Fatura do mês",
      },
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      defaultAmount: null,
      dueDay: null,
      startPeriod: "2026-11-01",
      endPeriod: "2026-11-01",
      notes: "Fatura do mês",
    });
    const november = await request(api, "/api/v1/periods/2026-11", { cookie });
    const december = await request(api, "/api/v1/periods/2026-12", { cookie });
    expect((await november.json()).items).toEqual([
      expect.objectContaining({ amount: null, dueDate: null }),
    ]);
    expect((await december.json()).items).toEqual([]);
  });

  it.each([
    [
      "a description over 120 characters",
      { description: "x".repeat(121) },
      "description",
    ],
    ["a zero default amount", { defaultAmount: 0 }, "defaultAmount"],
    ["a negative default amount", { defaultAmount: -100 }, "defaultAmount"],
    ["a due day of 0", { dueDay: 0 }, "dueDay"],
    ["a due day of 32", { dueDay: 32 }, "dueDay"],
    [
      "an end period before the start",
      { endPeriod: "2026-09-01" },
      "endPeriod",
    ],
    [
      "a start period that is not the 1st",
      { startPeriod: "2026-10-15" },
      "startPeriod",
    ],
  ])(
    "rejects %s with 400 INVALID_INPUT, naming the field",
    async (_, override, field) => {
      const { cookie } = await approvedUser();

      const response = await request(api, "/api/v1/recurrences", {
        cookie,
        body: { ...rent, ...override },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: "INVALID_INPUT",
        fields: [field],
      });
    }
  );

  it("rejects a start period before the current one with START_PERIOD_IN_PAST", async () => {
    const { cookie } = await approvedUser();

    const response = await request(api, "/api/v1/recurrences", {
      cookie,
      body: { ...rent, startPeriod: "2026-09-01" },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "START_PERIOD_IN_PAST" });
  });

  it("reads the current period in São Paulo, not UTC", async () => {
    // 2026-11-01T01:00Z is still 31 October in São Paulo.
    const lateNight = await startApi({
      now: () => new Date("2026-11-01T01:00:00Z"),
    });
    try {
      const user = await signUp(lateNight);
      await approve(lateNight, user.email);

      const response = await request(lateNight, "/api/v1/recurrences", {
        cookie: user.cookie,
        body: { ...rent, startPeriod: "2026-10-01" },
      });

      expect(response.status).toBe(201);
    } finally {
      await lateNight.close();
    }
  });

  it("creates nothing when the input is invalid", async () => {
    const { cookie } = await approvedUser();

    await request(api, "/api/v1/recurrences", {
      cookie,
      body: { ...rent, dueDay: 32 },
    });

    const october = await request(api, "/api/v1/periods/2026-10", { cookie });
    expect((await october.json()).items).toEqual([]);
  });
});
