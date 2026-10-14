import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
});

/** Each group of the month's occurrences, in order, with the text of its rows. */
async function groups(): Promise<Record<string, string[]>> {
  const occurrences = await screen.findByRole("region", {
    name: "Contas do mês",
  });
  return Object.fromEntries(
    within(occurrences)
      .getAllByRole("list")
      .map((list) => [
        list.getAttribute("aria-label"),
        within(list)
          .getAllByRole("listitem")
          .map((row) => row.textContent ?? ""),
      ])
  );
}

/** Picks the action `name` from the "Mais ações" menu of the row `description`. */
async function act(user: UserEvent, description: string, name: string) {
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

describe("the month's groups", () => {
  it("groups the occurrences into overdue, due today, upcoming, and settled or skipped, in that order", async () => {
    api.addOccurrence(email, {
      description: "Escola",
      period: "2026-10-01",
      dueDate: "2026-10-05",
    });
    api.addOccurrence(email, {
      description: "Luz",
      period: "2026-10-01",
      dueDate: "2026-10-12",
    });
    api.addOccurrence(email, {
      description: "Presente",
      period: "2026-10-01",
      dueDate: null,
    });
    api.addOccurrence(email, {
      description: "Internet",
      period: "2026-10-01",
      dueDate: "2026-10-20",
    });
    api.addOccurrence(email, {
      description: "Aluguel",
      period: "2026-10-01",
      dueDate: "2026-10-10",
      status: "SETTLED",
      amount: 220000,
      settledAt: "2026-10-09",
    });
    api.addOccurrence(email, {
      description: "Academia",
      period: "2026-10-01",
      dueDate: "2026-10-15",
      status: "SKIPPED",
    });

    openApp(api, "/");

    const found = await groups();
    expect(Object.keys(found)).toEqual([
      "Atrasadas",
      "Vencem hoje",
      "A vencer no mês",
      "Liquidadas e puladas",
    ]);
    expect(found).toEqual({
      Atrasadas: [expect.stringMatching(/Escola.*05\/10/)],
      "Vencem hoje": [expect.stringMatching(/Luz.*12\/10/)],
      "A vencer no mês": [
        expect.stringMatching(/Internet.*20\/10/),
        expect.stringMatching(/Presente.*Sem vencimento/),
      ],
      "Liquidadas e puladas": [
        expect.stringMatching(/Aluguel.*Liquidada/),
        expect.stringMatching(/Academia.*Pulada/),
      ],
    });
    expect(
      screen.getByRole("heading", { name: "Atrasadas" })
    ).toBeInTheDocument();
  });

  it("lists the overdue occurrences of earlier periods first, each labeled with its period", async () => {
    api.addRecurrence(email, {
      description: "Condomínio",
      defaultAmount: 70000,
      dueDay: 8,
      startPeriod: "2026-10-01",
    });
    api.addOccurrence(email, {
      description: "IPTU",
      period: "2026-08-01",
      dueDate: "2026-08-20",
    });
    api.addOccurrence(email, {
      description: "Dentista",
      period: "2026-09-01",
      dueDate: "2026-09-15",
    });

    openApp(api, "/");

    expect(await groups()).toEqual({
      Atrasadas: [
        expect.stringMatching(/IPTU.*20\/08.*Agosto 2026/),
        expect.stringMatching(/Dentista.*15\/09.*Setembro 2026/),
        expect.stringMatching(/Condomínio.*08\/10/),
      ],
    });
    expect(
      within(
        await screen.findByRole("list", { name: "Atrasadas" })
      ).getAllByRole("listitem")[2]
    ).not.toHaveTextContent("Outubro 2026");
  });

  it("leaves earlier periods out of any month but the current one", async () => {
    api.addOccurrence(email, {
      description: "Dentista",
      period: "2026-09-01",
      dueDate: "2026-09-15",
    });
    api.addOccurrence(email, {
      description: "IPVA",
      period: "2026-11-01",
      dueDate: "2026-11-15",
    });

    openApp(api, "/?mes=2026-11");

    expect(await groups()).toEqual({
      "A vencer no mês": [expect.stringMatching(/IPVA/)],
    });
  });

  it("hides the groups with nothing in them", async () => {
    api.addOccurrence(email, {
      description: "Internet",
      period: "2026-10-01",
      dueDate: "2026-10-20",
    });

    openApp(api, "/");

    expect(await groups()).toEqual({
      "A vencer no mês": [expect.stringMatching(/Internet/)],
    });
    expect(
      screen.queryByRole("heading", { name: "Atrasadas" })
    ).not.toBeInTheDocument();
  });
});

describe("moving between groups", () => {
  it("moves an occurrence to settled or skipped before the API answers, and back", async () => {
    const user = userEvent.setup();
    api.addOccurrence(email, {
      description: "Luz",
      period: "2026-10-01",
      dueDate: "2026-10-12",
    });
    api.addRecurrence(email, {
      description: "Internet",
      defaultAmount: 12000,
      dueDay: 20,
      startPeriod: "2026-10-01",
    });
    openApp(api, "/");
    await groups();

    api.stall();
    await user.click(screen.getByRole("checkbox", { name: "Liquidar Luz" }));
    await act(user, "Internet", "Pular");

    expect(await groups()).toEqual({
      "Liquidadas e puladas": [
        expect.stringMatching(/Luz.*Liquidada/),
        expect.stringMatching(/Internet.*Pulada/),
      ],
    });
    expect(api.occurrencesOf(email)).toEqual([
      expect.objectContaining({ description: "Luz", status: "PENDING" }),
    ]);
    api.resume();

    await user.click(screen.getByRole("checkbox", { name: "Liquidar Luz" }));
    await act(user, "Internet", "Retomar");

    expect(await groups()).toEqual({
      "Vencem hoje": [expect.stringMatching(/Luz/)],
      "A vencer no mês": [expect.stringMatching(/Internet/)],
    });
    await waitFor(() =>
      expect(api.occurrencesOf(email)).toEqual([
        expect.objectContaining({ description: "Luz", status: "PENDING" }),
        expect.objectContaining({ description: "Internet", status: "PENDING" }),
      ])
    );
  });

  it("settles an overdue occurrence of an earlier period, taking it off the month", async () => {
    const user = userEvent.setup();
    api.addRecurrence(email, {
      description: "Condomínio",
      defaultAmount: 70000,
      dueDay: 8,
      startPeriod: "2026-09-01",
      endPeriod: "2026-09-01",
    });
    api.addOccurrence(email, {
      description: "Internet",
      period: "2026-10-01",
      dueDate: "2026-10-20",
    });
    openApp(api, "/");
    await groups();

    await user.click(
      screen.getByRole("checkbox", { name: "Liquidar Condomínio" })
    );

    expect(await groups()).toEqual({
      "A vencer no mês": [expect.stringMatching(/Internet/)],
    });
    await waitFor(() =>
      expect(api.occurrencesOf(email)).toContainEqual(
        expect.objectContaining({
          description: "Condomínio",
          period: "2026-09-01",
          status: "SETTLED",
          settledAt: "2026-10-12",
        })
      )
    );
  });
});
