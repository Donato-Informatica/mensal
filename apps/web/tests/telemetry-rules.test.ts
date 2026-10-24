import { describe, expect, it } from "vitest";
import {
  errorReport,
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

describe("errorReport", () => {
  it("exports an error's type, never its message or stack", () => {
    const report = errorReport(new TypeError("Sentinel texto do usuario"), "x");

    expect(report).toEqual({
      body: "TypeError",
      attributes: { "exception.type": "TypeError" },
    });
  });

  it("falls back for anything else, strings included", () => {
    expect(errorReport("Sentinel texto", "Uncaught error")).toEqual({
      body: "Uncaught error",
      attributes: {},
    });
    expect(errorReport(undefined, "Unhandled promise rejection").body).toBe(
      "Unhandled promise rejection"
    );
  });
});
