import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { openApp, settle } from "./open-app.tsx";

const email = "ana@example.com";
const banner =
  "Sem conexão. O Mensal volta a funcionar quando a conexão voltar.";
let api: FakeApi;
let user: UserEvent;
beforeEach(() => {
  // Today is 2026-10-12 in São Paulo.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-12T15:00:00Z") });
  api = fakeApi();
  api.addAccount({
    name: "Ana",
    email,
    password: "correct-horse",
    approved: true,
  });
  user = userEvent.setup();
});
afterEach(() => {
  goOnline();
  vi.useRealTimers();
});

/** The browser's own signal: `navigator.onLine` and the window's event. */
function setConnection(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
  act(() => {
    window.dispatchEvent(new Event(online ? "online" : "offline"));
  });
}
const goOffline = () => setConnection(false);
const goOnline = () => setConnection(true);

/** The banner, by its role and its text. */
function findBanner() {
  return screen.findByRole("status", { name: banner });
}

describe("while the browser is offline (PRD §7.16)", () => {
  it("shows the banner on the monthly screen, and hides it once back online", async () => {
    api.signIn(email);
    openApp(api, "/");
    await screen.findByRole("button", { name: "Nova avulsa" });

    goOffline();
    expect(await findBanner()).toHaveTextContent(banner);

    goOnline();
    await waitFor(() => expect(screen.queryByText(banner)).toBeNull());
  });

  it("shows the banner on the sign-in screen", async () => {
    openApp(api, "/entrar");
    await screen.findByRole("heading", { name: "Entrar" });

    goOffline();
    expect(await findBanner()).toBeInTheDocument();
  });

  it("locks the app, an open dialog included, but not the banner, and keeps what was typed", async () => {
    api.signIn(email);
    api.addOccurrence(email, { description: "Aluguel" });
    openApp(api, "/");
    await user.click(
      await screen.findByRole("button", { name: "Nova avulsa" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Nova conta avulsa",
    });
    await user.type(within(dialog).getByLabelText("Descrição"), "Presente");
    const month = screen.getByRole("region", { name: "Contas do mês" });

    goOffline();
    const status = await findBanner();
    expect(month.closest("[inert]")).not.toBeNull();
    expect(dialog.closest("[inert]")).not.toBeNull();
    expect(status.closest("[inert]")).toBeNull();

    goOnline();
    await waitFor(() => expect(dialog.closest("[inert]")).toBeNull());
    expect(month.closest("[inert]")).toBeNull();
    expect(within(dialog).getByLabelText("Descrição")).toHaveValue("Presente");
  });

  it("refetches the month once the connection is back", async () => {
    api.signIn(email);
    api.addOccurrence(email, { description: "Aluguel" });
    openApp(api, "/");
    await screen.findByRole("region", { name: "Contas do mês" });

    goOffline();
    await findBanner();
    api.addOccurrence(email, { description: "Conserto do carro" });
    // A while offline: what was on screen is no longer fresh.
    vi.setSystemTime(new Date("2026-10-12T15:01:00Z"));

    goOnline();
    expect(await screen.findByText("Conserto do carro")).toBeInTheDocument();
  });

  it("opened offline, waits on its loading state behind the banner until the connection is back", async () => {
    api.signIn(email);
    api.addOccurrence(email, { description: "Aluguel" });
    goOffline();
    openApp(api, "/");

    await findBanner();
    await settle();
    expect(screen.queryByText("Aluguel")).toBeNull();

    goOnline();
    expect(await screen.findByText("Aluguel")).toBeInTheDocument();
  });

  it("doesn't move to another month with the arrow keys", async () => {
    api.signIn(email);
    openApp(api, "/");
    await screen.findByRole("heading", { name: "Outubro 2026" });

    goOffline();
    await findBanner();
    await user.keyboard("{ArrowRight}");
    await settle();
    expect(screen.getByRole("heading", { name: "Outubro 2026" })).toBeVisible();

    goOnline();
    await user.keyboard("{ArrowRight}");
    expect(
      await screen.findByRole("heading", { name: "Novembro 2026" })
    ).toBeInTheDocument();
  });

  it("sends a save started just before the drop once the connection is back", async () => {
    api.signIn(email);
    openApp(api, "/");
    await user.click(
      await screen.findByRole("button", { name: "Nova avulsa" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Nova conta avulsa",
    });
    await user.type(within(dialog).getByLabelText("Descrição"), "Presente");
    await user.type(within(dialog).getByLabelText("Valor"), "120");

    api.stall();
    await user.click(
      within(dialog).getByRole("button", { name: "Criar conta" })
    );
    await waitFor(() => expect(api.heldCount()).toBe(1));
    // The drop: the request is lost along with the connection.
    goOffline();
    api.answer(0, { fail: true });
    api.resume();
    await settle();
    expect(
      within(dialog).queryByText("Algo deu errado. Tente novamente.")
    ).toBeNull();
    expect(api.occurrencesOf(email)).toEqual([]);

    goOnline();
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(api.occurrencesOf(email)).toEqual([
      expect.objectContaining({ description: "Presente" }),
    ]);
  });
});
