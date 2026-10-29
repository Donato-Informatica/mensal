import type { ApiClient } from "./api-client.ts";
import { currentPushRegistration, pushSupported } from "./browser-push.ts";

/**
 * What signing in and out do to this browser's reminders (PRD §8.2, §6.8).
 * Neither ever stands in the way of the sign-in or sign-out itself.
 */

/**
 * Before signing out: turns reminders off for this device (`DELETE /device`)
 * and drops the browser's registration. The registration is dropped even when
 * the server refuses, as it does an unapproved user, so its endpoint dies and
 * the daily job drops the device on the push service's answer.
 */
export async function forgetThisDevice(api: ApiClient): Promise<void> {
  const registration = await thisRegistration();
  if (!registration) return;
  await api.turnReminderDeviceOff(registration.endpoint).catch(() => {});
  await registration.unsubscribe().catch(() => false);
}

/**
 * After signing in: checks the browser's registration (`POST /device/check`)
 * and drops one the server says belongs to someone else; the user's own is
 * bound to the new session by the server.
 */
export async function checkThisDevice(api: ApiClient): Promise<void> {
  const registration = await thisRegistration();
  if (!registration) return;
  try {
    const { mine } = await api.checkReminderDevice(registration.endpoint);
    if (!mine) await registration.unsubscribe();
  } catch {
    // Checked again whenever the Lembretes screen opens.
  }
}

async function thisRegistration(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  return currentPushRegistration().catch(() => null);
}
