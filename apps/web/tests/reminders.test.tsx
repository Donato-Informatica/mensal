import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { chooseFromAccountMenu } from "./account-menu.ts";
import { fakeApi, fakeVapidPublicKey, type FakeApi } from "./fake-api.ts";
import { fakePush } from "./fake-push.ts";
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

/** Opens "Lembretes" from the account menu of the monthly screen. */
async function openReminders(user = userEvent.setup()) {
  openApp(api, "/");
  await chooseFromAccountMenu("Lembretes", user);
  return screen.findByRole("dialog", { name: "Lembretes" });
}

/** Bytes as base64url, the form the API gives the VAPID public key in. */
function base64url(buffer: ArrayBuffer | undefined): string {
  return btoa(
    String.fromCharCode(...new Uint8Array(buffer ?? new ArrayBuffer()))
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

describe("the Lembretes screen", () => {
  it("is in the account menu, before Link do calendário", async () => {
    const user = userEvent.setup();
    openApp(api, "/");

    await user.click(await screen.findByRole("button", { name: "Conta" }));

    const items = (await screen.findAllByRole("menuitem")).map(
      (item) => item.textContent
    );
    expect(items.indexOf("Lembretes")).toBe(
      items.indexOf("Link do calendário") - 1
    );
  });

  it("states the rule and shows Desativado on a device without reminders", async () => {
    fakePush();

    const dialog = await openReminders();

    expect(await within(dialog).findByText("Desativado")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        /todo dia às 9h, neste dispositivo, .*vencem no dia e .*atrasadas/i
      )
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Ativar neste dispositivo" })
    ).toBeInTheDocument();
  });

  it("turns reminders on for this device: asks for permission, registers with the server's key and tells the server", async () => {
    const push = fakePush();
    const user = userEvent.setup();
    const dialog = await openReminders(user);

    await user.click(
      await within(dialog).findByRole("button", {
        name: "Ativar neste dispositivo",
      })
    );

    expect(await within(dialog).findByText("Ativado")).toBeInTheDocument();
    expect(push.permission()).toBe("granted");
    const subscription = push.subscription();
    expect(base64url(subscription?.applicationServerKey)).toBe(
      fakeVapidPublicKey
    );
    expect(api.reminderDevicesOf(email)).toEqual([subscription!.endpoint]);
    expect(api.confirmationsSent()).toEqual([subscription!.endpoint]);
    expect(
      within(dialog).queryByRole("button", {
        name: "Ativar neste dispositivo",
      })
    ).toBeNull();
  });

  it("shows Ativado when the server says this browser's registration is the user's", async () => {
    const endpoint = "https://push.example/send/this-browser";
    fakePush({ permission: "granted", subscribed: endpoint });
    api.addReminderDevice(email, endpoint);

    const dialog = await openReminders();

    expect(await within(dialog).findByText("Ativado")).toBeInTheDocument();
  });

  it("shows Desativado, and drops the browser's registration, when the server says it is not the user's", async () => {
    const endpoint = "https://push.example/send/previous-user";
    const push = fakePush({ permission: "granted", subscribed: endpoint });
    api.addAccount({
      name: "Bruno",
      email: "bruno@example.com",
      password: "correct-horse",
      approved: true,
    });
    api.addReminderDevice("bruno@example.com", endpoint);

    const dialog = await openReminders();

    expect(await within(dialog).findByText("Desativado")).toBeInTheDocument();
    expect(api.reminderDevicesOf("bruno@example.com")).toEqual([]);
    await waitFor(() => expect(push.subscription()).toBeNull());
  });

  it("says reminders are not available when the server has them off", async () => {
    fakePush();
    api.disableReminders();

    const dialog = await openReminders();

    expect(
      await within(dialog).findByText(
        "Os lembretes não estão disponíveis neste servidor."
      )
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", {
        name: "Ativar neste dispositivo",
      })
    ).toBeNull();
  });
});
