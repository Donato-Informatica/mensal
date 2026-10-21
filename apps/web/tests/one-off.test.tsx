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

async function openDialog() {
  await user.click(await screen.findByRole("button", { name: "Nova avulsa" }));
  return screen.findByRole("dialog", { name: "Nova conta avulsa" });
}

async function submit(dialog: HTMLElement) {
  await user.click(within(dialog).getByRole("button", { name: "Criar conta" }));
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
}

/** The picker's day, by its label: a role query over a calendar is slow in jsdom. */
function pickDay(date: string) {
  return screen.findByLabelText(date, { selector: "button" });
}

/** Picks the action `name` from the "Mais ações" menu of the row `description`. */
async function act(description: string, name: string) {
  await user.click(
    await screen.findByRole("button", {
      name: `Mais ações para ${description}`,
    })
  );
  // By its text: a role query over the whole page is slow in jsdom, and the
  // dropdown counts as hidden until its transition ends.
  await user.click(
    await screen.findByText(name, { selector: "[role=menuitem] *" })
  );
}

describe("creating a one-off occurrence", () => {
  it("stays open on a click outside, and closes from Cancelar", async () => {
    openApp(api, "/");
    const dialog = await openDialog();
    await user.type(within(dialog).getByLabelText("Descrição"), "Presente");

    await expectClickOutsideToKeepDialog(user);
    expect(within(dialog).getByLabelText("Descrição")).toHaveValue("Presente");

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(api.occurrencesOf(email)).toEqual([]);
  });

  it("shows it in the month without a reload", async () => {
    openApp(api, "/");
    const dialog = await openDialog();

    await user.type(
      within(dialog).getByLabelText("Descrição"),
      "Conserto do carro"
    );
    await user.type(within(dialog).getByLabelText("Valor"), "850");
    await user.click(within(dialog).getByLabelText("Vencimento"));
    await user.click(await pickDay("20/10/2026"));
    await user.type(
      within(dialog).getByLabelText("Observações"),
      "Oficina do Zé"
    );
    await submit(dialog);

    expect(await rows()).toEqual([
      expect.stringMatching(/Conserto do carro.*20\/10.*R\$\s850,00/),
    ]);
    const outflows = screen.getByRole("region", { name: "Saídas" });
    expect(within(outflows).getByLabelText("Previsto")).toHaveTextContent(
      "R$ 850,00"
    );
    expect(api.occurrencesOf(email)).toEqual([
      expect.objectContaining({
        recurrenceId: null,
        direction: "OUTFLOW",
        description: "Conserto do carro",
        status: "PENDING",
        amount: 85000,
        period: "2026-10-01",
        dueDate: "2026-10-20",
        notes: "Oficina do Zé",
      }),
    ]);
  });

  it("records an inflow to be defined in an earlier month on screen", async () => {
    openApp(api, "/?mes=2026-06");
    const dialog = await openDialog();

    expect(within(dialog).getByText("Em Junho 2026")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("radio", { name: "Entrada" }));
    await user.type(
      within(dialog).getByLabelText("Descrição"),
      "Restituição do IR"
    );
    await user.click(within(dialog).getByLabelText("A definir"));
    await submit(dialog);

    expect(await rows()).toEqual([
      expect.stringMatching(/Restituição do IR.*Sem vencimento.*A definir/),
    ]);
    expect(api.occurrencesOf(email)).toEqual([
      expect.objectContaining({
        direction: "INFLOW",
        amount: null,
        period: "2026-06-01",
        dueDate: null,
        notes: null,
      }),
    ]);
  });

  it("explains a failure in Portuguese and keeps what was typed", async () => {
    openApp(api, "/");
    const dialog = await openDialog();
    await user.type(within(dialog).getByLabelText("Descrição"), "Presente");
    await user.type(within(dialog).getByLabelText("Valor"), "120");

    api.breakDown();
    await user.click(
      within(dialog).getByRole("button", { name: "Criar conta" })
    );

    expect(
      await within(dialog).findByText("Algo deu errado. Tente novamente.")
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Descrição")).toHaveValue("Presente");
    expect(api.occurrencesOf(email)).toEqual([]);
  });
});

describe("deleting a one-off occurrence", () => {
  it("offers it on one-off rows only", async () => {
    api.addRecurrence(email, { description: "Aluguel" });
    api.addOccurrence(email, { description: "Conserto do carro" });
    openApp(api, "/");

    await user.click(
      await screen.findByRole("button", { name: "Mais ações para Aluguel" })
    );
    expect(
      await screen.findByText("Pular", { selector: "[role=menuitem] *" })
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Excluir", { selector: "[role=menuitem] *" })
    ).not.toBeInTheDocument();
  });

  it("deletes it once confirmed", async () => {
    api.addOccurrence(email, { description: "Conserto do carro" });
    api.addOccurrence(email, {
      description: "Presente",
      dueDate: "2026-10-25",
    });
    openApp(api, "/");

    await act("Conserto do carro", "Excluir");
    const dialog = await screen.findByRole("dialog", { name: "Excluir conta" });
    expect(dialog).toHaveTextContent("Conserto do carro");
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());

    expect(await rows()).toEqual([expect.stringMatching(/Presente/)]);
    expect(api.occurrencesOf(email)).toEqual([
      expect.objectContaining({ description: "Presente" }),
    ]);
  });

  it("keeps it when the deletion is dismissed by a click outside", async () => {
    api.addOccurrence(email, { description: "Conserto do carro" });
    openApp(api, "/");

    await act("Conserto do carro", "Excluir");
    const dialog = await screen.findByRole("dialog", { name: "Excluir conta" });
    await user.click(document.querySelector(".mantine-Modal-overlay")!);
    await waitFor(() => expect(dialog).not.toBeInTheDocument());

    expect(api.occurrencesOf(email)).toHaveLength(1);
  });

  it("keeps it when the deletion is cancelled", async () => {
    api.addOccurrence(email, { description: "Conserto do carro" });
    openApp(api, "/");

    await act("Conserto do carro", "Excluir");
    const dialog = await screen.findByRole("dialog", { name: "Excluir conta" });
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());

    expect(await rows()).toEqual([expect.stringMatching(/Conserto do carro/)]);
    expect(api.occurrencesOf(email)).toHaveLength(1);
  });

  it("explains a failure in Portuguese, keeping the occurrence", async () => {
    api.addOccurrence(email, { description: "Conserto do carro" });
    openApp(api, "/");
    await act("Conserto do carro", "Excluir");
    const dialog = await screen.findByRole("dialog", { name: "Excluir conta" });

    api.breakDown();
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    expect(
      await within(dialog).findByText("Algo deu errado. Tente novamente.")
    ).toBeInTheDocument();
    expect(api.occurrencesOf(email)).toHaveLength(1);
  });
});
