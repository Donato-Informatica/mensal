import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ColorScheme } from "@mensal/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import indexHtml from "../index.html?raw";
import { colorSchemeCacheKey } from "../src/color-scheme.ts";
import { appliedScheme, deviceTheme } from "./device-theme.ts";
import { chooseFromAccountMenu } from "./account-menu.ts";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { openApp } from "./open-app.tsx";

/**
 * Loads `index.html`'s head as the browser does before the app's bundle: its
 * `<meta>`s, then its inline script unless scripts do not run.
 */
function firstPaint({ scripts = true } = {}) {
  const page = new DOMParser().parseFromString(indexHtml, "text/html");
  document.head.replaceChildren(
    ...[...page.head.querySelectorAll("meta")].map((meta) =>
      document.importNode(meta, true)
    )
  );
  if (!scripts) return;
  const inline = [...page.head.querySelectorAll("script:not([src])")];
  for (const script of inline) new Function(script.textContent)();
}

/** What `<meta name="…">` tells the browser, for its own chrome. */
function meta(name: "color-scheme" | "theme-color") {
  return document.head
    .querySelector(`meta[name="${name}"]`)
    ?.getAttribute("content");
}

/** Leaves `value` as the theme this device last applied. */
function cacheOnDevice(value: string) {
  localStorage.setItem(colorSchemeCacheKey, value);
}

/** The theme this device last applied, as it keeps it. */
function cachedOnDevice() {
  return localStorage.getItem(colorSchemeCacheKey);
}

/** Signs in an approved account whose theme is `colorScheme`. */
function signedIn({
  email = "ana@example.com",
  colorScheme,
}: {
  email?: string;
  colorScheme: ColorScheme;
}) {
  api.addAccount({
    name: email,
    email,
    password: "correct-horse",
    approved: true,
    colorScheme,
  });
  api.signIn(email);
}

let api: FakeApi;
let device: ReturnType<typeof deviceTheme>;
beforeEach(() => {
  device = deviceTheme("light");
  api = fakeApi();
});
afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-mantine-color-scheme");
  document.head.querySelectorAll("meta").forEach((meta) => meta.remove());
});

describe("first paint, before the app loads (PRD §3.5)", () => {
  it("paints the theme this device last applied", () => {
    cacheOnDevice("light");

    firstPaint();

    expect(appliedScheme()).toBe("light");
    expect(meta("color-scheme")).toBe("light");
    expect(meta("theme-color")).toBe("#f5f5f5");
  });

  it("paints Escuro on a device that has applied none", () => {
    firstPaint();

    expect(appliedScheme()).toBe("dark");
    expect(meta("color-scheme")).toBe("dark");
    expect(meta("theme-color")).toBe("#0a0a0a");
  });

  it("tells the browser Escuro where scripts do not run", () => {
    cacheOnDevice("light");

    firstPaint({ scripts: false });

    expect(meta("color-scheme")).toBe("dark");
    expect(meta("theme-color")).toBe("#0a0a0a");
  });

  it("paints Escuro when the device's copy is not a theme", () => {
    cacheOnDevice("sepia");

    firstPaint();

    expect(appliedScheme()).toBe("dark");
    expect(meta("theme-color")).toBe("#0a0a0a");
  });

  it("paints the device's own theme on Automático", () => {
    cacheOnDevice("auto");
    device.change("dark");

    firstPaint();

    expect(appliedScheme()).toBe("dark");
    expect(meta("color-scheme")).toBe("dark");
    expect(meta("theme-color")).toBe("#0a0a0a");
  });

  it("paints the theme the app last applied", async () => {
    signedIn({ colorScheme: "light" });
    openApp(api, "/");
    await screen.findByRole("button", { name: "Mês anterior" });
    await waitFor(() => expect(appliedScheme()).toBe("light"));

    // Reloaded.
    cleanup();
    document.documentElement.removeAttribute("data-mantine-color-scheme");
    firstPaint();

    expect(appliedScheme()).toBe("light");
  });
});

describe("the browser's own chrome (PRD §3.5)", () => {
  it("follows the theme the app applies, live on Automático", async () => {
    signedIn({ colorScheme: "auto" });
    firstPaint();
    openApp(api, "/");
    await screen.findByRole("button", { name: "Mês anterior" });

    await waitFor(() => expect(meta("theme-color")).toBe("#f5f5f5"));
    expect(meta("color-scheme")).toBe("light");

    device.change("dark");

    expect(meta("theme-color")).toBe("#0a0a0a");
    expect(meta("color-scheme")).toBe("dark");
  });
});

describe("the theme before the session is known (PRD §3.5)", () => {
  it("shows sign-in in the theme this device last applied", async () => {
    cacheOnDevice("light");
    openApp(api, "/entrar");

    await screen.findByRole("heading", { name: "Entrar" });
    expect(appliedScheme()).toBe("light");
  });

  it("gives way to the account's theme once the session loads", async () => {
    signedIn({ colorScheme: "dark" });
    cacheOnDevice("light");
    openApp(api, "/");

    await screen.findByRole("button", { name: "Mês anterior" });
    await waitFor(() => expect(appliedScheme()).toBe("dark"));
    expect(cachedOnDevice()).toBe("dark");
  });

  it("keeps the account's theme when another tab changes the device's copy", async () => {
    signedIn({ colorScheme: "dark" });
    openApp(api, "/");
    await screen.findByRole("button", { name: "Mês anterior" });
    await waitFor(() => expect(appliedScheme()).toBe("dark"));
    const painting = new MutationObserver(() => {});
    painting.observe(document.documentElement, {
      attributeFilter: ["data-mantine-color-scheme"],
      attributeOldValue: true,
    });

    // Another tab, signed in to another account, applies its own theme.
    act(() => {
      localStorage.setItem(colorSchemeCacheKey, "light");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: colorSchemeCacheKey,
          newValue: "light",
          storageArea: localStorage,
        })
      );
    });

    // Not even for a moment.
    const painted = [
      ...painting.takeRecords().map((record) => record.oldValue),
      appliedScheme(),
    ];
    painting.disconnect();
    expect(painted).not.toContain("light");
  });

  it("keeps the last theme on sign-in after signing out, until the next account's loads", async () => {
    const user = userEvent.setup();
    signedIn({ email: "ana@example.com", colorScheme: "light" });
    api.addAccount({
      name: "Bia",
      email: "bia@example.com",
      password: "correct-horse",
      approved: true,
      colorScheme: "dark",
    });
    openApp(api, "/");
    await screen.findByRole("button", { name: "Mês anterior" });
    await waitFor(() => expect(appliedScheme()).toBe("light"));

    await chooseFromAccountMenu("Sair", user);
    const dialog = await screen.findByRole("dialog", { name: "Sair da conta" });
    await user.click(within(dialog).getByRole("button", { name: "Sair" }));

    await screen.findByRole("heading", { name: "Entrar" });
    expect(appliedScheme()).toBe("light");
    expect(cachedOnDevice()).toBe("light");

    await user.type(screen.getByLabelText("E-mail"), "bia@example.com");
    await user.type(screen.getByLabelText("Senha"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await screen.findByRole("button", { name: "Mês anterior" });
    await waitFor(() => expect(appliedScheme()).toBe("dark"));
    expect(cachedOnDevice()).toBe("dark");
  });

  it("starts a new account on Escuro, whatever the device last applied", async () => {
    const user = userEvent.setup();
    cacheOnDevice("light");
    openApp(api, "/cadastro");

    await user.type(await screen.findByLabelText("Nome"), "Caio");
    await user.type(screen.getByLabelText("E-mail"), "caio@example.com");
    await user.type(screen.getByLabelText("Senha"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    await screen.findByRole("heading", { name: "Aguardando aprovação" });
    expect(api.preferencesOf("caio@example.com")).toMatchObject({
      colorScheme: "dark",
    });
    await waitFor(() => expect(appliedScheme()).toBe("dark"));
  });

  it("paints Escuro when the device's copy is not a theme", async () => {
    cacheOnDevice("sepia");
    openApp(api, "/entrar");

    await screen.findByRole("heading", { name: "Entrar" });
    expect(appliedScheme()).toBe("dark");
  });
});
