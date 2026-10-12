import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/app.tsx";
import { createAuthClient } from "../src/auth-client.ts";
import { fakeApi, type FakeApi } from "./fake-api.ts";

let api: FakeApi;
beforeEach(() => {
  api = fakeApi();
});

function openApp(path: string) {
  window.history.replaceState(null, "", path);
  render(<App authClient={createAuthClient(api.fetch)} />);
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
});

describe("signing in", () => {
  it("takes an approved user to the home", async () => {
    api.addAccount({
      name: "Ana",
      email: "ana@example.com",
      password: "correct-horse",
      approved: true,
    });
    openApp("/entrar");

    await signIn("ana@example.com", "correct-horse");

    expect(
      await screen.findByRole("heading", { name: "Olá, Ana" })
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

    await userEvent.click(await screen.findByRole("button", { name: "Sair" }));

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

  it("sends a signed-in user away from sign-in to the home", async () => {
    openApp("/entrar");

    expect(
      await screen.findByRole("heading", { name: "Olá, Ana" })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("lets the user sign out", async () => {
    openApp("/");

    await userEvent.click(await screen.findByRole("button", { name: "Sair" }));

    expect(
      await screen.findByRole("heading", { name: "Entrar" })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/entrar");
  });
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
    const signOut = await screen.findByRole("button", { name: "Sair" });

    api.breakDown();
    await userEvent.click(signOut);

    expect(
      await screen.findByText("Algo deu errado. Tente novamente.")
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
