import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseICalendar, valueOf } from "./icalendar.ts";
import {
  approve,
  password,
  request,
  signUp,
  startApi,
  type TestApi,
} from "./api.ts";

let api: TestApi;
beforeAll(async () => {
  // Today is 2026-10-12 in São Paulo.
  api = await startApi({ now: () => new Date("2026-10-12T15:00:00Z") });
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
});
