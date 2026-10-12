import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { openApp } from "./open-app.tsx";

const email = "ana@example.com";
let api: FakeApi;
let user: UserEvent;
beforeEach(() => {
  // Today is 2026-10-12 in São Paulo.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-12T15:00:00Z") });
  api = fakeApi();
  api.addAccount({
    name: "Ana",
    email,
    password: "correct-horse",
    approved: true,
  });
  api.signIn(email);
  user = userEvent.setup();
});
afterEach(() => {
  vi.useRealTimers();
});

/** The text of each row of the month, group after group, in order. */
async function rows(): Promise<string[]> {
  const list = await screen.findByRole("region", {
    name: "Contas do mês",
  });
  return within(list)
    .getAllByRole("listitem")
    .map((row) => row.textContent ?? "");
}

async function openDialog() {
  await user.click(
    await screen.findByRole("button", { name: "Nova recorrência" })
  );
  return screen.findByRole("dialog", { name: "Nova recorrência" });
}

async function submit(dialog: HTMLElement) {
  await user.click(
    within(dialog).getByRole("button", { name: "Criar recorrência" })
  );
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
}

describe("creating a recurrence", () => {
  it("shows its occurrence in the month without a reload", async () => {
    openApp(api, "/");
    const dialog = await openDialog();

    await user.type(within(dialog).getByLabelText("Descrição"), "Internet");
    await user.type(within(dialog).getByLabelText("Valor"), "119,90");
    await user.type(within(dialog).getByLabelText("Dia do vencimento"), "5");
    await user.type(
      within(dialog).getByLabelText("Observações"),
      "Fibra 500 mega"
    );
    await submit(dialog);

    expect(await rows()).toEqual([
      expect.stringMatching(/Internet.*05\/10.*R\$\s119,90/),
    ]);
    const outflows = screen.getByRole("region", { name: "Saídas" });
    expect(within(outflows).getByLabelText("Previsto")).toHaveTextContent(
      "R$ 119,90"
    );
    expect(api.recurrencesOf(email)).toEqual([
      expect.objectContaining({
        direction: "OUTFLOW",
        description: "Internet",
        defaultAmount: 11990,
        dueDay: 5,
        startPeriod: "2026-10-01",
        endPeriod: null,
        notes: "Fibra 500 mega",
      }),
    ]);
  });

  it("creates an inflow whose amount is to be defined", async () => {
    openApp(api, "/");
    const dialog = await openDialog();

    await user.click(within(dialog).getByRole("radio", { name: "Entrada" }));
    await user.type(within(dialog).getByLabelText("Descrição"), "Freela");
    await user.click(within(dialog).getByLabelText("A definir"));
    await submit(dialog);

    expect(await rows()).toEqual([
      expect.stringMatching(/Freela.*Sem vencimento.*A definir/),
    ]);
    expect(api.recurrencesOf(email)).toEqual([
      expect.objectContaining({
        direction: "INFLOW",
        defaultAmount: null,
        dueDay: null,
      }),
    ]);
  });

  it("starts in the month on screen", async () => {
    openApp(api, "/?mes=2026-12");
    const dialog = await openDialog();

    expect(within(dialog).getByLabelText("Início")).toHaveTextContent(
      "Dezembro 2026"
    );
    await user.type(within(dialog).getByLabelText("Descrição"), "Academia");
    await user.type(within(dialog).getByLabelText("Valor"), "99");
    await submit(dialog);

    expect(await rows()).toEqual([expect.stringMatching(/Academia/)]);
    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(
      await screen.findByText("Nenhuma conta neste mês.")
    ).toBeInTheDocument();
  });

  it("starts in the current month when the month on screen is past", async () => {
    openApp(api, "/?mes=2026-08");
    const dialog = await openDialog();

    expect(within(dialog).getByLabelText("Início")).toHaveTextContent(
      "Outubro 2026"
    );
  });

  it("stops in the chosen end month", async () => {
    openApp(api, "/");
    const dialog = await openDialog();

    await user.type(within(dialog).getByLabelText("Descrição"), "Geladeira");
    await user.type(within(dialog).getByLabelText("Valor"), "450");
    await user.click(within(dialog).getByLabelText("Término"));
    await user.click(
      await screen.findByRole("button", { name: "Dezembro 2026" })
    );
    expect(within(dialog).getByLabelText("Término")).toHaveTextContent(
      "Dezembro 2026"
    );
    await submit(dialog);

    expect(api.recurrencesOf(email)).toEqual([
      expect.objectContaining({ endPeriod: "2026-12-01" }),
    ]);
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(await rows()).toEqual([expect.stringMatching(/Geladeira/)]);
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(
      await screen.findByText("Nenhuma conta neste mês.")
    ).toBeInTheDocument();
  });

  it("explains a failure in Portuguese and keeps what was typed", async () => {
    openApp(api, "/");
    const dialog = await openDialog();
    await user.type(within(dialog).getByLabelText("Descrição"), "Internet");
    await user.type(within(dialog).getByLabelText("Valor"), "120");

    api.breakDown();
    await user.click(
      within(dialog).getByRole("button", { name: "Criar recorrência" })
    );

    expect(
      await within(dialog).findByText("Algo deu errado. Tente novamente.")
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Descrição")).toHaveValue("Internet");
    expect(api.recurrencesOf(email)).toEqual([]);
  });

  it("keeps the arrow keys inside the dialog from changing the month", async () => {
    openApp(api, "/");
    const dialog = await openDialog();

    within(dialog).getByRole("button", { name: "Criar recorrência" }).focus();
    await user.keyboard("{ArrowRight}");
    await user.click(within(dialog).getByLabelText("Início"));
    await user.keyboard("{ArrowRight}");

    expect(
      screen.getByRole("heading", { name: "Outubro 2026", hidden: true })
    ).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });
});
