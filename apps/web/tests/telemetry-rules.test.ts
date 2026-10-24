import { describe, expect, it } from "vitest";
import {
  isOwnApiUrl,
  notOwnApiPattern,
  stripQueryAndHash,
  telemetryEndpoint,
} from "../src/telemetry-rules.ts";

describe("telemetryEndpoint", () => {
  it("is on only for the /otlp path", () => {
    expect(telemetryEndpoint("/otlp")).toBe("/otlp");
    expect(telemetryEndpoint("/otlp/")).toBe("/otlp");
  });

  it("is a no-op when unset or anything else", () => {
    expect(telemetryEndpoint(undefined)).toBeUndefined();
    expect(telemetryEndpoint("")).toBeUndefined();
    expect(telemetryEndpoint("https://collector.example/otlp")).toBeUndefined();
  });
});

describe("stripQueryAndHash", () => {
  it("drops the query string and the fragment", () => {
    expect(
      stripQueryAndHash("https://app.test/reset-password?token=abc#x")
    ).toBe("https://app.test/reset-password");
    expect(stripQueryAndHash("/api/v1/period?period=2026-10")).toBe(
      "/api/v1/period"
    );
  });

  it("leaves a clean url alone", () => {
    expect(stripQueryAndHash("https://app.test/")).toBe("https://app.test/");
  });
});

describe("notOwnApiPattern", () => {
  const ignored = notOwnApiPattern("https://app.test");

  it("lets only the app's own /api through", () => {
    expect(ignored.test("/api/v1/period?period=2026-10")).toBe(false);
    expect(ignored.test("https://app.test/api/auth/sign-in/email")).toBe(false);
  });

  it("ignores /otlp, other origins and other paths", () => {
    expect(ignored.test("/otlp/v1/traces")).toBe(true);
    expect(ignored.test("https://app.test/otlp/v1/logs")).toBe(true);
    expect(ignored.test("https://other.test/api/x")).toBe(true);
    expect(ignored.test("/apix")).toBe(true);
    expect(ignored.test("/assets/index.js")).toBe(true);
  });
});

describe("isOwnApiUrl", () => {
  const origin = "https://app.test";

  it("matches the app's own /api, absolute or relative", () => {
    expect(isOwnApiUrl("https://app.test/api/v1/period", origin)).toBe(true);
    expect(isOwnApiUrl("/api/auth/get-session", origin)).toBe(true);
    expect(isOwnApiUrl("https://app.test/api", origin)).toBe(true);
  });

  it("rejects other origins, other paths and look-alikes", () => {
    expect(isOwnApiUrl("https://other.test/api/v1/period", origin)).toBe(false);
    expect(isOwnApiUrl("https://app.test/otlp/v1/traces", origin)).toBe(false);
    expect(isOwnApiUrl("https://app.test/apix", origin)).toBe(false);
    expect(isOwnApiUrl("https://app.test.evil.com/api/x", origin)).toBe(false);
    expect(isOwnApiUrl("not a url", "")).toBe(false);
  });
});
