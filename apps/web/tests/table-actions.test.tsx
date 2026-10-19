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
    confirmStatusChanges: false,
  });
  api.setPreferences(email, { occurrenceView: "table" });
  api.signIn(email);
  user = userEvent.setup();
});
afterEach(() => {
  vi.useRealTimers();
});

/** The table's row for the occurrence described as `description`. */
async function row(description: string): Promise<HTMLElement> {
  const table = await screen.findByRole("table");
  const found = within(table)
    .getAllByRole("row")
    .find((tr) => within(tr).queryByText(description));
  if (!found) throw new Error(`no row for ${description}`);
  return found;
}

const outflowsSettled = () =>
  within(screen.getByRole("region", { name: "Saídas" })).getByLabelText(
    "Realizado"
  );

async function act(description: string, name: string) {
  await user.click(
    await screen.findByRole("button", {
      name: `Mais ações para ${description}`,
    })
  );
  await user.click(
    await screen.findByText(name, { selector: "[role=menuitem] *" })
  );
}

describe("settling from a table row", () => {
  it("settles and takes back to pending, updating the summary", async () => {
    api.addRecurrence(email, { description: "Aluguel", defaultAmount: 220000 });
    openApp(api, "/");

    await user.click(
      within(await row("Aluguel")).getByRole("checkbox", {
        name: "Liquidar Aluguel",
      })
    );

    expect(await row("Aluguel")).toHaveTextContent("Liquidada");
    expect(outflowsSettled()).toHaveTextContent("R$ 2.200,00");

    await user.click(
      within(await row("Aluguel")).getByRole("checkbox", {
        name: "Desfazer liquidação de Aluguel",
      })
    );
    await waitFor(() => expect(outflowsSettled()).toHaveTextContent("R$ 0,00"));
    expect(
      within(await row("Aluguel")).getByRole("checkbox", {
        name: "Liquidar Aluguel",
      })
    ).not.toBeChecked();
  });

  it("asks for the amount of an A definir occurrence first", async () => {
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
    await user.type(within(popover).getByLabelText("Valor"), "3120,90");
    await user.click(within(popover).getByRole("button", { name: "Liquidar" }));

    expect(await row("Cartão de crédito")).toHaveTextContent(
      /R\$\s3\.120,90.*Liquidada/
    );
    expect(outflowsSettled()).toHaveTextContent("R$ 3.120,90");
  });

  it("undoes the change from the toast", async () => {
    api.addRecurrence(email, { description: "Aluguel", defaultAmount: 220000 });
    openApp(api, "/");
    await user.click(
      within(await row("Aluguel")).getByRole("checkbox", {
        name: "Liquidar Aluguel",
      })
    );

    await user.click(await screen.findByRole("button", { name: "Desfazer" }));

    expect(
      within(await row("Aluguel")).getByRole("checkbox", {
        name: "Liquidar Aluguel",
      })
    ).not.toBeChecked();
    expect(outflowsSettled()).toHaveTextContent("R$ 0,00");
  });

  it("skips and resumes from the row menu", async () => {
    api.addRecurrence(email, { description: "Academia", defaultAmount: 9900 });
    openApp(api, "/");

    await act("Academia", "Pular");
    expect(await row("Academia")).toHaveTextContent("Pulada");

    await act("Academia", "Retomar");
    await waitFor(async () =>
      expect(await row("Academia")).not.toHaveTextContent("Pulada")
    );
  });

  it("shows the row's notice when the change is refused, and retries it", async () => {
    api.addRecurrence(email, { description: "Aluguel", defaultAmount: 220000 });
    openApp(api, "/");
    const checkbox = within(await row("Aluguel")).getByRole("checkbox", {
      name: "Liquidar Aluguel",
    });
    api.breakDown();
    await user.click(checkbox);

    const alert = await screen.findByRole("alert");
    // Its single full-width cell must stay out of the sticky columns.
    expect(alert.closest("tr")?.className).toMatch(/failureRow/);
    expect(alert).toHaveTextContent(
      "Alteração não salva. Algo deu errado. Tente novamente."
    );
    expect(
      within(await row("Aluguel")).getByRole("checkbox", {
        name: "Liquidar Aluguel",
      })
    ).not.toBeChecked();

    api.recover();
    await user.click(
      within(alert).getByRole("button", { name: "Tentar de novo: Aluguel" })
    );

    expect(await row("Aluguel")).toHaveTextContent("Liquidada");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("closes the notice", async () => {
    api.addRecurrence(email, { description: "Aluguel", defaultAmount: 220000 });
    openApp(api, "/");
    const checkbox = within(await row("Aluguel")).getByRole("checkbox", {
      name: "Liquidar Aluguel",
    });
    api.breakDown();
    await user.click(checkbox);
    const alert = await screen.findByRole("alert");

    await user.click(
      within(alert).getByRole("button", { name: "Fechar aviso de Aluguel" })
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("asks for confirmation when the setting is on", async () => {
    api.setPreferences(email, { confirmStatusChanges: true });
    api.addRecurrence(email, { description: "Aluguel", defaultAmount: 220000 });
    openApp(api, "/");

    await user.click(
      within(await row("Aluguel")).getByRole("checkbox", {
        name: "Liquidar Aluguel",
      })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Liquidar conta",
    });
    expect(api.occurrencesOf(email)).toEqual([]);
    await user.click(within(dialog).getByRole("button", { name: "Liquidar" }));

    expect(await row("Aluguel")).toHaveTextContent("Liquidada");
  });
});

describe("editing from a table row", () => {
  it("opens the edit dialog from the description", async () => {
    api.addOccurrence(email, { description: "Conserto do carro" });
    openApp(api, "/");

    await user.click(
      within(await row("Conserto do carro")).getByRole("button", {
        name: "Editar Conserto do carro",
      })
    );

    expect(
      await screen.findByRole("dialog", { name: "Editar conta" })
    ).toBeTruthy();
  });

  it("opens the edit dialog from A definir", async () => {
    api.addOccurrence(email, { description: "Academia", amount: null });
    openApp(api, "/");

    await user.click(
      within(await row("Academia")).getByRole("button", {
        name: "Definir valor de Academia",
      })
    );

    expect(
      await screen.findByRole("dialog", { name: "Editar conta" })
    ).toBeTruthy();
  });
});

describe("the row menu of the table", () => {
  it("deletes a one-off", async () => {
    api.addOccurrence(email, { description: "Conserto do carro" });
    openApp(api, "/");

    await act("Conserto do carro", "Excluir");
    const dialog = await screen.findByRole("dialog", { name: "Excluir conta" });
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(screen.queryByText("Conserto do carro")).toBeNull()
    );
    expect(api.occurrencesOf(email)).toEqual([]);
  });

  it("edits a recurrence", async () => {
    api.addRecurrence(email, { description: "Aluguel" });
    openApp(api, "/");

    await act("Aluguel", "Editar recorrência");

    expect(
      await screen.findByRole("dialog", { name: "Editar recorrência" })
    ).toBeTruthy();
  });

  it("ends a recurrence", async () => {
    api.addRecurrence(email, { description: "Aluguel" });
    openApp(api, "/");

    await act("Aluguel", "Encerrar recorrência");
    const dialog = await screen.findByRole("dialog", {
      name: "Encerrar recorrência",
    });
    await user.click(within(dialog).getByRole("button", { name: "Encerrar" }));

    await waitFor(() =>
      expect(api.recurrencesOf(email)).toEqual([
        expect.objectContaining({ endPeriod: "2026-10-01" }),
      ])
    );
  });

  it("deletes a recurrence", async () => {
    api.addRecurrence(email, { description: "Aluguel" });
    openApp(api, "/");

    await act("Aluguel", "Excluir recorrência");
    const dialog = await screen.findByRole("dialog", {
      name: "Excluir recorrência",
    });
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(api.recurrencesOf(email)).toEqual([]));
  });
});
