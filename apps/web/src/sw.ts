/// <reference lib="webworker" />
// The service worker (PRD §7.16, §8.4, ADR-0006): installable, online only.
// It precaches the built shell and nothing else, and answers navigations to
// client routes with index.html. Built by vite-plugin-pwa (injectManifest)
// into sw.js; only the production build registers it. Type-checked on its own
// (tsconfig.sw.json), with the WebWorker lib instead of the DOM's.
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
