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

const zero = {
  inflowExpected: 0,
  inflowSettled: 0,
  outflowExpected: 0,
  outflowSettled: 0,
};

describe("GET /api/v1/summaries", () => {
  it("gives the summary of every period of the range, ascending, with zeros for empty periods", async () => {
    const { cookie, userId } = await approvedUser();
    await insertOccurrence(api.db, {
      userId,
      amount: 85000,
      period: "2026-09-01",
      dueDate: "2026-09-20",
    });

    const response = await request(
      api,
      "/api/v1/summaries?from=2026-08&to=2026-10",
      { cookie }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [
        { period: "2026-08-01", summary: zero },
        { period: "2026-09-01", summary: { ...zero, outflowExpected: 85000 } },
        { period: "2026-10-01", summary: zero },
      ],
    });
  });

  it("gives each period the summary GET /periods gives it, over persisted, virtual, settled, skipped and amountless occurrences", async () => {
    const { cookie, userId } = await approvedUser();
    const salary = await insertRecurrence(api.db, {
      userId,
      direction: "INFLOW",
      description: "Salário",
      defaultAmount: 650000,
      dueDay: 5,
      startPeriod: "2026-08-01",
    });
    const power = await insertRecurrence(api.db, {
      userId,
      description: "Energia Elétrica",
      defaultAmount: null,
      dueDay: 25,
      startPeriod: "2026-08-01",
    });
    await insertOccurrence(api.db, {
      userId,
      recurrenceId: salary.id,
      direction: "INFLOW",
      description: "Salário",
      status: "SETTLED",
      amount: 700000,
      period: "2026-09-01",
      dueDate: "2026-09-05",
      settledAt: "2026-09-05",
    });
    await insertOccurrence(api.db, {
      userId,
      recurrenceId: power.id,
      description: "Energia Elétrica",
      status: "SKIPPED",
      amount: 18000,
      period: "2026-10-01",
      dueDate: "2026-10-25",
    });
    await insertOccurrence(api.db, {
      userId,
      description: "Dentista",
      amount: null,
      period: "2026-11-01",
      dueDate: "2026-11-03",
    });
    await insertOccurrence(api.db, {
      userId,
      description: "Conserto do carro",
      status: "SETTLED",
      amount: 85000,
      period: "2026-10-01",
      dueDate: "2026-10-01",
      settledAt: "2026-10-02",
    });
    const months = ["2026-08", "2026-09", "2026-10", "2026-11"];

    const response = await request(
      api,
      "/api/v1/summaries?from=2026-08&to=2026-11",
      { cookie }
    );

    const periods = await Promise.all(
      months.map(async (month) => {
        const period = await request(api, `/api/v1/periods/${month}`, {
          cookie,
        });
        const { summary } = await period.json();
        return { period: `${month}-01`, summary };
      })
    );
    expect((await response.json()).items).toEqual(periods);
    expect(periods.map(({ summary }) => summary)).toEqual([
      { ...zero, inflowExpected: 650000 },
      { ...zero, inflowExpected: 700000, inflowSettled: 700000 },
      {
        inflowExpected: 650000,
        inflowSettled: 0,
        outflowExpected: 85000,
        outflowSettled: 85000,
      },
      { ...zero, inflowExpected: 650000 },
    ]);
  });

  it("counts a recurrence only in the periods of the range it is in effect", async () => {
    const { cookie, userId } = await approvedUser();
    await insertRecurrence(api.db, {
      userId,
      description: "Academia",
      defaultAmount: 12000,
      startPeriod: "2026-09-01",
      endPeriod: "2026-10-01",
    });
    // Starts after the range ends.
    await insertRecurrence(api.db, {
      userId,
      defaultAmount: 220000,
      startPeriod: "2026-12-01",
    });

    const response = await request(
      api,
      "/api/v1/summaries?from=2026-08&to=2026-11",
      { cookie }
    );

    const { items } = await response.json();
    expect(
      items.map(
        ({ summary }: { summary: typeof zero }) => summary.outflowExpected
      )
    ).toEqual([0, 12000, 12000, 0]);
  });

  it("never counts an overdue occurrence of an earlier period in a later period", async () => {
    const { cookie, userId } = await approvedUser();
    await insertOccurrence(api.db, {
      userId,
      amount: 85000,
      period: "2026-08-01",
      dueDate: "2026-08-20",
    });

    const response = await request(
      api,
      "/api/v1/summaries?from=2026-08&to=2026-10",
      { cookie }
    );

    expect(await response.json()).toEqual({
      items: [
        { period: "2026-08-01", summary: { ...zero, outflowExpected: 85000 } },
        { period: "2026-09-01", summary: zero },
        { period: "2026-10-01", summary: zero },
      ],
    });
  });

  it("never counts another user's recurrences or occurrences", async () => {
    const owner = await approvedUser();
    await insertRecurrence(api.db, {
      userId: owner.userId,
      startPeriod: "2026-08-01",
    });
    await insertOccurrence(api.db, {
      userId: owner.userId,
      period: "2026-10-01",
      dueDate: "2026-10-20",
    });
    const other = await approvedUser();

    const response = await request(
      api,
      "/api/v1/summaries?from=2026-10&to=2026-10",
      { cookie: other.cookie }
    );

    expect(await response.json()).toEqual({
      items: [{ period: "2026-10-01", summary: zero }],
    });
  });

  it("refuses a user not approved yet with 403 USER_NOT_APPROVED", async () => {
    const { cookie } = await signUp(api);

    const response = await request(
      api,
      "/api/v1/summaries?from=2026-10&to=2026-10",
      { cookie }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: "USER_NOT_APPROVED" });
  });

  it("materializes nothing", async () => {
    const { cookie, userId } = await approvedUser();
    const rent = await insertRecurrence(api.db, {
      userId,
      startPeriod: "2026-08-01",
    });

    await request(api, "/api/v1/summaries?from=2026-08&to=2026-12", {
      cookie,
    });

    // Had the route persisted it, the period would list it as persisted.
    const period = await request(api, "/api/v1/periods/2026-09", { cookie });
    expect((await period.json()).items).toEqual([
      expect.objectContaining({
        id: `virtual_${rent.id}_2026-09-01`,
        isVirtual: true,
      }),
    ]);
  });

  it.each([
    ["reversed", "from=2026-10&to=2026-09"],
    ["13 periods long", "from=2025-10&to=2026-10"],
  ])("rejects a range %s with 400 INVALID_PERIOD_RANGE", async (_, query) => {
    const { cookie } = await approvedUser();

    const response = await request(api, `/api/v1/summaries?${query}`, {
      cookie,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "INVALID_PERIOD_RANGE" });
  });

  it("accepts a range of 12 periods", async () => {
    const { cookie } = await approvedUser();

    const response = await request(
      api,
      "/api/v1/summaries?from=2025-11&to=2026-10",
      { cookie }
    );

    expect(response.status).toBe(200);
    expect((await response.json()).items).toHaveLength(12);
  });

  it.each([
    "from=2026-13&to=2026-12",
    "from=2026-01&to=2026-1",
    "from=outubro&to=2026-10",
    "to=2026-10",
    "from=2026-10",
    "from=2026-01&from=2026-02&to=2026-10",
  ])("rejects %s with 400 INVALID_PERIOD", async (query) => {
    const { cookie } = await approvedUser();

    const response = await request(api, `/api/v1/summaries?${query}`, {
      cookie,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "INVALID_PERIOD" });
  });
});
