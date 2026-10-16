import { afterEach, describe, expect, it, vi } from "vitest";
import { consoleActivity } from "../../src/activity.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("consoleActivity", () => {
  it("writes an event as a single JSON line on the console", () => {
    const lines: unknown[][] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args);
    });

    consoleActivity({
      at: "2026-10-16T14:03:00.000Z",
      user: "user-1",
      action: "occurrence.status",
      kind: "occurrence",
      id: "3f0c9a52-1d7e-4c1b-9a4e-2b8f6d5e7c10",
      from: "virtual_9b1e2c3d-4f5a-4b6c-8d7e-0f1a2b3c4d5e_2026-10-01",
      status: "SETTLED",
    });

    expect(lines).toEqual([
      [
        '{"at":"2026-10-16T14:03:00.000Z","user":"user-1","action":"occurrence.status","kind":"occurrence","id":"3f0c9a52-1d7e-4c1b-9a4e-2b8f6d5e7c10","from":"virtual_9b1e2c3d-4f5a-4b6c-8d7e-0f1a2b3c4d5e_2026-10-01","status":"SETTLED"}',
      ],
    ]);
  });
});
