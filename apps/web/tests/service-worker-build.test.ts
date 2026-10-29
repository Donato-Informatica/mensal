import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The production build's service worker (PRD §7.16, §8.4, ADR-0006):
// installable, online only. It precaches the built shell and nothing else.
const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
let outDir = "";

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "mensal-web-"));
  await build({
    root: webRoot,
    configFile: join(webRoot, "vite.config.ts"),
    logLevel: "silent",
    build: { outDir, emptyOutDir: true },
  });
}, 120_000);

afterAll(() => {
  if (outDir) rmSync(outDir, { recursive: true });
});

const builtFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? builtFiles(join(dir, entry.name))
      : [relative(outDir, join(dir, entry.name)).replaceAll("\\", "/")]
  );

/** The urls the built sw.js precaches, as written into it by the build. */
const precached = () => {
  const worker = readFileSync(join(outDir, "sw.js"), "utf8");
  return [...worker.matchAll(/"?url"?\s*:\s*"([^"]+)"/g)].map(
    (match) => match[1]
  );
};

describe("the built service worker", () => {
  it("is sw.js, registered by the built page", () => {
    const page = readFileSync(join(outDir, "index.html"), "utf8");
    expect(page).toContain("registerSW.js");
    const register = readFileSync(join(outDir, "registerSW.js"), "utf8");
    expect(register).toContain("/sw.js");
  });

  it("precaches the whole built shell and its manifest", () => {
    const shell = builtFiles(outDir).filter(
      (file) =>
        /\.(js|css|html|woff2|png|svg)$/.test(file) &&
        file !== "sw.js" &&
        !/^workbox-[\w-]+\.js$/.test(file)
    );
    expect(shell).toContain("index.html");
    expect(shell.some((file) => file.endsWith(".woff2"))).toBe(true);

    expect(precached().sort()).toEqual(
      [...shell, "manifest.webmanifest"].sort()
    );
  });
});
