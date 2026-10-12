import { schema } from "@mensal/database";
import { eq } from "drizzle-orm";
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

function changeStatus(cookie: string, id: string, body: unknown) {
  return request(api, `/api/v1/occurrences/${id}/status`, {
    cookie,
    method: "PATCH",
    body,
  });
}

async function itemsOf(cookie: string, month: string) {
  const response = await request(api, `/api/v1/periods/${month}`, { cookie });
  return (await response.json()).items;
}

describe("PATCH /api/v1/occurrences/:id/status", () => {
  it("settles a persisted occurrence today, in São Paulo", async () => {
    const { cookie, userId } = await approvedUser();
    const repair = await insertOccurrence(api.db, { userId, amount: 85000 });

    const response = await changeStatus(cookie, repair.id, {
      status: "SETTLED",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: repair.id,
      status: "SETTLED",
      amount: 85000,
      settledAt: "2026-10-12",
    });
    expect(await itemsOf(cookie, "2026-10")).toEqual([
      expect.objectContaining({
        id: repair.id,
        status: "SETTLED",
        settledAt: "2026-10-12",
      }),
    ]);
  });

  it("materializes a virtual occurrence with a snapshot of its recurrence", async () => {
    const { cookie, userId } = await approvedUser();
    const salary = await insertRecurrence(api.db, {
      userId,
      direction: "INFLOW",
      description: "Salário",
      defaultAmount: 650000,
      dueDay: 31,
      startPeriod: "2026-10-01",
    });

    const response = await changeStatus(
      cookie,
      `virtual_${salary.id}_2026-11-01`,
      { status: "SETTLED" }
    );

    expect(response.status).toBe(200);
    const materialized = await response.json();
    expect(materialized).toEqual({
      id: expect.any(String),
      userId,
      recurrenceId: salary.id,
      direction: "INFLOW",
      description: "Salário",
      status: "SETTLED",
      amount: 650000,
      period: "2026-11-01",
      dueDate: "2026-11-30",
      settledAt: "2026-10-12",
      notes: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    // Editing the recurrence leaves the materialized occurrence as it was.
    await api.db
      .update(schema.recurrences)
      .set({ description: "Salário novo", defaultAmount: 700000, dueDay: 5 })
      .where(eq(schema.recurrences.id, salary.id));
    expect(await itemsOf(cookie, "2026-11")).toEqual([
      expect.objectContaining({
        id: materialized.id,
        isVirtual: false,
        description: "Salário",
        amount: 650000,
        dueDate: "2026-11-30",
      }),
    ]);
    expect(await itemsOf(cookie, "2026-12")).toEqual([
      expect.objectContaining({
        isVirtual: true,
        description: "Salário novo",
        amount: 700000,
      }),
    ]);
  });

  it("materializes the same virtual occurrence once, however often it is touched", async () => {
    const { cookie, userId } = await approvedUser();
    const rent = await insertRecurrence(api.db, { userId });
    const id = `virtual_${rent.id}_2026-10-01`;

    const [first, second] = await Promise.all([
      changeStatus(cookie, id, { status: "SETTLED" }),
      changeStatus(cookie, id, { status: "SETTLED" }),
    ]);
    const third = await changeStatus(cookie, id, { status: "SKIPPED" });

    const ids = await Promise.all(
      [first, second, third].map(async (response) => {
        expect(response.status).toBe(200);
        return (await response.json()).id;
      })
    );
    expect(new Set(ids).size).toBe(1);
    expect(await itemsOf(cookie, "2026-10")).toEqual([
      expect.objectContaining({ id: ids[0], status: "SKIPPED" }),
    ]);
  });

  describe("settling", () => {
    it("refuses an occurrence whose amount is to be defined, materializing nothing", async () => {
      const { cookie, userId } = await approvedUser();
      const card = await insertRecurrence(api.db, {
        userId,
        description: "Cartão de crédito",
        defaultAmount: null,
      });
      const id = `virtual_${card.id}_2026-10-01`;

      const response = await changeStatus(cookie, id, { status: "SETTLED" });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: "AMOUNT_REQUIRED_TO_SETTLE",
      });
      expect(await itemsOf(cookie, "2026-10")).toEqual([
        expect.objectContaining({ id, isVirtual: true, status: "PENDING" }),
      ]);
    });

    it("refuses a persisted occurrence whose amount is to be defined", async () => {
      const { cookie, userId } = await approvedUser();
      const gift = await insertOccurrence(api.db, { userId, amount: null });

      const response = await changeStatus(cookie, gift.id, {
        status: "SETTLED",
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: "AMOUNT_REQUIRED_TO_SETTLE",
      });
      expect(await itemsOf(cookie, "2026-10")).toEqual([
        expect.objectContaining({ id: gift.id, status: "PENDING" }),
      ]);
    });

    it("takes the amount sent with the request", async () => {
      const { cookie, userId } = await approvedUser();
      const card = await insertRecurrence(api.db, {
        userId,
        defaultAmount: null,
      });

      const response = await changeStatus(
        cookie,
        `virtual_${card.id}_2026-10-01`,
        { status: "SETTLED", amount: 312090 }
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        status: "SETTLED",
        amount: 312090,
      });
    });

    it("takes the settlement date sent with the request", async () => {
      const { cookie, userId } = await approvedUser();
      const repair = await insertOccurrence(api.db, { userId });

      const response = await changeStatus(cookie, repair.id, {
        status: "SETTLED",
        settledAt: "2026-10-08",
      });

      expect(await response.json()).toMatchObject({
        status: "SETTLED",
        settledAt: "2026-10-08",
      });
    });

    it("keeps the settlement date of an occurrence settled again", async () => {
      const { cookie, userId } = await approvedUser();
      const repair = await insertOccurrence(api.db, {
        userId,
        status: "SETTLED",
        settledAt: "2026-10-05",
      });

      const response = await changeStatus(cookie, repair.id, {
        status: "SETTLED",
      });

      expect(await response.json()).toMatchObject({
        status: "SETTLED",
        settledAt: "2026-10-05",
      });
    });

    it("reads today in São Paulo, not UTC", async () => {
      // 2026-11-01T01:00Z is still 31 October in São Paulo.
      const lateNight = await startApi({
        now: () => new Date("2026-11-01T01:00:00Z"),
      });
      try {
        const user = await signUp(lateNight);
        await approve(lateNight, user.email);
        const repair = await insertOccurrence(lateNight.db, {
          userId: user.userId,
        });

        const response = await request(
          lateNight,
          `/api/v1/occurrences/${repair.id}/status`,
          { cookie: user.cookie, method: "PATCH", body: { status: "SETTLED" } }
        );

        expect(await response.json()).toMatchObject({
          settledAt: "2026-10-31",
        });
      } finally {
        await lateNight.close();
      }
    });
  });

  it.each(["PENDING", "SKIPPED"])(
    "clears the settlement date when a settled occurrence becomes %s",
    async (status) => {
      const { cookie, userId } = await approvedUser();
      const repair = await insertOccurrence(api.db, {
        userId,
        status: "SETTLED",
        settledAt: "2026-10-05",
      });

      const response = await changeStatus(cookie, repair.id, { status });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ status, settledAt: null });
    }
  );

  it("skips a virtual occurrence whose amount is to be defined", async () => {
    const { cookie, userId } = await approvedUser();
    const card = await insertRecurrence(api.db, {
      userId,
      defaultAmount: null,
    });

    const response = await changeStatus(
      cookie,
      `virtual_${card.id}_2026-10-01`,
      { status: "SKIPPED" }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "SKIPPED",
      amount: null,
      settledAt: null,
    });
  });

  it.each([
    ["an unknown status", { status: "OVERDUE" }, "status"],
    ["a zero amount", { status: "SETTLED", amount: 0 }, "amount"],
    [
      "a settlement date without settling",
      { status: "SKIPPED", settledAt: "2026-10-08" },
      "settledAt",
    ],
  ])(
    "rejects %s with 400 INVALID_INPUT, naming the field",
    async (_, body, field) => {
      const { cookie, userId } = await approvedUser();
      const repair = await insertOccurrence(api.db, { userId });

      const response = await changeStatus(cookie, repair.id, body);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: "INVALID_INPUT",
        fields: [field],
      });
    }
  );

  describe("another user's occurrences", () => {
    it("cannot change their persisted occurrence", async () => {
      const owner = await approvedUser();
      const intruder = await approvedUser();
      const repair = await insertOccurrence(api.db, { userId: owner.userId });

      const response = await changeStatus(intruder.cookie, repair.id, {
        status: "SKIPPED",
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ code: "OCCURRENCE_NOT_FOUND" });
      expect(await itemsOf(owner.cookie, "2026-10")).toEqual([
        expect.objectContaining({ id: repair.id, status: "PENDING" }),
      ]);
    });

    it("cannot materialize their recurrence's virtual occurrence", async () => {
      const owner = await approvedUser();
      const intruder = await approvedUser();
      const rent = await insertRecurrence(api.db, { userId: owner.userId });
      const id = `virtual_${rent.id}_2026-10-01`;

      const response = await changeStatus(intruder.cookie, id, {
        status: "SETTLED",
      });

      expect(response.status).toBe(404);
      expect(await itemsOf(owner.cookie, "2026-10")).toEqual([
        expect.objectContaining({ id, isVirtual: true, status: "PENDING" }),
      ]);
      expect(await itemsOf(intruder.cookie, "2026-10")).toEqual([]);
    });
  });

  it.each([
    ["an id that is neither a uuid nor virtual", "rent"],
    ["an unknown uuid", "0b6f6c1e-7a51-4d1a-9a8e-3f1f4c2d9b10"],
  ])("answers 404 for %s", async (_, id) => {
    const { cookie } = await approvedUser();

    const response = await changeStatus(cookie, id, { status: "SETTLED" });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "OCCURRENCE_NOT_FOUND" });
  });

  it("answers 404 for a virtual id outside its recurrence's periods", async () => {
    const { cookie, userId } = await approvedUser();
    const installment = await insertRecurrence(api.db, {
      userId,
      startPeriod: "2026-10-01",
      endPeriod: "2026-11-01",
    });

    const before = await changeStatus(
      cookie,
      `virtual_${installment.id}_2026-09-01`,
      { status: "SETTLED" }
    );
    const after = await changeStatus(
      cookie,
      `virtual_${installment.id}_2026-12-01`,
      { status: "SETTLED" }
    );

    expect(before.status).toBe(404);
    expect(after.status).toBe(404);
    expect(await itemsOf(cookie, "2026-09")).toEqual([]);
    expect(await itemsOf(cookie, "2026-12")).toEqual([]);
  });
});

function edit(cookie: string, id: string, body: unknown) {
  return request(api, `/api/v1/occurrences/${id}`, {
    cookie,
    method: "PATCH",
    body,
  });
}

describe("PATCH /api/v1/occurrences/:id", () => {
  it("edits the description, amount, due date and notes of a persisted occurrence", async () => {
    const { cookie, userId } = await approvedUser();
    const repair = await insertOccurrence(api.db, { userId, amount: 85000 });

    const response = await edit(cookie, repair.id, {
      description: "Conserto do freio",
      amount: 91050,
      dueDate: "2026-10-28",
      notes: "Oficina do Zé",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: repair.id,
      description: "Conserto do freio",
      amount: 91050,
      dueDate: "2026-10-28",
      notes: "Oficina do Zé",
      status: "PENDING",
    });
    expect(await itemsOf(cookie, "2026-10")).toEqual([
      expect.objectContaining({
        id: repair.id,
        description: "Conserto do freio",
        amount: 91050,
        dueDate: "2026-10-28",
        notes: "Oficina do Zé",
      }),
    ]);
  });

  it("materializes a virtual occurrence, leaving its recurrence untouched", async () => {
    const { cookie, userId } = await approvedUser();
    const power = await insertRecurrence(api.db, {
      userId,
      description: "Energia",
      defaultAmount: 18000,
      dueDay: 25,
      startPeriod: "2026-10-01",
    });

    const response = await edit(cookie, `virtual_${power.id}_2026-11-01`, {
      amount: 23045,
      notes: "Bandeira vermelha",
    });

    expect(response.status).toBe(200);
    const materialized = await response.json();
    expect(materialized).toMatchObject({
      recurrenceId: power.id,
      direction: "OUTFLOW",
      description: "Energia",
      status: "PENDING",
      amount: 23045,
      period: "2026-11-01",
      dueDate: "2026-11-25",
      notes: "Bandeira vermelha",
    });
    expect(await itemsOf(cookie, "2026-11")).toEqual([
      expect.objectContaining({
        id: materialized.id,
        isVirtual: false,
        amount: 23045,
      }),
    ]);
    // The recurrence still projects as it was, in this period and the others.
    const [recurrence] = await api.db
      .select()
      .from(schema.recurrences)
      .where(eq(schema.recurrences.id, power.id));
    expect(recurrence).toEqual(power);
    expect(await itemsOf(cookie, "2026-12")).toEqual([
      expect.objectContaining({
        isVirtual: true,
        description: "Energia",
        amount: 18000,
        notes: null,
      }),
    ]);
  });

  it("materializes the same virtual occurrence once across edits and status changes", async () => {
    const { cookie, userId } = await approvedUser();
    const rent = await insertRecurrence(api.db, { userId });
    const id = `virtual_${rent.id}_2026-10-01`;

    const [first, second] = await Promise.all([
      edit(cookie, id, { notes: "Primeira" }),
      changeStatus(cookie, id, { status: "SETTLED" }),
    ]);
    const third = await edit(cookie, id, { amount: 230000 });

    const ids = await Promise.all(
      [first, second, third].map(async (response) => {
        expect(response.status).toBe(200);
        return (await response.json()).id;
      })
    );
    expect(new Set(ids).size).toBe(1);
    expect(await itemsOf(cookie, "2026-10")).toEqual([
      expect.objectContaining({
        id: ids[0],
        status: "SETTLED",
        amount: 230000,
        notes: "Primeira",
      }),
    ]);
  });

  describe("the due date", () => {
    it.each(["2026-09-30", "2026-11-01"])(
      "refuses %s, outside the period",
      async (dueDate) => {
        const { cookie, userId } = await approvedUser();
        const repair = await insertOccurrence(api.db, { userId });

        const response = await edit(cookie, repair.id, { dueDate });

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
          code: "DUE_DATE_OUTSIDE_PERIOD",
        });
        expect(await itemsOf(cookie, "2026-10")).toEqual([
          expect.objectContaining({ id: repair.id, dueDate: "2026-10-20" }),
        ]);
      }
    );

    it("refuses one outside the period of a virtual occurrence, materializing nothing", async () => {
      const { cookie, userId } = await approvedUser();
      const rent = await insertRecurrence(api.db, { userId });
      const id = `virtual_${rent.id}_2026-10-01`;

      const response = await edit(cookie, id, { dueDate: "2026-11-10" });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: "DUE_DATE_OUTSIDE_PERIOD",
      });
      expect(await itemsOf(cookie, "2026-10")).toEqual([
        expect.objectContaining({ id, isVirtual: true }),
      ]);
    });

    it("can be removed", async () => {
      const { cookie, userId } = await approvedUser();
      const repair = await insertOccurrence(api.db, { userId });

      const response = await edit(cookie, repair.id, { dueDate: null });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ dueDate: null });
    });
  });

  describe("the settlement date", () => {
    it("is edited on a settled occurrence", async () => {
      const { cookie, userId } = await approvedUser();
      const repair = await insertOccurrence(api.db, {
        userId,
        status: "SETTLED",
        settledAt: "2026-10-05",
      });

      const response = await edit(cookie, repair.id, {
        settledAt: "2026-10-03",
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        status: "SETTLED",
        settledAt: "2026-10-03",
      });
    });

    it.each(["PENDING", "SKIPPED"] as const)(
      "is refused on a %s occurrence",
      async (status) => {
        const { cookie, userId } = await approvedUser();
        const repair = await insertOccurrence(api.db, { userId, status });

        const response = await edit(cookie, repair.id, {
          settledAt: "2026-10-03",
        });

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
          code: "OCCURRENCE_NOT_SETTLED",
        });
        expect(await itemsOf(cookie, "2026-10")).toEqual([
          expect.objectContaining({ status, settledAt: null }),
        ]);
      }
    );

    it("is refused on a virtual occurrence, materializing nothing", async () => {
      const { cookie, userId } = await approvedUser();
      const rent = await insertRecurrence(api.db, { userId });
      const id = `virtual_${rent.id}_2026-10-01`;

      const response = await edit(cookie, id, { settledAt: "2026-10-03" });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: "OCCURRENCE_NOT_SETTLED",
      });
      expect(await itemsOf(cookie, "2026-10")).toEqual([
        expect.objectContaining({ id, isVirtual: true }),
      ]);
    });
  });

  describe("the amount", () => {
    it("can become to be defined on a pending occurrence", async () => {
      const { cookie, userId } = await approvedUser();
      const repair = await insertOccurrence(api.db, { userId });

      const response = await edit(cookie, repair.id, { amount: null });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ amount: null });
    });

    it("is required on a settled occurrence", async () => {
      const { cookie, userId } = await approvedUser();
      const repair = await insertOccurrence(api.db, {
        userId,
        status: "SETTLED",
        settledAt: "2026-10-05",
      });

      const response = await edit(cookie, repair.id, { amount: null });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: "AMOUNT_REQUIRED_TO_SETTLE",
      });
      expect(await itemsOf(cookie, "2026-10")).toEqual([
        expect.objectContaining({ amount: 85000 }),
      ]);
    });
  });

  it.each([
    ["the direction", { direction: "INFLOW" }, "direction"],
    ["the period", { period: "2026-11-01" }, "period"],
    [
      "the recurrence",
      { recurrenceId: "5d2c8a4b-1e3f-4b6a-8c9d-2a7e6f1b3c40" },
      "recurrenceId",
    ],
    ["the status", { status: "SETTLED" }, "status"],
    ["a blank description", { description: "  " }, "description"],
    ["a zero amount", { amount: 0 }, "amount"],
    ["a removed settlement date", { settledAt: null }, "settledAt"],
  ])(
    "rejects changing %s with 400 INVALID_INPUT, naming the field",
    async (_, body, field) => {
      const { cookie, userId } = await approvedUser();
      const repair = await insertOccurrence(api.db, {
        userId,
        status: "SETTLED",
        settledAt: "2026-10-05",
      });

      const response = await edit(cookie, repair.id, body);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: "INVALID_INPUT",
        fields: [field],
      });
      expect(await itemsOf(cookie, "2026-10")).toEqual([
        expect.objectContaining({
          id: repair.id,
          direction: "OUTFLOW",
          period: "2026-10-01",
          recurrenceId: null,
          status: "SETTLED",
          amount: 85000,
          settledAt: "2026-10-05",
        }),
      ]);
    }
  );

  describe("another user's occurrences", () => {
    it("cannot edit their persisted occurrence", async () => {
      const owner = await approvedUser();
      const intruder = await approvedUser();
      const repair = await insertOccurrence(api.db, { userId: owner.userId });

      const response = await edit(intruder.cookie, repair.id, {
        description: "Invadido",
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ code: "OCCURRENCE_NOT_FOUND" });
      expect(await itemsOf(owner.cookie, "2026-10")).toEqual([
        expect.objectContaining({ description: "Conserto do carro" }),
      ]);
    });

    it("cannot materialize their recurrence's virtual occurrence", async () => {
      const owner = await approvedUser();
      const intruder = await approvedUser();
      const rent = await insertRecurrence(api.db, { userId: owner.userId });
      const id = `virtual_${rent.id}_2026-10-01`;

      const response = await edit(intruder.cookie, id, { notes: "Invadido" });

      expect(response.status).toBe(404);
      expect(await itemsOf(owner.cookie, "2026-10")).toEqual([
        expect.objectContaining({ id, isVirtual: true, notes: null }),
      ]);
    });
  });

  it("materializes a virtual occurrence on an edit that changes nothing", async () => {
    const { cookie, userId } = await approvedUser();
    const rent = await insertRecurrence(api.db, { userId });
    const id = `virtual_${rent.id}_2026-10-01`;

    const response = await edit(cookie, id, {});

    expect(response.status).toBe(200);
    const materialized = await response.json();
    expect(materialized).toMatchObject({
      recurrenceId: rent.id,
      description: "Aluguel",
      amount: 220000,
    });
    expect(await itemsOf(cookie, "2026-10")).toEqual([
      expect.objectContaining({ id: materialized.id, isVirtual: false }),
    ]);
  });
});
