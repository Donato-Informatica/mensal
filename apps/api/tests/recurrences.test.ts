import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { approve, request, signUp, startApi, type TestApi } from "./api.ts";
import { insertOccurrence, insertRecurrence } from "./fixtures.ts";

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

describe("GET /api/v1/recurrences", () => {
  it("lists the active recurrences: open-ended, ending now or later, or starting later", async () => {
    const { cookie, userId } = await approvedUser();
    const openEnded = await insertRecurrence(api.db, {
      userId,
      description: "Aluguel",
      startPeriod: "2026-01-01",
    });
    const endingNow = await insertRecurrence(api.db, {
      userId,
      description: "Geladeira",
      startPeriod: "2026-05-01",
      endPeriod: "2026-10-01",
    });
    const startingLater = await insertRecurrence(api.db, {
      userId,
      description: "Academia",
      startPeriod: "2027-01-01",
    });
    await insertRecurrence(api.db, {
      userId,
      description: "Curso",
      startPeriod: "2026-03-01",
      endPeriod: "2026-09-01",
    });

    const response = await request(api, "/api/v1/recurrences?status=active", {
      cookie,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      expect.objectContaining({ id: startingLater.id }),
      expect.objectContaining({ id: openEnded.id }),
      expect.objectContaining({ id: endingNow.id }),
    ]);
  });

  it("lists every recurrence with status=all, ended ones included", async () => {
    const { cookie, userId } = await approvedUser();
    await insertRecurrence(api.db, { userId, description: "Aluguel" });
    await insertRecurrence(api.db, {
      userId,
      description: "Curso",
      startPeriod: "2026-03-01",
      endPeriod: "2026-09-01",
    });

    const response = await request(api, "/api/v1/recurrences?status=all", {
      cookie,
    });

    expect(response.status).toBe(200);
    expect(
      (await response.json()).map(
        ({ description }: { description: string }) => description
      )
    ).toEqual(["Aluguel", "Curso"]);
  });

  it("lists the active ones when no status is given", async () => {
    const { cookie, userId } = await approvedUser();
    await insertRecurrence(api.db, { userId, description: "Aluguel" });
    await insertRecurrence(api.db, {
      userId,
      description: "Curso",
      endPeriod: "2026-09-01",
    });

    const response = await request(api, "/api/v1/recurrences", { cookie });

    expect(
      (await response.json()).map(
        ({ description }: { description: string }) => description
      )
    ).toEqual(["Aluguel"]);
  });

  it("rejects an unknown status with 400 INVALID_INPUT", async () => {
    const { cookie } = await approvedUser();

    const response = await request(api, "/api/v1/recurrences?status=ended", {
      cookie,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "INVALID_INPUT",
      fields: ["status"],
    });
  });
});

describe("GET /api/v1/recurrences/:id", () => {
  it("answers with the recurrence", async () => {
    const { cookie, userId } = await approvedUser();
    const recurrence = await insertRecurrence(api.db, {
      userId,
      notes: "Contrato até 2028",
    });

    const response = await request(
      api,
      `/api/v1/recurrences/${recurrence.id}`,
      {
        cookie,
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...recurrence,
      createdAt: recurrence.createdAt.toISOString(),
      updatedAt: recurrence.updatedAt.toISOString(),
    });
  });

  it.each([
    ["an unknown id", "5d2c8a4b-1e3f-4b6a-8c9d-2a7e6f1b3c40"],
    ["an id that is not one", "aluguel"],
  ])("answers 404 RECURRENCE_NOT_FOUND for %s", async (_, id) => {
    const { cookie } = await approvedUser();

    const response = await request(api, `/api/v1/recurrences/${id}`, {
      cookie,
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "RECURRENCE_NOT_FOUND" });
  });
});

describe("another user's recurrences", () => {
  it("are never listed", async () => {
    const owner = await approvedUser();
    await insertRecurrence(api.db, { userId: owner.userId });
    const { cookie } = await approvedUser();

    const response = await request(api, "/api/v1/recurrences?status=all", {
      cookie,
    });

    expect(await response.json()).toEqual([]);
  });

  it("are not found", async () => {
    const owner = await approvedUser();
    const recurrence = await insertRecurrence(api.db, {
      userId: owner.userId,
    });
    const { cookie } = await approvedUser();

    const response = await request(
      api,
      `/api/v1/recurrences/${recurrence.id}`,
      {
        cookie,
      }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "RECURRENCE_NOT_FOUND" });
  });
});

describe("PATCH /api/v1/recurrences/:id", () => {
  function patch(cookie: string, id: string, body: unknown) {
    return request(api, `/api/v1/recurrences/${id}`, {
      cookie,
      body,
      method: "PATCH",
    });
  }

  async function itemsOf(cookie: string, month: string) {
    const response = await request(api, `/api/v1/periods/${month}`, {
      cookie,
    });
    return (await response.json()).items;
  }

  it("changes every virtual occurrence, past and future, but no materialized one", async () => {
    const { cookie, userId } = await approvedUser();
    const recurrence = await insertRecurrence(api.db, {
      userId,
      description: "Aluguel",
      defaultAmount: 220000,
      dueDay: 10,
      startPeriod: "2026-09-01",
    });
    const october = await insertOccurrence(api.db, {
      userId,
      recurrenceId: recurrence.id,
      description: "Aluguel",
      amount: 220000,
      period: "2026-10-01",
      dueDate: "2026-10-10",
    });

    const response = await patch(cookie, recurrence.id, {
      description: "Aluguel (reajustado)",
      defaultAmount: 235000,
      dueDay: 31,
      notes: "IGP-M",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: recurrence.id,
      direction: "OUTFLOW",
      description: "Aluguel (reajustado)",
      defaultAmount: 235000,
      dueDay: 31,
      startPeriod: "2026-09-01",
      endPeriod: null,
      notes: "IGP-M",
    });
    expect(await itemsOf(cookie, "2026-09")).toEqual([
      expect.objectContaining({
        isVirtual: true,
        description: "Aluguel (reajustado)",
        amount: 235000,
        dueDate: "2026-09-30",
      }),
    ]);
    expect(await itemsOf(cookie, "2026-10")).toEqual([
      expect.objectContaining({
        id: october.id,
        description: "Aluguel",
        amount: 220000,
        dueDate: "2026-10-10",
      }),
    ]);
    expect(await itemsOf(cookie, "2026-11")).toEqual([
      expect.objectContaining({
        isVirtual: true,
        description: "Aluguel (reajustado)",
        amount: 235000,
        dueDate: "2026-11-30",
      }),
    ]);
  });

  it("ends the recurrence after the new end period", async () => {
    const { cookie, userId } = await approvedUser();
    const recurrence = await insertRecurrence(api.db, {
      userId,
      startPeriod: "2026-10-01",
    });

    const response = await patch(cookie, recurrence.id, {
      endPeriod: "2026-11-01",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ endPeriod: "2026-11-01" });
    expect(await itemsOf(cookie, "2026-11")).toHaveLength(1);
    expect(await itemsOf(cookie, "2026-12")).toEqual([]);
  });

  it("leaves the recurrence as it is when the body is empty", async () => {
    const { cookie, userId } = await approvedUser();
    const recurrence = await insertRecurrence(api.db, { userId });

    const response = await patch(cookie, recurrence.id, {});

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      description: recurrence.description,
      defaultAmount: recurrence.defaultAmount,
      updatedAt: recurrence.updatedAt.toISOString(),
    });
  });

  it.each([
    ["the direction", { direction: "INFLOW" }, "direction"],
    ["the start period", { startPeriod: "2026-11-01" }, "startPeriod"],
    ["a blank description", { description: "  " }, "description"],
    ["a zero default amount", { defaultAmount: 0 }, "defaultAmount"],
    ["a due day of 32", { dueDay: 32 }, "dueDay"],
    [
      "an end period that is not the 1st",
      { endPeriod: "2026-12-15" },
      "endPeriod",
    ],
  ])(
    "rejects %s with 400 INVALID_INPUT, naming the field, and changes nothing",
    async (_, body, field) => {
      const { cookie, userId } = await approvedUser();
      const recurrence = await insertRecurrence(api.db, { userId });

      const response = await patch(cookie, recurrence.id, {
        description: "Aluguel novo",
        ...body,
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: "INVALID_INPUT",
        fields: [field],
      });
      const unchanged = await request(
        api,
        `/api/v1/recurrences/${recurrence.id}`,
        { cookie }
      );
      expect(await unchanged.json()).toMatchObject({
        description: "Aluguel",
        direction: "OUTFLOW",
        startPeriod: recurrence.startPeriod,
      });
    }
  );

  it("rejects an end period before the start with 400 END_PERIOD_BEFORE_START", async () => {
    const { cookie, userId } = await approvedUser();
    const recurrence = await insertRecurrence(api.db, {
      userId,
      startPeriod: "2026-10-01",
    });

    const response = await patch(cookie, recurrence.id, {
      endPeriod: "2026-09-01",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "END_PERIOD_BEFORE_START" });
  });

  it("answers 404 RECURRENCE_NOT_FOUND for an unknown id", async () => {
    const { cookie } = await approvedUser();

    const response = await patch(
      cookie,
      "5d2c8a4b-1e3f-4b6a-8c9d-2a7e6f1b3c40",
      { description: "Aluguel" }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "RECURRENCE_NOT_FOUND" });
  });

  it("answers 404 RECURRENCE_NOT_FOUND for another user's recurrence, leaving it as it is", async () => {
    const owner = await approvedUser();
    const recurrence = await insertRecurrence(api.db, {
      userId: owner.userId,
    });
    const { cookie } = await approvedUser();

    const response = await patch(cookie, recurrence.id, {
      description: "Invadido",
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "RECURRENCE_NOT_FOUND" });
    const unchanged = await request(
      api,
      `/api/v1/recurrences/${recurrence.id}`,
      { cookie: owner.cookie }
    );
    expect(await unchanged.json()).toMatchObject({ description: "Aluguel" });
  });
});
