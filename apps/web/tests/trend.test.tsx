import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chooseFromAccountMenu } from "./account-menu.ts";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { openApp, settle } from "./open-app.tsx";

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
    confirmStatusChanges: false,
  });
  api.signIn(email);
  user = userEvent.setup();
});
afterEach(() => {
  vi.useRealTimers();
});

/** Something in October, so the trend is not empty. */
function somethingInOctober() {
  api.addOccurrence(email, { period: "2026-10-01", dueDate: "2026-10-20" });
}

/** Opens Evolução from the summary bar and returns its dialog. */
async function openTrend(): Promise<HTMLElement> {
  await user.click(await screen.findByRole("button", { name: "Evolução" }));
  return screen.findByRole("dialog");
}

async function closeTrend(dialog: HTMLElement) {
  await user.click(within(dialog).getByRole("button", { name: "Fechar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

/** Expands "Ver valores" and returns the table's body rows as cell texts. */
async function values(dialog: HTMLElement): Promise<string[][]> {
  const toggle = await within(dialog).findByRole("button", {
    name: "Ver valores",
  });
  if (toggle.getAttribute("aria-expanded") !== "true") {
    await user.click(toggle);
  }
  const table = await within(dialog).findByRole("table");
  const [, body] = within(table).getAllByRole("rowgroup");
  return within(body!)
    .getAllByRole("row")
    .map((row) =>
      [...row.querySelectorAll("th, td")].map((cell) =>
        // Intl puts a no-break space after "R$".
        (cell.textContent ?? "").replaceAll(" ", " ")
      )
    );
}

async function periodsIn(dialog: HTMLElement): Promise<string[]> {
  return (await values(dialog)).map(([period]) => period!);
}

describe("the Evolução modal", () => {
  it("covers the 6 periods ending at the period on screen", async () => {
    somethingInOctober();
    openApp(api, "/");

    const dialog = await openTrend();

    expect(dialog).toHaveAccessibleName("Mai 2026 – Out 2026");
    expect(await periodsIn(dialog)).toEqual([
      "Mai 2026",
      "Jun 2026",
      "Jul 2026",
      "Ago 2026",
      "Set 2026",
      "Out 2026",
    ]);
  });

  it("ends at a future period on screen, with no Realizado after the current one", async () => {
    api.addRecurrence(email, { description: "Aluguel", defaultAmount: 220000 });
    openApp(api, "/?mes=2027-01");

    const dialog = await openTrend();

    expect(dialog).toHaveAccessibleName("Ago 2026 – Jan 2027");
    expect(await values(dialog)).toEqual([
      [
        "Ago 2026",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 0,00",
      ],
      [
        "Set 2026",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 0,00",
      ],
      [
        "Out 2026",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 2.200,00",
        "R$ 0,00",
        "-R$ 2.200,00",
        "-R$ 2.200,00",
      ],
      [
        "Nov 2026",
        "R$ 0,00",
        "—",
        "R$ 2.200,00",
        "—",
        "-R$ 2.200,00",
        "-R$ 4.400,00",
      ],
      [
        "Dez 2026",
        "R$ 0,00",
        "—",
        "R$ 2.200,00",
        "—",
        "-R$ 2.200,00",
        "-R$ 6.600,00",
      ],
      [
        "Jan 2027",
        "R$ 0,00",
        "—",
        "R$ 2.200,00",
        "—",
        "-R$ 2.200,00",
        "-R$ 8.800,00",
      ],
    ]);
  });

  it("derives Sobra prevista and Sobra acumulada from each period's totals", async () => {
    api.addOccurrence(email, {
      direction: "INFLOW",
      description: "Salário",
      amount: 650000,
      period: "2026-05-01",
      dueDate: "2026-05-05",
      status: "SETTLED",
      settledAt: "2026-05-05",
    });
    api.addOccurrence(email, {
      description: "Mercado",
      amount: 420000,
      period: "2026-05-01",
      dueDate: "2026-05-10",
      status: "SETTLED",
      settledAt: "2026-05-12",
    });
    api.addOccurrence(email, {
      description: "Conserto do carro",
      amount: 300000,
      period: "2026-07-01",
      dueDate: "2026-07-20",
    });
    api.addRecurrence(email, { description: "Aluguel", defaultAmount: 220000 });
    openApp(api, "/");

    const dialog = await openTrend();

    expect(await values(dialog)).toEqual([
      [
        "Mai 2026",
        "R$ 6.500,00",
        "R$ 6.500,00",
        "R$ 4.200,00",
        "R$ 4.200,00",
        "R$ 2.300,00",
        "R$ 2.300,00",
      ],
      [
        "Jun 2026",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 2.300,00",
      ],
      [
        "Jul 2026",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 3.000,00",
        "R$ 0,00",
        "-R$ 3.000,00",
        "-R$ 700,00",
      ],
      [
        "Ago 2026",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 0,00",
        "-R$ 700,00",
      ],
      [
        "Set 2026",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 0,00",
        "-R$ 700,00",
      ],
      [
        "Out 2026",
        "R$ 0,00",
        "R$ 0,00",
        "R$ 2.200,00",
        "R$ 0,00",
        "-R$ 2.200,00",
        "-R$ 2.900,00",
      ],
    ]);
  });

  it("switches between 3, 6 and 12 meses, remembering the choice on reopen", async () => {
    somethingInOctober();
    openApp(api, "/");
    let dialog = await openTrend();
    expect(
      within(dialog).getByRole("radio", { name: "6 meses" })
    ).toBeChecked();

    await user.click(within(dialog).getByRole("radio", { name: "3 meses" }));

    expect(dialog).toHaveAccessibleName("Ago 2026 – Out 2026");
    await waitFor(async () =>
      expect(await periodsIn(dialog)).toEqual([
        "Ago 2026",
        "Set 2026",
        "Out 2026",
      ])
    );

    await user.click(within(dialog).getByRole("radio", { name: "12 meses" }));

    expect(dialog).toHaveAccessibleName("Nov 2025 – Out 2026");
    await waitFor(async () => expect(await periodsIn(dialog)).toHaveLength(12));

    await closeTrend(dialog);
    dialog = await openTrend();

    expect(
      within(dialog).getByRole("radio", { name: "12 meses" })
    ).toBeChecked();
    expect(dialog).toHaveAccessibleName("Nov 2025 – Out 2026");
  });

  it("switches the chart between Linhas and Barras, remembering the choice on reopen", async () => {
    somethingInOctober();
    openApp(api, "/");
    let dialog = await openTrend();
    const chartType = () =>
      within(dialog).findByRole("radiogroup", { name: "Tipo de gráfico" });
    expect(
      within(await chartType()).getByRole("radio", { name: "Linhas" })
    ).toBeChecked();

    await user.click(
      within(await chartType()).getByRole("radio", { name: "Barras" })
    );

    expect(
      within(await chartType()).getByRole("radio", { name: "Barras" })
    ).toBeChecked();

    await closeTrend(dialog);
    dialog = await openTrend();

    expect(
      within(await chartType()).getByRole("radio", { name: "Barras" })
    ).toBeChecked();
  });

  it("forgets the range on sign-out", async () => {
    somethingInOctober();
    openApp(api, "/");
    const dialog = await openTrend();
    await user.click(within(dialog).getByRole("radio", { name: "3 meses" }));
    await closeTrend(dialog);

    await chooseFromAccountMenu("Sair", user);
    const signOut = await screen.findByRole("dialog", {
      name: "Sair da conta",
    });
    await user.click(within(signOut).getByRole("button", { name: "Sair" }));
    await user.type(await screen.findByLabelText("E-mail"), email);
    await user.type(screen.getByLabelText("Senha"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      within(await openTrend()).getByRole("radio", { name: "6 meses" })
    ).toBeChecked();
  });

  it("says so when the range has nothing in it", async () => {
    openApp(api, "/");

    const dialog = await openTrend();

    expect(
      await within(dialog).findByText("Nenhuma conta nesses meses.")
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("table")).toBeNull();
  });

  it("offers to try again when loading fails", async () => {
    somethingInOctober();
    openApp(api, "/");
    await screen.findByRole("button", { name: "Evolução" });
    api.breakDown();

    const dialog = await openTrend();
    const retry = await within(dialog).findByRole("button", {
      name: "Tentar novamente",
    });
    api.recover();
    await user.click(retry);

    expect(await periodsIn(dialog)).toHaveLength(6);
  });

  it("is up to date after settling an occurrence", async () => {
    api.addRecurrence(email, { description: "Aluguel", defaultAmount: 220000 });
    openApp(api, "/");
    let dialog = await openTrend();
    expect((await values(dialog)).at(-1)?.[4]).toBe("R$ 0,00");
    await closeTrend(dialog);

    await user.click(
      await screen.findByRole("checkbox", { name: "Liquidar Aluguel" })
    );
    await screen.findByRole("checkbox", {
      name: "Desfazer liquidação de Aluguel",
    });
    dialog = await openTrend();

    await waitFor(async () =>
      expect((await values(dialog)).at(-1)?.[4]).toBe("R$ 2.200,00")
    );
  });

  it("keeps ← / → from changing the month while it is open", async () => {
    somethingInOctober();
    openApp(api, "/");
    await openTrend();
    // Even with focus outside the dialog, the arrows stay put.
    (document.activeElement as HTMLElement | null)?.blur();

    await user.keyboard("{ArrowRight}");
    await settle();

    expect(window.location.search).toBe("");
    expect(
      screen.getByRole("heading", { name: "Outubro 2026", hidden: true })
    ).toBeInTheDocument();
  });
});
