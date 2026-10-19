import { screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { openApp } from "./open-app.tsx";

const email = "ana@example.com";
const header =
  "Descrição;Vencimento;Tipo;Valor;Situação;Liquidada em;Origem;Notas";
let api: FakeApi;
let user: UserEvent;
let blobs: Blob[];
let downloads: string[];
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
  blobs = [];
  downloads = [];
  URL.createObjectURL = (blob: Blob | MediaSource) => {
    blobs.push(blob as Blob);
    return "blob:mensal";
  };
  URL.revokeObjectURL = () => {};
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    downloads.push(this.download);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/** Clicks Exportar CSV and returns the file: its raw bytes and its decoded text, BOM kept. */
async function exportCsv() {
  await user.click(await screen.findByRole("button", { name: "Exportar CSV" }));
  expect(blobs).toHaveLength(1);
  const bytes = await bytesOf(blobs[0]!);
  const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
  return { bytes, text };
}

describe("exporting the period as CSV", () => {
  it("writes the period's own occurrences in table order, ready for a pt-BR spreadsheet", async () => {
    api.addOccurrence(email, {
      description: 'Aluguel; casa "nova"',
      amount: 220000,
      dueDate: "2026-10-10",
      notes: "linha 1\nlinha 2",
    });
    api.addOccurrence(email, {
      direction: "INFLOW",
      description: "Salário",
      amount: 650000,
      dueDate: "2026-10-05",
      status: "SETTLED",
      settledAt: "2026-10-05",
    });
    api.addRecurrence(email, {
      description: "Cartão",
      defaultAmount: null,
      dueDay: 25,
      startPeriod: "2026-10-01",
    });
    api.addOccurrence(email, {
      description: "Presente",
      amount: 15050,
      dueDate: null,
    });
    // An earlier period's overdue occurrence is on screen but not exported.
    api.addOccurrence(email, {
      description: "Antiga",
      period: "2026-09-01",
      dueDate: "2026-09-20",
    });
    openApp(api, "/");

    const { bytes, text } = await exportCsv();

    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(text).toBe(
      [
        "﻿" + header,
        '"Aluguel; casa ""nova""";10/10/2026;Saída;2200,00;Atrasada;;Avulsa;"linha 1\nlinha 2"',
        "Cartão;25/10/2026;Saída;;A vencer;;Recorrência;",
        "Presente;;Saída;150,50;A vencer;;Avulsa;",
        "Salário;05/10/2026;Entrada;6500,00;Liquidada;05/10/2026;Avulsa;",
        "",
      ].join("\r\n")
    );
  });

  it.each([
    ["a past period", "/?mes=2026-09", "2026-09-01", "mensal-2026-09.csv"],
    ["the current period", "/", "2026-10-01", "mensal-2026-10.csv"],
    ["a future period", "/?mes=2026-12", "2026-12-01", "mensal-2026-12.csv"],
  ])("names the file after %s", async (_, path, period, name) => {
    api.addOccurrence(email, { period, dueDate: null });
    openApp(api, path);

    await exportCsv();

    expect(downloads).toEqual([name]);
  });

  it("is disabled for an empty period", async () => {
    openApp(api, "/?mes=2026-11");

    expect(
      await screen.findByRole("button", { name: "Exportar CSV" })
    ).toBeDisabled();
  });

  it("is disabled when only earlier periods' overdue occurrences are on screen", async () => {
    api.addOccurrence(email, {
      description: "Antiga",
      period: "2026-09-01",
      dueDate: "2026-09-20",
    });
    openApp(api, "/");

    expect(await screen.findByText("Antiga")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
  });

  it("reflects a status change made just before", async () => {
    api.addOccurrence(email, { description: "Luz", dueDate: "2026-10-20" });
    openApp(api, "/");
    await user.click(
      await screen.findByRole("checkbox", { name: "Liquidar Luz" })
    );
    await screen.findByRole("checkbox", { name: "Desfazer liquidação de Luz" });

    const { text } = await exportCsv();

    expect(text).toContain("Luz;20/10/2026;Saída;850,00;Liquidada;12/10/2026;");
  });
});
