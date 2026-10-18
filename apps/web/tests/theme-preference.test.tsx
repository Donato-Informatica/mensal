import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appliedScheme, deviceTheme } from "./device-theme.ts";
import { chooseFromAccountMenu } from "./account-menu.ts";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { openApp } from "./open-app.tsx";

const email = "ana@example.com";
let api: FakeApi;
let device: ReturnType<typeof deviceTheme>;
beforeEach(() => {
  device = deviceTheme("light");
  api = fakeApi();
  api.addAccount({
    name: "Ana",
    email,
    password: "correct-horse",
    approved: true,
  });
  api.signIn(email);
});
afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-mantine-color-scheme");
});

/** Opens the settings and finds the theme's control. */
async function openTheme(user: UserEvent) {
  await chooseFromAccountMenu("Configurações", user);
  const dialog = await screen.findByRole("dialog", { name: "Configurações" });
  return within(dialog).getByRole("radiogroup", { name: "Tema" });
}

describe("theme preference (PRD §3.5)", () => {
  it("applies Claro at once and keeps it on the account", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    const theme = await openTheme(user);
    expect(appliedScheme()).toBe("dark");
    api.stall();

    await user.click(within(theme).getByRole("radio", { name: "Claro" }));

    // Before the account has answered.
    await waitFor(() => expect(appliedScheme()).toBe("light"));
    api.resume();
    await waitFor(() =>
      expect(api.preferencesOf(email)).toMatchObject({ colorScheme: "light" })
    );

    // Reloaded, with nothing kept in the browser.
    cleanup();
    localStorage.clear();
    document.documentElement.removeAttribute("data-mantine-color-scheme");
    openApp(api, "/");

    await screen.findByRole("button", { name: "Mês anterior" });
    await waitFor(() => expect(appliedScheme()).toBe("light"));
  });

  it("goes back to the previous theme when it could not be saved", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    const theme = await openTheme(user);
    api.stall();

    await user.click(within(theme).getByRole("radio", { name: "Claro" }));

    // Applied at once, before the account has answered.
    await waitFor(() => expect(appliedScheme()).toBe("light"));
    api.breakDown();
    api.resume();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Alteração não salva."
    );
    expect(appliedScheme()).toBe("dark");
    expect(within(theme).getByRole("radio", { name: "Escuro" })).toBeChecked();
    expect(api.preferencesOf(email)).toMatchObject({ colorScheme: "dark" });
  });

  it("follows the device's own theme, live, on Automático", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    const theme = await openTheme(user);

    await user.click(within(theme).getByRole("radio", { name: "Automático" }));

    await waitFor(() => expect(appliedScheme()).toBe("light"));
    device.change("dark");
    expect(appliedScheme()).toBe("dark");
    device.change("light");
    expect(appliedScheme()).toBe("light");
    await waitFor(() =>
      expect(api.preferencesOf(email)).toMatchObject({ colorScheme: "auto" })
    );
  });

  it("starts from the account's theme", async () => {
    api.addAccount({
      name: "Bia",
      email: "bia@example.com",
      password: "correct-horse",
      approved: true,
      colorScheme: "auto",
    });
    api.signIn("bia@example.com");
    device.change("dark");
    openApp(api, "/");

    await screen.findByRole("button", { name: "Mês anterior" });
    await waitFor(() => expect(appliedScheme()).toBe("dark"));
    device.change("light");
    expect(appliedScheme()).toBe("light");
  });

  it("reports only the latest change that could not be saved", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    const theme = await openTheme(user);
    api.breakDown();
    await user.click(
      screen.getByRole("switch", {
        name: "Mostrar resumo de entradas e saídas",
      })
    );
    await screen.findByRole("alert");
    api.recover();

    await user.click(within(theme).getByRole("radio", { name: "Claro" }));

    await waitFor(() =>
      expect(api.preferencesOf(email)).toMatchObject({ colorScheme: "light" })
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
