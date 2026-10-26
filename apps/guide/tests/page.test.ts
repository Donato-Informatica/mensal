// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { guideSections } from "@mensal/guide";
import { captures } from "../scripts/captures.ts";

// The guide's source page (PRD §7.17): links into it from the app, and
// within it, must never break silently.
const guideRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(guideRoot, "index.html"), "utf8");
const page = new DOMParser().parseFromString(source, "text/html");

/** A PNG's size in pixels, from its IHDR chunk. */
function pngSize(file: string) {
  const header = readFileSync(file).subarray(16, 24);
  return { width: header.readUInt32BE(0), height: header.readUInt32BE(4) };
}

/** Where Vite takes an `src` from: `/x` is public/x, anything else is relative. */
function sourceFile(src: string) {
  return src.startsWith("/")
    ? join(guideRoot, "public", src)
    : join(guideRoot, src);
}

describe("guide sections", () => {
  it("are the PRD §7.17 list, in order", () => {
    expect(guideSections).toEqual([
      "cadastro",
      "mes",
      "liquidar",
      "avulsa",
      "recorrencias",
      "visualizacao",
      "evolucao",
      "configuracoes",
      "instalar",
      "mcp",
      "conta",
    ]);
  });

  it("are the page's sections, in order, each with a heading", () => {
    const sections = [...page.querySelectorAll("main section[id]")];
    expect(sections.map((section) => section.id)).toEqual(guideSections);
    for (const section of sections) {
      expect(section.querySelector("h2")?.textContent?.trim()).toBeTruthy();
    }
  });

  it("each say what the feature is for, then how to use it, step by step", () => {
    for (const id of guideSections) {
      const section = page.getElementById(id)!;
      expect(
        section.querySelector("h2 + p")?.textContent?.trim(),
        id
      ).toBeTruthy();
      expect(section.querySelectorAll("ol li").length, id).toBeGreaterThan(1);
    }
  });

  it("are each listed in the table of contents, in order", () => {
    const toc = [...page.querySelectorAll("nav[aria-label] a[href^='#']")];
    expect(toc.map((link) => link.getAttribute("href"))).toEqual(
      guideSections.map((id) => `#${id}`)
    );
  });
});

describe("guide page", () => {
  it("links in-page only to ids that exist", () => {
    const links = [...page.querySelectorAll("a[href^='#']")];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const id = link.getAttribute("href")!.slice(1);
      expect(page.getElementById(id), `#${id}`).not.toBeNull();
    }
  });

  it("has every image on disk, with its size declared", () => {
    const images = [...page.querySelectorAll("img")];
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      const src = image.getAttribute("src")!;
      expect(existsSync(sourceFile(src)), src).toBe(true);
      expect(image.getAttribute("width"), src).toMatch(/^\d+$/);
      expect(image.getAttribute("height"), src).toMatch(/^\d+$/);
    }
  });

  it("shows only declared screenshots, described, lazy and at their 2x size", () => {
    const screenshots = [
      ...page.querySelectorAll<HTMLImageElement>("main img"),
    ];
    const declared = captures.map(({ name }) => `./screenshots/${name}.png`);
    expect(screenshots.length).toBeGreaterThan(0);
    for (const image of screenshots) {
      const src = image.getAttribute("src")!;
      expect(declared, src).toContain(src);
      expect(image.getAttribute("alt")?.trim(), src).toBeTruthy();
      expect(image.getAttribute("loading"), src).toBe("lazy");
      const { width, height } = pngSize(sourceFile(src));
      expect(Number(image.getAttribute("width")), src).toBe(width / 2);
      expect(Number(image.getAttribute("height")), src).toBe(height / 2);
    }
  });

  it("previews with the monthly screen when shared", () => {
    const image = page
      .querySelector("meta[property='og:image']")
      ?.getAttribute("content");
    expect(image).toBe("./screenshots/mes.png");
    expect(existsSync(sourceFile(image!))).toBe(true);
    expect(
      page.querySelector("meta[property='og:title']")?.getAttribute("content")
    ).toBeTruthy();
  });

  it("never points at a local address", () => {
    expect(source).not.toMatch(/localhost|127\.0\.0\.1/);
  });

  it("gives the agent setup as copyable code, and conversations as text", () => {
    const mcp = page.getElementById("mcp")!;
    const code = [...mcp.querySelectorAll("pre code")].map(
      (block) => block.textContent ?? ""
    );
    expect(
      code.some((text) =>
        text.includes("claude mcp add --transport http mensal")
      )
    ).toBe(true);
    expect(code.some((text) => text.includes("[mcp_servers.mensal]"))).toBe(
      true
    );
    expect(mcp.textContent).toContain("Authorization: Bearer");
    expect(mcp.textContent).toContain("quais contas vencem esta semana?");
    expect(mcp.textContent).toContain("liquide a conta de luz");
  });

  it("links home, to Entrar and to Criar conta", () => {
    const header = page.querySelector("header")!;
    const hrefs = [...header.querySelectorAll("a")].map((link) => [
      link.textContent?.trim(),
      link.getAttribute("href"),
    ]);
    expect(hrefs).toEqual([
      ["Mensal", "/"],
      ["Entrar", "/entrar"],
      ["Criar conta", "/cadastro"],
    ]);
  });

  it("is a pt-BR page with a title, a description and a favicon", () => {
    expect(page.documentElement.lang).toBe("pt-BR");
    expect(page.title).toBeTruthy();
    expect(
      page.querySelector("meta[name='description']")?.getAttribute("content")
    ).toBeTruthy();
    expect(page.querySelector("meta[name='robots']")).toBeNull();
    const icon = page.querySelector("link[rel='icon']")!.getAttribute("href")!;
    expect(existsSync(sourceFile(icon)), icon).toBe(true);
  });
});
