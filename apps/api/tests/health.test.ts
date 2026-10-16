import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createDatabase } from "@mensal/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { createAuth } from "../src/auth.ts";
import { request, startApi, type TestApi } from "./api.ts";
import { testDatabaseUrl } from "./database.ts";

let api: TestApi;
beforeAll(async () => {
  api = await startApi();
});
afterAll(async () => {
  await api.close();
});

describe("GET /api/health", () => {
  it("answers 200 without a session while the database is up", async () => {
    const response = await request(api, "/api/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("answers 503 and logs the cause when the database is down", async () => {
    const db = createDatabase(testDatabaseUrl);
    await db.$client.end();
    const logged: string[] = [];
    const log = (line: string) => logged.push(line);
    const server = createServer();
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const auth = createAuth({
      db,
      baseURL: url,
      secret: "integration-tests-secret-0123456789abcdef",
      rateLimit: false,
      log,
    });
    server.on("request", createApp({ auth, db, log }));

    try {
      const response = await fetch(`${url}/api/health`);

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ status: "unavailable" });
      expect(logged).toHaveLength(1);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
