import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectClickOutsideToKeepDialog } from "./account-menu.ts";
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

async function openEdit(description: string) {
  await user.click(
    await screen.findByRole("button", { name: `Editar ${description}` })
  );
  return screen.findByRole("dialog", { name: "Editar conta" });
}

async function save(dialog: HTMLElement) {
  await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
}

/** The picker's day, by its label: a role query over a calendar is slow in jsdom. */
function pickDay(date: string) {
  return screen.findByLabelText(date, { selector: "button" });
}

async function replace(field: HTMLElement, text: string) {
  await user.clear(field);
  await user.type(field, text);
}

describe("editing an occurrence", () => {
  it("stays open on a click outside, and closes from Cancelar", async () => {
    api.addOccurrence(email, { description: "Conserto do carro" });
    openApp(api, "/");
    const dialog = await openEdit("Conserto do carro");
    await replace(within(dialog).getByLabelText("Descrição"), "Oficina");

    await expectClickOutsideToKeepDialog(user);
    expect(within(dialog).getByLabelText("Descrição")).toHaveValue("Oficina");

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(api.occurrencesOf(email)).toEqual([
      expect.objectContaining({ description: "Conserto do carro" }),
    ]);
  });

  it("edits a virtual occurrence, materializing it and leaving the recurrence as it was", async () => {
    const power = api.addRecurrence(email, {
      description: "Energia",
      defaultAmount: 18000,
      dueDay: 25,
    });
    const recurrenceBefore = structuredClone(power);
    openApp(api, "/");
    const dialog = await openEdit("Energia");

    await replace(within(dialog).getByLabelText("Descrição"), "Energia (casa)");
    await replace(within(dialog).getByLabelText("Valor"), "230,45");
    await user.click(within(dialog).getByLabelText("Vencimento"));
    await user.click(await pickDay("28/10/2026"));
    await user.type(
      within(dialog).getByLabelText("Observações"),
      "Bandeira vermelha"
    );
    await save(dialog);

    expect(await rows()).toEqual([
      expect.stringMatching(/Energia \(casa\).*28\/10.*R\$\s230,45/),
    ]);
    expect(api.occurrencesOf(email)).toEqual([
      expect.objectContaining({
        recurrenceId: power.id,
        description: "Energia (casa)",
        amount: 23045,
        dueDate: "2026-10-28",
        notes: "Bandeira vermelha",
        status: "PENDING",
      }),
    ]);
    expect(api.recurrencesOf(email)).toEqual([recurrenceBefore]);
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(await rows()).toEqual([
      expect.stringMatching(/Energia.*25\/11.*R\$\s180,00/),
    ]);
  });

  it("edits the settlement date of a settled occurrence", async () => {
    api.addOccurrence(email, {
      description: "Conserto do carro",
      status: "SETTLED",
      amount: 85000,
      settledAt: "2026-10-05",
    });
    openApp(api, "/");
    const dialog = await openEdit("Conserto do carro");

    const settledAt = within(dialog).getByLabelText("Data da liquidação");
    expect(settledAt).toHaveTextContent("05/10/2026");
    expect(
      within(dialog).queryByLabelText("A definir")
    ).not.toBeInTheDocument();
    await user.click(settledAt);
    await user.click(await pickDay("03/10/2026"));
    await save(dialog);

    expect(api.occurrencesOf(email)).toEqual([
      expect.objectContaining({ status: "SETTLED", settledAt: "2026-10-03" }),
    ]);
  });

  it("offers no settlement date for an occurrence not settled", async () => {
    api.addOccurrence(email, { description: "Conserto do carro" });
    openApp(api, "/");
    const dialog = await openEdit("Conserto do carro");

    expect(
      within(dialog).queryByLabelText("Data da liquidação")
    ).not.toBeInTheDocument();
  });

  it("makes the amount to be defined and removes the due date", async () => {
    api.addOccurrence(email, {
      description: "Conserto do carro",
      amount: 85000,
      dueDate: "2026-10-20",
      notes: "Orçamento",
    });
    openApp(api, "/");
    const dialog = await openEdit("Conserto do carro");

    expect(within(dialog).getByLabelText("Valor")).toHaveValue("R$ 850");
    expect(within(dialog).getByLabelText("Observações")).toHaveValue(
      "Orçamento"
    );
    await user.click(within(dialog).getByLabelText("A definir"));
    await user.click(
      within(dialog).getByRole("button", { name: "Remover vencimento" })
    );
    await user.clear(within(dialog).getByLabelText("Observações"));
    await save(dialog);

    expect(await rows()).toEqual([
      expect.stringMatching(/Conserto do carro.*Sem vencimento.*A definir/),
    ]);
    expect(api.occurrencesOf(email)).toEqual([
      expect.objectContaining({ amount: null, dueDate: null, notes: null }),
    ]);
  });

  it("explains a failure in Portuguese and keeps what was typed", async () => {
    api.addOccurrence(email, { description: "Conserto do carro" });
    openApp(api, "/");
    const dialog = await openEdit("Conserto do carro");
    await replace(within(dialog).getByLabelText("Descrição"), "Freio");

    api.breakDown();
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(
      await within(dialog).findByText("Algo deu errado. Tente novamente.")
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Descrição")).toHaveValue("Freio");
    expect(api.occurrencesOf(email)).toEqual([
      expect.objectContaining({ description: "Conserto do carro" }),
    ]);
  });

  it("saves no amount of zero", async () => {
    api.addOccurrence(email, { description: "Conserto do carro" });
    openApp(api, "/");
    const dialog = await openEdit("Conserto do carro");

    await replace(within(dialog).getByLabelText("Valor"), "0");

    expect(
      within(dialog).getByRole("button", { name: "Salvar" })
    ).toBeDisabled();
  });
});
