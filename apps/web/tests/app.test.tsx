import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chooseFromAccountMenu } from "./account-menu.ts";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { openApp as openAppWith } from "./open-app.tsx";

let api: FakeApi;
beforeEach(() => {
  api = fakeApi();
  // Today is 2026-10-12 in São Paulo.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-12T15:00:00Z") });
});
afterEach(() => {
  vi.useRealTimers();
});

function openApp(path: string) {
  openAppWith(api, path);
}

async function confirmSignOut({ fromMenu = true } = {}) {
  if (fromMenu) await chooseFromAccountMenu("Sair");
  else
    await userEvent.click(await screen.findByRole("button", { name: "Sair" }));
  const dialog = await screen.findByRole("dialog", { name: "Sair da conta" });
  await userEvent.click(within(dialog).getByRole("button", { name: "Sair" }));
  return dialog;
}

async function signIn(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("E-mail"), email);
  await user.type(screen.getByLabelText("Senha"), password);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("signed out", () => {
  it("sends a visitor to sign-in", async () => {
    openApp("/");

    expect(
      await screen.findByRole("heading", { name: "Entrar" })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/entrar");
  });

  it("names the app once, beside a mark screen readers skip", async () => {
    openApp("/entrar");

    expect(await screen.findByText("Mensal")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("signing in", () => {
  it("takes an approved user to the current month", async () => {
    api.addAccount({
      name: "Ana",
      email: "ana@example.com",
      password: "correct-horse",
      approved: true,
    });
    openApp("/entrar");

    await signIn("ana@example.com", "correct-horse");

    expect(
      await screen.findByRole("heading", { name: "Outubro 2026" })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("explains a wrong password in Portuguese", async () => {
    api.addAccount({
      name: "Ana",
      email: "ana@example.com",
      password: "correct-horse",
    });
    openApp("/entrar");

    await signIn("ana@example.com", "wrong-horse");

    expect(
      await screen.findByText("E-mail ou senha incorretos.")
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/entrar");
  });
});

describe("signing up", () => {
  async function signUp(name: string, email: string, password: string) {
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Nome"), name);
    await user.type(screen.getByLabelText("E-mail"), email);
    await user.type(screen.getByLabelText("Senha"), password);
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
  }

  it("leaves the new user awaiting approval", async () => {
    openApp("/cadastro");

    await signUp("Bia", "bia@example.com", "correct-horse");

    expect(
      await screen.findByRole("heading", { name: "Aguardando aprovação" })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/aguardando-aprovacao");
  });

  it("refuses a blank name", async () => {
    openApp("/cadastro");

    await signUp("   ", "bia@example.com", "correct-horse");

    expect(
      await screen.findByText("Informe um nome de até 100 caracteres.")
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/cadastro");
  });
});

describe("awaiting approval", () => {
  beforeEach(() => {
    api.addAccount({
      name: "Bia",
      email: "bia@example.com",
      password: "correct-horse",
    });
    api.signIn("bia@example.com");
  });

  it("holds the user on the waiting screen", async () => {
    openApp("/");

    expect(
      await screen.findByRole("heading", { name: "Aguardando aprovação" })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/aguardando-aprovacao");
  });

  it("lets the user sign out", async () => {
    openApp("/aguardando-aprovacao");

    await confirmSignOut({ fromMenu: false });

    expect(
      await screen.findByRole("heading", { name: "Entrar" })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/entrar");
  });
});

describe("approved", () => {
  beforeEach(() => {
    api.addAccount({
      name: "Ana",
      email: "ana@example.com",
      password: "correct-horse",
      approved: true,
    });
    api.signIn("ana@example.com");
  });

  it("sends a signed-in user away from sign-in to the current month", async () => {
    openApp("/entrar");

    expect(
      await screen.findByRole("heading", { name: "Outubro 2026" })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("lets the user sign out", async () => {
    openApp("/");

    await confirmSignOut();

    expect(
      await screen.findByRole("heading", { name: "Entrar" })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/entrar");
  });

  it("stays signed in when sign-out is cancelled", async () => {
    openApp("/");

    await chooseFromAccountMenu("Sair");
    const dialog = await screen.findByRole("dialog", { name: "Sair da conta" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancelar" })
    );

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(window.location.pathname).toBe("/");
  });

  // On phones it floats at the bottom right, on wider screens it sits in the
  // header: one button either way, which CSS moves (jsdom ignores the media query).
  it.each([
    { screenName: "Mês", path: "/", action: "Nova avulsa" },
    {
      screenName: "Recorrências",
      path: "/recorrencias",
      action: "Nova recorrência",
    },
  ])(
    "shows $screenName's primary action once, a + icon beside its label",
    async ({ path, action }) => {
      openApp(path);

      const button = await screen.findByRole("button", { name: action });
      expect(screen.getAllByRole("button", { name: action })).toHaveLength(1);
      const icon = button.querySelector("svg");
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  );
});

describe("when things go wrong", () => {
  it("explains a failed sign-out in Portuguese", async () => {
    api.addAccount({
      name: "Ana",
      email: "ana@example.com",
      password: "correct-horse",
      approved: true,
    });
    api.signIn("ana@example.com");
    openApp("/");
    await screen.findByRole("button", { name: "Conta" });

    api.breakDown();
    const dialog = await confirmSignOut();

    expect(
      await within(dialog).findByText("Algo deu errado. Tente novamente.")
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("says in Portuguese that an address does not exist", async () => {
    openApp("/nao-existe");

    expect(
      await screen.findByRole("heading", { name: "Página não encontrada" })
    ).toBeInTheDocument();
  });

  it("says in Portuguese that the API failed, and retries on request", async () => {
    api.breakDown();
    openApp("/");

    const retry = await screen.findByRole("button", {
      name: "Tentar novamente",
    });
    expect(
      screen.getByRole("heading", { name: "Algo deu errado" })
    ).toBeInTheDocument();

    api.recover();
    await userEvent.click(retry);

    expect(
      await screen.findByRole("heading", { name: "Entrar" })
    ).toBeInTheDocument();
  });
});
