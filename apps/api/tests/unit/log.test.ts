import { afterEach, describe, expect, it, vi } from "vitest";
import { consoleActivity } from "../../src/activity.ts";
import { exportedLog } from "../../src/log.ts";

afterEach(() => vi.restoreAllMocks());

describe("sinks with telemetry off", () => {
  it("writes the activity event as one JSON line to stdout", () => {
    const stdout = vi.spyOn(console, "log").mockImplementation(() => {});
    const event = {
      at: "2026-10-01T00:00:00.000Z",
      user: "u",
      action: "user.sign-in",
    } as const;

    consoleActivity(event);

    expect(stdout.mock.calls).toEqual([[JSON.stringify(event)]]);
  });

  it("writes the operator log to the stream it wraps", () => {
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    const stdout = vi.spyOn(console, "log").mockImplementation(() => {});

    exportedLog((message) => console.error(message))("boom");
    exportedLog((message) => console.log(message), "INFO")("hello");

    expect(stderr.mock.calls).toEqual([["boom"]]);
    expect(stdout.mock.calls).toEqual([["hello"]]);
  });
});
