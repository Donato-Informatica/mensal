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
  await user.click(await screen.findByRole("menuitem", { name }));
}

/**
 * Clicks the dimmed page behind the open dialog and checks the dialog outlives
 * its closing transition: these dialogs close only when told to.
 */
export async function expectClickOutsideToKeepDialog(user: UserEvent) {
  await user.click(document.querySelector(".mantine-Modal-overlay")!);
  await expect(
    waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  ).rejects.toThrow();
}
