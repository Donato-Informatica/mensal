import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  approve,
  password,
  request,
  signUp,
  startApi,
  type TestApi,
} from "./api.ts";
import { insertOccurrence, insertRecurrence } from "./fixtures.ts";

const clock = new Date("2026-10-21T15:00:00Z");
let api: TestApi;
beforeAll(async () => {
  api = await startApi({ now: () => clock });
});
afterAll(async () => {
  await api.close();
});

/** An approved user with an access token, as the app would hand it out. */
async function agentUser() {
  const user = await signUp(api);
  await approve(api, user.email);
  const response = await request(api, "/api/v1/access-tokens", {
    cookie: user.cookie,
    body: { name: "Claude Code", currentPassword: password },
  });
  const { id, token } = (await response.json()) as {
    id: string;
    token: string;
  };
  return { ...user, tokenId: id, token };
}

async function connect(token: string) {
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${api.url}/api/mcp`), {
      requestInit: { headers: { authorization: `Bearer ${token}` } },
    }) as Transport
  );
  return client;
}

interface ToolResult {
  isError?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  structuredContent?: Record<string, any>;
  content: { type: string; text: string }[];
}

async function call(
  client: Client,
  name: string,
  args: Record<string, unknown> = {}
) {
  return (await client.callTool({ name, arguments: args })) as ToolResult;
}

function post(
  token: string | undefined,
  body: unknown = { jsonrpc: "2.0", id: 1, method: "ping" }
) {
  return fetch(`${api.url}/api/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });
}

describe("the MCP endpoint's authentication", () => {
  it("answers 401 UNAUTHENTICATED to a missing, malformed or unknown token", async () => {
    for (const token of [undefined, "", "mensal_nope", "x".repeat(40)]) {
      const response = await post(token);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ code: "UNAUTHENTICATED" });
    }
    const basic = await fetch(`${api.url}/api/mcp`, {
      method: "POST",
      headers: {
        authorization: "Basic abc",
        "content-type": "application/json",
      },
      body: "{}",
    });
    expect(basic.status).toBe(401);
  });

  it("answers 401 to a revoked token", async () => {
    const { cookie, tokenId, token } = await agentUser();
    expect((await post(token)).status).toBe(200);

    await request(api, `/api/v1/access-tokens/${tokenId}`, {
      cookie,
      method: "DELETE",
    });

    expect((await post(token)).status).toBe(401);
  });

  it("answers 403 USER_NOT_APPROVED while the owner is not approved, checked on every request", async () => {
    const { email, token } = await agentUser();
    expect((await post(token)).status).toBe(200);

    await api.db.$client.query(
      "UPDATE users SET approved = false WHERE email = $1",
      [email]
    );
    const refused = await post(token);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ code: "USER_NOT_APPROVED" });

    await approve(api, email);
    expect((await post(token)).status).toBe(200);
  });

  it(
    "answers 429 above 120 requests a minute for one token, and only that token",
    { timeout: 60_000 },
    async () => {
      const limited = await agentUser();
      const other = await agentUser();

      const statuses: number[] = [];
      for (let i = 0; i < 121; i++) {
        statuses.push((await post(limited.token)).status);
      }

      expect(statuses.slice(0, 120).every((status) => status === 200)).toBe(
        true
      );
      expect(statuses[120]).toBe(429);
      expect((await post(other.token)).status).toBe(200);
    }
  );

  it("answers 405 to any method but POST, without a stream", async () => {
    const { token } = await agentUser();
    for (const method of ["GET", "DELETE"]) {
      const response = await fetch(`${api.url}/api/mcp`, {
        method,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(405);
    }
  });

  it("is not reachable with a session cookie", async () => {
    const { cookie } = await agentUser();
    const response = await fetch(`${api.url}/api/mcp`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(401);
  });
});

describe("the read tools", () => {
  it("lists the four, all read-only, with English descriptions", async () => {
    const { token } = await agentUser();
    const client = await connect(token);

    const tools = (await client.listTools()).tools.filter(
      ({ annotations }) => annotations?.readOnlyHint
    );

    expect(tools.map(({ name }) => name).sort()).toEqual([
      "get_period",
      "get_recurrence",
      "get_trend",
      "list_recurrences",
    ]);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.description).toMatch(/\(.+\)/);
    }
    const period = tools.find(({ name }) => name === "get_period")!;
    expect(period.description).toContain("Period (Competência)");
    expect(period.description).toContain("Overdue (Atrasada)");
    expect(JSON.stringify(period.outputSchema)).toContain(
      "integer BRL cents (R$ 50,00 = 5000)"
    );
    await client.close();
  });

  it("get_period defaults to the current period and carries today", async () => {
    const { userId, token } = await agentUser();
    await insertRecurrence(api.db, {
      userId,
      description: "Aluguel",
      dueDay: 25,
    });
    const client = await connect(token);

    const result = await call(client, "get_period");

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      period: "2026-10-01",
      today: "2026-10-21",
      summary: { outflowExpected: 220000 },
      items: [{ description: "Aluguel", isVirtual: true, overdue: false }],
    });
    expect(JSON.parse(result.content[0]!.text)).toEqual(
      result.structuredContent
    );
    await client.close();
  });

  it("get_period takes a YYYY-MM period", async () => {
    const { userId, token } = await agentUser();
    await insertOccurrence(api.db, {
      userId,
      period: "2026-08-01",
      dueDate: "2026-08-05",
      description: "Conserto",
    });
    const client = await connect(token);

    const result = await call(client, "get_period", { period: "2026-08" });

    expect(result.structuredContent).toMatchObject({
      period: "2026-08-01",
      today: "2026-10-21",
      items: [{ description: "Conserto" }],
    });
    await client.close();
  });

  it("get_period turns an invalid period into an error result with INVALID_PERIOD", async () => {
    const { token } = await agentUser();
    const client = await connect(token);

    const result = await call(client, "get_period", { period: "2026-13" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "INVALID_PERIOD" });
    expect(result.content[0]!.text).toContain("INVALID_PERIOD");
    expect(result.content[0]!.text).toMatch(/YYYY-MM/);
    await client.close();
  });

  it("get_trend returns each period's summary, and refuses a bad range", async () => {
    const { userId, token } = await agentUser();
    await insertOccurrence(api.db, {
      userId,
      period: "2026-09-01",
      dueDate: "2026-09-02",
      amount: 1000,
    });
    const client = await connect(token);

    const ok = await call(client, "get_trend", {
      from: "2026-09",
      to: "2026-10",
    });
    expect(ok.structuredContent).toMatchObject({
      today: "2026-10-21",
      items: [
        { period: "2026-09-01", summary: { outflowExpected: 1000 } },
        { period: "2026-10-01" },
      ],
    });

    const reversed = await call(client, "get_trend", {
      from: "2026-10",
      to: "2026-09",
    });
    expect(reversed.isError).toBe(true);
    expect(reversed.structuredContent).toMatchObject({
      code: "INVALID_PERIOD_RANGE",
    });
    const malformed = await call(client, "get_trend", {
      from: "x",
      to: "2026-09",
    });
    expect(malformed.structuredContent).toMatchObject({
      code: "INVALID_PERIOD",
    });
    await client.close();
  });

  it("list_recurrences filters by status and get_recurrence reads one", async () => {
    const { userId, token } = await agentUser();
    const active = await insertRecurrence(api.db, {
      userId,
      description: "Ativa",
    });
    await insertRecurrence(api.db, {
      userId,
      description: "Encerrada",
      endPeriod: "2026-03-01",
    });
    const client = await connect(token);

    const defaults = await call(client, "list_recurrences");
    expect(defaults.structuredContent?.today).toBe("2026-10-21");
    expect(
      defaults.structuredContent?.items.map(
        (r: { description: string }) => r.description
      )
    ).toEqual(["Ativa"]);
    const all = await call(client, "list_recurrences", { status: "all" });
    expect(all.structuredContent?.items).toHaveLength(2);

    const one = await call(client, "get_recurrence", { id: active.id });
    expect(one.structuredContent).toMatchObject({
      id: active.id,
      description: "Ativa",
      defaultAmount: 220000,
      today: "2026-10-21",
    });

    const missing = await call(client, "get_recurrence", { id: "nope" });
    expect(missing.isError).toBe(true);
    expect(missing.structuredContent).toMatchObject({
      code: "RECURRENCE_NOT_FOUND",
    });
    await client.close();
  });

  it("reports INVALID_INPUT with the fields for arguments of the wrong shape", async () => {
    const { token } = await agentUser();
    const client = await connect(token);

    const result = await call(client, "list_recurrences", { status: "bogus" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: "INVALID_INPUT",
      fields: ["status"],
    });
    await client.close();
  });

  it("shows each user only their own data", async () => {
    const mine = await agentUser();
    const theirs = await agentUser();
    const recurrence = await insertRecurrence(api.db, {
      userId: theirs.userId,
      description: "Deles",
    });
    const client = await connect(mine.token);

    expect(
      (await call(client, "list_recurrences", { status: "all" }))
        .structuredContent?.items
    ).toEqual([]);
    expect((await call(client, "get_period")).structuredContent?.items).toEqual(
      []
    );
    const stolen = await call(client, "get_recurrence", { id: recurrence.id });
    expect(stolen.structuredContent).toMatchObject({
      code: "RECURRENCE_NOT_FOUND",
    });
    await client.close();
  });
});
