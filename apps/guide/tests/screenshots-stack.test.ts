import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

// `npm run -w @mensal/guide screenshots` (PRD §7.17) needs the local stack;
// without it, it must stop at once and say how to start it.
const script = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "scripts",
  "screenshots.ts"
);

function run(webUrl: string) {
  return new Promise<{ code: number | null; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, [script], {
      env: { ...process.env, GUIDE_WEB_URL: webUrl },
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("close", (code) => resolve({ code, stderr }));
  });
}

function listen(server: Server) {
  return new Promise<string>((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
    )
  );
}

let server: Server | undefined;
afterEach(() => {
  server?.close();
  server = undefined;
});

function expectStartInstructions(stderr: string) {
  expect(stderr).toContain("docker compose up -d");
  expect(stderr).toContain("npm run -w @mensal/api dev");
  expect(stderr).toContain("npm run -w @mensal/web dev");
}

describe("the screenshots script, without the local stack", () => {
  it("exits non-zero naming how to start it when the web server is down", async () => {
    server = createServer();
    const url = await listen(server);
    server.close();
    server = undefined;

    const { code, stderr } = await run(url);

    expect(code).not.toBe(0);
    expectStartInstructions(stderr);
  }, 30_000);

  it("exits non-zero naming how to start it when the API is not healthy", async () => {
    // What the web dev server answers while its /api proxy finds no API.
    server = createServer((_req, res) => {
      res.statusCode = 502;
      res.end();
    });
    const url = await listen(server);

    const { code, stderr } = await run(url);

    expect(code).not.toBe(0);
    expectStartInstructions(stderr);
  }, 30_000);
});
