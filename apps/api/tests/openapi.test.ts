import type { Database } from "@mensal/database";
import { randomUUID } from "node:crypto";
import { Ajv2020 } from "ajv/dist/2020.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import type { Auth } from "../src/auth.ts";
import { buildOpenApiSpec } from "../src/openapi.ts";
import { mountedOperations } from "./openapi-routes.ts";
import {
  approve,
  password,
  request,
  signUp,
  startApi,
  type TestApi,
} from "./api.ts";

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

describe("GET /api/openapi.json", () => {
  it("serves an OpenAPI 3.1 document without a session", async () => {
    const response = await request(api, "/api/openapi.json");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/application\/json/);
    const spec = await response.json();
    expect(spec.openapi).toMatch(/^3\.1\./);
    expect(spec.info.title).toBe("Mensal API");
    expect(spec.paths).toBeTypeOf("object");
  });
});

describe("the API description", () => {
  it("documents every operation the app serves", async () => {
    const app = createApp({ auth: {} as Auth, db: {} as Database });
    const spec = buildOpenApiSpec();
    const documented = Object.entries(spec.paths).flatMap(([path, item]) =>
      Object.keys(item).map((method) => `${method.toUpperCase()} ${path}`)
    );

    const { operations, unresolved } = mountedOperations(
      app,
      // The MCP endpoint is mounted but described by its own tools (§8.9).
      [...Object.keys(spec.paths), "/api/mcp"]
    );

    // Better-Auth documents its own routes (merged into the spec), and the
    // documentation endpoints do not describe themselves, nor does /api/mcp.
    const ours = operations.filter(
      (operation) =>
        !operation.includes(" /api/auth/") &&
        !/ \/api\/(openapi\.json|docs(\/scalar\.js)?|mcp)$/.test(operation)
    );
    expect(unresolved).toBe(0);
    expect(ours.sort()).toEqual(documented.sort());
  });
});

describe("the API description's responses", () => {
  const ajv = new Ajv2020({ strict: false, validateFormats: false });

  /** The body must satisfy the schema the spec declares for this status. */
  function expectDocumented(
    operation: `${string} ${string}`,
    status: number,
    body: unknown
  ) {
    const [method = "", path = ""] = operation.split(" ");
    const declared =
      buildOpenApiSpec().paths[path]?.[method.toLowerCase()]?.responses?.[
        status
      ];
    expect(declared, `${operation} documents ${status}`).toBeDefined();
    const schema = declared?.content?.["application/json"]?.schema;
    if (body === undefined) {
      expect(schema, `${operation} ${status} has no body`).toBeUndefined();
      return;
    }
    expect(schema, `${operation} ${status} has a schema`).toBeDefined();
    const validate = ajv.compile(schema!);
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
  }

  it("match what the API really answers", async () => {
    const { cookie, userId } = await approvedUser();
    const call = async (
      operation: `${string} ${string}`,
      url: string,
      status: number,
      body?: unknown
    ) => {
      const response = await request(api, url, {
        cookie,
        method: operation.split(" ")[0]!,
        ...(body !== undefined && { body }),
      });
      expect(response.status).toBe(status);
      const text = await response.text();
      expectDocumented(operation, status, text ? JSON.parse(text) : undefined);
      return text ? JSON.parse(text) : undefined;
    };
    const recurrence = await call(
      "POST /api/v1/recurrences",
      "/api/v1/recurrences",
      201,
      {
        direction: "OUTFLOW",
        description: "Aluguel",
        defaultAmount: 220000,
        dueDay: 10,
        startPeriod: "2026-10-01",
        endPeriod: null,
        notes: null,
      }
    );
    const one = `/api/v1/recurrences/${recurrence.id}`;
    await call("GET /api/v1/recurrences", "/api/v1/recurrences", 200);
    await call("GET /api/v1/recurrences/{id}", one, 200);
    await call("PATCH /api/v1/recurrences/{id}", one, 200, { notes: "Dia 10" });
    const period = await call(
      "GET /api/v1/periods/{month}",
      "/api/v1/periods/2026-10",
      200
    );
    await call(
      "GET /api/v1/summaries",
      "/api/v1/summaries?from=2026-09&to=2026-11",
      200
    );
    await call(
      "GET /api/v1/summaries",
      "/api/v1/summaries?from=2026-11&to=2026-09",
      400
    );
    const oneOff = await call(
      "POST /api/v1/occurrences",
      "/api/v1/occurrences",
      201,
      {
        direction: "OUTFLOW",
        description: "Conserto do carro",
        amount: 85000,
        period: "2026-10-01",
        dueDate: "2026-10-20",
        notes: null,
      }
    );
    await call(
      "PATCH /api/v1/occurrences/{id}",
      `/api/v1/occurrences/${oneOff.id}`,
      200,
      { notes: "Oficina" }
    );
    // A virtual occurrence is materialized by its first change.
    await call(
      "PATCH /api/v1/occurrences/{id}/status",
      `/api/v1/occurrences/${period.items[0].id}/status`,
      200,
      { status: "SETTLED" }
    );
    await call(
      "DELETE /api/v1/occurrences/{id}",
      `/api/v1/occurrences/${oneOff.id}`,
      204
    );
    await call("GET /api/v1/me", "/api/v1/me", 200);
    const token = await call(
      "POST /api/v1/access-tokens",
      "/api/v1/access-tokens",
      201,
      { name: "Claude Code", currentPassword: password }
    );
    await call("POST /api/v1/access-tokens", "/api/v1/access-tokens", 400, {
      name: "Claude Code",
      currentPassword: "wrong",
    });
    await call("GET /api/v1/access-tokens", "/api/v1/access-tokens", 200);
    await call(
      "DELETE /api/v1/access-tokens/{id}",
      `/api/v1/access-tokens/${token.id}`,
      204
    );
    await call(
      "DELETE /api/v1/access-tokens/{id}",
      `/api/v1/access-tokens/${token.id}`,
      404
    );
    await call(
      "GET /api/v1/recurrences/{id}",
      `/api/v1/recurrences/${randomUUID()}`,
      404
    );
    await call("POST /api/v1/recurrences", "/api/v1/recurrences", 400, {
      direction: "SIDEWAYS",
    });
    expect(userId).toBeTypeOf("string");
  });

  it("cover the health check and the refusal of an anonymous request", async () => {
    const health = await request(api, "/api/health");
    expectDocumented("GET /api/health", 200, await health.json());

    const anonymous = await request(api, "/api/v1/me");
    expect(anonymous.status).toBe(401);
    expectDocumented("GET /api/v1/me", 401, await anonymous.json());
  });
});

describe("GET /api/docs", () => {
  it("serves the reference page and its script without a session", async () => {
    const page = await request(api, "/api/docs");

    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toMatch(/text\/html/);
    const html = await page.text();
    expect(html).toContain("/api/openapi.json");
    const script = /<script[^>]+src="([^"]+)"/.exec(html)?.[1];
    expect(script).toBeDefined();
    const asset = await request(api, script!);
    expect(asset.status).toBe(200);
    expect(asset.headers.get("content-type")).toMatch(/javascript/);
  });

  it("runs under the same Content-Security-Policy as every other route", async () => {
    const docs = await request(api, "/api/docs");
    const health = await request(api, "/api/health");

    expect(docs.headers.get("content-security-policy")).toBe(
      health.headers.get("content-security-policy")
    );
    // No inline script, which that policy would block.
    expect(await docs.text()).not.toMatch(
      /<script(?![^>]*\b(src|type)=)[^>]*>/
    );
  });
});

describe("the served description of the sign-in routes", () => {
  it("includes Better-Auth's routes under /api/auth", async () => {
    const spec = await (await request(api, "/api/openapi.json")).json();

    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining([
        "/api/auth/sign-in/email",
        "/api/auth/sign-up/email",
        "/api/auth/sign-out",
        "/api/v1/me",
      ])
    );
    expect(spec.paths["/api/auth/sign-in/email"].post).toBeDefined();
  });

  it("does not add Better-Auth's own CDN-backed reference page", async () => {
    const response = await request(api, "/api/auth/reference");

    expect(response.status).toBe(404);
  });
});
