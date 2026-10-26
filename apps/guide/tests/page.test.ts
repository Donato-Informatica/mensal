// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { guideSections } from "@mensal/guide";

// The guide's source page (PRD §7.17): links into it from the app, and
// within it, must never break silently.
const guideRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = new DOMParser().parseFromString(
  readFileSync(join(guideRoot, "index.html"), "utf8"),
  "text/html"
);

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
