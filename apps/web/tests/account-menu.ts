import { screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { expect } from "vitest";

/** Opens the header's account menu ("Conta") and picks one of its items. */
export async function chooseFromAccountMenu(
  name:
    | "Configurações"
    | "Alterar nome"
    | "Alterar senha"
    | "Tokens de acesso"
    | "Lembretes"
    | "Link do calendário"
    | "Baixar meus dados"
    | "Sair"
    | "Excluir conta",
  user: UserEvent = userEvent.setup()
) {
  await user.click(await screen.findByRole("button", { name: "Conta" }));
  // By its text: a role query over the whole page is slow in jsdom, and the
  // dropdown counts as hidden until its transition ends.
  await user.click(
    await screen.findByText(name, { selector: "[role=menuitem] *" })
  );
}

/**
 * Clicks the dimmed page behind the open dialog and checks the dialog outlives
 * its closing transition: these dialogs close only when told to.
 */
export async function expectClickOutsideToKeepDialog(user: UserEvent) {
  await user.click(document.querySelector(".mantine-Modal-overlay")!);
  await expect(
    waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), {
      timeout: 1_000,
    })
  ).rejects.toThrow();
}
