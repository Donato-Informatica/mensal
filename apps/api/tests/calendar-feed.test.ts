import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insertOccurrence, insertRecurrence } from "./fixtures.ts";
import {
  eventsOf,
  parseICalendar,
  textOf,
  valueOf,
  type Component,
} from "./icalendar.ts";
import {
  approve,
  password,
  request,
  signUp,
  startApi,
  type TestApi,
} from "./api.ts";

// Today is 2026-10-12 in São Paulo; a test that moves the clock puts it back.
const noon = new Date("2026-10-12T15:00:00Z");
let clock = noon;
let api: TestApi;
beforeAll(async () => {
  api = await startApi({ now: () => clock });
});
afterAll(async () => {
  await api.close();
});

async function approvedUser() {
  const user = await signUp(api);
  await approve(api, user.email);
  return user;
}

/** Generates the user's calendar link and returns its URL's path and query. */
async function generateLink(cookie: string): Promise<string> {
  const response = await request(api, "/api/v1/calendar-link", {
    cookie,
    body: { password },
  });
  expect(response.status).toBe(201);
  const { link } = await response.json();
  const url = new URL(link.url);
  return url.pathname + url.search;
}

/** What a calendar app gets: no cookie, only the link. */
function read(link: string) {
  return fetch(api.url + link);
}

describe("the calendar feed", () => {
  it("answers a valid link with a calendar named Mensal", async () => {
    const { cookie } = await approvedUser();
    const link = await generateLink(cookie);

    const response = await read(link);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/calendar; charset=utf-8"
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    const calendar = parseICalendar(await response.text());
    expect(calendar.name).toBe("VCALENDAR");
    expect(valueOf(calendar, "VERSION")).toBe("2.0");
    expect(valueOf(calendar, "PRODID")).toBeTruthy();
    expect(valueOf(calendar, "X-WR-CALNAME")).toBe("Mensal");
    expect(valueOf(calendar, "X-WR-TIMEZONE")).toBe("America/Sao_Paulo");
  });

  it("answers 404 with no body for a missing or unknown key", async () => {
    for (const link of [
      "/api/calendar.ics",
      "/api/calendar.ics?key=",
      `/api/calendar.ics?key=${"A".repeat(43)}`,
    ]) {
      const response = await read(link);
      expect(response.status, link).toBe(404);
      expect(await response.text(), link).toBe("");
    }
  });

  it("answers 404 with no body for a replaced or deactivated link", async () => {
    const { cookie } = await approvedUser();
    const replaced = await generateLink(cookie);
    const deactivated = await generateLink(cookie);
    await request(api, "/api/v1/calendar-link", { cookie, method: "DELETE" });

    for (const link of [replaced, deactivated]) {
      const response = await read(link);
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("");
    }
  });

  it("answers 403 USER_NOT_APPROVED once the owner's approval is withdrawn, on that owner's link only", async () => {
    const mine = await approvedUser();
    const theirs = await approvedUser();
    const myLink = await generateLink(mine.cookie);
    const theirLink = await generateLink(theirs.cookie);

    await api.db.$client.query(
      "UPDATE users SET approved = false WHERE email = $1",
      [mine.email]
    );
    const withdrawn = await read(myLink);

    expect(withdrawn.status).toBe(403);
    expect(await withdrawn.json()).toEqual({ code: "USER_NOT_APPROVED" });
    expect((await read(theirLink)).status).toBe(200);
  });

  it("answers 429 after 60 reads of a link in an hour, for that link only", async () => {
    const mine = await approvedUser();
    const theirs = await approvedUser();
    const myLink = await generateLink(mine.cookie);
    const theirLink = await generateLink(theirs.cookie);

    try {
      for (let n = 1; n <= 60; n++) {
        clock = new Date(noon.getTime() + n * 1000);
        expect((await read(myLink)).status, `read ${n}`).toBe(200);
      }
      const limited = await read(myLink);
      expect(limited.status).toBe(429);
      expect(await limited.json()).toEqual({ code: "TOO_MANY_REQUESTS" });
      expect((await read(theirLink)).status).toBe(200);

      // An hour after the first read, one more is allowed.
      clock = new Date(noon.getTime() + 3600 * 1000 + 1000);
      expect((await read(myLink)).status).toBe(200);
      expect((await read(myLink)).status).toBe(429);
    } finally {
      clock = noon;
    }
  });

  it("never materializes a virtual occurrence", async () => {
    const { cookie, userId } = await approvedUser();
    await insertRecurrence(api.db, { userId, startPeriod: "2026-10-01" });
    const link = await generateLink(cookie);

    expect(await eventsAt(link)).toHaveLength(4);

    for (const month of ["2026-10", "2026-11", "2026-12", "2027-01"]) {
      const response = await request(api, `/api/v1/periods/${month}`, {
        cookie,
      });
      const { items } = await response.json();
      expect(items, month).toHaveLength(1);
      expect(items[0].isVirtual, month).toBe(true);
    }
  });

  it("never shows another user's occurrences", async () => {
    const mine = await approvedUser();
    const theirs = await approvedUser();
    const myRepair = await insertOccurrence(api.db, { userId: mine.userId });
    await insertOccurrence(api.db, { userId: theirs.userId });
    await insertRecurrence(api.db, {
      userId: theirs.userId,
      startPeriod: "2026-10-01",
    });
    const link = await generateLink(mine.cookie);

    const events = await eventsAt(link);

    expect(events.map((event) => valueOf(event, "UID"))).toEqual([
      `${myRepair.id}@mensal`,
    ]);
  });
});

/** The events a calendar app gets from `link`, after checking it is a 200. */
async function eventsAt(link: string): Promise<Component[]> {
  const response = await read(link);
  expect(response.status).toBe(200);
  return eventsOf(parseICalendar(await response.text()));
}

/** The one event whose UID is `uid`. */
function eventWithUid(events: Component[], uid: string): Component {
  const found = events.filter((event) => valueOf(event, "UID") === uid);
  expect(found, uid).toHaveLength(1);
  return found[0]!;
}

describe("the calendar's events", () => {
  it("shows a pending one-off as an all-day event on its due date", async () => {
    const { cookie, userId } = await approvedUser();
    const repair = await insertOccurrence(api.db, {
      userId,
      description: "Conserto do carro",
      amount: 85000,
      period: "2026-10-01",
      dueDate: "2026-10-20",
    });
    const link = await generateLink(cookie);

    const events = await eventsAt(link);

    expect(events).toHaveLength(1);
    const event = eventWithUid(events, `${repair.id}@mensal`);
    expect(event.properties.find((p) => p.name === "DTSTART")?.params).toEqual({
      VALUE: "DATE",
    });
    expect(valueOf(event, "DTSTART")).toBe("20261020");
    expect(valueOf(event, "DTEND")).toBe("20261021");
    // Stamped with the app's clock, as RFC 5545 requires of every event.
    expect(valueOf(event, "DTSTAMP")).toBe("20261012T150000Z");
    expect(textOf(event, "SUMMARY")).toBe("Conserto do carro · R$ 850,00");
  });

  it("shows only pending occurrences with a due date, virtual ones included, up to 3 periods ahead", async () => {
    const { cookie, userId } = await approvedUser();
    const rent = await insertRecurrence(api.db, {
      userId,
      description: "Aluguel",
      dueDay: 25,
      startPeriod: "2026-10-01",
    });
    const pending = await insertOccurrence(api.db, {
      userId,
      period: "2027-01-01",
      dueDate: "2027-01-31",
    });
    for (const values of [
      { status: "SETTLED" as const, settledAt: "2026-10-05" },
      { status: "SKIPPED" as const },
      { dueDate: null },
      { period: "2027-02-01", dueDate: "2027-02-01" },
    ]) {
      await insertOccurrence(api.db, { userId, ...values });
    }
    const link = await generateLink(cookie);

    const events = await eventsAt(link);

    expect(events.map((event) => valueOf(event, "UID")).sort()).toEqual(
      [
        `${rent.id}_2026-10-01@mensal`,
        `${rent.id}_2026-11-01@mensal`,
        `${rent.id}_2026-12-01@mensal`,
        `${rent.id}_2027-01-01@mensal`,
        `${pending.id}@mensal`,
      ].sort()
    );
    expect(
      valueOf(eventWithUid(events, `${rent.id}_2026-11-01@mensal`), "DTSTART")
    ).toBe("20261125");
  });

  it("prefixes inflows and shows an amount to be defined as A definir", async () => {
    const { cookie, userId } = await approvedUser();
    const salary = await insertRecurrence(api.db, {
      userId,
      direction: "INFLOW",
      description: "Salário",
      defaultAmount: 1234567,
      dueDay: 30,
      startPeriod: "2026-10-01",
      endPeriod: "2026-10-01",
    });
    const card = await insertOccurrence(api.db, {
      userId,
      description: "Fatura do cartão",
      amount: null,
    });
    const link = await generateLink(cookie);

    const events = await eventsAt(link);

    expect(
      textOf(eventWithUid(events, `${salary.id}_2026-10-01@mensal`), "SUMMARY")
    ).toBe("Entrada: Salário · R$ 12.345,67");
    expect(textOf(eventWithUid(events, `${card.id}@mensal`), "SUMMARY")).toBe(
      "Fatura do cartão · A definir"
    );
  });

  it("describes the period with a link to that month in the app, and never the notes", async () => {
    const { cookie, userId } = await approvedUser();
    const repair = await insertOccurrence(api.db, {
      userId,
      period: "2026-11-01",
      dueDate: "2026-11-03",
      notes: "Oficina do Zé, pedir nota",
    });
    const link = await generateLink(cookie);

    const response = await read(link);
    const text = await response.text();
    const event = eventWithUid(
      eventsOf(parseICalendar(text)),
      `${repair.id}@mensal`
    );

    expect(textOf(event, "DESCRIPTION")).toBe(
      `Competência: novembro de 2026\n${api.url}/?mes=2026-11`
    );
    expect(text).not.toContain("Oficina");
  });

  it("escapes text and folds long lines at 75 octets, never inside a character", async () => {
    const { cookie, userId } = await approvedUser();
    const description =
      "Condomínio, água; luz \\ gás — reajuste anual çãõ éêí, parcela única; vencimento acordado";
    const bill = await insertOccurrence(api.db, { userId, description });
    const link = await generateLink(cookie);

    const response = await read(link);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const event = eventWithUid(
      eventsOf(parseICalendar(text)),
      `${bill.id}@mensal`
    );

    expect(valueOf(event, "SUMMARY")).toBe(
      "Condomínio\\, água\\; luz \\\\ gás — reajuste anual çãõ éêí\\, parcela única\\; vencimento acordado · R$ 850\\,00"
    );
    expect(textOf(event, "SUMMARY")).toBe(`${description} · R$ 850,00`);
    let start = 0;
    for (let i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] !== 0x0d || bytes[i + 1] !== 0x0a) continue;
      expect(i - start).toBeLessThanOrEqual(75);
      // A continuation line starts with a whole character, after its space.
      if (bytes[i + 2] === 0x20) expect(bytes[i + 3]! & 0xc0).not.toBe(0x80);
      start = i + 2;
    }
  });

  it("reminds at 09:00 on the due date, with one display alarm", async () => {
    const { cookie, userId } = await approvedUser();
    const repair = await insertOccurrence(api.db, { userId });
    const link = await generateLink(cookie);

    const event = eventWithUid(await eventsAt(link), `${repair.id}@mensal`);

    expect(event.components).toHaveLength(1);
    const [alarm] = event.components;
    expect(alarm!.name).toBe("VALARM");
    expect(valueOf(alarm!, "ACTION")).toBe("DISPLAY");
    expect(valueOf(alarm!, "TRIGGER")).toBe("PT9H");
    expect(textOf(alarm!, "DESCRIPTION")).toBe("Conserto do carro · R$ 850,00");
  });

  it("dates each event by its last change: the occurrence's, or the recurrence's for a virtual one", async () => {
    const { cookie, userId } = await approvedUser();
    const rent = await insertRecurrence(api.db, {
      userId,
      startPeriod: "2026-10-01",
      dueDay: 25,
      updatedAt: new Date("2026-10-01T12:00:00Z"),
    });
    const repair = await insertOccurrence(api.db, {
      userId,
      updatedAt: new Date("2026-10-05T12:34:56Z"),
    });
    const link = await generateLink(cookie);

    const events = await eventsAt(link);

    const virtual = eventWithUid(events, `${rent.id}_2026-10-01@mensal`);
    expect(valueOf(virtual, "LAST-MODIFIED")).toBe("20261001T120000Z");
    const oneOff = eventWithUid(events, `${repair.id}@mensal`);
    expect(valueOf(oneOff, "LAST-MODIFIED")).toBe("20261005T123456Z");
    expect(Number(valueOf(oneOff, "SEQUENCE"))).toBeGreaterThan(
      Number(valueOf(virtual, "SEQUENCE"))
    );
  });

  it("keeps a virtual occurrence's event, with a later sequence, once an edit materializes it", async () => {
    const { cookie, userId } = await approvedUser();
    const rent = await insertRecurrence(api.db, {
      userId,
      startPeriod: "2026-10-01",
      dueDay: 25,
      updatedAt: new Date("2026-10-01T12:00:00Z"),
    });
    const uid = `${rent.id}_2026-10-01@mensal`;
    const link = await generateLink(cookie);
    const before = eventWithUid(await eventsAt(link), uid);

    const edited = await request(
      api,
      `/api/v1/occurrences/virtual_${rent.id}_2026-10-01`,
      { cookie, method: "PATCH", body: { amount: 230000 } }
    );
    expect(edited.status).toBe(200);
    const after = eventWithUid(await eventsAt(link), uid);

    expect(textOf(after, "SUMMARY")).toBe("Aluguel · R$ 2.300,00");
    expect(Number(valueOf(after, "SEQUENCE"))).toBeGreaterThan(
      Number(valueOf(before, "SEQUENCE"))
    );
    expect(Number.isInteger(Number(valueOf(after, "SEQUENCE")))).toBe(true);
  });

  it("reads the current period from the app's clock in São Paulo, not UTC", async () => {
    const { cookie, userId } = await approvedUser();
    const january = await insertOccurrence(api.db, {
      userId,
      period: "2027-01-01",
      dueDate: "2027-01-10",
    });
    await insertOccurrence(api.db, {
      userId,
      period: "2027-02-01",
      dueDate: "2027-02-10",
    });
    const link = await generateLink(cookie);

    // 23:30 on 2026-10-31 in São Paulo, already November in UTC.
    clock = new Date("2026-11-01T02:30:00Z");
    try {
      const events = await eventsAt(link);
      expect(events.map((event) => valueOf(event, "UID"))).toEqual([
        `${january.id}@mensal`,
      ]);
    } finally {
      clock = noon;
    }
  });

  it("keeps overdue occurrences of earlier periods on their own due date", async () => {
    const { cookie, userId } = await approvedUser();
    const internet = await insertRecurrence(api.db, {
      userId,
      description: "Internet",
      dueDay: 5,
      startPeriod: "2026-08-01",
      endPeriod: "2026-10-01",
    });
    await insertOccurrence(api.db, {
      userId,
      recurrenceId: internet.id,
      description: "Internet",
      status: "SETTLED",
      period: "2026-09-01",
      dueDate: "2026-09-05",
      settledAt: "2026-09-05",
    });
    const forgotten = await insertOccurrence(api.db, {
      userId,
      period: "2026-07-01",
      dueDate: "2026-07-15",
    });
    await insertOccurrence(api.db, {
      userId,
      status: "SETTLED",
      period: "2026-07-01",
      dueDate: "2026-07-20",
      settledAt: "2026-07-20",
    });
    const link = await generateLink(cookie);

    const events = await eventsAt(link);

    const dates = Object.fromEntries(
      events.map((event) => [valueOf(event, "UID"), valueOf(event, "DTSTART")])
    );
    expect(dates).toEqual({
      [`${forgotten.id}@mensal`]: "20260715",
      [`${internet.id}_2026-08-01@mensal`]: "20260805",
      [`${internet.id}_2026-10-01@mensal`]: "20261005",
    });
  });
});
