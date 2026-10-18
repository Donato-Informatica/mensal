import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  it("is reached from the header, and the new password is the one to sign in with", async () => {
    const user = userEvent.setup();
    openApp(api, "/");

    await user.click(
      await screen.findByRole("link", { name: "Alterar senha" })
    );
    await changePassword({ current: "old-horse", next: "new-horse" });
    expect(
      await screen.findByText(
        "Senha alterada. Nos outros dispositivos, entre de novo com a nova senha."
      )
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Voltar para o mês" }));
    await user.click(await screen.findByRole("button", { name: "Sair" }));
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

  it("marks its header link as the current page", async () => {
    openApp(api, "/alterar-senha");

    expect(
      await screen.findByRole("link", { name: "Alterar senha" })
    ).toHaveAttribute("aria-current", "page");
  });

  it("says when the current password is wrong", async () => {
    openApp(api, "/alterar-senha");

    await changePassword({ current: "not-my-horse", next: "new-horse" });

    expect(
      await screen.findByText("Senha atual incorreta.")
    ).toBeInTheDocument();
    const current = screen.getByLabelText("Senha atual");
    expect(current).toBeInvalid();
    expect(current).toHaveFocus();
  });

  it("refuses a confirmation that differs from the new password", async () => {
    openApp(api, "/alterar-senha");

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
