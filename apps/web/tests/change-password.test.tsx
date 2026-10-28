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

/** Opens the "Alterar senha" modal from the header of the monthly screen. */
async function openChangePassword() {
  openApp(api, "/");
  await chooseFromAccountMenu("Alterar senha");
  return screen.findByRole("dialog", { name: "Alterar senha" });
}

/** Fills in the "Alterar senha" form and sends it. */
async function changePassword({
  current,
  next,
  confirmation = next,
}: {
  current: string;
  next: string;
  confirmation?: string;
}) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Senha atual"), current);
  await user.type(screen.getByLabelText("Nova senha"), next);
  await user.type(screen.getByLabelText("Confirmar nova senha"), confirmation);
  await user.click(screen.getByRole("button", { name: "Salvar senha" }));
}

describe("changing the password", () => {
  it("offers to revoke other devices, and access tokens with the calendar link, both checked", async () => {
    const dialog = await openChangePassword();

    for (const label of [
      "Desconectar dos outros dispositivos",
      "Revogar todos os tokens de acesso e o link do calendário",
    ])
      expect(within(dialog).getByLabelText(label)).toBeChecked();
  });

  it.each([
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ])("sends the choice (sessions %s, tokens %s)", async (sessions, tokens) => {
    const user = userEvent.setup();
    const dialog = await openChangePassword();
    if (!sessions)
      await user.click(
        within(dialog).getByLabelText("Desconectar dos outros dispositivos")
      );
    if (!tokens)
      await user.click(
        within(dialog).getByLabelText(
          "Revogar todos os tokens de acesso e o link do calendário"
        )
      );

    await changePassword({ current: "old-horse", next: "new-horse" });

    await within(dialog).findByText(/Senha alterada/);
    expect(api.passwordChanges()).toEqual([
      { revokeOtherSessions: sessions, revokeAccessTokens: tokens },
    ]);
  });

  it("says what was revoked once the password is changed", async () => {
    const user = userEvent.setup();
    const dialog = await openChangePassword();
    await user.click(
      within(dialog).getByLabelText("Desconectar dos outros dispositivos")
    );

    await changePassword({ current: "old-horse", next: "new-horse" });

    expect(
      await within(dialog).findByText(
        "Senha alterada. Os tokens de acesso e o link do calendário foram revogados."
      )
    ).toBeInTheDocument();
  });

  it("is opened from the header, and the new password is the one to sign in with", async () => {
    const user = userEvent.setup();
    const dialog = await openChangePassword();

    await changePassword({ current: "old-horse", next: "new-horse" });
    expect(
      await within(dialog).findByText(
        "Senha alterada. Nos outros dispositivos, entre de novo com a nova senha. Os tokens de acesso e o link do calendário foram revogados."
      )
    ).toBeInTheDocument();
    // The text one, not the modal's own "Fechar" ×.
    await user.click(within(dialog).getByText("Fechar"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await chooseFromAccountMenu("Sair", user);
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Sair",
      })
    );
    await user.type(await screen.findByLabelText("E-mail"), email);
    await user.type(screen.getByLabelText("Senha"), "new-horse");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByRole("heading", { name: "Outubro 2026" })
    ).toBeInTheDocument();
  });

  it("starts empty when opened again", async () => {
    const user = userEvent.setup();
    const dialog = await openChangePassword();
    await user.type(within(dialog).getByLabelText("Senha atual"), "old-horse");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await chooseFromAccountMenu("Alterar senha", user);

    expect(
      within(
        await screen.findByRole("dialog", { name: "Alterar senha" })
      ).getByLabelText("Senha atual")
    ).toHaveValue("");
  });

  it("stays open on a click outside, and closes from Cancelar", async () => {
    const user = userEvent.setup();
    const dialog = await openChangePassword();
    await user.type(within(dialog).getByLabelText("Senha atual"), "old-horse");

    await expectClickOutsideToKeepDialog(user);
    expect(within(dialog).getByLabelText("Senha atual")).toHaveValue(
      "old-horse"
    );

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.passwordChanges()).toEqual([]);
  });

  it("says when the current password is wrong", async () => {
    await openChangePassword();

    await changePassword({ current: "not-my-horse", next: "new-horse" });

    expect(
      await screen.findByText("Senha atual incorreta.")
    ).toBeInTheDocument();
    const current = screen.getByLabelText("Senha atual");
    expect(current).toBeInvalid();
    expect(current).toHaveFocus();
  });

  it("refuses a confirmation that differs from the new password", async () => {
    await openChangePassword();

    await changePassword({
      current: "old-horse",
      next: "new-horse",
      confirmation: "new-hrose",
    });

    expect(
      await screen.findByText("As senhas não conferem.")
    ).toBeInTheDocument();
    const confirmation = screen.getByLabelText("Confirmar nova senha");
    expect(confirmation).toBeInvalid();
    expect(confirmation).toHaveFocus();
    expect(api.passwordOf(email)).toBe("old-horse");
  });
});
