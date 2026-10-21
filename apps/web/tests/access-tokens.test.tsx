import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { chooseFromAccountMenu } from "./account-menu.ts";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { openApp } from "./open-app.tsx";

const email = "ana@example.com";
const mcpUrl = () => `${window.location.origin}/api/mcp`;
let api: FakeApi;
beforeEach(() => {
  api = fakeApi();
  api.addAccount({
    name: "Ana",
    email,
    password: "correct-horse",
    approved: true,
  });
  api.signIn(email);
});

/** Opens "Tokens de acesso" from the account menu of the monthly screen. */
async function openAccessTokens(user = userEvent.setup()) {
  openApp(api, "/");
  await chooseFromAccountMenu("Tokens de acesso", user);
  return screen.findByRole("dialog", { name: "Tokens de acesso" });
}

/** Asks for a new token through the "Criar token" form. */
async function createToken(
  user: ReturnType<typeof userEvent.setup>,
  { name, password }: { name: string; password: string }
) {
  await user.click(await screen.findByRole("button", { name: "Criar token" }));
  await user.type(await screen.findByLabelText("Nome"), name);
  await user.type(screen.getByLabelText("Senha atual"), password);
  await user.click(screen.getByRole("button", { name: "Criar" }));
}

describe("access tokens", () => {
  it("lists each token with its name, prefix, creation date and last use", async () => {
    api.addAccessToken(email, {
      name: "Claude Code",
      prefix: "mns_ab",
      createdAt: "2026-10-01T12:00:00.000Z",
      lastUsedAt: "2026-10-05T12:00:00.000Z",
    });
    api.addAccessToken(email, { name: "Codex", prefix: "mns_cd" });

    const dialog = await openAccessTokens();

    const claude = (await within(dialog).findByText("Claude Code")).closest(
      "li"
    )!;
    expect(within(claude).getByText(/mns_ab/)).toBeInTheDocument();
    expect(within(claude).getByText(/01\/10\/2026/)).toBeInTheDocument();
    expect(within(claude).getByText(/05\/10\/2026/)).toBeInTheDocument();
    const codex = within(dialog).getByText("Codex").closest("li")!;
    expect(within(codex).getByText(/Nunca usado/)).toBeInTheDocument();
  });

  it("explains what a token is for when there are none, and offers to create one", async () => {
    const dialog = await openAccessTokens();

    expect(
      await within(dialog).findByText(/Claude Code ou o Codex/)
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Criar token" })
    ).toBeInTheDocument();
  });

  it("shows a new token once, with both snippets and the app's MCP URL", async () => {
    const user = userEvent.setup();
    await openAccessTokens(user);
    await createToken(user, { name: "Meu agente", password: "correct-horse" });

    const dialog = await screen.findByRole("dialog", {
      name: "Tokens de acesso",
    });
    const field = await within(dialog).findByLabelText("Token");
    const token = (field as HTMLInputElement).value;
    expect(token).toBe(api.accessTokensOf(email)[0]!.token);
    expect(token).not.toBe("");
    expect(
      within(dialog).getByText(/não será mostrado novamente/)
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        `claude mcp add --transport http mensal ${mcpUrl()} --header "Authorization: Bearer ${token}"`
      )
    ).toBeInTheDocument();
    const codex = within(dialog).getByTestId("codex-snippet");
    expect(codex).toHaveTextContent("[mcp_servers.mensal]");
    expect(codex).toHaveTextContent(`url = "${mcpUrl()}"`);
    expect(codex).toHaveTextContent(`Authorization = "Bearer ${token}"`);

    // Closing drops the token: reopening the screen lists it, never shows it.
    await user.click(within(dialog).getByRole("button", { name: "Concluir" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    await chooseFromAccountMenu("Tokens de acesso", user);
    const reopened = await screen.findByRole("dialog", {
      name: "Tokens de acesso",
    });
    expect(await within(reopened).findByText("Meu agente")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(token)).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(token);
  });

  it("copies the token", async () => {
    const user = userEvent.setup();
    await openAccessTokens(user);
    await createToken(user, { name: "Meu agente", password: "correct-horse" });

    await user.click(
      await screen.findByRole("button", { name: "Copiar token" })
    );

    expect(await navigator.clipboard.readText()).toBe(
      api.accessTokensOf(email)[0]!.token
    );
  });

  it("refuses a wrong password and creates nothing", async () => {
    const user = userEvent.setup();
    await openAccessTokens(user);
    await createToken(user, { name: "Meu agente", password: "wrong" });

    expect(
      await screen.findByText("Senha atual incorreta.")
    ).toBeInTheDocument();
    expect(api.accessTokensOf(email)).toHaveLength(0);
  });

  it("revokes a token after a confirmation", async () => {
    api.addAccessToken(email, { name: "Claude Code" });
    const user = userEvent.setup();
    const dialog = await openAccessTokens(user);

    await user.click(
      await within(dialog).findByRole("button", {
        name: "Revogar Claude Code",
      })
    );
    expect(api.accessTokensOf(email)).toHaveLength(1);
    await user.click(
      await screen.findByRole("button", { name: "Revogar token" })
    );

    await waitFor(() => expect(api.accessTokensOf(email)).toHaveLength(0));
    expect(
      await screen.findByText(/Claude Code ou o Codex/)
    ).toBeInTheDocument();
  });

  it("keeps the token when the revocation is cancelled", async () => {
    api.addAccessToken(email, { name: "Claude Code" });
    const user = userEvent.setup();
    const dialog = await openAccessTokens(user);

    await user.click(
      await within(dialog).findByRole("button", {
        name: "Revogar Claude Code",
      })
    );
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(await screen.findByText("Claude Code")).toBeInTheDocument();
    expect(api.accessTokensOf(email)).toHaveLength(1);
  });
});
