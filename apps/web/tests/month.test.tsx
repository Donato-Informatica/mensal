import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chooseFromAccountMenu } from "./account-menu.ts";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { openApp, settle } from "./open-app.tsx";

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

function summaryOf(name: "Entradas" | "Saídas") {
  const block = screen.getByRole("region", { name });
  return {
    expected: within(block).getByLabelText("Previsto").textContent,
    settled: within(block).getByLabelText("Realizado").textContent,
  };
}

describe("the month", () => {
  it("lists the period's occurrences, persisted and virtual, with the summary", async () => {
    const rent = api.addRecurrence(email, {
      description: "Aluguel",
      defaultAmount: 220000,
      dueDay: 10,
      startPeriod: "2026-10-01",
    });
    api.addOccurrence(email, {
      recurrenceId: rent.id,
      description: "Aluguel",
      status: "SETTLED",
      amount: 220000,
      period: "2026-10-01",
      dueDate: "2026-10-10",
      settledAt: "2026-10-09",
    });
    api.addRecurrence(email, {
      description: "Cartão de crédito",
      defaultAmount: null,
      dueDay: 25,
      startPeriod: "2026-10-01",
    });
    api.addOccurrence(email, {
      direction: "INFLOW",
      description: "Salário",
      amount: 650000,
      period: "2026-10-01",
      dueDate: "2026-10-05",
      status: "SETTLED",
      settledAt: "2026-10-05",
    });
    api.addOccurrence(email, {
      description: "Presente",
      amount: 15050,
      period: "2026-10-01",
      dueDate: null,
    });

    openApp(api, "/");

    expect(
      await screen.findByRole("heading", { name: "Outubro 2026" })
    ).toBeInTheDocument();
    expect(await rows()).toEqual([
      expect.stringMatching(/Cartão de crédito.*25\/10.*A definir/),
      expect.stringMatching(/Presente.*Sem vencimento.*R\$\s150,50/),
      expect.stringMatching(/Salário.*05\/10.*R\$\s6\.500,00.*Liquidada/),
      expect.stringMatching(/Aluguel.*10\/10.*R\$\s2\.200,00.*Liquidada/),
    ]);
    expect(summaryOf("Entradas")).toEqual({
      expected: "R$ 6.500,00",
      settled: "R$ 6.500,00",
    });
    expect(summaryOf("Saídas")).toEqual({
      expected: "R$ 2.350,50",
      settled: "R$ 2.200,00",
    });
  });
});

describe("moving between periods", () => {
  beforeEach(() => {
    api.addOccurrence(email, {
      description: "IPVA",
      period: "2026-11-01",
      dueDate: "2026-11-15",
    });
  });

  it("goes to the next and previous month with one click", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    await screen.findByRole("heading", { name: "Outubro 2026" });

    await user.click(screen.getByRole("button", { name: "Próximo mês" }));

    expect(
      await screen.findByRole("heading", { name: "Novembro 2026" })
    ).toBeInTheDocument();
    expect(await rows()).toEqual([expect.stringMatching(/IPVA/)]);
    expect(window.location.search).toBe("?mes=2026-11");

    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    await user.click(screen.getByRole("button", { name: "Mês anterior" }));

    expect(
      await screen.findByRole("heading", { name: "Setembro 2026" })
    ).toBeInTheDocument();
  });

  it("goes to the next and previous month with the arrow keys", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    await screen.findByRole("heading", { name: "Outubro 2026" });

    await user.keyboard("{ArrowRight}");

    expect(
      await screen.findByRole("heading", { name: "Novembro 2026" })
    ).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");

    expect(
      await screen.findByRole("heading", { name: "Outubro 2026" })
    ).toBeInTheDocument();
  });

  it("crosses into the next year", async () => {
    const user = userEvent.setup();
    openApp(api, "/?mes=2026-12");
    await screen.findByRole("heading", { name: "Dezembro 2026" });

    await user.click(screen.getByRole("button", { name: "Próximo mês" }));

    expect(
      await screen.findByRole("heading", { name: "Janeiro 2027" })
    ).toBeInTheDocument();
  });

  it("opens the month in the address", async () => {
    openApp(api, "/?mes=2026-11");

    expect(
      await screen.findByRole("heading", { name: "Novembro 2026" })
    ).toBeInTheDocument();
    expect(await rows()).toEqual([expect.stringMatching(/IPVA/)]);
  });

  it("says when a month has nothing", async () => {
    openApp(api, "/?mes=2027-03");

    expect(
      await screen.findByText("Nenhuma conta neste mês.")
    ).toBeInTheDocument();
  });
});

describe("hiding the summary", () => {
  it("brings the summary back with a retry when hiding it could not be saved", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    const close = await screen.findByRole("button", { name: "Ocultar resumo" });
    api.breakDown();

    await user.click(close);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Alteração não salva. Algo deu errado. Tente novamente."
    );
    expect(screen.getByRole("region", { name: "Entradas" })).toBeVisible();
    expect(
      within(alert).getByRole("button", { name: "Tentar de novo" })
    ).toBeVisible();
    expect(api.preferencesOf(email)).toMatchObject({ showSummary: true });
  });

  it("hides the summary once the retry is saved", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    const close = await screen.findByRole("button", { name: "Ocultar resumo" });
    api.breakDown();
    await user.click(close);
    const alert = await screen.findByRole("alert");

    api.recover();
    await user.click(
      within(alert).getByRole("button", { name: "Tentar de novo" })
    );

    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Entradas" })).toBeNull()
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(api.preferencesOf(email)).toMatchObject({ showSummary: false });
  });

  it("keeps the summary once the failure is dismissed", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    const close = await screen.findByRole("button", { name: "Ocultar resumo" });
    api.breakDown();
    await user.click(close);
    const alert = await screen.findByRole("alert");

    await user.click(within(alert).getByRole("button", { name: "Fechar" }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("region", { name: "Entradas" })).toBeVisible();
    expect(api.preferencesOf(email)).toMatchObject({ showSummary: true });
  });

  it("says nothing of a hiding that a later change replaced", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    const close = await screen.findByRole("button", { name: "Ocultar resumo" });
    api.stall();
    await user.click(close);
    // Before it is answered, the summary is turned back on in the settings.
    await chooseFromAccountMenu("Configurações", user);
    await user.click(
      await screen.findByRole("switch", {
        name: "Mostrar resumo de entradas e saídas",
      })
    );
    await user.keyboard("{Escape}");
    await waitFor(() => expect(api.heldCount()).toBe(2));

    api.answer(0, { fail: true });
    api.answer(1);

    await settle();
    expect(screen.getByRole("region", { name: "Entradas" })).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("moving between months", () => {
  it("answers at once, dimming the month on screen until the next lands", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    const content = (
      await screen.findByText("Nenhuma conta neste mês.")
    ).closest("[aria-busy]");

    api.stall();
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Novembro 2026" })
    ).toBeInTheDocument();
    expect(content).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Carregando o mês…")).toBeInTheDocument();

    api.resume();
    await waitFor(() => expect(content).toHaveAttribute("aria-busy", "false"));
  });
});

describe("returning to the current month", () => {
  const goToCurrent = () =>
    screen.queryByRole("button", { name: "Ir para o mês atual" });
  const nav = () => screen.getByRole("navigation", { name: "Telas" });

  it("offers the way back only away from the current period", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    await screen.findByRole("heading", { name: "Outubro 2026" });
    expect(goToCurrent()).toBeNull();

    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    await screen.findByRole("heading", { name: "Setembro 2026" });
    await user.click(goToCurrent()!);

    expect(
      await screen.findByRole("heading", { name: "Outubro 2026" })
    ).toBeInTheDocument();
    expect(goToCurrent()).toBeNull();
    expect(window.location.search).toBe("");
  });

  it("is a step in the history, so Back returns to the far month", async () => {
    const user = userEvent.setup();
    openApp(api, "/?mes=2026-03");
    await screen.findByRole("heading", { name: "Março 2026" });

    await user.click(goToCurrent()!);
    await screen.findByRole("heading", { name: "Outubro 2026" });
    window.history.back();

    expect(
      await screen.findByRole("heading", { name: "Março 2026" })
    ).toBeInTheDocument();
  });

  it("comes back to the month last viewed after a visit to Recorrências", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    await screen.findByRole("heading", { name: "Outubro 2026" });
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    await screen.findByRole("heading", { name: "Dezembro 2026" });

    await user.click(within(nav()).getByRole("link", { name: "Recorrências" }));
    await screen.findByRole("heading", { name: "Recorrências" });
    await user.click(within(nav()).getByRole("link", { name: "Mês" }));

    expect(
      await screen.findByRole("heading", { name: "Dezembro 2026" })
    ).toBeInTheDocument();
  });

  it("goes back to the current period when that was the last one viewed", async () => {
    const user = userEvent.setup();
    openApp(api, "/");
    await screen.findByRole("heading", { name: "Outubro 2026" });
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    await screen.findByRole("heading", { name: "Novembro 2026" });
    await user.click(goToCurrent()!);
    await screen.findByRole("heading", { name: "Outubro 2026" });

    await user.click(within(nav()).getByRole("link", { name: "Recorrências" }));
    await screen.findByRole("heading", { name: "Recorrências" });
    await user.click(within(nav()).getByRole("link", { name: "Mês" }));

    await screen.findByRole("heading", { name: "Outubro 2026" });
    expect(window.location.search).toBe("");
  });

  it("is forgotten on sign-out", async () => {
    const user = userEvent.setup();
    openApp(api, "/?mes=2026-03");
    await screen.findByRole("heading", { name: "Março 2026" });
    await user.click(within(nav()).getByRole("link", { name: "Recorrências" }));
    await screen.findByRole("heading", { name: "Recorrências" });

    await chooseFromAccountMenu("Sair", user);
    const dialog = await screen.findByRole("dialog", { name: "Sair da conta" });
    await user.click(within(dialog).getByRole("button", { name: "Sair" }));
    await user.type(await screen.findByLabelText("E-mail"), email);
    await user.type(screen.getByLabelText("Senha"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByRole("heading", { name: "Outubro 2026" })
    ).toBeInTheDocument();
  });
});

describe("tab title and month picker", () => {
  it("titles the tab after the month and the recurrences screen", async () => {
    openApp(api, "/?mes=2026-06");
    await screen.findByRole("heading", { name: "Junho 2026" });
    expect(document.title).toBe("Mensal | Junho 2026");
  });

  it("jumps to a month picked from the popup", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    openApp(api, "/");
    await user.click(
      await screen.findByRole("button", { name: /Outubro 2026/ })
    );

    await user.click(await screen.findByRole("button", { name: "Março 2026" }));
    await screen.findByRole("heading", { name: "Março 2026" });
    expect(document.title).toBe("Mensal | Março 2026");
  });
});
