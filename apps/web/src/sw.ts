/// <reference lib="webworker" />
// The service worker (PRD §7.16, §8.4, ADR-0006): installable, online only.
// It precaches the built shell and nothing else, answers navigations to
// client routes with index.html, and shows reminders (ADR-0009). Built by
// vite-plugin-pwa (injectManifest) into sw.js; only the production build
// registers it. Type-checked on its own (tsconfig.sw.json), with the
// WebWorker lib instead of the DOM's.
import { clientsClaim } from "workbox-core";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { notAnsweredByShell } from "./pwa-navigation.ts";

declare const self: ServiceWorkerGlobalScope;

// A new version takes over at once, with no prompt and no reload: open tabs
// keep their shell, the next open gets the new one.
self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// /api and the guide (/guia) are never cached nor answered by the shell: a
// navigation to /api/docs or /guia/ goes to the network (and fails offline).
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: notAnsweredByShell,
  })
);

// Reminders (PRD §6.8, ADR-0009): the API pushes `{ title, body }`. One fixed
// tag, so a reminder replaces the previous one still on screen instead of
// stacking; no action buttons.
self.addEventListener("push", (event) => {
  const { title = "Mensal", body = "" } = readPush(event.data);
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: "mensal-reminder",
      icon: "/pwa-192x192.png",
    })
  );
});

// Tapping one focuses an open app window, or opens one, at the current
// period ("/").
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const open = windows.find(
        (client) => new URL(client.url).origin === self.location.origin
      );
      if (!open) {
        await self.clients.openWindow("/");
        return;
      }
      const focused = await open.focus();
      if (new URL(focused.url).pathname !== "/")
        await focused.navigate("/").catch(() => undefined);
    })()
  );
});

function readPush(data: PushMessageData | null): {
  title?: string;
  body?: string;
} {
  try {
    const parsed: unknown = data?.json();
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
