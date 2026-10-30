/**
 * Navigations the service worker never answers with the app shell (PRD §8.4,
 * ADR-0006): they go to the network, and fail offline. /api is the API (and
 * its /api/docs); /guia is the static guide (PRD §7.17), which nginx serves
 * apart from the app and the service worker does not precache. Free of the
 * app and the DOM so the worker (sw.ts) can import it.
 */
export const notAnsweredByShell = [/^\/api(\/|$)/, /^\/guia(\/|$)/];
