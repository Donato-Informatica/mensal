// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fakeToken, redactTokens } from "../scripts/redact.ts";

// The guide's captures must never show a real access token (PRD §7.17):
// before each one, the script runs `redactTokens` in the page.
const real = {
  token: "mensal_Zq81RealSecretValue0123456789",
  start: "mensal_Zq8",
};

function screen() {
  document.body.innerHTML = `
    <ul><li>Claude Code <span>${real.start}…</span></li></ul>
    <label>Token <input value="${real.token}" readonly /></label>
    <pre>claude mcp add --header "Authorization: Bearer ${real.token}"</pre>
    <textarea>${real.token}</textarea>`;
}

/** Everything a screenshot of the page could show. */
function shown() {
  const fields = [...document.querySelectorAll("input, textarea")].map(
    (field) => (field as HTMLInputElement).value
  );
  return [document.body.textContent ?? "", ...fields].join("\n");
}

describe("redactTokens", () => {
  it("replaces every real token, and its listed prefix, with the fake one", () => {
    screen();

    const remaining = redactTokens({ tokens: [real], fake: fakeToken });

    expect(remaining).toBe(false);
    expect(shown()).not.toContain(real.token);
    expect(shown()).not.toContain(real.start);
    expect(shown()).toContain(`Bearer ${fakeToken}`);
    expect((document.querySelector("input") as HTMLInputElement).value).toBe(
      fakeToken
    );
  });

  it("leaves a page without tokens as it was", () => {
    document.body.innerHTML = "<p>Contas do mês</p>";

    expect(redactTokens({ tokens: [real], fake: fakeToken })).toBe(false);
    expect(document.body.innerHTML).toBe("<p>Contas do mês</p>");
  });
});
