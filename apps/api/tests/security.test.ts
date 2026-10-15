import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  approve,
  newEmail,
  password,
  request,
  signUp,
  startApi,
  type TestApi,
} from "./api.ts";

let api: TestApi;
beforeAll(async () => {
  api = await startApi();
});
afterAll(async () => {
  await api.close();
});

describe("security headers", () => {
  it("answers with Helmet's headers and without X-Powered-By", async () => {
    const response = await request(api, "/api/v1/me");

    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(response.headers.has("x-powered-by")).toBe(false);
  });
});

describe("error responses", () => {
  /** Posts `body` as is, from an approved user, to an endpoint that parses JSON. */
  async function postRaw(body: string): Promise<Response> {
    const { cookie, email } = await signUp(api);
    await approve(api, email);
    return fetch(`${api.url}/api/v1/recurrences`, {
      method: "POST",
      headers: { origin: api.url, cookie, "content-type": "application/json" },
      body,
    });
  }

  it("answers a malformed JSON body with 400 INVALID_INPUT", async () => {
    const response = await postRaw('{"description": ');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "INVALID_INPUT",
      fields: [],
    });
  });

  it("answers a body over 100 kB with 413 PAYLOAD_TOO_LARGE", async () => {
    const response = await postRaw(
      JSON.stringify({ description: "x".repeat(101 * 1024) })
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ code: "PAYLOAD_TOO_LARGE" });
  });

  it("answers an unexpected throw with 500 INTERNAL_ERROR, logging the error but returning no detail", async () => {
    const logged: string[] = [];
    const broken = await startApi({
      now: () => {
        throw new Error("the clock is broken");
      },
      log: (message) => logged.push(message),
    });
    try {
      const { cookie, email } = await signUp(broken);
      await approve(broken, email);

      const response = await request(broken, "/api/v1/periods/2026-10", {
        cookie,
      });

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('{"code":"INTERNAL_ERROR"}');
      expect(logged.join("\n")).toContain("the clock is broken");
    } finally {
      await broken.close();
    }
  });
});

describe("rate limiting on /api/auth", () => {
  let limited: TestApi;
  beforeAll(async () => {
    limited = await startApi({ rateLimit: true });
  });
  afterAll(async () => {
    await limited.close();
  });

  /** A documentation address (RFC 5737), fresh for each test. */
  function newIp(): string {
    const octet = () => Math.floor(Math.random() * 254) + 1;
    return `198.51.${octet()}.${octet()}`;
  }

  function signIn(ip: string) {
    return request(limited, "/api/auth/sign-in/email", {
      body: { email: newEmail(), password },
      ip,
    });
  }

  it("answers the 6th sign-in within a minute from one address with 429, and still lets another address in", async () => {
    const ip = newIp();
    const statuses = [];
    for (let attempt = 0; attempt < 6; attempt++)
      statuses.push((await signIn(ip)).status);

    const elsewhere = await signIn(newIp());

    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
    expect(elsewhere.status).toBe(401);
  });
});
