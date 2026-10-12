import {
  periodOfMonth,
  resolvePeriod,
  today,
  type Occurrence,
  type Recurrence,
} from "@mensal/shared";

interface Account {
  id: string;
  name: string;
  email: string;
  password: string;
  approved: boolean;
  recurrences: Recurrence[];
  occurrences: Occurrence[];
}

/**
 * An in-memory stand-in for the Better-Auth and /api/v1 endpoints the web app
 * calls, answering in the same shapes and error codes. The session cookie is
 * modelled as "who is signed in"; periods are resolved by the real
 * `resolvePeriod`, as the API does.
 */
export function fakeApi() {
  const accounts = new Map<string, Account>();
  let signedIn: Account | undefined;
  let down = false;

  function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  function sessionOf({ id, name, email, approved }: Account) {
    return {
      user: { id, name, email, approved, emailVerified: false },
      session: { id: `session-${id}`, userId: id },
    };
  }

  /** GET /api/v1/periods/:yyyy-mm, behind the approval gate. */
  function getPeriod(month: string): Response {
    if (!signedIn) return json(401, { code: "UNAUTHENTICATED" });
    if (!signedIn.approved) return json(403, { code: "USER_NOT_APPROVED" });
    const period = periodOfMonth(month);
    if (!period) return json(400, { code: "INVALID_PERIOD" });
    return json(
      200,
      resolvePeriod({
        period,
        today: today(),
        occurrences: signedIn.occurrences,
        recurrences: signedIn.recurrences,
      })
    );
  }

  const handlers: Record<string, (body: Record<string, string>) => Response> = {
    "GET /api/auth/get-session": () =>
      json(200, signedIn ? sessionOf(signedIn) : null),
    "POST /api/auth/sign-in/email": ({ email, password }) => {
      const account = accounts.get(email ?? "");
      if (!account || account.password !== password) {
        return json(401, {
          code: "INVALID_EMAIL_OR_PASSWORD",
          message: "Invalid email or password",
        });
      }
      signedIn = account;
      return json(200, { redirect: false, ...sessionOf(account) });
    },
    "POST /api/auth/sign-up/email": ({ name, email, password }) => {
      if (accounts.has(email ?? "")) {
        return json(422, {
          code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
          message: "User already exists. Use another email.",
        });
      }
      signedIn = api.addAccount({
        name: name ?? "",
        email: email ?? "",
        password: password ?? "",
      });
      return json(200, sessionOf(signedIn));
    },
    "POST /api/auth/sign-out": () => {
      signedIn = undefined;
      return json(200, { success: true });
    },
  };

  const api = {
    fetch: async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      if (down) return json(500, { message: "Internal Server Error" });
      const request = new Request(input, init);
      const { pathname } = new URL(request.url);
      const periodMatch = /^\/api\/v1\/periods\/([^/]+)$/.exec(pathname);
      if (request.method === "GET" && periodMatch) {
        return getPeriod(decodeURIComponent(periodMatch[1]!));
      }
      const handler = handlers[`${request.method} ${pathname}`];
      if (!handler) return json(404, { message: "Not found" });
      const text = await request.text();
      return handler(text ? JSON.parse(text) : {});
    },

    addAccount({
      approved = false,
      ...account
    }: Pick<Account, "name" | "email" | "password"> & {
      approved?: boolean;
    }): Account {
      const created = {
        id: `user-${accounts.size + 1}`,
        approved,
        recurrences: [],
        occurrences: [],
        ...account,
      };
      accounts.set(created.email, created);
      return created;
    },

    signIn(email: string) {
      signedIn = accounts.get(email);
    },

    /** Seeds a recurrence for the account, as through Adminer. */
    addRecurrence(email: string, overrides: Partial<Recurrence> = {}) {
      const account = accounts.get(email)!;
      const recurrence: Recurrence = {
        id: uuid(),
        userId: account.id,
        direction: "OUTFLOW",
        description: "Aluguel",
        defaultAmount: 220000,
        dueDay: 10,
        startPeriod: "2026-01-01",
        endPeriod: null,
        notes: null,
        createdAt: "2026-01-01T12:00:00.000Z",
        updatedAt: "2026-01-01T12:00:00.000Z",
        ...overrides,
      };
      account.recurrences.push(recurrence);
      return recurrence;
    },

    /** Seeds an occurrence for the account, as through Adminer. */
    addOccurrence(email: string, overrides: Partial<Occurrence> = {}) {
      const account = accounts.get(email)!;
      const occurrence: Occurrence = {
        id: uuid(),
        userId: account.id,
        recurrenceId: null,
        direction: "OUTFLOW",
        description: "Conserto do carro",
        status: "PENDING",
        amount: 85000,
        period: "2026-10-01",
        dueDate: "2026-10-20",
        settledAt: null,
        notes: null,
        createdAt: "2026-10-01T12:00:00.000Z",
        updatedAt: "2026-10-01T12:00:00.000Z",
        ...overrides,
      };
      account.occurrences.push(occurrence);
      return occurrence;
    },

    /** Makes every request fail with 500 until `recover` is called. */
    breakDown() {
      down = true;
    },

    recover() {
      down = false;
    },
  };
  return api;
}

export type FakeApi = ReturnType<typeof fakeApi>;

let sequence = 0;

function uuid(): string {
  sequence += 1;
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}
