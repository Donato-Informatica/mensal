// @vitest-environment jsdom
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { afterEach, describe, expect, it } from "vitest";

// The built guide (PRD §7.17) previews well when shared: link previews need
// an absolute og:image, so the build prefixes it with the public origin.
const guideRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDirs: string[] = [];

afterEach(() => {
  delete process.env.VITE_PUBLIC_ORIGIN;
  for (const dir of outDirs.splice(0)) rmSync(dir, { recursive: true });
});

/** Builds the guide into a temporary folder; returns its page and folder. */
async function buildGuide(publicOrigin?: string) {
  if (publicOrigin !== undefined) process.env.VITE_PUBLIC_ORIGIN = publicOrigin;
  const outDir = mkdtempSync(join(tmpdir(), "mensal-guide-"));
  outDirs.push(outDir);
  await build({
    root: guideRoot,
    configFile: join(guideRoot, "vite.config.ts"),
    logLevel: "silent",
    build: { outDir, emptyOutDir: true },
  });
  const html = readFileSync(join(outDir, "index.html"), "utf8");
  const page = new DOMParser().parseFromString(html, "text/html");
  const meta = (property: string) =>
    page.querySelector(`meta[property='${property}']`)?.getAttribute("content");
  return { meta, outDir };
}

describe("built guide", () => {
  it("shares an absolute og:image and og:url on the public origin", async () => {
    const { meta, outDir } = await buildGuide("https://mensal.example.com/");

    const image = meta("og:image")!;
    expect(image).toMatch(
      /^https:\/\/mensal\.example\.com\/guia\/assets\/mes-[\w-]+\.png$/
    );
    const built = new URL(image).pathname.replace(/^\/guia\//, "");
    expect(existsSync(join(outDir, built)), built).toBe(true);
    expect(meta("og:url")).toBe("https://mensal.example.com/guia/");
  }, 60_000);

  it("keeps a root-relative og:image and no og:url without an origin", async () => {
    const { meta } = await buildGuide();

    expect(meta("og:image")).toMatch(/^\/guia\/assets\/mes-[\w-]+\.png$/);
    expect(meta("og:url")).toBeUndefined();
  }, 60_000);

  it("refuses an origin that is not an http(s) URL", async () => {
    await expect(buildGuide("mensal.example.com")).rejects.toThrow(
      /VITE_PUBLIC_ORIGIN/
    );
  }, 60_000);
});
