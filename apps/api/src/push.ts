import webPush from "web-push";
import type { Vapid } from "./config.ts";

/**
 * A browser's push registration (PRD §6.8), as its `PushManager` hands it
 * out. The endpoint is a capability URL: it is never logged or exported.
 */
export interface PushDevice {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * What a reminder device shows (pt-BR): the service worker puts `title` and
 * `body` on a notification. Never amounts or notes: the lock screen shows it.
 */
export interface PushMessage {
  title: string;
  body: string;
}

/**
 * Where pushes go: a real push service by default, a capturing sink in tests.
 * Rejects when the push service refused the message; the error never carries
 * the endpoint.
 */
export type SendPush = (
  device: PushDevice,
  message: PushMessage
) => Promise<void>;

/**
 * Sends through the device's push service, encrypted to it (RFC 8291) and
 * signed with the server's VAPID keys (PRD §8.4).
 */
export function webPushSender(vapid: Vapid): SendPush {
  return async (device, message) => {
    try {
      await webPush.sendNotification(device, JSON.stringify(message), {
        vapidDetails: vapid,
        TTL: 60 * 60 * 24,
      });
    } catch (error) {
      // web-push's errors can name the endpoint, a capability URL that must
      // never reach a log (PRD §8.7.2), so they are not kept as the cause.
      if (error instanceof webPush.WebPushError)
        throw new PushRefused(error.statusCode);
      // eslint-disable-next-line preserve-caught-error -- see above
      throw new Error("Push failed to reach the push service");
    }
  };
}

/** A push service's refusal, by its HTTP status (404 and 410: gone). */
export class PushRefused extends Error {
  readonly statusCode: number;
  constructor(statusCode: number) {
    super(`Push service answered ${statusCode}`);
    this.statusCode = statusCode;
  }
}
