import {
  applyStatusChange,
  clampDueDate,
  ColorSchemeSchema,
  currentPeriod,
  defaultColorScheme,
  defaultOccurrenceView,
  editRefusal,
  isActive,
  isInEffect,
  NewAccessTokenSchema,
  NewOneOffSchema,
  NewRecurrenceSchema,
  OccurrenceViewSchema,
  OccurrenceEditSchema,
  parseVirtualId,
  RecurrenceEditSchema,
  RecurrenceListQuerySchema,
  periodOfMonth,
  resolvePeriod,
  StatusChangeSchema,
  parseSummariesQuery,
  summarizeRange,
  today,
  type CreatedAccessToken,
  type Occurrence,
  type Recurrence,
} from "@mensal/shared";

import type { Preference, Preferences } from "../src/session.ts";

/** A new account's preferences (PRD §3.5): all on, in the dark theme, as a list. */
const defaultPreferences: Preferences = {
  showSummary: true,
  confirmStatusChanges: true,
  colorScheme: defaultColorScheme,
  occurrenceView: defaultOccurrenceView,
};

interface Account {
  id: string;
  name: string;
  email: string;
  password: string;
  approved: boolean;
  /** As Better-Auth keeps them, on the user. */
  preferences: Preferences;
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
  /** Reset tokens not yet used, by token, to the email they reset. */
  const resetTokens = new Map<string, string>();
  /** The reset screen each emailed link leads to, by email. */
  const resetLinks = new Map<string, string>();
  let down = false;
  /**
   * While stalled, the requests held unanswered, in the order they came; each
   * is let through, as a 500 when `fail`, by `resume` or `answer`.
   */
  let held: ((fail: boolean) => void)[] | undefined;

  function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  function serverError() {
    return json(500, { message: "Internal Server Error" });
  }

  function sessionOf({ id, name, email, approved, preferences }: Account) {
    return {
      user: {
        id,
        name,
        email,
        approved,
        ...preferences,
        emailVerified: false,
      },
      session: { id: `session-${id}`, userId: id },
    };
  }

  /**
   * The theme a request to Better-Auth carries, checked as the API's
   * validator does: absent, or dark, light or auto. Anything else is
   * `rejected`, with the 400 to answer, and nothing changes.
   */
  function colorSchemeIn(body: Record<string, unknown>) {
    const parsed = ColorSchemeSchema.optional().safeParse(body.colorScheme);
    return parsed.success
      ? { colorScheme: parsed.data, rejected: undefined }
      : {
          colorScheme: undefined,
          rejected: json(400, {
            code: "VALIDATION_ERROR",
            message: "Invalid option",
          }),
        };
  }

  /**
   * POST /api/auth/update-user: the user's own preferences. Anything else,
   * such as `approved`, is ignored, as Better-Auth does for fields that are
   * not `input`.
   */
  function updateUser(body: Record<string, unknown>): Response {
    if (!signedIn) return json(401, { code: "UNAUTHENTICATED" });
    const { rejected } = colorSchemeIn(body);
    if (rejected) return rejected;
    // The API's validator: absent, or list or table.
    if (
      !OccurrenceViewSchema.optional().safeParse(body.occurrenceView).success
    ) {
      return json(400, { code: "VALIDATION_ERROR", message: "Invalid option" });
    }
    for (const preference of Object.keys(defaultPreferences) as Preference[]) {
      const value = body[preference];
      if (typeof value === typeof defaultPreferences[preference]) {
        Object.assign(signedIn.preferences, { [preference]: value });
      }
    }
    return json(200, { status: true });
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

  /**
   * GET /api/v1/summaries?from&to, behind the approval gate, with the route's
   * own range checks (PRD §6.4).
   */
  function getSummaries(search: URLSearchParams): Response {
    if (!signedIn) return json(401, { code: "UNAUTHENTICATED" });
    if (!signedIn.approved) return json(403, { code: "USER_NOT_APPROVED" });
    const parsed = parseSummariesQuery(Object.fromEntries(search));
    if ("code" in parsed) return json(400, { code: parsed.code });
    return json(
      200,
      summarizeRange({
        ...parsed.query,
        occurrences: signedIn.occurrences,
        recurrences: signedIn.recurrences,
      })
    );
  }

  /** POST /api/v1/recurrences, behind the approval gate. */
  function postRecurrence(body: unknown): Response {
    if (!signedIn) return json(401, { code: "UNAUTHENTICATED" });
    if (!signedIn.approved) return json(403, { code: "USER_NOT_APPROVED" });
    const input = NewRecurrenceSchema.safeParse(body);
    if (!input.success) {
      return json(400, {
        code: "INVALID_INPUT",
        fields: [
          ...new Set(
            input.error.issues.flatMap(({ path: [field] }) =>
              field === undefined ? [] : [String(field)]
            )
          ),
        ],
      });
    }
    if (input.data.startPeriod < currentPeriod()) {
      return json(400, { code: "START_PERIOD_IN_PAST" });
    }
    const now = new Date().toISOString();
    const recurrence: Recurrence = {
      id: uuid(),
      userId: signedIn.id,
      ...input.data,
      createdAt: now,
      updatedAt: now,
    };
    signedIn.recurrences.push(recurrence);
    return json(201, recurrence);
  }

  /** GET /api/v1/recurrences?status=active|all, behind the approval gate. */
  function getRecurrences(search: URLSearchParams): Response {
    if (!signedIn) return json(401, { code: "UNAUTHENTICATED" });
    if (!signedIn.approved) return json(403, { code: "USER_NOT_APPROVED" });
    const query = RecurrenceListQuerySchema.safeParse(
      Object.fromEntries(search)
    );
    if (!query.success) return json(400, { code: "INVALID_INPUT" });
    const period = currentPeriod();
    return json(
      200,
      signedIn.recurrences
        .filter(
          (recurrence) =>
            query.data.status === "all" || isActive(recurrence, period)
        )
        .toSorted((a, b) => a.description.localeCompare(b.description))
    );
  }

  /** GET /api/v1/recurrences/:id, behind the approval gate. */
  function getRecurrence(id: string): Response {
    if (!signedIn) return json(401, { code: "UNAUTHENTICATED" });
    if (!signedIn.approved) return json(403, { code: "USER_NOT_APPROVED" });
    const recurrence = signedIn.recurrences.find(
      (candidate) => candidate.id === id
    );
    if (!recurrence) return json(404, { code: "RECURRENCE_NOT_FOUND" });
    return json(200, recurrence);
  }

  /** PATCH /api/v1/recurrences/:id, behind the approval gate. */
  function patchRecurrence(id: string, body: unknown): Response {
    if (!signedIn) return json(401, { code: "UNAUTHENTICATED" });
    if (!signedIn.approved) return json(403, { code: "USER_NOT_APPROVED" });
    const input = RecurrenceEditSchema.safeParse(body);
    if (!input.success) return json(400, { code: "INVALID_INPUT" });
    const recurrence = signedIn.recurrences.find(
      (candidate) => candidate.id === id
    );
    if (!recurrence) return json(404, { code: "RECURRENCE_NOT_FOUND" });
    const { endPeriod } = input.data;
    if (endPeriod && endPeriod < recurrence.startPeriod) {
      return json(400, { code: "END_PERIOD_BEFORE_START" });
    }
    if (Object.values(input.data).every((value) => value === undefined)) {
      return json(200, recurrence);
    }
    Object.assign(recurrence, input.data, {
      updatedAt: new Date().toISOString(),
    });
    return json(200, recurrence);
  }

  /** DELETE /api/v1/recurrences/:id, behind the approval gate. */
  function deleteRecurrence(id: string): Response {
    if (!signedIn) return json(401, { code: "UNAUTHENTICATED" });
    if (!signedIn.approved) return json(403, { code: "USER_NOT_APPROVED" });
    const recurrence = signedIn.recurrences.find(
      (candidate) => candidate.id === id
    );
    if (!recurrence) return json(404, { code: "RECURRENCE_NOT_FOUND" });
    if (signedIn.occurrences.some(({ recurrenceId }) => recurrenceId === id)) {
      return json(409, { code: "RECURRENCE_HAS_OCCURRENCES" });
    }
    signedIn.recurrences.splice(signedIn.recurrences.indexOf(recurrence), 1);
    return new Response(null, { status: 204 });
  }

  /** POST /api/v1/occurrences, behind the approval gate. */
  function postOccurrence(body: unknown): Response {
    if (!signedIn) return json(401, { code: "UNAUTHENTICATED" });
    if (!signedIn.approved) return json(403, { code: "USER_NOT_APPROVED" });
    const input = NewOneOffSchema.safeParse(body);
    if (!input.success) return json(400, { code: "INVALID_INPUT" });
    const now = new Date().toISOString();
    const occurrence: Occurrence = {
      id: uuid(),
      userId: signedIn.id,
      recurrenceId: null,
      status: "PENDING",
      settledAt: null,
      ...input.data,
      createdAt: now,
      updatedAt: now,
    };
    signedIn.occurrences.push(occurrence);
    return json(201, occurrence);
  }

  /** PATCH /api/v1/occurrences/:id/status, behind the approval gate. */
  function patchStatus(id: string, body: unknown): Response {
    if (!signedIn) return json(401, { code: "UNAUTHENTICATED" });
    if (!signedIn.approved) return json(403, { code: "USER_NOT_APPROVED" });
    const input = StatusChangeSchema.safeParse(body);
    if (!input.success) return json(400, { code: "INVALID_INPUT" });
    const occurrence =
      signedIn.occurrences.find((persisted) => persisted.id === id) ??
      materialized(signedIn, id);
    if (!occurrence) return json(404, { code: "OCCURRENCE_NOT_FOUND" });
    const changed = applyStatusChange(occurrence, input.data, today());
    if (changed.status === "SETTLED" && changed.amount === null) {
      return json(400, { code: "AMOUNT_REQUIRED_TO_SETTLE" });
    }
    Object.assign(occurrence, changed, {
      updatedAt: new Date().toISOString(),
    });
    if (!signedIn.occurrences.includes(occurrence)) {
      signedIn.occurrences.push(occurrence);
    }
    return json(200, occurrence);
  }

  /** PATCH /api/v1/occurrences/:id, behind the approval gate. */
  function patchOccurrence(id: string, body: unknown): Response {
    if (!signedIn) return json(401, { code: "UNAUTHENTICATED" });
    if (!signedIn.approved) return json(403, { code: "USER_NOT_APPROVED" });
    const input = OccurrenceEditSchema.safeParse(body);
    if (!input.success) return json(400, { code: "INVALID_INPUT" });
    const occurrence =
      signedIn.occurrences.find((persisted) => persisted.id === id) ??
      materialized(signedIn, id);
    if (!occurrence) return json(404, { code: "OCCURRENCE_NOT_FOUND" });
    const refusal = editRefusal(occurrence, input.data);
    if (refusal) return json(400, { code: refusal });
    Object.assign(occurrence, input.data, {
      updatedAt: new Date().toISOString(),
    });
    if (!signedIn.occurrences.includes(occurrence)) {
      signedIn.occurrences.push(occurrence);
    }
    return json(200, occurrence);
  }

  /** DELETE /api/v1/occurrences/:id, behind the approval gate. */
  function deleteOccurrence(id: string): Response {
    if (!signedIn) return json(401, { code: "UNAUTHENTICATED" });
    if (!signedIn.approved) return json(403, { code: "USER_NOT_APPROVED" });
    const occurrence =
      signedIn.occurrences.find((persisted) => persisted.id === id) ??
      materialized(signedIn, id);
    if (!occurrence) return json(404, { code: "OCCURRENCE_NOT_FOUND" });
    if (occurrence.recurrenceId !== null) {
      return json(409, { code: "ONLY_ONE_OFF_DELETABLE" });
    }
    signedIn.occurrences.splice(signedIn.occurrences.indexOf(occurrence), 1);
    return new Response(null, { status: 204 });
  }

  /** The occurrence a virtual id names: already persisted, or a new snapshot. */
  function materialized(account: Account, id: string): Occurrence | undefined {
    const virtual = parseVirtualId(id);
    if (!virtual) return undefined;
    const { recurrenceId, period } = virtual;
    const persisted = account.occurrences.find(
      (occurrence) =>
        occurrence.recurrenceId === recurrenceId && occurrence.period === period
    );
    if (persisted) return persisted;
    const recurrence = account.recurrences.find(
      (candidate) =>
        candidate.id === recurrenceId && isInEffect(candidate, period)
    );
    if (!recurrence) return undefined;
    const now = new Date().toISOString();
    return {
      id: uuid(),
      userId: account.id,
      recurrenceId,
      direction: recurrence.direction,
      description: recurrence.description,
      status: "PENDING",
      amount: recurrence.defaultAmount,
      period,
      dueDate: clampDueDate(period, recurrence.dueDay),
      settledAt: null,
      notes: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  /** The access tokens of each account, by account id, newest first. */
  const accessTokens = new Map<string, FakeAccessToken[]>();

  function tokensOf(account: Account): FakeAccessToken[] {
    let tokens = accessTokens.get(account.id);
    if (!tokens) {
      tokens = [];
      accessTokens.set(account.id, tokens);
    }
    return tokens;
  }

  /** What `/api/v1/access-tokens` shows of a token: never the secret. */
  function describeToken({
    id,
    name,
    prefix,
    createdAt,
    lastUsedAt,
  }: FakeAccessToken) {
    return { id, name, prefix, createdAt, lastUsedAt };
  }

  /** GET /api/v1/access-tokens, behind the approval gate. */
  function getAccessTokens(): Response {
    if (!signedIn) return json(401, { code: "UNAUTHENTICATED" });
    if (!signedIn.approved) return json(403, { code: "USER_NOT_APPROVED" });
    return json(200, tokensOf(signedIn).map(describeToken));
  }

  /** POST /api/v1/access-tokens: needs the current password (PRD §8.9). */
  function postAccessToken(body: unknown): Response {
    if (!signedIn) return json(401, { code: "UNAUTHENTICATED" });
    if (!signedIn.approved) return json(403, { code: "USER_NOT_APPROVED" });
    const input = NewAccessTokenSchema.safeParse(body);
    if (!input.success) return json(400, { code: "INVALID_INPUT" });
    if (input.data.currentPassword !== signedIn.password) {
      return json(400, { code: "INVALID_PASSWORD" });
    }
    const created = newAccessToken({ name: input.data.name });
    tokensOf(signedIn).unshift(created);
    return json(201, created);
  }

  /** DELETE /api/v1/access-tokens/:id, behind the approval gate. */
  function deleteAccessToken(id: string): Response {
    if (!signedIn) return json(401, { code: "UNAUTHENTICATED" });
    if (!signedIn.approved) return json(403, { code: "USER_NOT_APPROVED" });
    const tokens = tokensOf(signedIn);
    const token = tokens.find((candidate) => candidate.id === id);
    if (!token) return json(404, { code: "ACCESS_TOKEN_NOT_FOUND" });
    tokens.splice(tokens.indexOf(token), 1);
    return new Response(null, { status: 204 });
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
    // Better-Auth takes an `input` preference at sign-up too, so a theme sent
    // here would land on the new account.
    "POST /api/auth/sign-up/email": (body) => {
      const { name, email, password } = body;
      if (accounts.has(email ?? "")) {
        return json(422, {
          code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
          message: "User already exists. Use another email.",
        });
      }
      const { colorScheme, rejected } = colorSchemeIn(body);
      if (rejected) return rejected;
      signedIn = api.addAccount({
        name: name ?? "",
        email: email ?? "",
        password: password ?? "",
        ...(colorScheme && { colorScheme }),
      });
      return json(200, sessionOf(signedIn));
    },
    "POST /api/auth/request-password-reset": ({ email, redirectTo }) => {
      if (accounts.has(email ?? "")) {
        const token = uuid();
        resetTokens.set(token, email!);
        const screen = new URL(redirectTo ?? "/", "http://localhost");
        screen.searchParams.set("token", token);
        resetLinks.set(email!, screen.pathname + screen.search);
      }
      return json(200, {
        status: true,
        message:
          "If this email exists in our system, check your email for the reset link",
      });
    },
    "POST /api/auth/reset-password": ({ token, newPassword }) => {
      const email = resetTokens.get(token ?? "");
      if (!email) {
        return json(400, { code: "INVALID_TOKEN", message: "Invalid token" });
      }
      if ((newPassword ?? "").length < 8) {
        return json(400, {
          code: "PASSWORD_TOO_SHORT",
          message: "Password too short",
        });
      }
      resetTokens.delete(token!);
      accounts.get(email)!.password = newPassword!;
      return json(200, { status: true });
    },
    // Other devices are not modelled: there is only ever this one.
    "POST /api/auth/change-password": ({ currentPassword, newPassword }) => {
      if (!signedIn) return json(401, { code: "UNAUTHENTICATED" });
      if (currentPassword !== signedIn.password) {
        return json(400, {
          code: "INVALID_PASSWORD",
          message: "Invalid password",
        });
      }
      if ((newPassword ?? "").length < 8) {
        return json(400, {
          code: "PASSWORD_TOO_SHORT",
          message: "Password too short",
        });
      }
      signedIn.password = newPassword!;
      return json(200, { token: null, user: sessionOf(signedIn).user });
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
      if (held) {
        const { promise, resolve } = Promise.withResolvers<boolean>();
        held.push(resolve);
        if (await promise) return serverError();
      }
      if (down) return serverError();
      const request = new Request(input, init);
      const { pathname, searchParams } = new URL(request.url);
      if (request.method === "GET" && pathname === "/api/v1/recurrences") {
        return getRecurrences(searchParams);
      }
      if (request.method === "GET" && pathname === "/api/v1/summaries") {
        return getSummaries(searchParams);
      }
      const recurrenceMatch = /^\/api\/v1\/recurrences\/([^/]+)$/.exec(
        pathname
      );
      if (request.method === "GET" && recurrenceMatch) {
        return getRecurrence(decodeURIComponent(recurrenceMatch[1]!));
      }
      if (request.method === "DELETE" && recurrenceMatch) {
        return deleteRecurrence(decodeURIComponent(recurrenceMatch[1]!));
      }
      if (request.method === "GET" && pathname === "/api/v1/access-tokens") {
        return getAccessTokens();
      }
      const accessTokenMatch = /^\/api\/v1\/access-tokens\/([^/]+)$/.exec(
        pathname
      );
      if (request.method === "DELETE" && accessTokenMatch) {
        return deleteAccessToken(decodeURIComponent(accessTokenMatch[1]!));
      }
      const periodMatch = /^\/api\/v1\/periods\/([^/]+)$/.exec(pathname);
      if (request.method === "GET" && periodMatch) {
        return getPeriod(decodeURIComponent(periodMatch[1]!));
      }
      const text = await request.text();
      const body = text ? JSON.parse(text) : {};
      if (request.method === "POST" && pathname === "/api/auth/update-user") {
        return updateUser(body);
      }
      if (request.method === "POST" && pathname === "/api/v1/access-tokens") {
        return postAccessToken(body);
      }
      if (request.method === "POST" && pathname === "/api/v1/recurrences") {
        return postRecurrence(body);
      }
      if (request.method === "PATCH" && recurrenceMatch) {
        return patchRecurrence(decodeURIComponent(recurrenceMatch[1]!), body);
      }
      if (request.method === "POST" && pathname === "/api/v1/occurrences") {
        return postOccurrence(body);
      }
      const statusMatch = /^\/api\/v1\/occurrences\/([^/]+)\/status$/.exec(
        pathname
      );
      if (request.method === "PATCH" && statusMatch) {
        return patchStatus(decodeURIComponent(statusMatch[1]!), body);
      }
      const occurrenceMatch = /^\/api\/v1\/occurrences\/([^/]+)$/.exec(
        pathname
      );
      if (request.method === "PATCH" && occurrenceMatch) {
        return patchOccurrence(decodeURIComponent(occurrenceMatch[1]!), body);
      }
      if (request.method === "DELETE" && occurrenceMatch) {
        return deleteOccurrence(decodeURIComponent(occurrenceMatch[1]!));
      }
      const handler = handlers[`${request.method} ${pathname}`];
      if (!handler) return json(404, { message: "Not found" });
      return handler(body);
    },

    addAccount({
      name,
      email,
      password,
      approved = false,
      ...preferences
    }: Pick<Account, "name" | "email" | "password"> &
      Partial<Pick<Account, "approved"> & Preferences>): Account {
      const created = {
        id: `user-${accounts.size + 1}`,
        name,
        email,
        password,
        approved,
        preferences: { ...defaultPreferences, ...preferences },
        recurrences: [],
        occurrences: [],
      };
      accounts.set(created.email, created);
      return created;
    },

    signIn(email: string) {
      signedIn = accounts.get(email);
    },

    /**
     * Where the reset link last emailed to this address leads once opened (the
     * reset screen with its token), or undefined when none was sent.
     */
    resetLinkFor(email: string): string | undefined {
      return resetLinks.get(email);
    },

    /** The account's password as it stands, to tell whether it changed. */
    passwordOf(email: string): string | undefined {
      return accounts.get(email)?.password;
    },

    /** Seeds an access token for the account. */
    addAccessToken(
      email: string,
      overrides: Partial<FakeAccessToken> = {}
    ): FakeAccessToken {
      const token = newAccessToken(overrides);
      tokensOf(accounts.get(email)!).push(token);
      return token;
    },

    /** The account's access tokens, secrets included, as the database holds them. */
    accessTokensOf(email: string): readonly FakeAccessToken[] {
      return tokensOf(accounts.get(email)!);
    },

    /** Seeds a recurrence for the account, as through Drizzle Studio. */
    addRecurrence(email: string, overrides: Partial<Recurrence> = {}) {
      const account = accounts.get(email)!;
      const recurrence: Recurrence = {
        id: uuid(),
        userId: account.id,
        direction: "OUTFLOW",
        description: "Aluguel",
        defaultAmount: 220000,
        dueDay: 10,
        // The current period: the earliest the app lets a recurrence start.
        startPeriod: "2026-10-01",
        endPeriod: null,
        notes: null,
        createdAt: "2026-01-01T12:00:00.000Z",
        updatedAt: "2026-01-01T12:00:00.000Z",
        ...overrides,
      };
      account.recurrences.push(recurrence);
      return recurrence;
    },

    /** Changes the account's preferences, as the user does on another device. */
    setPreferences(email: string, preferences: Partial<Preferences>) {
      Object.assign(accounts.get(email)!.preferences, preferences);
    },

    /** The account's preferences, as the database holds them. */
    preferencesOf(email: string): Preferences {
      return { ...accounts.get(email)!.preferences };
    },

    /** The account's recurrences, as the database holds them. */
    recurrencesOf(email: string): readonly Recurrence[] {
      return accounts.get(email)!.recurrences;
    },

    /** The account's persisted occurrences, as the database holds them. */
    occurrencesOf(email: string): readonly Occurrence[] {
      return accounts.get(email)!.occurrences;
    },

    /** Seeds an occurrence for the account, as through Drizzle Studio. */
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

    /** Holds every request unanswered until `resume` is called. */
    stall() {
      held = [];
    },

    /** Lets every request still held through, in the order they came. */
    resume() {
      held?.forEach((release) => release(false));
      held = undefined;
    },

    /** How many requests came since `stall`, answered or not. */
    heldCount(): number {
      return held?.length ?? 0;
    },

    /**
     * Lets the `nth` request held since `stall` through (0 is the first), on
     * its own, so requests can be answered out of order; `fail` answers 500.
     */
    answer(nth: number, { fail = false }: { fail?: boolean } = {}) {
      held![nth]!(fail);
    },
  };
  return api;
}

export type FakeApi = ReturnType<typeof fakeApi>;

/** An access token with its secret, which only the create ever returns. */
type FakeAccessToken = CreatedAccessToken;

function newAccessToken(overrides: Partial<FakeAccessToken>): FakeAccessToken {
  const id = uuid();
  return {
    id,
    name: "Agente",
    prefix: `mns_${id.slice(-4)}`,
    createdAt: "2026-10-01T12:00:00.000Z",
    lastUsedAt: null,
    token: `mns_${id}_secret`,
    ...overrides,
  };
}

let sequence = 0;

function uuid(): string {
  sequence += 1;
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}
