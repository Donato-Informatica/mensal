import { act, render } from "@testing-library/react";
import { createApiClient } from "../src/api-client.ts";
import { App } from "../src/app.tsx";
import { createAuthClient } from "../src/auth-client.ts";
import type { FakeApi } from "./fake-api.ts";

/** Renders the whole app at `path`, talking to `api` instead of the network. */
export function openApp(api: FakeApi, path: string) {
  window.history.replaceState(null, "", path);
  render(
    <App
      authClient={createAuthClient(api.fetch)}
      api={createApiClient(api.fetch)}
    />
  );
}

/**
 * Gives the app time to take in what the fake API has answered, for a check
 * that nothing changes (there is nothing to wait for).
 */
export async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
}
