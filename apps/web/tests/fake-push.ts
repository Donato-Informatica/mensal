import { onTestFinished } from "vitest";

/**
 * The browser's push service is network, so tests fake it (AGENTS.md): this
 * stands in for the Push API the app reaches through `navigator.serviceWorker`
 * (a registration's `PushManager`) and for `Notification`'s permission.
 *
 * Installed per test, and removed when that test finishes. It models the
 * browsers of PRD §7.19: one that supports push (the default), one whose
 * permission was denied (`permission: "denied"`, which `requestPermission`
 * then keeps, or `answer: "denied"` for a user who refuses the prompt), and
 * one with no Push API at all (`supported: false`, which installs nothing).
 * `userAgent` stands in for the browser's own, e.g. Safari on an iPhone.
 */
export function fakePush({
  permission: initialPermission = "default",
  answer = "granted",
  subscribed,
  supported = true,
  userAgent,
}: {
  /** `Notification.permission` before the app asks. */
  permission?: NotificationPermission;
  /** What the user answers when the browser asks for permission. */
  answer?: "granted" | "denied";
  /** An endpoint this browser is already registered with, from before. */
  subscribed?: string;
  /** False for a browser without the Push API. */
  supported?: boolean;
  /** `navigator.userAgent`, when it matters which browser this is. */
  userAgent?: string;
} = {}) {
  if (userAgent !== undefined) {
    const previousAgent = Object.getOwnPropertyDescriptor(
      navigator,
      "userAgent"
    );
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: userAgent,
    });
    onTestFinished(() => {
      if (previousAgent)
        Object.defineProperty(navigator, "userAgent", previousAgent);
      else Reflect.deleteProperty(navigator, "userAgent");
    });
  }
  let permission = initialPermission;
  let subscription: FakeSubscription | null = subscribed
    ? newSubscription(subscribed, undefined)
    : null;
  let made = 0;

  function newSubscription(
    endpoint: string,
    applicationServerKey: ArrayBuffer | undefined
  ): FakeSubscription {
    const keys = { p256dh: `p256dh-${endpoint}`, auth: `auth-${endpoint}` };
    const created: FakeSubscription = {
      endpoint,
      expirationTime: null,
      applicationServerKey,
      toJSON: () => ({ endpoint, expirationTime: null, keys }),
      unsubscribe: async () => {
        if (subscription === created) subscription = null;
        return true;
      },
    };
    return created;
  }

  const pushManager = {
    getSubscription: async () => subscription,
    subscribe: async ({
      applicationServerKey,
    }: {
      userVisibleOnly: boolean;
      applicationServerKey: BufferSource;
    }) => {
      if (permission !== "granted")
        throw new DOMException("Permission denied", "NotAllowedError");
      if (!subscription) {
        made += 1;
        subscription = newSubscription(
          `https://push.example/send/device-${made}`,
          toArrayBuffer(applicationServerKey)
        );
      }
      return subscription;
    },
  };
  const registration = { pushManager };

  class FakeNotification {
    static get permission() {
      return permission;
    }
    static async requestPermission(): Promise<NotificationPermission> {
      if (permission === "default") permission = answer;
      return permission;
    }
  }

  const fake = {
    /** The browser's own registration, or null when it has none. */
    subscription: () => subscription,
    /** What `Notification.permission` reads now. */
    permission: () => permission,
  };
  if (!supported) return fake;

  const previous = {
    serviceWorker: Object.getOwnPropertyDescriptor(navigator, "serviceWorker"),
    PushManager: Object.getOwnPropertyDescriptor(window, "PushManager"),
    Notification: Object.getOwnPropertyDescriptor(window, "Notification"),
  };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve(registration),
      getRegistration: async () => registration,
    },
  });
  Object.defineProperty(window, "PushManager", {
    configurable: true,
    value: class PushManager {},
  });
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: FakeNotification,
  });
  onTestFinished(() => {
    for (const [target, name, descriptor] of [
      [navigator, "serviceWorker", previous.serviceWorker],
      [window, "PushManager", previous.PushManager],
      [window, "Notification", previous.Notification],
    ] as const) {
      if (descriptor) Object.defineProperty(target, name, descriptor);
      else Reflect.deleteProperty(target, name);
    }
  });

  return fake;
}

export type FakePush = ReturnType<typeof fakePush>;

interface FakeSubscription {
  endpoint: string;
  expirationTime: null;
  /** The VAPID public key the app registered with, as bytes. */
  applicationServerKey: ArrayBuffer | undefined;
  toJSON(): {
    endpoint: string;
    expirationTime: null;
    keys: { p256dh: string; auth: string };
  };
  unsubscribe(): Promise<boolean>;
}

function toArrayBuffer(source: BufferSource): ArrayBuffer {
  const bytes = ArrayBuffer.isView(source)
    ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
    : new Uint8Array(source);
  return bytes.slice().buffer;
}
