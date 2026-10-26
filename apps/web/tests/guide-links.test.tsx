import { guideSections, type GuideSection } from "@mensal/guide";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { chooseFromAccountMenu } from "./account-menu.ts";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { openApp } from "./open-app.tsx";

// Links from the app to the static guide (PRD §7.17). The guide is not part of
// the app, so each is a plain link the browser follows, never a client route.

/** The guide's address, or one of its sections from the guide's own list. */
function guideHref(section?: GuideSection) {
  if (section !== undefined) expect(guideSections).toContain(section);
  return section === undefined ? "/guia/" : `/guia/#${section}`;
}

let api: FakeApi;
beforeEach(() => {
  api = fakeApi();
});

describe("links to the guide", () => {
  it("from the sign-in screen", async () => {
    openApp(api, "/entrar");

    const link = await screen.findByRole("link", { name: "Como funciona" });
    expect(link).toHaveAttribute("href", guideHref());
  });

  it("from the sign-up screen", async () => {
    openApp(api, "/cadastro");

    const link = await screen.findByRole("link", { name: "Como funciona" });
    expect(link).toHaveAttribute("href", guideHref());
  });

  it("from the awaiting-approval screen, to the sign-up section", async () => {
    api.addAccount({
      name: "Bia",
      email: "bia@example.com",
      password: "correct-horse",
    });
    api.signIn("bia@example.com");
    openApp(api, "/aguardando-aprovacao");

    const link = await screen.findByRole("link", {
      name: "Como funciona a aprovação",
    });
    expect(link).toHaveAttribute("href", guideHref("cadastro"));
  });

  describe("signed in", () => {
    const email = "ana@example.com";
    beforeEach(() => {
      api.addAccount({
        name: "Ana",
        email,
        password: "correct-horse",
        approved: true,
      });
      api.signIn(email);
      openApp(api, "/");
    });

    it("from the account menu", async () => {
      await userEvent.click(
        await screen.findByRole("button", { name: "Conta" })
      );

      const item = await screen.findByRole("menuitem", { name: "Guia" });
      expect(item).toHaveAttribute("href", guideHref());
    });

    it("from Tokens de acesso, to the MCP section", async () => {
      const user = userEvent.setup();
      await chooseFromAccountMenu("Tokens de acesso", user);
      const dialog = await screen.findByRole("dialog", {
        name: "Tokens de acesso",
      });

      const link = await within(dialog).findByRole("link", {
        name: "Como conectar um agente",
      });
      expect(link).toHaveAttribute("href", guideHref("mcp"));
    });

    it("beside the snippets of a token just created, to the MCP section", async () => {
      const user = userEvent.setup();
      await chooseFromAccountMenu("Tokens de acesso", user);
      await user.click(
        await screen.findByRole("button", { name: "Criar token" })
      );
      await user.type(await screen.findByLabelText("Nome"), "Claude Code");
      await user.type(screen.getByLabelText("Senha atual"), "correct-horse");
      await user.click(screen.getByRole("button", { name: "Criar" }));
      await screen.findByText("Comando do Claude Code");

      const link = screen.getByRole("link", {
        name: "Como conectar um agente",
      });
      expect(link).toHaveAttribute("href", guideHref("mcp"));
    });
  });
});
