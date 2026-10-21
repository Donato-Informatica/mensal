import { screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";

/** Opens the header's account menu ("Conta") and picks one of its items. */
export async function chooseFromAccountMenu(
  name: "Configurações" | "Alterar senha" | "Tokens de acesso" | "Sair",
  user: UserEvent = userEvent.setup()
) {
  await user.click(await screen.findByRole("button", { name: "Conta" }));
  await user.click(await screen.findByRole("menuitem", { name }));
}
