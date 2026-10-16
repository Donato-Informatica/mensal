import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ActivityEvent } from "../src/activity.ts";
import { approve, request, signUp, startApi, type TestApi } from "./api.ts";
import { insertOccurrence, insertRecurrence } from "./fixtures.ts";

const at = "2026-10-16T14:03:00.000Z";

const events: ActivityEvent[] = [];
let api: TestApi;
beforeAll(async () => {
  api = await startApi({
    now: () => new Date(at),
    activity: (event) => events.push(event),
  });
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

/**
 * What `userId` did to their items, in the order it was logged; account events
 * such as their sign-up are covered by account-activity.test.ts.
 */
function activityOf(userId: string) {
  return events.filter(
    (event) =>
      "user" in event &&
      event.user === userId &&
      !event.action.startsWith("user.")
  );
}

const oneOff = {
  direction: "OUTFLOW",
  description: "Conserto do carro",
  amount: 85000,
  period: "2026-10-01",
  dueDate: "2026-10-20",
  notes: "",
};

describe("the activity log (PRD §8.7)", () => {
  it("logs a one-off occurrence created", async () => {
    const { cookie, userId } = await approvedUser();

    const response = await request(api, "/api/v1/occurrences", {
      cookie,
      body: oneOff,
    });

    const { id } = await response.json();
    expect(activityOf(userId)).toEqual([
      { at, user: userId, action: "occurrence.create", kind: "occurrence", id },
    ]);
  });

  it("logs the names of the fields an edit changes, never their values", async () => {
    const { cookie, userId } = await approvedUser();
    const repair = await insertOccurrence(api.db, {
      userId,
      description: "Conserto do carro",
      amount: 85000,
    });

    await request(api, `/api/v1/occurrences/${repair.id}`, {
      cookie,
      method: "PATCH",
      body: {
        description: "Conserto do freio",
        amount: 85000,
        notes: "Oficina",
      },
    });

    expect(activityOf(userId)).toEqual([
      {
        at,
        user: userId,
        action: "occurrence.edit",
        kind: "occurrence",
        id: repair.id,
        fields: ["description", "notes"],
      },
    ]);
  });

  it("logs the new status of an occurrence", async () => {
    const { cookie, userId } = await approvedUser();
    const repair = await insertOccurrence(api.db, { userId });

    await changeStatus(cookie, repair.id, { status: "SKIPPED" });

    expect(activityOf(userId)).toEqual([
      {
        at,
        user: userId,
        action: "occurrence.status",
        kind: "occurrence",
        id: repair.id,
        status: "SKIPPED",
      },
    ]);
  });

  it("logs the persisted id and the virtual one it came from, when a status change materializes it", async () => {
    const { cookie, userId } = await approvedUser();
    const rent = await insertRecurrence(api.db, { userId });
    const virtualId = `virtual_${rent.id}_2026-10-01`;

    const settled = await changeStatus(cookie, virtualId, {
      status: "SETTLED",
    });

    const { id } = await settled.json();
    expect(id).not.toBe(virtualId);
    expect(activityOf(userId)).toEqual([
      {
        at,
        user: userId,
        action: "occurrence.status",
        kind: "occurrence",
        id,
        from: virtualId,
        status: "SETTLED",
      },
    ]);
  });

  it("logs the persisted id and the virtual one it came from, when an edit materializes it", async () => {
    const { cookie, userId } = await approvedUser();
    const rent = await insertRecurrence(api.db, { userId });
    const virtualId = `virtual_${rent.id}_2026-10-01`;

    const edited = await request(api, `/api/v1/occurrences/${virtualId}`, {
      cookie,
      method: "PATCH",
      body: { notes: "Pago no Pix" },
    });

    const { id } = await edited.json();
    expect(id).not.toBe(virtualId);
    expect(activityOf(userId)).toEqual([
      {
        at,
        user: userId,
        action: "occurrence.edit",
        kind: "occurrence",
        id,
        from: virtualId,
        fields: ["notes"],
      },
    ]);
  });

  it("logs no virtual id for a later write sent to the virtual id of an occurrence already materialized", async () => {
    const { cookie, userId } = await approvedUser();
    const rent = await insertRecurrence(api.db, { userId });
    const virtualId = `virtual_${rent.id}_2026-10-01`;
    const settled = await changeStatus(cookie, virtualId, {
      status: "SETTLED",
    });
    const { id } = await settled.json();

    await request(api, `/api/v1/occurrences/${virtualId}`, {
      cookie,
      method: "PATCH",
      body: { notes: "Pago no Pix" },
    });

    expect(activityOf(userId).at(-1)).toEqual({
      at,
      user: userId,
      action: "occurrence.edit",
      kind: "occurrence",
      id,
      fields: ["notes"],
    });
  });

  it("logs a one-off occurrence deleted", async () => {
    const { cookie, userId } = await approvedUser();
    const repair = await insertOccurrence(api.db, { userId });

    const response = await request(api, `/api/v1/occurrences/${repair.id}`, {
      cookie,
      method: "DELETE",
    });

    expect(response.status).toBe(204);
    expect(activityOf(userId)).toEqual([
      {
        at,
        user: userId,
        action: "occurrence.delete",
        kind: "occurrence",
        id: repair.id,
      },
    ]);
  });

  it("logs nothing for an edit that changes nothing", async () => {
    const { cookie, userId } = await approvedUser();
    const repair = await insertOccurrence(api.db, {
      userId,
      description: "Conserto do carro",
    });

    const rent = await insertRecurrence(api.db, { userId });
    const virtualId = `virtual_${rent.id}_2026-10-01`;

    const responses = await Promise.all([
      request(api, `/api/v1/occurrences/${repair.id}`, {
        cookie,
        method: "PATCH",
        body: { description: "Conserto do carro" },
      }),
      request(api, `/api/v1/occurrences/${virtualId}`, {
        cookie,
        method: "PATCH",
        body: {},
      }),
      changeStatus(cookie, virtualId, { status: "PENDING" }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200,
    ]);
    expect(activityOf(userId)).toEqual([]);
  });

  it("logs nothing for a refused write", async () => {
    const { cookie, userId } = await approvedUser();
    const rent = await insertRecurrence(api.db, {
      userId,
      defaultAmount: null,
    });
    const repair = await insertOccurrence(api.db, { userId, amount: null });

    const responses = await Promise.all([
      // A virtual occurrence's materialization rolls back with the refusal.
      changeStatus(cookie, `virtual_${rent.id}_2026-10-01`, {
        status: "SETTLED",
      }),
      changeStatus(cookie, repair.id, { status: "SETTLED" }),
      request(api, `/api/v1/occurrences/${repair.id}`, {
        cookie,
        method: "PATCH",
        body: { dueDate: "2026-11-05" },
      }),
      request(api, "/api/v1/occurrences", {
        cookie,
        body: { ...oneOff, amount: -1 },
      }),
      request(api, `/api/v1/occurrences/virtual_${rent.id}_2026-10-01`, {
        cookie,
        method: "DELETE",
      }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      400, 400, 400, 400, 409,
    ]);
    expect(activityOf(userId)).toEqual([]);
  });

  it("logs nothing for a read", async () => {
    const { cookie, userId } = await approvedUser();
    await insertRecurrence(api.db, { userId });

    const response = await request(api, "/api/v1/periods/2026-10", { cookie });

    expect(response.status).toBe(200);
    expect(activityOf(userId)).toEqual([]);
  });
});

const rentInput = {
  direction: "OUTFLOW",
  description: "Aluguel",
  defaultAmount: 220000,
  dueDay: 10,
  startPeriod: "2026-10-01",
  endPeriod: null,
  notes: "",
};

describe("the activity log of recurrences (PRD §8.7)", () => {
  it("logs a recurrence created", async () => {
    const { cookie, userId } = await approvedUser();

    const response = await request(api, "/api/v1/recurrences", {
      cookie,
      body: rentInput,
    });

    const { id } = await response.json();
    expect(activityOf(userId)).toEqual([
      { at, user: userId, action: "recurrence.create", kind: "recurrence", id },
    ]);
  });

  it("logs the names of the fields an edit changes, never their values", async () => {
    const { cookie, userId } = await approvedUser();
    const recurrence = await insertRecurrence(api.db, {
      userId,
      description: "Aluguel",
      defaultAmount: 220000,
    });

    await request(api, `/api/v1/recurrences/${recurrence.id}`, {
      cookie,
      method: "PATCH",
      body: { description: "Aluguel", defaultAmount: 235000, notes: "IGP-M" },
    });

    expect(activityOf(userId)).toEqual([
      {
        at,
        user: userId,
        action: "recurrence.edit",
        kind: "recurrence",
        id: recurrence.id,
        fields: ["defaultAmount", "notes"],
      },
    ]);
  });

  it("logs a recurrence deleted", async () => {
    const { cookie, userId } = await approvedUser();
    const recurrence = await insertRecurrence(api.db, { userId });

    const response = await request(
      api,
      `/api/v1/recurrences/${recurrence.id}`,
      { cookie, method: "DELETE" }
    );

    expect(response.status).toBe(204);
    expect(activityOf(userId)).toEqual([
      {
        at,
        user: userId,
        action: "recurrence.delete",
        kind: "recurrence",
        id: recurrence.id,
      },
    ]);
  });

  it("logs a recurrence ended as an edit of its endPeriod", async () => {
    const { cookie, userId } = await approvedUser();
    const recurrence = await insertRecurrence(api.db, { userId });

    await request(api, `/api/v1/recurrences/${recurrence.id}`, {
      cookie,
      method: "PATCH",
      body: { endPeriod: "2026-12-01" },
    });

    expect(activityOf(userId)).toEqual([
      {
        at,
        user: userId,
        action: "recurrence.edit",
        kind: "recurrence",
        id: recurrence.id,
        fields: ["endPeriod"],
      },
    ]);
  });

  it("logs nothing for an edit that changes nothing", async () => {
    const { cookie, userId } = await approvedUser();
    const recurrence = await insertRecurrence(api.db, {
      userId,
      description: "Aluguel",
      endPeriod: null,
    });

    const responses = await Promise.all([
      request(api, `/api/v1/recurrences/${recurrence.id}`, {
        cookie,
        method: "PATCH",
        body: { description: "Aluguel", endPeriod: null },
      }),
      request(api, `/api/v1/recurrences/${recurrence.id}`, {
        cookie,
        method: "PATCH",
        body: {},
      }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(activityOf(userId)).toEqual([]);
  });

  it("logs nothing for a refused write", async () => {
    const { cookie, userId } = await approvedUser();
    const kept = await insertRecurrence(api.db, { userId });
    await insertOccurrence(api.db, {
      userId,
      recurrenceId: kept.id,
      period: "2026-10-01",
    });

    const responses = await Promise.all([
      request(api, `/api/v1/recurrences/${kept.id}`, {
        cookie,
        method: "DELETE",
      }),
      request(api, "/api/v1/recurrences", {
        cookie,
        body: { ...rentInput, startPeriod: "2026-09-01" },
      }),
      request(api, `/api/v1/recurrences/${kept.id}`, {
        cookie,
        method: "PATCH",
        body: { endPeriod: "2025-12-01" },
      }),
    ]);

    expect(
      await Promise.all(responses.map((response) => response.json()))
    ).toEqual([
      { code: "RECURRENCE_HAS_OCCURRENCES" },
      { code: "START_PERIOD_IN_PAST" },
      { code: "END_PERIOD_BEFORE_START" },
    ]);
    expect(activityOf(userId)).toEqual([]);
  });

  it("logs nothing for a read", async () => {
    const { cookie, userId } = await approvedUser();
    const recurrence = await insertRecurrence(api.db, { userId });

    const responses = await Promise.all([
      request(api, "/api/v1/recurrences", { cookie }),
      request(api, `/api/v1/recurrences/${recurrence.id}`, { cookie }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(activityOf(userId)).toEqual([]);
  });
});
