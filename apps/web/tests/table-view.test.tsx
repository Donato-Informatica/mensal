import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chooseFromAccountMenu } from "./account-menu.ts";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { openApp } from "./open-app.tsx";

const email = "ana@example.com";
let api: FakeApi;
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
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

const cells = (row: HTMLElement) =>
  within(row)
    .getAllByRole("cell")
    .map((cell) => (cell.textContent ?? "").replace(/\u00a0/g, " "));

describe("the view preference", () => {
  it("shows the month as a list until the user picks the table", async () => {
    api.addOccurrence(email, { description: "Escola" });
    openApp(api, "/");

    expect(
      await screen.findByRole("region", { name: "Contas do mês" })
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("radio", { name: "Lista" })).toBeChecked();
  });

  it("switches from the monthly screen and keeps the choice on every device", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    api.addOccurrence(email, { description: "Escola" });
    openApp(api, "/");

    await user.click(await screen.findByRole("radio", { name: "Tabela" }));

    expect(await screen.findByRole("table")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "A vencer no mês" })).toBeNull();
    await waitFor(() =>
      expect(api.preferencesOf(email)).toMatchObject({
        occurrenceView: "table",
      })
    );

    // Another device: a fresh app with nothing in the browser.
    cleanup();
    localStorage.clear();
    openApp(api, "/");
    expect(await screen.findByRole("table")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Tabela" })).toBeChecked();
  });

  it("switches back to the list", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    api.setPreferences(email, { occurrenceView: "table" });
    api.addOccurrence(email, { description: "Escola" });
    openApp(api, "/");

    await user.click(await screen.findByRole("radio", { name: "Lista" }));

    expect(
      await screen.findByRole("region", { name: "Contas do mês" })
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("switches from Configurações", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    api.addOccurrence(email, { description: "Escola" });
    openApp(api, "/");
    await chooseFromAccountMenu("Configurações", user);
    const dialog = await screen.findByRole("dialog", { name: "Configurações" });

    await user.click(within(dialog).getByRole("radio", { name: "Tabela" }));

    await waitFor(() =>
      expect(api.preferencesOf(email)).toMatchObject({
        occurrenceView: "table",
      })
    );
    await user.keyboard("{Escape}");
    expect(await screen.findByRole("table")).toBeTruthy();
  });

  it("holds while moving between months", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    api.setPreferences(email, { occurrenceView: "table" });
    api.addOccurrence(email, { description: "Escola" });
    api.addOccurrence(email, { description: "Aluguel", period: "2026-11-01" });
    openApp(api, "/");
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "Próximo mês" }));

    expect(await screen.findByText("Aluguel")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("rolls the view back with a notice when it could not be saved", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    api.addOccurrence(email, { description: "Escola" });
    openApp(api, "/");
    const table = await screen.findByRole("radio", { name: "Tabela" });
    api.breakDown();

    await user.click(table);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Alteração não salva."
    );
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Lista" })).toBeChecked()
    );
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("says in Configurações when the view could not be saved", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    openApp(api, "/");
    await chooseFromAccountMenu("Configurações", user);
    const dialog = await screen.findByRole("dialog", { name: "Configurações" });
    api.breakDown();

    await user.click(within(dialog).getByRole("radio", { name: "Tabela" }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      "Alteração não salva. Algo deu errado. Tente novamente."
    );
    await waitFor(() =>
      expect(within(dialog).getByRole("radio", { name: "Lista" })).toBeChecked()
    );
  });
});

describe("the table", () => {
  beforeEach(() => {
    api.setPreferences(email, { occurrenceView: "table" });
  });

  it("shows every column of each occurrence, in the list's group order", async () => {
    api.addOccurrence(email, {
      description: "Escola",
      period: "2026-09-01",
      dueDate: "2026-09-05",
    });
    api.addOccurrence(email, {
      description: "Luz",
      dueDate: "2026-10-12",
      amount: 12345,
    });
    api.addOccurrence(email, {
      description: "Internet",
      dueDate: "2026-10-20",
      notes: "Plano de 500 mega",
    });
    api.addOccurrence(email, {
      description: "Salário",
      direction: "INFLOW",
      dueDate: null,
      amount: 500000,
      status: "SETTLED",
      settledAt: "2026-10-05",
    });
    api.addOccurrence(email, {
      description: "Academia",
      amount: null,
      dueDate: "2026-10-25",
    });
    api.addOccurrence(email, {
      description: "Seguro",
      dueDate: "2026-10-28",
      status: "SKIPPED",
    });
    api.addRecurrence(email, {
      description: "Aluguel",
      defaultAmount: 220000,
      dueDay: 8,
    });
    openApp(api, "/");

    const table = await screen.findByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent)
    ).toEqual([
      "Liquidar",
      "Descrição",
      "Vencimento",
      "Tipo",
      "Valor",
      "Situação",
      "Liquidada em",
      "Origem",
      "Notas",
      "Ações",
    ]);
    const rows = within(table).getAllByRole("row").slice(1);
    const text = rows.map((row) => cells(row).join("|"));
    // Description, due date, direction, amount, situation, settled on, origin, notes.
    expect(text.map((line) => line.split("|").slice(1))).toEqual([
      expect.arrayContaining(["Escola", "05/09/2026", "Atrasada"]),
      expect.arrayContaining(["Aluguel", "08/10/2026", "Atrasada"]),
      expect.arrayContaining(["Luz", "12/10/2026", "Vence hoje"]),
      expect.arrayContaining(["Internet", "20/10/2026", "A vencer"]),
      expect.arrayContaining(["Academia", "25/10/2026", "A vencer"]),
      expect.arrayContaining(["Seguro", "28/10/2026", "Pulada"]),
      expect.arrayContaining(["Salário", "Sem vencimento", "Liquidada"]),
    ]);

    const luz = rows[2]!;
    expect(cells(luz)).toEqual([
      "",
      "Luz",
      "12/10/2026",
      "Saída",
      "−R$ 123,45",
      "Vence hoje",
      "",
      "Avulsa",
      "",
      "",
    ]);
    expect(cells(rows[1]!)[7]).toBe("Recorrência");
    expect(cells(rows[3]!)[8]).toBe("Plano de 500 mega");
    expect(within(rows[3]!).getByText("Plano de 500 mega")).toHaveAttribute(
      "title",
      "Plano de 500 mega"
    );
    expect(cells(rows[4]!)[4]).toContain("A definir");
    expect(cells(rows[6]!).slice(2, 7)).toEqual([
      "Sem vencimento",
      "Entrada",
      "+R$ 5.000,00",
      "Liquidada",
      "05/10/2026",
    ]);
  });

  it("includes the overdue occurrences of earlier periods on the current period only", async () => {
    api.addOccurrence(email, {
      description: "Escola",
      period: "2026-09-01",
      dueDate: "2026-09-05",
    });
    openApp(api, "/");
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Escola")).toBeTruthy();

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));

    expect(await screen.findByText("Nenhuma conta neste mês.")).toBeTruthy();
  });

  it("shows the empty-month message instead of a bare header", async () => {
    openApp(api, "/");

    expect(await screen.findByText("Nenhuma conta neste mês.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("the table on a phone", () => {
  it("scrolls inside its own keyboard-reachable container, with every column", async () => {
    api.setPreferences(email, { occurrenceView: "table" });
    api.addOccurrence(email, { description: "Escola" });
    openApp(api, "/");

    const table = await screen.findByRole("table");
    const container = screen.getByRole("region", { name: "Contas do mês" });

    expect(container.contains(table)).toBe(true);
    expect(container.getAttribute("tabindex")).toBe("0");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent)
    ).toEqual([
      "Liquidar",
      "Descrição",
      "Vencimento",
      "Tipo",
      "Valor",
      "Situação",
      "Liquidada em",
      "Origem",
      "Notas",
      "Ações",
    ]);
  });
});
