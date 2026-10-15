import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createDatabase, type Database } from "@mensal/database";
import { createApp } from "../src/app.ts";
import { createAuth } from "../src/auth.ts";
import { testDatabaseUrl } from "./database.ts";

export interface TestApi {
  url: string;
  db: Database;
  close(): Promise<void>;
}

/** The real app on a random port, backed by the test database. */
export async function startApi({
  now,
  log,
  rateLimit = false,
}: {
  now?: () => Date;
  /** Where the API's own log lines go, instead of the console. */
  log?: (message: string) => void;
  /**
   * Turns Better-Auth's rate limiter on. Off by default: every test request
   * comes from one address, so the suite's many sign-ups would trip it.
   */
  rateLimit?: boolean;
} = {}): Promise<TestApi> {
  const db = createDatabase(testDatabaseUrl);
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;
  const auth = createAuth({
    db,
    baseURL: url,
    secret: "integration-tests-secret-0123456789abcdef",
    rateLimit,
    ...(log && { log }),
  });
  server.on(
    "request",
    createApp({ auth, db, ...(now && { now }), ...(log && { log }) })
  );
  return {
    url,
    db,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
      await db.$client.end();
    },
  };
}

/** A same-origin request, as the browser would send it. */
export function request(
  api: TestApi,
  path: string,
  {
    cookie,
    body,
    method = body === undefined ? "GET" : "POST",
    ip,
  }: {
    cookie?: string;
    body?: unknown;
    method?: string;
    /** The client address, as the proxy reports it in `X-Forwarded-For`. */
    ip?: string;
  } = {}
): Promise<Response> {
  const headers = new Headers({ origin: api.url });
  if (cookie) headers.set("cookie", cookie);
  if (ip) headers.set("x-forwarded-for", ip);
  if (body !== undefined) headers.set("content-type", "application/json");
  return fetch(api.url + path, {
    method,
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

/** The `Cookie` header a browser would send back after this response. */
export function cookieFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

export const password = "correct horse battery staple";

export function newEmail(): string {
  return `${randomUUID()}@example.com`;
}

/** Signs a new user up and returns their session cookie and id. */
export async function signUp(
  api: TestApi,
  email = newEmail()
): Promise<{ cookie: string; userId: string; email: string }> {
  const response = await request(api, "/api/auth/sign-up/email", {
    body: { name: "Test User", email, password },
  });
  if (!response.ok) throw new Error(`sign-up failed: ${response.status}`);
  const { user } = (await response.json()) as { user: { id: string } };
  return { cookie: cookieFrom(response), userId: user.id, email };
}

/** What an administrator does by hand in the database. */
export async function approve(api: TestApi, email: string): Promise<void> {
  await api.db.$client.query(
    "UPDATE users SET approved = true WHERE email = $1",
    [email]
  );
}
