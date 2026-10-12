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

/** The month's row for the occurrence described as `description`. */
async function row(description: string): Promise<HTMLElement> {
  const list = await screen.findByRole("list", { name: "Contas do mês" });
  const found = within(list)
    .getAllByRole("listitem")
    .find((item) => within(item).queryByText(description));
  if (!found) throw new Error(`no row for ${description}`);
  return found;
}

function outflowsSettled() {
  const block = screen.getByRole("region", { name: "Saídas" });
  return within(block).getByLabelText("Realizado");
}

describe("settling an occurrence", () => {
  it("settles a virtual occurrence with one click", async () => {
    api.addRecurrence(email, { description: "Aluguel", defaultAmount: 220000 });
    openApp(api, "/");

    await user.click(
      within(await row("Aluguel")).getByRole("checkbox", {
        name: "Liquidar Aluguel",
      })
    );

    expect(
      within(await row("Aluguel")).getByRole("checkbox", {
        name: "Liquidar Aluguel",
      })
    ).toBeChecked();
    expect(await row("Aluguel")).toHaveTextContent("Liquidada");
    expect(outflowsSettled()).toHaveTextContent("R$ 2.200,00");
    expect(api.occurrencesOf(email)).toEqual([
      expect.objectContaining({
        description: "Aluguel",
        status: "SETTLED",
        amount: 220000,
        settledAt: "2026-10-12",
      }),
    ]);
  });

  it("takes a settled occurrence back to pending", async () => {
    api.addOccurrence(email, {
      description: "Conserto do carro",
      status: "SETTLED",
      amount: 85000,
      settledAt: "2026-10-05",
    });
    openApp(api, "/");

    await user.click(
      within(await row("Conserto do carro")).getByRole("checkbox", {
        name: "Liquidar Conserto do carro",
      })
    );

    expect(
      within(await row("Conserto do carro")).getByRole("checkbox", {
        name: "Liquidar Conserto do carro",
      })
    ).not.toBeChecked();
    expect(outflowsSettled()).toHaveTextContent("R$ 0,00");
    await waitFor(() =>
      expect(api.occurrencesOf(email)).toEqual([
        expect.objectContaining({ status: "PENDING", settledAt: null }),
      ])
    );
  });

  it("asks only for the amount when it is to be defined", async () => {
    api.addRecurrence(email, {
      description: "Cartão de crédito",
      defaultAmount: null,
    });
    openApp(api, "/");

    await user.click(
      within(await row("Cartão de crédito")).getByRole("checkbox", {
        name: "Liquidar Cartão de crédito",
      })
    );
    const popover = await screen.findByRole("dialog", {
      name: "Liquidar Cartão de crédito",
    });
    expect(within(popover).getAllByRole("textbox")).toEqual([
      within(popover).getByLabelText("Valor"),
    ]);
    await user.type(within(popover).getByLabelText("Valor"), "3120,90");
    await user.click(within(popover).getByRole("button", { name: "Liquidar" }));

    expect(popover).not.toBeInTheDocument();
    expect(await row("Cartão de crédito")).toHaveTextContent(
      /R\$\s3\.120,90.*Liquidada/
    );
    expect(outflowsSettled()).toHaveTextContent("R$ 3.120,90");
    await waitFor(() =>
      expect(api.occurrencesOf(email)).toEqual([
        expect.objectContaining({ status: "SETTLED", amount: 312090 }),
      ])
    );
  });

  it("settles nothing when the amount popover is dismissed", async () => {
    api.addRecurrence(email, {
      description: "Cartão de crédito",
      defaultAmount: null,
    });
    openApp(api, "/");

    await user.click(
      within(await row("Cartão de crédito")).getByRole("checkbox", {
        name: "Liquidar Cartão de crédito",
      })
    );
    const popover = await screen.findByRole("dialog", {
      name: "Liquidar Cartão de crédito",
    });
    await user.keyboard("{Escape}");

    await waitFor(() => expect(popover).not.toBeInTheDocument());
    expect(
      within(await row("Cartão de crédito")).getByRole("checkbox", {
        name: "Liquidar Cartão de crédito",
      })
    ).not.toBeChecked();
    expect(api.occurrencesOf(email)).toEqual([]);
  });

  it("shows the change before the API answers", async () => {
    api.addRecurrence(email, { description: "Aluguel", defaultAmount: 220000 });
    openApp(api, "/");
    const checkbox = within(await row("Aluguel")).getByRole("checkbox", {
      name: "Liquidar Aluguel",
    });

    api.stall();
    await user.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(await row("Aluguel")).toHaveTextContent("Liquidada");
    expect(outflowsSettled()).toHaveTextContent("R$ 2.200,00");
    expect(api.occurrencesOf(email)).toEqual([]);
    api.resume();
    await waitFor(() => expect(api.occurrencesOf(email)).toHaveLength(1));
  });

  it("rolls the change back when the API fails, explaining why", async () => {
    api.addRecurrence(email, { description: "Aluguel", defaultAmount: 220000 });
    openApp(api, "/");
    const checkbox = within(await row("Aluguel")).getByRole("checkbox", {
      name: "Liquidar Aluguel",
    });

    api.breakDown();
    await user.click(checkbox);

    expect(
      await screen.findByText("Algo deu errado. Tente novamente.")
    ).toBeInTheDocument();
    expect(
      within(await row("Aluguel")).getByRole("checkbox", {
        name: "Liquidar Aluguel",
      })
    ).not.toBeChecked();
    expect(await row("Aluguel")).not.toHaveTextContent("Liquidada");
    expect(outflowsSettled()).toHaveTextContent("R$ 0,00");
  });
});

describe("skipping an occurrence", () => {
  it("skips it, leaving it out of the summary, and takes the skip back", async () => {
    api.addRecurrence(email, { description: "Academia", defaultAmount: 9900 });
    openApp(api, "/");
    const outflows = () => screen.getByRole("region", { name: "Saídas" });

    await user.click(
      within(await row("Academia")).getByRole("button", {
        name: "Pular Academia",
      })
    );

    expect(await row("Academia")).toHaveTextContent("Pulada");
    expect(within(outflows()).getByLabelText("Previsto")).toHaveTextContent(
      "R$ 0,00"
    );
    await waitFor(() =>
      expect(api.occurrencesOf(email)).toEqual([
        expect.objectContaining({ description: "Academia", status: "SKIPPED" }),
      ])
    );

    await user.click(
      within(await row("Academia")).getByRole("button", {
        name: "Retomar Academia",
      })
    );

    expect(await row("Academia")).not.toHaveTextContent("Pulada");
    expect(within(outflows()).getByLabelText("Previsto")).toHaveTextContent(
      "R$ 99,00"
    );
    await waitFor(() =>
      expect(api.occurrencesOf(email)).toEqual([
        expect.objectContaining({ status: "PENDING" }),
      ])
    );
  });
});
