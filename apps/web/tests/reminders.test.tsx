import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { chooseFromAccountMenu } from "./account-menu.ts";
import { fakeApi, fakeVapidPublicKey, type FakeApi } from "./fake-api.ts";
import { fakePush } from "./fake-push.ts";
import { openApp } from "./open-app.tsx";

const email = "ana@example.com";
const iPhoneSafari =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
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

describe("the Lembretes screen when the browser stands in the way", () => {
  it("says Bloqueado pelo navegador, and how to allow it again, when permission was denied", async () => {
    fakePush({ permission: "denied" });

    const dialog = await openReminders();

    expect(
      await within(dialog).findByText("Bloqueado pelo navegador")
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/configurações do site/i)
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", {
        name: "Ativar neste dispositivo",
      })
    ).toBeNull();
  });

  it("turns to Bloqueado pelo navegador when the user refuses the browser's prompt", async () => {
    const push = fakePush({ answer: "denied" });
    const user = userEvent.setup();
    const dialog = await openReminders(user);

    await user.click(
      await within(dialog).findByRole("button", {
        name: "Ativar neste dispositivo",
      })
    );

    expect(
      await within(dialog).findByText("Bloqueado pelo navegador")
    ).toBeInTheDocument();
    expect(push.subscription()).toBeNull();
    expect(api.reminderDevicesOf(email)).toEqual([]);
  });

  it("says Indisponível on a browser without the Push API", async () => {
    fakePush({ supported: false });

    const dialog = await openReminders();

    expect(await within(dialog).findByText("Indisponível")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", {
        name: "Ativar neste dispositivo",
      })
    ).toBeNull();
    expect(within(dialog).queryByText(/tela inicial/i)).toBeNull();
  });

  it("tells iPhone users outside the installed app to install it, linking to the guide", async () => {
    fakePush({ supported: false, userAgent: iPhoneSafari });

    const dialog = await openReminders();

    expect(await within(dialog).findByText("Indisponível")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Instale o app na tela inicial para receber lembretes."
      )
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: /como instalar/i })
    ).toHaveAttribute("href", "/guia/#instalar");
  });
});

describe("turning reminders off", () => {
  const endpoint = "https://push.example/send/this-browser";

  it("turns them off on this device: tells the server and drops the browser's registration", async () => {
    const push = fakePush({ permission: "granted", subscribed: endpoint });
    api.addReminderDevice(email, endpoint);
    api.addReminderDevice(email, "https://push.example/send/laptop");
    const user = userEvent.setup();
    const dialog = await openReminders(user);

    await user.click(
      await within(dialog).findByRole("button", {
        name: "Desativar neste dispositivo",
      })
    );

    expect(await within(dialog).findByText("Desativado")).toBeInTheDocument();
    expect(api.reminderDevicesOf(email)).toEqual([
      "https://push.example/send/laptop",
    ]);
    expect(push.subscription()).toBeNull();
  });

  it("shows how many other devices have reminders on", async () => {
    fakePush({ permission: "granted", subscribed: endpoint });
    api.addReminderDevice(email, endpoint);
    api.addReminderDevice(email, "https://push.example/send/laptop");
    api.addReminderDevice(email, "https://push.example/send/tablet");

    const dialog = await openReminders();

    expect(
      await within(dialog).findByText("Ativado em mais 2 dispositivos")
    ).toBeInTheDocument();
  });

  it("counts every device as another one when this device is off", async () => {
    fakePush();
    api.addReminderDevice(email, "https://push.example/send/laptop");

    const dialog = await openReminders();

    expect(
      await within(dialog).findByText("Ativado em mais 1 dispositivo")
    ).toBeInTheDocument();
  });

  it("offers no other devices when this is the only one", async () => {
    fakePush({ permission: "granted", subscribed: endpoint });
    api.addReminderDevice(email, endpoint);

    const dialog = await openReminders();

    expect(await within(dialog).findByText("Ativado")).toBeInTheDocument();
    expect(within(dialog).queryByText(/ativado em mais/i)).toBeNull();
    expect(
      within(dialog).queryByRole("button", {
        name: "Desativar em todos os dispositivos",
      })
    ).toBeNull();
  });

  it("turns them off on every device after a confirmation", async () => {
    const push = fakePush({ permission: "granted", subscribed: endpoint });
    api.addReminderDevice(email, endpoint);
    api.addReminderDevice(email, "https://push.example/send/laptop");
    api.addAccount({
      name: "Bruno",
      email: "bruno@example.com",
      password: "correct-horse",
      approved: true,
    });
    api.addReminderDevice("bruno@example.com", "https://push.example/send/b");
    const user = userEvent.setup();
    const dialog = await openReminders(user);

    await user.click(
      await within(dialog).findByRole("button", {
        name: "Desativar em todos os dispositivos",
      })
    );
    expect(api.reminderDevicesOf(email)).toHaveLength(2);
    await user.click(
      await within(dialog).findByRole("button", { name: "Desativar em todos" })
    );

    expect(await within(dialog).findByText("Desativado")).toBeInTheDocument();
    expect(api.reminderDevicesOf(email)).toEqual([]);
    expect(api.reminderDevicesOf("bruno@example.com")).toEqual([
      "https://push.example/send/b",
    ]);
    expect(push.subscription()).toBeNull();
    expect(within(dialog).queryByText(/ativado em mais/i)).toBeNull();
  });

  it("keeps every device on when the confirmation is cancelled", async () => {
    fakePush();
    api.addReminderDevice(email, "https://push.example/send/laptop");
    const user = userEvent.setup();
    const dialog = await openReminders(user);

    await user.click(
      await within(dialog).findByRole("button", {
        name: "Desativar em todos os dispositivos",
      })
    );
    await user.click(
      await within(dialog).findByRole("button", { name: "Cancelar" })
    );

    expect(
      await within(dialog).findByText("Ativado em mais 1 dispositivo")
    ).toBeInTheDocument();
    expect(api.reminderDevicesOf(email)).toHaveLength(1);
  });
});
