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
  /** Posts `rawBody` as is, from an approved user, to an endpoint that parses JSON. */
  async function postRaw(rawBody: string): Promise<Response> {
    const { cookie, email } = await signUp(api);
    await approve(api, email);
    return request(api, "/api/v1/recurrences", { cookie, rawBody });
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
      // Signed up on the working API: the broken clock would fail sign-up too.
      const { cookie, email } = await signUp(api);
      await approve(api, email);

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

  let issued = 0;
  /** A documentation address (RFC 5737's 198.51.100.0/24), fresh for each call. */
  function newIp(): string {
    issued += 1;
    return `198.51.100.${issued}`;
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
