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

/** The text of each row of the month, group after group, in order. */
async function monthRows(): Promise<string[]> {
  const list = await screen.findByRole("region", { name: "Contas do mês" });
  return within(list)
    .getAllByRole("listitem")
    .map((row) => row.textContent ?? "");
}

/** Opens the action `name` from the "Mais ações" menu of the row `description`. */
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
  return screen.findByRole("dialog", { name });
}

describe("deleting a recurrence", () => {
  it("deletes one without history, once confirmed", async () => {
    api.addRecurrence(email, { description: "Aluguel" });
    api.addRecurrence(email, { description: "Internet" });
    openApp(api, "/recorrencias");

    const dialog = await act("Aluguel", "Excluir recorrência");
    expect(dialog).toHaveTextContent(
      "Aluguel será excluída. Isso não pode ser desfeito."
    );
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(await rows()).toEqual([expect.stringMatching(/Internet/)]);
    expect(api.recurrencesOf(email)).toEqual([
      expect.objectContaining({ description: "Internet" }),
    ]);
  });
});

describe("deleting a recurrence with history", () => {
  it("is refused, and ending it is offered instead", async () => {
    const rent = api.addRecurrence(email, {
      description: "Aluguel",
      startPeriod: "2026-09-01",
    });
    api.addOccurrence(email, {
      recurrenceId: rent.id,
      description: "Aluguel",
      status: "SETTLED",
      settledAt: "2026-09-10",
      period: "2026-09-01",
      dueDate: "2026-09-10",
    });
    openApp(api, "/recorrencias");

    const dialog = await act("Aluguel", "Excluir recorrência");
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    expect(
      await within(dialog).findByText(
        "Esta recorrência já tem contas registradas e não pode ser excluída. Encerre-a para que deixe de aparecer nos próximos meses."
      )
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Encerrar recorrência" })
    );
    const ending = await screen.findByRole("dialog", {
      name: "Encerrar recorrência",
    });
    expect(within(ending).getByLabelText("Último mês")).toHaveTextContent(
      "Outubro 2026"
    );
    await user.click(within(ending).getByRole("button", { name: "Encerrar" }));

    await waitFor(() => expect(ending).not.toBeInTheDocument());
    expect(await rows()).toEqual([
      expect.stringMatching(/Aluguel.*setembro 2026 a outubro 2026/),
    ]);
    expect(api.recurrencesOf(email)).toEqual([
      expect.objectContaining({ endPeriod: "2026-10-01" }),
    ]);
    expect(api.occurrencesOf(email)).toEqual([
      expect.objectContaining({ recurrenceId: rent.id, status: "SETTLED" }),
    ]);
  });
});

describe("ending a recurrence", () => {
  it("ends it in the current period by default", async () => {
    api.addRecurrence(email, {
      description: "Aluguel",
      startPeriod: "2026-08-01",
    });
    openApp(api, "/recorrencias");

    const dialog = await act("Aluguel", "Encerrar recorrência");
    expect(within(dialog).getByLabelText("Último mês")).toHaveTextContent(
      "Outubro 2026"
    );
    await user.click(within(dialog).getByRole("button", { name: "Encerrar" }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(await rows()).toEqual([
      expect.stringMatching(/Aluguel.*agosto 2026 a outubro 2026/),
    ]);
    expect(api.recurrencesOf(email)).toEqual([
      expect.objectContaining({ endPeriod: "2026-10-01" }),
    ]);
  });

  it("ends it in the month picked", async () => {
    api.addRecurrence(email, { description: "Aluguel" });
    openApp(api, "/recorrencias");

    const dialog = await act("Aluguel", "Encerrar recorrência");
    await user.click(within(dialog).getByLabelText("Último mês"));
    // By its label: a role query over a calendar is slow in jsdom.
    await user.click(
      await screen.findByLabelText("Dezembro 2026", { selector: "button" })
    );
    await user.click(within(dialog).getByRole("button", { name: "Encerrar" }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(api.recurrencesOf(email)).toEqual([
      expect.objectContaining({ endPeriod: "2026-12-01" }),
    ]);
  });

  it.each([
    [
      "its start, for one starting later",
      { startPeriod: "2026-12-01" },
      "Dezembro 2026",
    ],
    [
      "its end, for one already ended",
      { startPeriod: "2026-03-01", endPeriod: "2026-09-01" },
      "Setembro 2026",
    ],
    [
      "the current period, for one ending later",
      { startPeriod: "2026-03-01", endPeriod: "2027-03-01" },
      "Outubro 2026",
    ],
  ])("defaults to %s", async (_, span, month) => {
    api.addRecurrence(email, { description: "Aluguel", ...span });
    openApp(api, "/recorrencias?filtro=todas");

    const dialog = await act("Aluguel", "Encerrar recorrência");

    expect(within(dialog).getByLabelText("Último mês")).toHaveTextContent(
      month
    );
  });
});

describe("from an occurrence row of the monthly screen", () => {
  it("deletes the recurrence, and its occurrences leave the month", async () => {
    api.addRecurrence(email, { description: "Aluguel" });
    api.addOccurrence(email, { description: "Conserto do carro" });
    openApp(api, "/");

    const dialog = await act("Aluguel", "Excluir recorrência");
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Mais ações para Aluguel" })
      ).not.toBeInTheDocument()
    );
    expect(await monthRows()).toEqual([
      expect.stringMatching(/Conserto do carro/),
    ]);
    expect(api.recurrencesOf(email)).toEqual([]);
  });

  it("ends the recurrence, and it leaves the months after the end", async () => {
    const rent = api.addRecurrence(email, { description: "Aluguel" });
    api.addOccurrence(email, {
      recurrenceId: rent.id,
      description: "Aluguel de outubro",
      period: "2026-10-01",
      dueDate: "2026-10-10",
    });
    openApp(api, "/");

    const dialog = await act("Aluguel de outubro", "Encerrar recorrência");
    expect(dialog).toHaveTextContent("Aluguel deixa de aparecer");
    await user.click(within(dialog).getByRole("button", { name: "Encerrar" }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());

    expect(await monthRows()).toEqual([
      expect.stringMatching(/Aluguel de outubro/),
    ]);
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(
      await screen.findByText("Nenhuma conta neste mês.")
    ).toBeInTheDocument();
    expect(api.recurrencesOf(email)).toEqual([
      expect.objectContaining({ endPeriod: "2026-10-01" }),
    ]);
  });
});
