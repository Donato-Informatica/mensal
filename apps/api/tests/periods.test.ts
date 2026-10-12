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

describe("GET /api/v1/periods/:yyyy-mm", () => {
  it("merges the period's persisted and virtual occurrences, with the summary", async () => {
    const { cookie, userId } = await approvedUser();
    const rent = await insertRecurrence(api.db, {
      userId,
      description: "Aluguel",
      defaultAmount: 220000,
      dueDay: 10,
      startPeriod: "2026-09-01",
    });
    const power = await insertRecurrence(api.db, {
      userId,
      description: "Energia Elétrica",
      defaultAmount: 18000,
      dueDay: 25,
      startPeriod: "2026-09-01",
    });
    const settledRent = await insertOccurrence(api.db, {
      userId,
      recurrenceId: rent.id,
      description: "Aluguel",
      status: "SETTLED",
      amount: 220000,
      period: "2026-11-01",
      dueDate: "2026-11-10",
      settledAt: "2026-11-09",
    });
    const freelance = await insertOccurrence(api.db, {
      userId,
      direction: "INFLOW",
      description: "Freela",
      amount: 650000,
      period: "2026-11-01",
      dueDate: null,
    });

    const response = await request(api, "/api/v1/periods/2026-11", { cookie });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      period: "2026-11-01",
      summary: {
        inflowExpected: 650000,
        inflowSettled: 0,
        outflowExpected: 238000,
        outflowSettled: 220000,
      },
      items: [
        {
          id: settledRent.id,
          isVirtual: false,
          recurrenceId: rent.id,
          direction: "OUTFLOW",
          description: "Aluguel",
          status: "SETTLED",
          amount: 220000,
          period: "2026-11-01",
          dueDate: "2026-11-10",
          settledAt: "2026-11-09",
          notes: null,
          overdue: false,
        },
        {
          id: `virtual_${power.id}_2026-11-01`,
          isVirtual: true,
          recurrenceId: power.id,
          direction: "OUTFLOW",
          description: "Energia Elétrica",
          status: "PENDING",
          amount: 18000,
          period: "2026-11-01",
          dueDate: "2026-11-25",
          settledAt: null,
          notes: null,
          overdue: false,
        },
        {
          id: freelance.id,
          isVirtual: false,
          recurrenceId: null,
          direction: "INFLOW",
          description: "Freela",
          status: "PENDING",
          amount: 650000,
          period: "2026-11-01",
          dueDate: null,
          settledAt: null,
          notes: null,
          overdue: false,
        },
      ],
      overdueFromPreviousPeriods: [],
    });
  });

  it("lists, for the current period, overdue occurrences from earlier periods", async () => {
    const { cookie, userId } = await approvedUser();
    const internet = await insertRecurrence(api.db, {
      userId,
      description: "Internet",
      dueDay: 5,
      startPeriod: "2026-08-01",
    });
    // August's was settled; September's was never touched.
    await insertOccurrence(api.db, {
      userId,
      recurrenceId: internet.id,
      description: "Internet",
      status: "SETTLED",
      period: "2026-08-01",
      dueDate: "2026-08-05",
      settledAt: "2026-08-05",
    });
    const dentist = await insertOccurrence(api.db, {
      userId,
      description: "Dentista",
      period: "2026-09-01",
      dueDate: "2026-09-20",
    });
    await insertOccurrence(api.db, {
      userId,
      description: "Academia",
      status: "SKIPPED",
      period: "2026-09-01",
      dueDate: "2026-09-15",
    });

    const response = await request(api, "/api/v1/periods/2026-10", { cookie });

    const payload = await response.json();
    expect(
      payload.overdueFromPreviousPeriods.map(
        ({ id, period }: { id: string; period: string }) => ({ id, period })
      )
    ).toEqual([
      { id: `virtual_${internet.id}_2026-09-01`, period: "2026-09-01" },
      { id: dentist.id, period: "2026-09-01" },
    ]);
    expect(payload.items).toEqual([
      expect.objectContaining({
        id: `virtual_${internet.id}_2026-10-01`,
        overdue: true,
      }),
    ]);
  });

  it("never shows a user another user's recurrences or occurrences", async () => {
    const owner = await approvedUser();
    const recurrence = await insertRecurrence(api.db, {
      userId: owner.userId,
      startPeriod: "2026-08-01",
    });
    await insertOccurrence(api.db, {
      userId: owner.userId,
      recurrenceId: recurrence.id,
      period: "2026-10-01",
      dueDate: "2026-10-10",
    });
    await insertOccurrence(api.db, {
      userId: owner.userId,
      period: "2026-09-01",
      dueDate: "2026-09-10",
    });
    const other = await approvedUser();

    const owners = await request(api, "/api/v1/periods/2026-10", {
      cookie: owner.cookie,
    });
    const others = await request(api, "/api/v1/periods/2026-10", {
      cookie: other.cookie,
    });

    const ownersPayload = await owners.json();
    expect(ownersPayload.items).toHaveLength(1);
    expect(ownersPayload.overdueFromPreviousPeriods).toHaveLength(3);
    expect(await others.json()).toEqual({
      period: "2026-10-01",
      summary: {
        inflowExpected: 0,
        inflowSettled: 0,
        outflowExpected: 0,
        outflowSettled: 0,
      },
      items: [],
      overdueFromPreviousPeriods: [],
    });
  });

  it.each(["2026-13", "2026-00", "2026-1", "202610", "outubro"])(
    "rejects the period %s with 400 INVALID_PERIOD",
    async (month) => {
      const { cookie } = await approvedUser();

      const response = await request(api, `/api/v1/periods/${month}`, {
        cookie,
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ code: "INVALID_PERIOD" });
    }
  );
});
