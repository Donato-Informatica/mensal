// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  exampleOrigin,
  fakeCalendarKey,
  fakeToken,
  redactSecrets,
} from "../scripts/redact.ts";

// The guide's captures must never show a real access token or calendar link
// key (PRD §7.17): before each one, the script runs `redactSecrets` in the page.
const real = {
  token: "mensal_Zq81RealSecretValue0123456789",
  prefix: "mensal_Zq8",
};

function screen() {
  document.body.innerHTML = `
    <ul><li>Claude Code <span>${real.prefix}…</span></li></ul>
    <label>Token <input value="${real.token}" readonly /></label>
    <pre>claude mcp add --header "Authorization: Bearer ${real.token}"</pre>
    <textarea>${real.token}</textarea>`;
}

/** What the script shows in place of each secret. */
const fakes = { fakeToken, fakeCalendarKey };

/** Everything a screenshot of the page could show. */
function shown() {
  const fields = [...document.querySelectorAll("input, textarea")].map(
    (field) => (field as HTMLInputElement).value
  );
  return [document.body.textContent ?? "", ...fields].join("\n");
}

describe("redactSecrets", () => {
  it("replaces every real token, and its listed prefix, with the fake one", () => {
    screen();

    const remaining = redactSecrets({
      tokens: [real],
      calendarKeys: [],
      ...fakes,
    });

    expect(remaining).toBe(false);
    expect(shown()).not.toContain(real.token);
    expect(shown()).not.toContain(real.prefix);
    expect(shown()).toContain(`Bearer ${fakeToken}`);
    expect((document.querySelector("input") as HTMLInputElement).value).toBe(
      fakeToken
    );
  });

  it("shows the example host in place of the local stack's origin", () => {
    document.body.innerHTML = `
      <pre>claude mcp add --transport http mensal http://localhost:5173/api/mcp</pre>
      <input value="http://localhost:5173/api/mcp" />`;

    redactSecrets({
      tokens: [],
      calendarKeys: [],
      ...fakes,
      origin: { real: "http://localhost:5173", shown: exampleOrigin },
    });

    expect(shown()).not.toContain("localhost");
    expect(shown()).toContain("https://mensal.example.com/api/mcp");
    expect((document.querySelector("input") as HTMLInputElement).value).toBe(
      "https://mensal.example.com/api/mcp"
    );
  });

  it("replaces a calendar link's key with the fake one, in text, fields and links", () => {
    const key = "Zq81RealCalendarKey0123456789abcdefghijklmno";
    const url = `http://localhost:5173/api/calendar.ics?key=${key}`;
    const deviceCalendarUrl = url.replace("http://", "webcal://");
    document.body.innerHTML = `
      <label>Link <input value="${url}" readonly /></label>
      <a href="${deviceCalendarUrl}">Abrir no calendário do dispositivo</a>
      <a href="https://calendar.google.com/calendar/r?cid=${encodeURIComponent(deviceCalendarUrl)}">Adicionar ao Google Agenda</a>
      <p>${url}</p>`;

    const remaining = redactSecrets({
      tokens: [],
      calendarKeys: [key],
      ...fakes,
      origin: { real: "http://localhost:5173", shown: exampleOrigin },
    });

    expect(remaining).toBe(false);
    expect(document.body.innerHTML).not.toContain(key);
    expect(shown()).not.toContain(key);
    expect((document.querySelector("input") as HTMLInputElement).value).toBe(
      `https://mensal.example.com/api/calendar.ics?key=${fakeCalendarKey}`
    );
    expect(document.querySelector("a")!.getAttribute("href")).toBe(
      `webcal://localhost:5173/api/calendar.ics?key=${fakeCalendarKey}`
    );
  });

  it("leaves a page without tokens as it was", () => {
    document.body.innerHTML = "<p>Contas do mês</p>";

    expect(redactSecrets({ tokens: [real], calendarKeys: [], ...fakes })).toBe(
      false
    );
    expect(document.body.innerHTML).toBe("<p>Contas do mês</p>");
  });
});
