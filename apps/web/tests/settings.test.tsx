import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  chooseFromAccountMenu,
  expectClickOutsideToKeepDialog,
} from "./account-menu.ts";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { openApp, settle } from "./open-app.tsx";

const email = "ana@example.com";
let api: FakeApi;
beforeEach(() => {
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
});

/** Opens the settings and finds the summary's switch. */
async function openSummarySwitch(user: UserEvent) {
  await chooseFromAccountMenu("Configurações", user);
  return screen.findByRole("switch", {
    name: "Mostrar resumo de entradas e saídas",
  });
}

describe("settings", () => {
  it("stays open on a click outside, and closes from Fechar", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    await chooseFromAccountMenu("Configurações", user);
    const dialog = await screen.findByRole("dialog", { name: "Configurações" });

    await expectClickOutsideToKeepDialog(user);

    // The text one, not the modal's own "Fechar" ×.
    await user.click(within(dialog).getByText("Fechar"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("toggles the month's summary cards from the header", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    expect(
      await screen.findByRole("region", { name: "Entradas" })
    ).toBeTruthy();

    await chooseFromAccountMenu("Configurações", user);
    await user.click(
      await screen.findByRole("switch", {
        name: "Mostrar resumo de entradas e saídas",
      })
    );
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("region", { name: "Entradas" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Saídas" })).toBeNull();
  });

  it("starts from the account's preferences", async () => {
    api.addAccount({
      name: "Bia",
      email: "bia@example.com",
      password: "correct-horse",
      approved: true,
      showSummary: false,
    });
    api.signIn("bia@example.com");
    openApp(api, "/");

    expect(
      await screen.findByRole("button", { name: "Mês anterior" })
    ).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Entradas" })).toBeNull();
  });

  it("keeps a changed preference on every device", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    await chooseFromAccountMenu("Configurações", user);
    await user.click(
      await screen.findByRole("switch", {
        name: "Mostrar resumo de entradas e saídas",
      })
    );
    await waitFor(() =>
      expect(api.preferencesOf(email)).toMatchObject({ showSummary: false })
    );

    // Another device: a fresh app with nothing in the browser.
    cleanup();
    localStorage.clear();
    openApp(api, "/");

    expect(
      await screen.findByRole("button", { name: "Mês anterior" })
    ).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Entradas" })).toBeNull();
  });

  it("saves only the preference that changed", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    await chooseFromAccountMenu("Configurações", user);
    // Meanwhile another device turns the summary off.
    api.setPreferences(email, { showSummary: false });

    await user.click(
      await screen.findByRole("switch", {
        name: "Confirmar antes de liquidar, pular ou voltar uma conta para pendente",
      })
    );

    await waitFor(() =>
      expect(api.preferencesOf(email)).toEqual({
        showSummary: false,
        confirmStatusChanges: false,
        colorScheme: "dark",
        occurrenceView: "list",
      })
    );
  });

  it("restores a preference that could not be saved", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    await chooseFromAccountMenu("Configurações", user);
    const summarySwitch = await screen.findByRole("switch", {
      name: "Mostrar resumo de entradas e saídas",
    });
    api.breakDown();

    await user.click(summarySwitch);

    await waitFor(() => expect(summarySwitch).toBeChecked());
    expect(api.preferencesOf(email)).toMatchObject({ showSummary: true });
  });

  it("says when a preference could not be saved", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    await chooseFromAccountMenu("Configurações", user);
    const dialog = await screen.findByRole("dialog", { name: "Configurações" });
    api.breakDown();

    await user.click(
      within(dialog).getByRole("switch", {
        name: "Mostrar resumo de entradas e saídas",
      })
    );

    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      "Alteração não salva. Algo deu errado. Tente novamente."
    );
  });

  it("clears the failure once a later change is saved", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    await chooseFromAccountMenu("Configurações", user);
    const dialog = await screen.findByRole("dialog", { name: "Configurações" });
    api.breakDown();
    await user.click(
      within(dialog).getByRole("switch", {
        name: "Mostrar resumo de entradas e saídas",
      })
    );
    await within(dialog).findByRole("alert");
    api.recover();

    await user.click(
      within(dialog).getByRole("switch", {
        name: "Confirmar antes de liquidar, pular ou voltar uma conta para pendente",
      })
    );

    await waitFor(() =>
      expect(api.preferencesOf(email)).toMatchObject({
        confirmStatusChanges: false,
      })
    );
    expect(within(dialog).queryByRole("alert")).toBeNull();
  });

  it("ends on what the account holds when quick changes all fail", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    const summarySwitch = await openSummarySwitch(user);
    api.stall();
    await user.click(summarySwitch); // Off…
    await user.click(summarySwitch); // …and on again.
    await waitFor(() => expect(api.heldCount()).toBe(2));

    api.answer(0, { fail: true });
    api.answer(1, { fail: true });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Alteração não salva."
    );
    await settle();
    expect(summarySwitch).toBeChecked();
    expect(api.preferencesOf(email)).toMatchObject({ showSummary: true });
  });

  it("keeps the latest change when an earlier one fails after it", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    const summarySwitch = await openSummarySwitch(user);
    api.stall();
    await user.click(summarySwitch); // Off…
    await user.click(summarySwitch); // …on…
    await user.click(summarySwitch); // …and off again.
    await waitFor(() => expect(api.heldCount()).toBe(3));

    api.answer(2);
    await waitFor(() =>
      expect(api.preferencesOf(email)).toMatchObject({ showSummary: false })
    );
    api.answer(0, { fail: true });

    await settle();
    expect(summarySwitch).not.toBeChecked();
    expect(screen.queryByRole("alert")).toBeNull();

    api.answer(1, { fail: true });

    await settle();
    expect(summarySwitch).not.toBeChecked();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(api.preferencesOf(email)).toMatchObject({ showSummary: false });
  });

  it("ignores what an older version kept in the browser", async () => {
    localStorage.setItem("mensal:show-summary", "false");
    openApp(api, "/");

    expect(
      await screen.findByRole("region", { name: "Entradas" })
    ).toBeTruthy();
  });

  it("settles with one click once confirmations are turned off", async () => {
    const user = userEvent.setup();
    api.addRecurrence(email, { description: "Aluguel", defaultAmount: 220000 });
    openApp(api, "/");

    await chooseFromAccountMenu("Configurações", user);
    await user.click(
      await screen.findByRole("switch", {
        name: "Confirmar antes de liquidar, pular ou voltar uma conta para pendente",
      })
    );
    await user.keyboard("{Escape}");
    await user.click(
      await screen.findByRole("checkbox", { name: "Liquidar Aluguel" })
    );

    expect(screen.queryByRole("dialog", { name: "Liquidar conta" })).toBeNull();
    await waitFor(() =>
      expect(api.occurrencesOf(email)).toEqual([
        expect.objectContaining({ status: "SETTLED" }),
      ])
    );
  });
});
