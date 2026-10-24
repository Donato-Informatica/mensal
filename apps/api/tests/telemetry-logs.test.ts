import { createRequire } from "node:module";
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

// The real app with the real default sinks, exporting to memory (PRD §8.7.1).
// Telemetry starts before express and the app are loaded, as `--import` does.
const spanExporter = new InMemorySpanExporter();
const logExporter = new InMemoryLogRecordExporter();
let stop: () => Promise<void>;
let api: TestApi;
let helpers: typeof import("./api.ts");
let stdout: MockInstance<typeof console.log>;

beforeAll(async () => {
  const { registerModuleHooks, startTelemetry } =
    await import("../src/telemetry.ts");
  registerModuleHooks();
  const telemetry = startTelemetry({}, { exporter: spanExporter, logExporter });
  stop = () => telemetry!.shutdown();
  const require = createRequire(import.meta.url);
  require("node:http");
  require("express");
  helpers = await import("./api.ts");
  const { consoleActivity } = await import("../src/activity.ts");
  stdout = vi.spyOn(console, "log").mockImplementation(() => {});
  // No `log` and no `email`: the defaults, as in production without Resend.
  api = await helpers.startApi({ activity: consoleActivity });
});
afterAll(async () => {
  stdout.mockRestore();
  await api.close();
  await stop();
});

describe("activity and operator logs as OpenTelemetry records", () => {
  it("links an activity record to its request's trace, fields as attributes", async () => {
    const { request, signUp, approve } = helpers;
    const user = await signUp(api);
    await approve(api, user.email);
    const created = await request(api, "/api/v1/occurrences", {
      cookie: user.cookie,
      body: {
        direction: "OUTFLOW",
        description: "Sentinel logs ABC",
        amount: 1234567,
        period: "2026-10-01",
        dueDate: "2026-10-20",
        notes: null,
      },
    });
    const { id } = (await created.json()) as { id: string };

    const record = logExporter
      .getFinishedLogRecords()
      .find((r) => r.attributes.action === "occurrence.create");
    expect(record).toBeDefined();
    expect(record!.severityText).toBe("INFO");
    expect(record!.attributes).toMatchObject({
      action: "occurrence.create",
      kind: "occurrence",
      id,
      user: user.userId,
    });
    expect(typeof record!.body).toBe("string");
    expect(record!.body).not.toContain("{");

    const span = spanExporter
      .getFinishedSpans()
      .find(
        (s) =>
          s.kind === 1 &&
          s.attributes["url.path"] === "/api/v1/occurrences" &&
          s.attributes["http.request.method"] === "POST"
      );
    expect(span).toBeDefined();
    expect(record!.spanContext?.traceId).toBe(span!.spanContext().traceId);
    expect(record!.spanContext?.spanId).toBeTruthy();
    // Still written to stdout as one JSON line.
    expect(
      stdout.mock.calls.some(([line]) =>
        String(line).includes('"action":"occurrence.create"')
      )
    ).toBe(true);
  });

  it("exports no email, not even a failed sign-in's attempted one", async () => {
    const { request } = helpers;
    const attempted = "attempted-sentinel@example.com";
    await request(api, "/api/auth/sign-in/email", {
      body: { email: attempted, password: "wrong password here" },
    });

    const failed = logExporter
      .getFinishedLogRecords()
      .find((r) => r.attributes.action === "user.sign-in-failed");
    expect(failed).toBeDefined();
    expect(JSON.stringify(failed!.attributes)).not.toContain(attempted);
    expect(
      stdout.mock.calls.some(([line]) => String(line).includes(attempted))
    ).toBe(true);
  });

  it("prints a reset email to stdout without exporting it", async () => {
    const { request, signUp } = helpers;
    const user = await signUp(api);
    stdout.mockClear();
    const response = await request(api, "/api/auth/request-password-reset", {
      body: { email: user.email, redirectTo: "/redefinir-senha" },
    });
    expect(response.status).toBe(200);

    await vi.waitFor(() =>
      expect(
        stdout.mock.calls.some(([line]) =>
          String(line).includes("reset-password")
        )
      ).toBe(true)
    );
    const exported = JSON.stringify(
      logExporter
        .getFinishedLogRecords()
        .map(({ body, attributes }) => ({ body, attributes }))
    );
    expect(exported).not.toContain("reset-password");
    expect(exported).not.toContain(user.email);
  });
});
