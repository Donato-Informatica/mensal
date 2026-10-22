import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chooseFromAccountMenu,
  expectClickOutsideToKeepDialog,
} from "./account-menu.ts";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { openApp } from "./open-app.tsx";

const email = "ana@example.com";
let api: FakeApi;
beforeEach(() => {
  api = fakeApi();
  api.addAccount({ name: "Ana", email, password: "old-horse", approved: true });
  api.signIn(email);
  // Today is 2026-10-12 in São Paulo.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-12T15:00:00Z") });
});
afterEach(() => {
  vi.useRealTimers();
});

/** Opens the "Alterar nome" modal from the header of the monthly screen. */
async function openChangeName() {
  openApp(api, "/");
  await chooseFromAccountMenu("Alterar nome");
  return screen.findByRole("dialog", { name: "Alterar nome" });
}

/** Replaces the name in the open modal and saves it. */
async function changeName(to: string) {
  const user = userEvent.setup();
  const field = await screen.findByLabelText("Nome");
  await user.clear(field);
  await user.type(field, to);
  await user.click(screen.getByRole("button", { name: "Salvar nome" }));
}

/** Opens the account menu and checks it shows `name`. */
async function expectNameInMenu(name: string) {
  await userEvent.click(await screen.findByRole("button", { name: "Conta" }));
  const menu = await screen.findByRole("menu");
  expect(within(menu).getByText(name)).toBeInTheDocument();
}

describe("changing the name", () => {
  it("starts from the current name", async () => {
    const dialog = await openChangeName();

    expect(within(dialog).getByLabelText("Nome")).toHaveValue("Ana");
  });

  it("closes once saved, and the menu shows the new name, trimmed", async () => {
    await openChangeName();

    await changeName("  Ana Paula Souza ");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.nameUpdates()).toEqual(["Ana Paula Souza"]);
    await expectNameInMenu("Ana Paula Souza");
  });

  it("closes without a request when the name is unchanged", async () => {
    await openChangeName();

    await changeName(" Ana ");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.nameUpdates()).toEqual([]);
  });

  it("refuses a blank name as the field's error", async () => {
    const dialog = await openChangeName();

    await changeName("   ");

    expect(
      await within(dialog).findByText("Informe um nome de até 100 caracteres.")
    ).toBeInTheDocument();
    const field = within(dialog).getByLabelText("Nome");
    expect(field).toBeInvalid();
    expect(field).toHaveFocus();
    expect(api.nameUpdates()).toEqual([]);
  });

  it("says when the save fails", async () => {
    const dialog = await openChangeName();
    api.breakDown();

    await changeName("Ana Paula");

    expect(
      await within(dialog).findByText("Algo deu errado. Tente novamente.")
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Nome")).toBeValid();
  });

  it("stays open on a click outside, and closes from Cancelar", async () => {
    const user = userEvent.setup();
    const dialog = await openChangeName();
    await user.type(within(dialog).getByLabelText("Nome"), " Paula");

    await expectClickOutsideToKeepDialog(user);
    expect(within(dialog).getByLabelText("Nome")).toHaveValue("Ana Paula");

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.nameUpdates()).toEqual([]);
  });
});
