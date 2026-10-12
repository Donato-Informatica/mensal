import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { openApp } from "./open-app.tsx";

let api: FakeApi;
beforeEach(() => {
  api = fakeApi();
  api.addAccount({
    name: "Ana",
    email: "ana@example.com",
    password: "old-horse",
    approved: true,
  });
  // Today is 2026-10-12 in São Paulo.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-12T15:00:00Z") });
});
afterEach(() => {
  vi.useRealTimers();
});

/** Asks for a reset link on the "Esqueci a senha" screen. */
async function askForLink(email: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("E-mail"), email);
  await user.click(screen.getByRole("button", { name: "Pedir link" }));
}

describe("forgetting the password", () => {
  it("requests a reset link for the administrator to forward", async () => {
    const user = userEvent.setup();
    openApp(api, "/entrar");

    await user.click(
      await screen.findByRole("link", { name: "Esqueci a senha" })
    );
    await askForLink("ana@example.com");

    expect(
      await screen.findByText(
        "Se houver uma conta com este e-mail, o administrador vai enviar a você um link para criar uma nova senha."
      )
    ).toBeInTheDocument();
    expect(api.resetLinkFor("ana@example.com")).toBeDefined();
  });
});

describe("opening the reset link", () => {
  async function requestedLink() {
    openApp(api, "/esqueci-a-senha");
    await askForLink("ana@example.com");
    await screen.findByText(/o administrador vai enviar/);
    cleanup();
    return api.resetLinkFor("ana@example.com")!;
  }

  async function setNewPassword(password: string) {
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Nova senha"), password);
    await user.click(screen.getByRole("button", { name: "Salvar senha" }));
  }

  it("sets a new password the user then signs in with", async () => {
    openApp(api, await requestedLink());

    await setNewPassword("new-horse");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("link", { name: "Entrar" }));
    await user.type(await screen.findByLabelText("E-mail"), "ana@example.com");
    await user.type(screen.getByLabelText("Senha"), "new-horse");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByRole("heading", { name: "Outubro 2026" })
    ).toBeInTheDocument();
  });

  it("says an invalid or expired link is no good, and offers a new one", async () => {
    // Opening such a link lands here with an error instead of a token.
    openApp(api, "/redefinir-senha?error=INVALID_TOKEN");

    await userEvent.click(
      await screen.findByRole("link", { name: "Pedir um novo link" })
    );

    expect(
      await screen.findByRole("heading", { name: "Esqueci a senha" })
    ).toBeInTheDocument();
  });

  it("says a link already used is no good", async () => {
    const link = await requestedLink();
    openApp(api, link);
    await setNewPassword("new-horse");
    await screen.findByText("Senha redefinida. Entre com a nova senha.");
    cleanup();
    openApp(api, link);

    await setNewPassword("newer-horse");

    expect(
      await screen.findByText("Este link é inválido ou expirou. Peça um novo.")
    ).toBeInTheDocument();
  });
});
