import type { ReminderDevice } from "@mensal/shared";

/**
 * This browser's push registration (PRD §6.8), through the service worker's
 * `PushManager`. Only the production build registers the service worker
 * (§7.16), so in development there is never a registration to read or make.
 */

/** The browser's own registration, or null when it has none. */
export async function currentPushRegistration(): Promise<PushSubscription | null> {
  const worker = await navigator.serviceWorker.getRegistration();
  return (await worker?.pushManager.getSubscription()) ?? null;
}

/**
 * Asks for permission to notify, then registers this browser with the
 * server's VAPID public key; the registration, as the API takes it.
 */
export async function registerForPush(
  publicKey: string
): Promise<ReminderDevice> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(`Notifications ${permission}`);
  const worker = await navigator.serviceWorker.getRegistration();
  if (!worker) throw new Error("No service worker to receive pushes");
  const subscription = await worker.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: fromBase64url(publicKey),
  });
  return asDevice(subscription);
}

/** A registration as `PUT /reminders/device` takes it. */
function asDevice(subscription: PushSubscription): ReminderDevice {
  const { endpoint, keys } = subscription.toJSON();
  return {
    endpoint: endpoint ?? subscription.endpoint,
    keys: { p256dh: keys?.p256dh ?? "", auth: keys?.auth ?? "" },
  };
}

/** The bytes of a base64url string, as `applicationServerKey` takes them. */
function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
