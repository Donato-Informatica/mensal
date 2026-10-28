import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { chooseFromAccountMenu } from "./account-menu.ts";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { openApp } from "./open-app.tsx";

const email = "ana@example.com";
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

/** Opens "Link do calendário" from the account menu of the monthly screen. */
async function openCalendarLink(user = userEvent.setup()) {
  openApp(api, "/");
  await chooseFromAccountMenu("Link do calendário", user);
  return screen.findByRole("dialog", { name: "Link do calendário" });
}

describe("the calendar link", () => {
  it("explains what the link is for when there is none, and offers to generate one", async () => {
    const dialog = await openCalendarLink();

    expect(
      await within(dialog).findByText(/no dia do vencimento/)
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/provedor do seu calendário/)
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Gerar link" })
    ).toBeInTheDocument();
  });

  it("is generated with the current password, then shown with its URL", async () => {
    const user = userEvent.setup();
    const dialog = await openCalendarLink(user);

    await generate(user, "correct-horse");

    const url = api.calendarLinkOf(email)!.url;
    expect(await within(dialog).findByLabelText("Link")).toHaveValue(url);
  });

  it("shows a wrong password on its field and generates nothing", async () => {
    const user = userEvent.setup();
    await openCalendarLink(user);

    await generate(user, "wrong");

    expect(
      await screen.findByLabelText("Senha atual")
    ).toHaveAccessibleDescription(/Senha atual incorreta\./);
    expect(api.calendarLinkOf(email)).toBeUndefined();
  });

  it("shows the link again when the screen is reopened, and copies it", async () => {
    const { url } = api.addCalendarLink(email);
    const user = userEvent.setup();
    const dialog = await openCalendarLink(user);

    expect(await within(dialog).findByLabelText("Link")).toHaveValue(url);
    await user.click(
      within(dialog).getByRole("button", { name: "Copiar link" })
    );

    expect(await navigator.clipboard.readText()).toBe(url);
  });

  it("opens the link in the device's calendar and in Google Calendar, through its webcal:// form", async () => {
    const { url } = api.addCalendarLink(email);
    const { host, pathname, search } = new URL(url);
    const deviceCalendarUrl = `webcal://${host}${pathname}${search}`;
    const dialog = await openCalendarLink();

    expect(
      await within(dialog).findByRole("link", {
        name: "Abrir no calendário do dispositivo",
      })
    ).toHaveAttribute("href", deviceCalendarUrl);
    const google = within(dialog).getByRole("link", {
      name: /Adicionar ao Google Agenda/,
    });
    expect(google).toHaveAttribute(
      "href",
      `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(deviceCalendarUrl)}`
    );
    expect(google).toHaveAccessibleName(/no computador/);
  });

  it("warns that calendars may drop the reminder and take a day to drop a settled occurrence", async () => {
    api.addCalendarLink(email);
    const dialog = await openCalendarLink();

    expect(
      await within(dialog).findByText(
        /Google Agenda e o Outlook ignoram o lembrete.*Remover alertas/
      )
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/até cerca de um dia para sair/)
    ).toBeInTheDocument();
  });

  it("is replaced after a warning that the current link stops working, given the password", async () => {
    const old = api.addCalendarLink(email);
    const user = userEvent.setup();
    const dialog = await openCalendarLink(user);

    await user.click(
      await within(dialog).findByRole("button", { name: "Gerar novo link" })
    );
    expect(
      await within(dialog).findByText(
        /deixará de funcionar em todos os calendários/
      )
    ).toBeInTheDocument();
    await user.type(
      within(dialog).getByLabelText("Senha atual"),
      "correct-horse"
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Gerar novo link" })
    );

    const replaced = api.calendarLinkOf(email)!.url;
    expect(replaced).not.toBe(old.url);
    expect(await within(dialog).findByLabelText("Link")).toHaveValue(replaced);
  });

  it("is deactivated after a confirmation, without a password", async () => {
    api.addCalendarLink(email);
    const user = userEvent.setup();
    const dialog = await openCalendarLink(user);

    await user.click(
      await within(dialog).findByRole("button", { name: "Desativar" })
    );
    expect(api.calendarLinkOf(email)).toBeDefined();
    expect(within(dialog).queryByLabelText("Senha atual")).toBeNull();
    await user.click(
      within(dialog).getByRole("button", { name: "Desativar link" })
    );

    expect(
      await within(dialog).findByRole("button", { name: "Gerar link" })
    ).toBeInTheDocument();
    expect(api.calendarLinkOf(email)).toBeUndefined();
  });

  it("keeps the link when the deactivation is cancelled", async () => {
    const { url } = api.addCalendarLink(email);
    const user = userEvent.setup();
    const dialog = await openCalendarLink(user);

    await user.click(
      await within(dialog).findByRole("button", { name: "Desativar" })
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(await within(dialog).findByLabelText("Link")).toHaveValue(url);
    expect(api.calendarLinkOf(email)).toEqual({
      url,
      createdAt: expect.any(String),
    });
  });
});

/** Asks for a new link through "Gerar link" with `password`. */
async function generate(
  user: ReturnType<typeof userEvent.setup>,
  password: string
) {
  await user.click(await screen.findByRole("button", { name: "Gerar link" }));
  await user.type(await screen.findByLabelText("Senha atual"), password);
  await user.click(screen.getByRole("button", { name: "Gerar link" }));
}
