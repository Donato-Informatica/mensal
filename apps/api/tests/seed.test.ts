import { clampDueDate, shiftPeriod, type PeriodPayload } from "@mensal/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuth } from "../src/auth.ts";
import {
  assertLocalDatabase,
  assertNoRealUsers,
  demoUser,
  seed,
} from "../src/seed.ts";
import { cookieFrom, request, startApi, type TestApi } from "./api.ts";

let api: TestApi;
beforeAll(async () => {
  api = await startApi();
});
afterAll(async () => {
  await api.close();
});

async function counts() {
  const { rows } = await api.db.$client.query<{ r: string; o: string }>(
    `SELECT (SELECT count(*) FROM recurrences WHERE user_id = u.id) AS r,
            (SELECT count(*) FROM occurrences WHERE user_id = u.id) AS o
     FROM users u WHERE u.email = $1`,
    [demoUser.email]
  );
  return { recurrences: Number(rows[0]!.r), occurrences: Number(rows[0]!.o) };
}

describe("seed", () => {
  it("creates an approved demo user who can sign in, and is re-runnable", async () => {
    const auth = createAuth({
      db: api.db,
      baseURL: api.url,
      secret: "integration-tests-secret-0123456789abcdef",
    });
    await seed(api.db, auth);
    const first = await counts();
    expect(first.recurrences).toBeGreaterThan(0);
    expect(first.occurrences).toBeGreaterThan(0);

    await seed(api.db, auth);
    expect(await counts()).toEqual(first);

    const signIn = await request(api, "/api/auth/sign-in/email", {
      body: { email: demoUser.email, password: demoUser.password },
    });
    expect(signIn.ok).toBe(true);
    const { rows } = await api.db.$client.query(
      "SELECT approved FROM users WHERE email = $1",
      [demoUser.email]
    );
    expect(rows).toEqual([{ approved: true }]);
  });

  // The guide's screenshots (PRD §7.17) need every group of the monthly
  // screen, whatever day of the month they are taken on.
  it.each([
    ["the 1st", "2026-10-01T15:00:00Z", "2026-10", "2026-10-01"],
    ["mid-month", "2026-10-12T15:00:00Z", "2026-10", "2026-10-12"],
    ["the 25th", "2026-10-25T15:00:00Z", "2026-10", "2026-10-25"],
    ["the last day", "2026-10-31T15:00:00Z", "2026-10", "2026-10-31"],
    [
      "late evening, a day behind UTC",
      "2027-03-01T01:00:00Z",
      "2027-02",
      "2027-02-28",
    ],
  ])(
    "has every monthly-screen group on %s, and six months of history",
    async (_, instant, month, today) => {
      const now = () => new Date(instant);
      const dated = await startApi({ now });
      try {
        const auth = createAuth({
          db: dated.db,
          baseURL: dated.url,
          secret: "integration-tests-secret-0123456789abcdef",
          now,
        });
        await seed(dated.db, auth, now);
        const cookie = cookieFrom(
          await request(dated, "/api/auth/sign-in/email", {
            body: { email: demoUser.email, password: demoUser.password },
          })
        );

        const period = (await (
          await request(dated, `/api/v1/periods/${month}`, { cookie })
        ).json()) as PeriodPayload;
        const pending = period.items.filter((i) => i.status === "PENDING");
        const groups = {
          overdueEarlier: period.overdueFromPreviousPeriods,
          dueToday: pending.filter((i) => !i.overdue && i.dueDate === today),
          upcoming: pending.filter((i) => !i.overdue && i.dueDate !== today),
          settled: period.items.filter((i) => i.status === "SETTLED"),
          skipped: period.items.filter((i) => i.status === "SKIPPED"),
          toBeDefined: period.items.filter((i) => i.amount === null),
        };
        for (const [name, items] of Object.entries(groups)) {
          expect(items.length, name).toBeGreaterThan(0);
        }
        expect(groups.upcoming.some((i) => i.dueDate !== null)).toBe(
          clampDueDate(`${month}-01`, 31) !== today
        );

        const from = shiftPeriod(`${month}-01`, -5).slice(0, 7);
        const trend = (await (
          await request(dated, `/api/v1/summaries?from=${from}&to=${month}`, {
            cookie,
          })
        ).json()) as { items: { summary: PeriodPayload["summary"] }[] };
        expect(trend.items).toHaveLength(6);
        for (const { summary } of trend.items) {
          expect(summary.inflowSettled).toBeGreaterThan(0);
          expect(summary.outflowExpected).toBeGreaterThan(0);
        }
      } finally {
        await dated.close();
      }
    }
  );

  it("refuses a non-local or production database", () => {
    expect(() =>
      assertLocalDatabase("postgres://u:p@db.example.com/x")
    ).toThrow(/local development only/);
    expect(() =>
      assertLocalDatabase("postgres://u:p@localhost/x", "production")
    ).toThrow(/local development only/);
    expect(() =>
      assertLocalDatabase("postgres://u:p@localhost/x", "development")
    ).not.toThrow();
  });

  it("refuses the preview opt-in once real users exist", async () => {
    await request(api, "/api/auth/sign-up/email", {
      body: {
        name: "Real",
        email: "real@example.com",
        password: "a-long-enough-password",
      },
    });
    await expect(assertNoRealUsers(api.db)).rejects.toThrow(
      /other than the demo/
    );
  });
});
