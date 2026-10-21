import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ActivityEvent } from "../src/activity.ts";
import { createApp } from "../src/app.ts";
import type { Auth } from "../src/auth.ts";
import type { Database } from "@mensal/database";
import { tools } from "../src/mcp-tools.ts";
import { mountedOperations } from "./openapi-routes.ts";
import { buildOpenApiSpec } from "../src/openapi.ts";
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
const events: ActivityEvent[] = [];
let api: TestApi;
beforeAll(async () => {
  api = await startApi({
    now: () => clock,
    activity: (event) => events.push(event),
  });
});
afterAll(async () => {
  await api.close();
});

async function agent() {
  const user = await signUp(api);
  await approve(api, user.email);
  const response = await request(api, "/api/v1/access-tokens", {
    cookie: user.cookie,
    body: { name: "Claude Code", currentPassword: password },
  });
  const { token } = (await response.json()) as { token: string };
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${api.url}/api/mcp`), {
      requestInit: { headers: { authorization: `Bearer ${token}` } },
    }) as Transport
  );
  return { ...user, client };
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

const newRecurrence = {
  direction: "OUTFLOW",
  description: "Aluguel",
  defaultAmount: 220000,
  dueDay: 10,
  startPeriod: "2026-10-01",
  endPeriod: null,
  notes: null,
};

const newOneOff = {
  direction: "OUTFLOW",
  description: "Conserto do carro",
  amount: 85000,
  period: "2026-10-01",
  dueDate: "2026-10-20",
  notes: null,
};

describe("the write tools", () => {
  it("lists the seven, with delete_* destructive and the rest not read-only", async () => {
    const { client } = await agent();

    const { tools: listed } = await client.listTools();

    const writes = listed.filter(
      ({ name }) => !name.startsWith("get_") && !name.startsWith("list_")
    );
    expect(writes.map(({ name }) => name).sort()).toEqual([
      "change_occurrence_status",
      "create_one_off",
      "create_recurrence",
      "delete_occurrence",
      "delete_recurrence",
      "update_occurrence",
      "update_recurrence",
    ]);
    for (const tool of writes) {
      expect(tool.annotations?.readOnlyHint).toBeFalsy();
      expect(tool.annotations?.destructiveHint).toBe(
        tool.name.startsWith("delete_") ? true : undefined
      );
      expect(tool.description).toMatch(/\(.+\)/);
    }
    const settle = writes.find(
      ({ name }) => name === "change_occurrence_status"
    )!;
    expect(settle.description).toContain("Settle (Liquidar)");
    expect(settle.description).toContain("5.7");
    const update = writes.find(({ name }) => name === "update_recurrence")!;
    expect(update.description).toContain("endPeriod");
    await client.close();
  });

  it("create_recurrence creates it, logged with via mcp", async () => {
    const { client } = await agent();
    events.length = 0;

    const result = await call(client, "create_recurrence", newRecurrence);

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      description: "Aluguel",
      defaultAmount: 220000,
    });
    expect(events).toMatchObject([
      {
        action: "recurrence.create",
        id: result.structuredContent!.id,
        via: "mcp",
      },
    ]);
    await client.close();
  });

  it("REST writes are not logged with via", async () => {
    const { cookie } = await agent();
    events.length = 0;

    await request(api, "/api/v1/recurrences", {
      cookie,
      body: newRecurrence,
    });

    expect(events).toHaveLength(1);
    expect(events[0]).not.toHaveProperty("via");
  });

  it("create_recurrence refuses a start in the past", async () => {
    const { client } = await agent();

    const result = await call(client, "create_recurrence", {
      ...newRecurrence,
      startPeriod: "2026-09-01",
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: "START_PERIOD_IN_PAST",
    });
    await client.close();
  });

  it("update_recurrence edits it and ends it with endPeriod", async () => {
    const { client } = await agent();
    const created = await call(client, "create_recurrence", newRecurrence);
    const id = created.structuredContent!.id;

    const edited = await call(client, "update_recurrence", {
      id,
      notes: "Dia 10",
      endPeriod: "2026-12-01",
    });

    expect(edited.structuredContent).toMatchObject({
      id,
      notes: "Dia 10",
      endPeriod: "2026-12-01",
    });
    const early = await call(client, "update_recurrence", {
      id,
      endPeriod: "2026-09-01",
    });
    expect(early.structuredContent).toMatchObject({
      code: "END_PERIOD_BEFORE_START",
    });
    const missing = await call(client, "update_recurrence", {
      id: "nope",
      notes: "x",
    });
    expect(missing.structuredContent).toMatchObject({
      code: "RECURRENCE_NOT_FOUND",
    });
    await client.close();
  });

  it("delete_recurrence deletes one without history and points to update_recurrence otherwise", async () => {
    const { client, userId } = await agent();
    const created = await call(client, "create_recurrence", newRecurrence);
    const id = created.structuredContent!.id;
    const withHistory = await insertRecurrence(api.db, { userId });
    await insertOccurrence(api.db, {
      userId,
      recurrenceId: withHistory.id,
      period: "2026-10-01",
    });

    const refused = await call(client, "delete_recurrence", {
      id: withHistory.id,
    });
    expect(refused.isError).toBe(true);
    expect(refused.structuredContent).toMatchObject({
      code: "RECURRENCE_HAS_OCCURRENCES",
    });
    expect(refused.structuredContent!.message).toContain("update_recurrence");

    events.length = 0;
    const deleted = await call(client, "delete_recurrence", { id });
    expect(deleted.isError).toBeFalsy();
    expect(deleted.structuredContent).toEqual({ deleted: true });
    expect(events).toMatchObject([
      { action: "recurrence.delete", id, via: "mcp" },
    ]);
    await client.close();
  });

  it("create_one_off, update_occurrence and delete_occurrence", async () => {
    const { client } = await agent();

    const created = await call(client, "create_one_off", newOneOff);
    expect(created.structuredContent).toMatchObject({
      description: "Conserto do carro",
      status: "PENDING",
    });
    const id = created.structuredContent!.id;

    events.length = 0;
    const edited = await call(client, "update_occurrence", {
      id,
      notes: "Oficina",
    });
    expect(edited.structuredContent).toMatchObject({ id, notes: "Oficina" });
    expect(events).toMatchObject([
      { action: "occurrence.edit", id, fields: ["notes"], via: "mcp" },
    ]);

    const outside = await call(client, "update_occurrence", {
      id,
      dueDate: "2026-11-02",
    });
    expect(outside.structuredContent).toMatchObject({
      code: "DUE_DATE_OUTSIDE_PERIOD",
    });
    const notSettled = await call(client, "update_occurrence", {
      id,
      settledAt: "2026-10-05",
    });
    expect(notSettled.structuredContent).toMatchObject({
      code: "OCCURRENCE_NOT_SETTLED",
    });

    const deleted = await call(client, "delete_occurrence", { id });
    expect(deleted.structuredContent).toEqual({ deleted: true });
    expect(
      (await call(client, "delete_occurrence", { id })).structuredContent
    ).toMatchObject({ code: "OCCURRENCE_NOT_FOUND" });
    await client.close();
  });

  it("settling a virtual occurrence materializes it, and leaving SETTLED clears settledAt", async () => {
    const { client } = await agent();
    await call(client, "create_recurrence", newRecurrence);
    const period = await call(client, "get_period");
    const virtual = period.structuredContent!.items[0];
    expect(virtual.isVirtual).toBe(true);

    const settled = await call(client, "change_occurrence_status", {
      id: virtual.id,
      status: "SETTLED",
    });
    expect(settled.structuredContent).toMatchObject({
      status: "SETTLED",
      settledAt: "2026-10-21",
      amount: 220000,
    });
    expect(settled.structuredContent!.id).not.toBe(virtual.id);

    const after = await call(client, "get_period");
    expect(after.structuredContent!.items[0]).toMatchObject({
      id: settled.structuredContent!.id,
      status: "SETTLED",
    });

    const pending = await call(client, "change_occurrence_status", {
      id: settled.structuredContent!.id,
      status: "PENDING",
    });
    expect(pending.structuredContent).toMatchObject({
      status: "PENDING",
      settledAt: null,
    });
    await client.close();
  });

  it("update_occurrence accepts a virtual id", async () => {
    const { client } = await agent();
    await call(client, "create_recurrence", newRecurrence);
    const virtual = (await call(client, "get_period")).structuredContent!
      .items[0];

    const edited = await call(client, "update_occurrence", {
      id: virtual.id,
      amount: 230000,
    });

    expect(edited.structuredContent).toMatchObject({
      amount: 230000,
      recurrenceId: virtual.recurrenceId,
    });
    expect(edited.structuredContent!.id).not.toBe(virtual.id);
    await client.close();
  });

  it("points to the way forward when a rule refuses", async () => {
    const { client } = await agent();
    await call(client, "create_recurrence", {
      ...newRecurrence,
      defaultAmount: null,
    });
    const virtual = (await call(client, "get_period")).structuredContent!
      .items[0];

    const noAmount = await call(client, "change_occurrence_status", {
      id: virtual.id,
      status: "SETTLED",
    });
    expect(noAmount.isError).toBe(true);
    expect(noAmount.structuredContent).toMatchObject({
      code: "AMOUNT_REQUIRED_TO_SETTLE",
    });
    expect(noAmount.structuredContent!.message).toMatch(/update_occurrence/);

    const fromRecurrence = await call(client, "delete_occurrence", {
      id: virtual.id,
    });
    expect(fromRecurrence.structuredContent).toMatchObject({
      code: "ONLY_ONE_OFF_DELETABLE",
    });
    const persisted = await call(client, "update_occurrence", {
      id: virtual.id,
      notes: "x",
    });
    const refused = await call(client, "delete_occurrence", {
      id: persisted.structuredContent!.id,
    });
    expect(refused.structuredContent).toMatchObject({
      code: "ONLY_ONE_OFF_DELETABLE",
    });
    expect(refused.structuredContent!.message).toContain(
      "change_occurrence_status"
    );
    await client.close();
  });

  it("keeps one user's data from another's tools", async () => {
    const mine = await agent();
    const theirs = await agent();
    const occurrence = await insertOccurrence(api.db, {
      userId: theirs.userId,
    });

    const result = await call(mine.client, "change_occurrence_status", {
      id: occurrence.id,
      status: "SKIPPED",
    });

    expect(result.structuredContent).toMatchObject({
      code: "OCCURRENCE_NOT_FOUND",
    });
    await mine.client.close();
    await theirs.client.close();
  });
});

describe("the coverage guard", () => {
  /** Operations on /api/v1, /me and the access tokens apart, without a tool. */
  function uncovered(app: ReturnType<typeof createApp>) {
    const spec = buildOpenApiSpec();
    const { operations } = mountedOperations(app, [
      ...Object.keys(spec.paths),
      "/api/mcp",
    ]);
    const covered = new Set(tools.map(({ operation }) => operation));
    return operations.filter(
      (operation) =>
        / \/api\/v1\//.test(operation) &&
        !/ \/api\/v1\/(me|access-tokens)/.test(operation) &&
        !covered.has(operation)
    );
  }

  const bareApp = () => createApp({ auth: {} as Auth, db: {} as Database });

  it("finds every /api/v1 operation covered by a tool", () => {
    expect(uncovered(bareApp())).toEqual([]);
  });

  it("fails for a /api/v1 route added without a tool", () => {
    const app = bareApp();
    app.get("/api/v1/widgets", () => {});

    expect(uncovered(app)).toEqual(["GET /api/v1/widgets"]);
  });
});
