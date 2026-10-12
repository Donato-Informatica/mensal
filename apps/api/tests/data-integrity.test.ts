import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signUp, startApi, type TestApi } from "./api.ts";
import { insertOccurrence, insertRecurrence } from "./fixtures.ts";

let api: TestApi;
beforeAll(async () => {
  api = await startApi();
});
afterAll(async () => {
  await api.close();
});

async function count(table: string, userId: string): Promise<number> {
  const { rows } = await api.db.$client.query<{ count: string }>(
    `SELECT count(*) FROM ${table} WHERE user_id = $1`,
    [userId]
  );
  return Number(rows[0]!.count);
}

/** The Postgres error code a statement fails with. */
async function failureCode(statement: Promise<unknown>): Promise<string> {
  const error: unknown = await statement.then(
    () => expect.fail("expected the database to reject the statement"),
    (error: unknown) => error
  );
  const cause = (error as { cause?: { code?: string } }).cause;
  return cause?.code ?? (error as { code: string }).code;
}

const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";

describe("deleting a user", () => {
  it("deletes their recurrences and occurrences", async () => {
    const { userId } = await signUp(api);
    const recurrence = await insertRecurrence(api.db, { userId });
    await insertOccurrence(api.db, { userId, recurrenceId: recurrence.id });
    await insertOccurrence(api.db, { userId });

    await api.db.$client.query("DELETE FROM users WHERE id = $1", [userId]);

    expect(await count("recurrences", userId)).toBe(0);
    expect(await count("occurrences", userId)).toBe(0);
  });
});

describe("the database rejects", () => {
  it.each([
    ["an amount of zero", { amount: 0 }],
    [
      "a settled occurrence without an amount",
      {
        status: "SETTLED" as const,
        amount: null,
        settledAt: "2026-10-05",
      },
    ],
    [
      "a settled occurrence without a settlement date",
      {
        status: "SETTLED" as const,
        settledAt: null,
      },
    ],
    [
      "a pending occurrence with a settlement date",
      {
        status: "PENDING" as const,
        settledAt: "2026-10-05",
      },
    ],
    ["a due date outside the period", { dueDate: "2026-11-01" }],
    [
      "a period that is not the 1st of a month",
      {
        period: "2026-10-02",
        dueDate: null,
      },
    ],
  ])("an occurrence with %s", async (_, values) => {
    const { userId } = await signUp(api);

    expect(
      await failureCode(insertOccurrence(api.db, { userId, ...values }))
    ).toBe(CHECK_VIOLATION);
  });

  it.each([
    ["a default amount of zero", { defaultAmount: 0 }],
    ["a due day of 32", { dueDay: 32 }],
    [
      "an end before its start",
      {
        startPeriod: "2026-10-01",
        endPeriod: "2026-09-01",
      },
    ],
    [
      "a start period that is not the 1st of a month",
      {
        startPeriod: "2026-10-15",
      },
    ],
  ])("a recurrence with %s", async (_, values) => {
    const { userId } = await signUp(api);

    expect(
      await failureCode(insertRecurrence(api.db, { userId, ...values }))
    ).toBe(CHECK_VIOLATION);
  });

  it("a second occurrence of a recurrence in the same period", async () => {
    const { userId } = await signUp(api);
    const { id: recurrenceId } = await insertRecurrence(api.db, { userId });
    await insertOccurrence(api.db, { userId, recurrenceId });

    expect(
      await failureCode(insertOccurrence(api.db, { userId, recurrenceId }))
    ).toBe(UNIQUE_VIOLATION);
  });
});

describe("the database accepts", () => {
  it("several one-off occurrences in the same period", async () => {
    const { userId } = await signUp(api);
    await insertOccurrence(api.db, { userId });
    await insertOccurrence(api.db, { userId });

    expect(await count("occurrences", userId)).toBe(2);
  });
});
