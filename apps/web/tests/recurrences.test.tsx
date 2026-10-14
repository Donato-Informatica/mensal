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

/** The text of each recurrence listed, in order. */
async function rows(): Promise<string[]> {
  const list = await screen.findByRole("list", { name: "Recorrências" });
  return within(list)
    .queryAllByRole("listitem")
    .map((row) => row.textContent ?? "");
}

describe("the recurrences screen", () => {
  it("is reached from the monthly screen and lists the active recurrences", async () => {
    api.addRecurrence(email, {
      description: "Aluguel",
      defaultAmount: 220000,
      dueDay: 10,
      startPeriod: "2026-10-01",
    });
    api.addRecurrence(email, {
      description: "Freela",
      direction: "INFLOW",
      defaultAmount: null,
      dueDay: null,
      startPeriod: "2026-11-01",
      endPeriod: "2027-03-01",
    });
    api.addRecurrence(email, {
      description: "Curso",
      startPeriod: "2026-03-01",
      endPeriod: "2026-09-01",
    });
    openApp(api, "/");

    await user.click(await screen.findByRole("link", { name: "Recorrências" }));

    expect(
      await screen.findByRole("heading", { name: "Recorrências" })
    ).toBeInTheDocument();
    expect(await rows()).toEqual([
      expect.stringMatching(
        /Aluguel.*Dia 10.*desde outubro 2026.*R\$\s2\.200,00/
      ),
      expect.stringMatching(
        /Freela.*Sem vencimento.*novembro 2026 a março 2027.*A definir/
      ),
    ]);
  });

  it("lists the ended ones too under Todas", async () => {
    api.addRecurrence(email, { description: "Aluguel" });
    api.addRecurrence(email, {
      description: "Curso",
      startPeriod: "2026-03-01",
      endPeriod: "2026-09-01",
    });
    openApp(api, "/recorrencias");

    await user.click(await screen.findByRole("radio", { name: "Todas" }));

    expect(await rows()).toEqual([
      expect.stringMatching(/Aluguel/),
      expect.stringMatching(/Curso.*março 2026 a setembro 2026.*Encerrada/),
    ]);
    await user.click(screen.getByRole("radio", { name: "Ativas" }));
    expect(await rows()).toEqual([expect.stringMatching(/Aluguel/)]);
  });

  it("says so when there is no recurrence", async () => {
    openApp(api, "/recorrencias");

    expect(
      await screen.findByText("Nenhuma recorrência ativa.")
    ).toBeInTheDocument();
  });
});

/** The text of each row of the month, group after group, in order. */
async function monthRows(): Promise<string[]> {
  const list = await screen.findByRole("region", { name: "Contas do mês" });
  return within(list)
    .getAllByRole("listitem")
    .map((row) => row.textContent ?? "");
}

async function replace(field: HTMLElement, text: string) {
  await user.clear(field);
  await user.type(field, text);
}

async function save(dialog: HTMLElement) {
  await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
}

describe("editing a recurrence", () => {
  it("changes its virtual occurrences but none already materialized", async () => {
    const rent = api.addRecurrence(email, {
      description: "Aluguel",
      defaultAmount: 220000,
      dueDay: 10,
      startPeriod: "2026-10-01",
    });
    api.addOccurrence(email, {
      recurrenceId: rent.id,
      description: "Aluguel",
      amount: 220000,
      period: "2026-10-01",
      dueDate: "2026-10-10",
    });
    openApp(api, "/recorrencias");

    await user.click(
      await screen.findByRole("button", { name: "Editar Aluguel" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Editar recorrência",
    });
    await replace(within(dialog).getByLabelText("Descrição"), "Aluguel novo");
    await replace(within(dialog).getByLabelText("Valor"), "2350");
    await replace(within(dialog).getByLabelText("Dia do vencimento"), "5");
    await user.type(within(dialog).getByLabelText("Observações"), "IGP-M");
    await save(dialog);

    expect(await rows()).toEqual([
      expect.stringMatching(/Aluguel novo.*Dia 5.*R\$\s2\.350,00/),
    ]);
    expect(api.recurrencesOf(email)).toEqual([
      expect.objectContaining({
        description: "Aluguel novo",
        defaultAmount: 235000,
        dueDay: 5,
        endPeriod: null,
        notes: "IGP-M",
      }),
    ]);
    await user.click(screen.getByRole("link", { name: "Mês" }));
    expect(await monthRows()).toEqual([
      expect.stringMatching(/^Aluguel10\/10.*R\$\s2\.200,00/),
    ]);
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    await waitFor(async () =>
      expect(await monthRows()).toEqual([
        expect.stringMatching(/Aluguel novo.*05\/11.*R\$\s2\.350,00/),
      ])
    );
  });

  it("makes its amount to be defined", async () => {
    api.addRecurrence(email, { description: "Cartão", defaultAmount: 150000 });
    openApp(api, "/recorrencias");

    await user.click(
      await screen.findByRole("button", { name: "Editar Cartão" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Editar recorrência",
    });
    await user.click(within(dialog).getByLabelText("A definir"));
    await save(dialog);

    expect(await rows()).toEqual([expect.stringMatching(/Cartão.*A definir/)]);
    expect(api.recurrencesOf(email)).toEqual([
      expect.objectContaining({ defaultAmount: null }),
    ]);
  });

  it("explains a failure in Portuguese and keeps what was typed", async () => {
    api.addRecurrence(email, { description: "Aluguel" });
    openApp(api, "/recorrencias");
    await user.click(
      await screen.findByRole("button", { name: "Editar Aluguel" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Editar recorrência",
    });
    await replace(within(dialog).getByLabelText("Descrição"), "Aluguel novo");

    api.breakDown();
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(
      await within(dialog).findByText("Algo deu errado. Tente novamente.")
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Descrição")).toHaveValue(
      "Aluguel novo"
    );
    expect(api.recurrencesOf(email)).toEqual([
      expect.objectContaining({ description: "Aluguel" }),
    ]);
  });
});

describe("editing a recurrence from the monthly screen", () => {
  it("opens the recurrence behind an occurrence row, as the recurrence is now", async () => {
    const rent = api.addRecurrence(email, {
      description: "Aluguel",
      defaultAmount: 220000,
      dueDay: 10,
    });
    api.addOccurrence(email, {
      recurrenceId: rent.id,
      description: "Aluguel de outubro",
      amount: 210000,
      period: "2026-10-01",
      dueDate: "2026-10-10",
    });
    openApp(api, "/");

    await user.click(
      await screen.findByRole("button", {
        name: "Mais ações para Aluguel de outubro",
      })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Editar recorrência" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Editar recorrência",
    });
    expect(await within(dialog).findByLabelText("Descrição")).toHaveValue(
      "Aluguel"
    );
    expect(within(dialog).getByLabelText("Valor")).toHaveValue("R$ 2.200");
    await replace(within(dialog).getByLabelText("Valor"), "2400");
    await save(dialog);

    expect(await monthRows()).toEqual([
      expect.stringMatching(/Aluguel de outubro.*R\$\s2\.100,00/),
    ]);
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    await waitFor(async () =>
      expect(await monthRows()).toEqual([
        expect.stringMatching(/Aluguel.*R\$\s2\.400,00/),
      ])
    );
  });

  it("offers no recurrence actions on a one-off row", async () => {
    api.addOccurrence(email, { description: "Conserto do carro" });
    openApp(api, "/");

    await user.click(
      await screen.findByRole("button", {
        name: "Mais ações para Conserto do carro",
      })
    );
    expect(
      await screen.findByText("Excluir", { selector: "[role=menuitem] *" })
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Editar recorrência", {
        selector: "[role=menuitem] *",
      })
    ).not.toBeInTheDocument();
  });
});
