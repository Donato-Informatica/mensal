import { unzipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { approve, request, signUp, startApi, type TestApi } from "./api.ts";
import { insertOccurrence, insertRecurrence } from "./fixtures.ts";

let api: TestApi;
beforeAll(async () => {
  // 23:00 on 2026-10-12 in São Paulo, already the 13th in UTC.
  api = await startApi({ now: () => new Date("2026-10-13T02:00:00Z") });
});
afterAll(async () => {
  await api.close();
});

async function approvedUser() {
  const user = await signUp(api);
  await approve(api, user.email);
  return user;
}

const BOM = [0xef, 0xbb, 0xbf];

/** Downloads the user's data and opens the archive: each file's raw bytes. */
async function download(cookie: string) {
  const response = await request(api, "/api/v1/data", { cookie });
  expect(response.status).toBe(200);
  return {
    response,
    files: unzipSync(new Uint8Array(await response.arrayBuffer())),
  };
}

/** A file's text, BOM kept, after checking the bytes start with it. */
function text(bytes: Uint8Array | undefined): string {
  expect(bytes, "the file is in the archive").toBeDefined();
  expect([...bytes!.slice(0, 3)]).toEqual(BOM);
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
}

/** A CSV file's expected text: BOM, then each line ended by CRLF. */
const csv = (...lines: string[]) =>
  "﻿" + lines.map((line) => `${line}\r\n`).join("");

const recurrencesHeader =
  "ID;Descrição;Tipo;Valor;Dia de vencimento;Início;Fim;Notas";
const occurrencesHeader =
  "ID;Competência;Descrição;Vencimento;Tipo;Valor;Situação;Liquidada em;Origem;Recorrência (ID);Notas";

describe("GET /api/v1/data", () => {
  it("answers a ZIP named after today in São Paulo, with every file even when there is nothing to put in it", async () => {
    const { cookie } = await approvedUser();

    const { response, files } = await download(cookie);

    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="mensal-dados-2026-10-12.zip"'
    );
    expect(Object.keys(files).sort()).toEqual([
      "ocorrencias.csv",
      "perfil.csv",
      "recorrencias.csv",
    ]);
    expect(text(files["recorrencias.csv"])).toBe(csv(recurrencesHeader));
    expect(text(files["ocorrencias.csv"])).toBe(csv(occurrencesHeader));
  });

  it("writes the profile: name, email and the day the account was created in São Paulo", async () => {
    const { cookie, email } = await approvedUser();
    // 23:30 on 2026-03-04 in São Paulo.
    await api.db.$client.query(
      "UPDATE users SET name = $1, created_at = '2026-03-05 02:30:00' WHERE email = $2",
      ['Ana "Paula"; Souza', email]
    );

    const { files } = await download(cookie);

    expect(text(files["perfil.csv"])).toBe(
      csv("Nome;Email;Criado em", `"Ana ""Paula""; Souza";${email};04/03/2026`)
    );
  });

  it("writes every recurrence, ended ones included, by creation", async () => {
    const { cookie, userId } = await approvedUser();
    const rent = await insertRecurrence(api.db, {
      userId,
      description: "Aluguel",
      defaultAmount: 220000,
      dueDay: 10,
      startPeriod: "2026-01-01",
      endPeriod: null,
      notes: 'Contrato "novo";\r\nassinado',
      createdAt: new Date("2026-02-01T12:00:00Z"),
    });
    const salary = await insertRecurrence(api.db, {
      userId,
      direction: "INFLOW",
      description: "Salário",
      defaultAmount: null,
      dueDay: null,
      startPeriod: "2025-06-01",
      endPeriod: "2026-03-01",
      notes: null,
      createdAt: new Date("2026-01-01T12:00:00Z"),
    });

    const { files } = await download(cookie);

    expect(text(files["recorrencias.csv"])).toBe(
      csv(
        recurrencesHeader,
        `${salary.id};Salário;Entrada;;;2025-06;2026-03;`,
        `${rent.id};Aluguel;Saída;2200,00;10;2026-01;;"Contrato ""novo"";\r\nassinado"`
      )
    );
  });

  it("writes every persisted occurrence by period and due date, and never a virtual one", async () => {
    const { cookie, userId } = await approvedUser();
    const rent = await insertRecurrence(api.db, {
      userId,
      startPeriod: "2026-09-01",
    });
    const settled = await insertOccurrence(api.db, {
      userId,
      recurrenceId: rent.id,
      description: "Aluguel",
      status: "SETTLED",
      amount: 220000,
      period: "2026-09-01",
      dueDate: "2026-09-10",
      settledAt: "2026-09-09",
    });
    const upcoming = await insertOccurrence(api.db, {
      userId,
      description: "Conserto do carro",
      amount: 85000,
      dueDate: "2026-10-20",
      notes: 'Oficina; "Zé"',
    });
    const skipped = await insertOccurrence(api.db, {
      userId,
      description: "Presente",
      status: "SKIPPED",
      amount: null,
      dueDate: null,
    });
    const overdue = await insertOccurrence(api.db, {
      userId,
      direction: "INFLOW",
      description: "Reembolso",
      amount: 15050,
      dueDate: "2026-10-05",
    });
    const dueToday = await insertOccurrence(api.db, {
      userId,
      description: "Luz",
      amount: 9990,
      dueDate: "2026-10-12",
    });

    const { files } = await download(cookie);

    expect(text(files["ocorrencias.csv"])).toBe(
      csv(
        occurrencesHeader,
        `${settled.id};2026-09;Aluguel;10/09/2026;Saída;2200,00;Liquidada;09/09/2026;Recorrência;${rent.id};`,
        `${overdue.id};2026-10;Reembolso;05/10/2026;Entrada;150,50;Atrasada;;Avulsa;;`,
        `${dueToday.id};2026-10;Luz;12/10/2026;Saída;99,90;Vence hoje;;Avulsa;;`,
        `${upcoming.id};2026-10;Conserto do carro;20/10/2026;Saída;850,00;A vencer;;Avulsa;;"Oficina; ""Zé"""`,
        `${skipped.id};2026-10;Presente;;Saída;;Pulada;;Avulsa;;`
      )
    );
    // October's rent is still virtual: the download materialized nothing.
    const october = await request(api, "/api/v1/periods/2026-10", { cookie });
    const { items } = (await october.json()) as { items: { id: string }[] };
    expect(items.map(({ id }) => id)).toContain(
      `virtual_${rent.id}_2026-10-01`
    );
  });

  it("never holds another user's data", async () => {
    const { cookie, email } = await approvedUser();
    const other = await approvedUser();
    await insertRecurrence(api.db, { userId: other.userId });
    await insertOccurrence(api.db, { userId: other.userId });

    const { files } = await download(cookie);

    expect(text(files["perfil.csv"])).toContain(`;${email};`);
    expect(text(files["perfil.csv"])).not.toContain(other.email);
    expect(text(files["recorrencias.csv"])).toBe(csv(recurrencesHeader));
    expect(text(files["ocorrencias.csv"])).toBe(csv(occurrencesHeader));
  });

  it("leaves the user's reminder devices out", async () => {
    const { cookie } = await approvedUser();
    const endpoint = "https://push.example/send/a-capability-url";
    const turnedOn = await request(api, "/api/v1/reminders/device", {
      cookie,
      method: "PUT",
      body: { endpoint, keys: { p256dh: "p256dh-key", auth: "auth-secret" } },
    });
    expect(turnedOn.status).toBe(200);

    const { files } = await download(cookie);

    expect(Object.keys(files).sort()).toEqual([
      "ocorrencias.csv",
      "perfil.csv",
      "recorrencias.csv",
    ]);
    for (const bytes of Object.values(files))
      for (const secret of [endpoint, "p256dh-key", "auth-secret"])
        expect(new TextDecoder().decode(bytes)).not.toContain(secret);
  });

  it("is refused to a user awaiting approval", async () => {
    const { cookie } = await signUp(api);

    const response = await request(api, "/api/v1/data", { cookie });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: "USER_NOT_APPROVED" });
  });
});
