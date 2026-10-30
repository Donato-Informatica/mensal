import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { chooseFromAccountMenu } from "./account-menu.ts";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { fakePush } from "./fake-push.ts";
import { openApp } from "./open-app.tsx";

// Reminders and sign-out, and the check on every sign-in (PRD §8.2, §6.8).

const ana = "ana@example.com";
const bruno = "bruno@example.com";
const endpoint = "https://push.example/send/this-browser";
let api: FakeApi;
beforeEach(() => {
  api = fakeApi();
  api.addAccount({
    name: "Ana",
    email: ana,
    password: "correct-horse",
    approved: true,
  });
});

async function signOut({ fromMenu = true } = {}) {
  const user = userEvent.setup();
  if (fromMenu) await chooseFromAccountMenu("Sair", user);
  else await user.click(await screen.findByRole("button", { name: "Sair" }));
  const dialog = await screen.findByRole("dialog", { name: "Sair da conta" });
  await user.click(within(dialog).getByRole("button", { name: "Sair" }));
  expect(
    await screen.findByRole("heading", { name: "Entrar" })
  ).toBeInTheDocument();
}

async function signIn(email: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("E-mail"), email);
  await user.type(screen.getByLabelText("Senha"), "correct-horse");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("signing out", () => {
  beforeEach(() => {
    api.signIn(ana);
  });

  it("turns reminders off for this device and drops the browser's registration", async () => {
    const push = fakePush({ permission: "granted", subscribed: endpoint });
    api.addReminderDevice(ana, endpoint);
    api.addReminderDevice(ana, "https://push.example/send/ana-phone");
    openApp(api, "/");

    await signOut();

    expect(api.reminderDevicesOf(ana)).toEqual([
      "https://push.example/send/ana-phone",
    ]);
    expect(push.subscription()).toBeNull();
    expect(window.location.pathname).toBe("/entrar");
  });

  it("still signs out when turning reminders off fails", async () => {
    const push = fakePush({ permission: "granted", subscribed: endpoint });
    api.addReminderDevice(ana, endpoint);
    openApp(api, "/");
    await screen.findByRole("button", { name: "Conta" });
    api.breakReminders();

    await signOut();

    expect(push.subscription()).toBeNull();
    expect(window.location.pathname).toBe("/entrar");
  });

  it("signs out of a browser without the Push API", async () => {
    fakePush({ supported: false });
    openApp(api, "/");

    await signOut();

    expect(window.location.pathname).toBe("/entrar");
  });

  it("from Aguardando aprovação, signs out and drops the browser's registration, though the server refuses the unapproved user", async () => {
    api.addAccount({ name: "Bia", email: "bia@example.com", password: "x" });
    api.signIn("bia@example.com");
    const push = fakePush({ permission: "granted", subscribed: endpoint });
    openApp(api, "/aguardando-aprovacao");

    await signOut({ fromMenu: false });

    expect(push.subscription()).toBeNull();
    expect(window.location.pathname).toBe("/entrar");
  });
});

describe("signing in", () => {
  beforeEach(() => {
    api.addAccount({
      name: "Bruno",
      email: bruno,
      password: "correct-horse",
      approved: true,
    });
  });

  it("removes another user's reminders from this browser", async () => {
    const push = fakePush({ permission: "granted", subscribed: endpoint });
    api.addReminderDevice(bruno, endpoint);
    openApp(api, "/entrar");

    await signIn(ana);

    expect(
      await screen.findByRole("button", { name: "Conta" })
    ).toBeInTheDocument();
    await waitFor(() => expect(push.subscription()).toBeNull());
    expect(api.reminderDevicesOf(bruno)).toEqual([]);
  });

  it("drops the browser's registration when an unapproved user signs in", async () => {
    api.addAccount({
      name: "Bia",
      email: "bia@example.com",
      password: "correct-horse",
    });
    const push = fakePush({ permission: "granted", subscribed: endpoint });
    api.addReminderDevice(bruno, endpoint);
    openApp(api, "/entrar");

    await signIn("bia@example.com");

    expect(
      await screen.findByRole("heading", { name: "Aguardando aprovação" })
    ).toBeInTheDocument();
    await waitFor(() => expect(push.subscription()).toBeNull());
  });

  it("keeps the user's own reminders on this browser", async () => {
    const push = fakePush({ permission: "granted", subscribed: endpoint });
    api.addReminderDevice(ana, endpoint);
    openApp(api, "/entrar");

    await signIn(ana);

    expect(
      await screen.findByRole("button", { name: "Conta" })
    ).toBeInTheDocument();
    expect(api.reminderDevicesOf(ana)).toEqual([endpoint]);
    expect(push.subscription()?.endpoint).toBe(endpoint);
  });
});
