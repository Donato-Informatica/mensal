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
  // Today is 2026-10-12 in São Paulo.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-12T15:00:00Z") });
});
afterEach(() => {
  vi.useRealTimers();
});

function signedIn({ approved }: { approved: boolean }) {
  api.addAccount({ name: "Ana", email, password: "old-horse", approved });
  api.signIn(email);
}

/** Opens "Excluir conta" from the account menu of the monthly screen. */
async function openFromMenu() {
  signedIn({ approved: true });
  openApp(api, "/");
  await chooseFromAccountMenu("Excluir conta");
  return screen.findByRole("dialog", { name: "Excluir conta" });
}

/** Fills in the modal: the password, then the email typed as confirmation. */
async function fillIn(
  dialog: HTMLElement,
  { password, typedEmail }: { password: string; typedEmail: string }
) {
  const user = userEvent.setup();
  await user.type(within(dialog).getByLabelText("Senha atual"), password);
  await user.type(
    within(dialog).getByLabelText("Digite seu e-mail para confirmar"),
    typedEmail
  );
}

function deleteButton(dialog: HTMLElement) {
  return within(dialog).getByRole("button", { name: "Excluir conta" });
}

describe("deleting the account (PRD §7.15)", () => {
  it("says what is erased, and lands on the sign-in screen with a notice", async () => {
    const user = userEvent.setup();
    const dialog = await openFromMenu();

    expect(
      within(dialog).getByText(
        /recorrências, contas e tokens de acesso serão apagados para sempre/
      )
    ).toBeInTheDocument();
    await fillIn(dialog, { password: "old-horse", typedEmail: email });
    await user.click(deleteButton(dialog));

    expect(
      await screen.findByRole("heading", { name: "Entrar" })
    ).toBeInTheDocument();
    expect(screen.getByText("Sua conta foi excluída.")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/entrar");
    expect(api.hasAccount(email)).toBe(false);
  });

  it("erases the account's recurrences, occurrences and access tokens with it (PRD §5.13)", async () => {
    const user = userEvent.setup();
    signedIn({ approved: true });
    api.addRecurrence(email);
    api.addOccurrence(email);
    api.addAccessToken(email);
    openApp(api, "/");
    await chooseFromAccountMenu("Excluir conta");
    const dialog = await screen.findByRole("dialog", { name: "Excluir conta" });

    await fillIn(dialog, { password: "old-horse", typedEmail: email });
    await user.click(deleteButton(dialog));

    await screen.findByText("Sua conta foi excluída.");
    expect(api.recurrencesOf(email)).toEqual([]);
    expect(api.occurrencesOf(email)).toEqual([]);
    expect(api.accessTokensOf(email)).toEqual([]);
  });

  it("leaves other accounts alone, even one made afterwards", async () => {
    const user = userEvent.setup();
    signedIn({ approved: true });
    api.addAccount({ name: "Bia", email: "bia@example.com", password: "x" });
    const biasToken = api.addAccessToken("bia@example.com");
    openApp(api, "/");
    await chooseFromAccountMenu("Excluir conta");
    const dialog = await screen.findByRole("dialog", { name: "Excluir conta" });

    await fillIn(dialog, { password: "old-horse", typedEmail: email });
    await user.click(deleteButton(dialog));
    await screen.findByText("Sua conta foi excluída.");
    api.addAccount({ name: "Caio", email: "caio@example.com", password: "x" });

    expect(api.accessTokensOf("bia@example.com")).toEqual([biasToken]);
    expect(api.accessTokensOf("caio@example.com")).toEqual([]);
  });

  it("is the last item of the account menu", async () => {
    signedIn({ approved: true });
    openApp(api, "/");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Conta" }));

    const items = await screen.findAllByRole("menuitem");
    expect(items.at(-1)).toHaveTextContent("Excluir conta");
  });

  it("is reached from the awaiting-approval screen too", async () => {
    const user = userEvent.setup();
    signedIn({ approved: false });
    openApp(api, "/aguardando-aprovacao");

    await user.click(
      await screen.findByRole("button", { name: "Excluir conta" })
    );
    const dialog = await screen.findByRole("dialog", { name: "Excluir conta" });
    await fillIn(dialog, { password: "old-horse", typedEmail: email });
    await user.click(deleteButton(dialog));

    expect(
      await screen.findByText("Sua conta foi excluída.")
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/entrar");
    expect(api.hasAccount(email)).toBe(false);
  });

  it("keeps the button disabled until the typed email matches", async () => {
    const user = userEvent.setup();
    const dialog = await openFromMenu();

    await fillIn(dialog, { password: "old-horse", typedEmail: "ana@exampl" });
    expect(deleteButton(dialog)).toBeDisabled();

    await user.type(
      within(dialog).getByLabelText("Digite seu e-mail para confirmar"),
      "e.com"
    );
    expect(deleteButton(dialog)).toBeEnabled();
  });

  it("says when the password is wrong, on that field, and deletes nothing", async () => {
    const user = userEvent.setup();
    const dialog = await openFromMenu();

    await fillIn(dialog, { password: "not-my-horse", typedEmail: email });
    await user.click(deleteButton(dialog));

    expect(
      await within(dialog).findByText("Senha atual incorreta.")
    ).toBeInTheDocument();
    const field = within(dialog).getByLabelText("Senha atual");
    expect(field).toBeInvalid();
    expect(field).toHaveFocus();
    expect(api.hasAccount(email)).toBe(true);
  });

  it("stays open on a click outside, and closes from Cancelar", async () => {
    const user = userEvent.setup();
    const dialog = await openFromMenu();

    await expectClickOutsideToKeepDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.hasAccount(email)).toBe(true);
  });
});

describe("downloading the data before deleting the account", () => {
  let downloads: string[];
  beforeEach(() => {
    downloads = [];
    URL.createObjectURL = () => "blob:mensal";
    URL.revokeObjectURL = () => {};
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      downloads.push(this.download);
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is offered to an approved user, and downloads the archive without deleting anything", async () => {
    const user = userEvent.setup();
    const dialog = await openFromMenu();

    await user.click(
      within(dialog).getByRole("button", { name: "Baixar meus dados" })
    );

    await waitFor(() =>
      expect(downloads).toEqual(["mensal-dados-2026-10-12.zip"])
    );
    expect(api.dataDownloads()).toBe(1);
    expect(screen.getByRole("dialog", { name: "Excluir conta" })).toBe(dialog);
    expect(api.hasAccount(email)).toBe(true);
  });

  it("is not offered to a user awaiting approval, who has no data to take", async () => {
    const user = userEvent.setup();
    signedIn({ approved: false });
    openApp(api, "/aguardando-aprovacao");

    await user.click(
      await screen.findByRole("button", { name: "Excluir conta" })
    );
    const dialog = await screen.findByRole("dialog", { name: "Excluir conta" });

    expect(within(dialog).getByLabelText("Senha atual")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Baixar meus dados" })
    ).toBeNull();
  });
});
