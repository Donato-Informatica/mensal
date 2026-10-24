import { createRequire } from "node:module";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { InMemoryLogRecordExporter } from "@opentelemetry/sdk-logs";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import type { TestApi } from "./api.ts";

// The real app with the real instrumentation, exporting to memory (PRD §8.7.2).
// Telemetry starts before express, pg and the app are loaded, as `--import`
// does in production, hence the dynamic imports below.
const exporter = new InMemorySpanExporter();
const logExporter = new InMemoryLogRecordExporter();
let stop: () => Promise<void>;
let api: TestApi;
let helpers: typeof import("./api.ts");
let stdout: MockInstance<typeof console.log>;

beforeAll(async () => {
  const { registerModuleHooks, startTelemetry } =
    await import("../src/telemetry.ts");
  registerModuleHooks();
  const telemetry = startTelemetry({}, { exporter, logExporter });
  stop = () => telemetry!.shutdown();
  // The test runner has loaded or will load these its own way: a CommonJS require now is
  // what lets the HTTP instrumentation patch them.
  const require = createRequire(import.meta.url);
  require("node:http");
  require("express");
  helpers = await import("./api.ts");
  // The real activity sink, so its records are checked too.
  const { consoleActivity } = await import("../src/activity.ts");
  stdout = vi.spyOn(console, "log").mockImplementation(() => {});
  api = await helpers.startApi({ activity: consoleActivity });
});
afterAll(async () => {
  stdout.mockRestore();
  await api.close();
  await stop();
});

const secrets = {
  description: "Sentinel descricao XYZ",
  edited: "Sentinel editada QWK",
  amount: 7654321,
  editedAmount: 7654322,
  recurrence: "Sentinel recorrencia JKL",
  recurrenceAmount: 8765432,
  notes: "Sentinel notas MNB",
};

describe("telemetry privacy and identity", () => {
  it("exports no user data and tags request spans with the user", async () => {
    const { request, signUp, approve, password, cookieFrom } = helpers;
    const user = await signUp(api);
    await approve(api, user.email);
    const signIn = await request(api, "/api/auth/sign-in/email", {
      body: { email: user.email, password },
    });
    const cookie = cookieFrom(signIn);

    const created = await request(api, "/api/v1/occurrences?secret=QRYSECRET", {
      cookie,
      body: {
        direction: "OUTFLOW",
        description: secrets.description,
        amount: secrets.amount,
        period: "2026-10-01",
        dueDate: "2026-10-20",
        notes: secrets.notes,
      },
    });
    const { id } = (await created.json()) as { id: string };
    await request(api, `/api/v1/occurrences/${id}`, {
      cookie,
      method: "PATCH",
      body: { description: secrets.edited, amount: secrets.editedAmount },
    });
    await request(api, `/api/v1/occurrences/${id}/status`, {
      cookie,
      method: "PATCH",
      body: { status: "SETTLED" },
    });
    await request(api, "/api/v1/recurrences", {
      cookie,
      body: {
        direction: "OUTFLOW",
        description: secrets.recurrence,
        defaultAmount: secrets.recurrenceAmount,
        dueDay: 10,
        startPeriod: "2026-10-01",
        endPeriod: null,
        notes: null,
      },
    });
    await request(api, "/api/health");

    const tokenResponse = await request(api, "/api/v1/access-tokens", {
      cookie,
      body: { name: "Claude Code", currentPassword: password },
    });
    const { token } = (await tokenResponse.json()) as { token: string };
    const client = new Client({ name: "test", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${api.url}/api/mcp`), {
        requestInit: { headers: { authorization: `Bearer ${token}` } },
      }) as Transport
    );
    await client.callTool({
      name: "create_one_off",
      arguments: {
        direction: "OUTFLOW",
        description: "Sentinel mcp PLM",
        amount: 6543210,
        period: "2026-10-01",
        dueDate: "2026-10-20",
        notes: null,
      },
    });
    await client.close();

    const spans = exporter.getFinishedSpans();
    const records = logExporter.getFinishedLogRecords();
    // The flows above did produce activity records.
    expect(
      records.some((r) => r.attributes.action === "occurrence.create")
    ).toBe(true);
    const exported = JSON.stringify([
      spans.map(({ name, attributes, events, resource, links }) => ({
        name,
        attributes,
        events,
        links,
        resource: resource.attributes,
      })),
      records.map(({ body, attributes, resource }) => ({
        body,
        attributes,
        resource: resource.attributes,
      })),
    ]);
    const forbidden = [
      ...Object.values(secrets).map(String),
      "Sentinel mcp PLM",
      "6543210",
      "QRYSECRET",
      user.email,
      "Test User",
      token,
      password,
    ];
    for (const value of forbidden) expect(exported).not.toContain(value);

    // The spans exist at all: HTTP, Express and pg.
    const scopes = new Set(spans.map((s) => s.instrumentationScope.name));
    expect(scopes).toContain("@opentelemetry/instrumentation-http");
    expect(scopes).toContain("@opentelemetry/instrumentation-express");
    expect(scopes).toContain("@opentelemetry/instrumentation-pg");
    expect(
      spans.some((s) => s.resource.attributes["service.name"] === "mensal-api")
    ).toBe(true);

    // Request spans of the signed-in flows carry the user, REST and MCP.
    const requests = spans.filter(
      (s) =>
        s.instrumentationScope.name === "@opentelemetry/instrumentation-http" &&
        s.kind === 1 // SERVER
    );
    const rest = requests.filter((s) =>
      String(s.attributes["http.route"] ?? s.attributes["url.path"]).startsWith(
        "/api/v1/occurrences"
      )
    );
    expect(rest.length).toBeGreaterThanOrEqual(3);
    for (const span of rest)
      expect(span.attributes["enduser.id"]).toBe(user.userId);
    // The calls that got through authentication (a client may also probe with a GET).
    const mcp = requests.filter(
      (s) =>
        s.attributes["url.path"] === "/api/mcp" &&
        s.attributes["http.response.status_code"] === 200
    );
    expect(mcp.length).toBeGreaterThan(0);
    for (const span of mcp)
      expect(span.attributes["enduser.id"]).toBe(user.userId);

    // Health checks leave no trace, not even their query.
    expect(JSON.stringify(spans.map((s) => s.attributes))).not.toContain(
      "/api/health"
    );
    expect(spans.map((s) => s.name).join(" ")).not.toContain("health");
  });
});
