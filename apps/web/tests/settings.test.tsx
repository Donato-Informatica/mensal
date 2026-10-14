import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { openApp } from "./open-app.tsx";

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

describe("settings", () => {
  it("toggles the month's summary cards from the header", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    expect(
      await screen.findByRole("region", { name: "Entradas" })
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Configurações" }));
    await user.click(
      await screen.findByRole("switch", {
        name: "Mostrar resumo de entradas e saídas",
      })
    );
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("region", { name: "Entradas" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Saídas" })).toBeNull();
  });

  it("settles with one click once confirmations are turned off", async () => {
    const user = userEvent.setup();
    api.addRecurrence(email, { description: "Aluguel", defaultAmount: 220000 });
    openApp(api, "/");

    await user.click(
      await screen.findByRole("button", { name: "Configurações" })
    );
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
