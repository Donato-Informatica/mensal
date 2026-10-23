import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/charts/styles.css";
import "dayjs/locale/pt-br";
import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useState } from "react";
import type { ApiClient } from "./api-client.ts";
import type { AuthClient } from "./auth-client.ts";
import { colorSchemeCache } from "./color-scheme.ts";
import { ConnectionLock, subscribeToConnection } from "./connection.tsx";
import { createAppRouter } from "./router.tsx";
import { cssVariablesResolver, theme } from "./theme.ts";

/**
 * React Query in step with the connection lock (PRD §7.16): requests pause
 * while the browser is offline and resume once it's back.
 */
function createQueryClient() {
  // On its own, React Query assumes a connection until the first `offline`
  // event, so an app opened offline would fail its requests instead of
  // waiting on its loading state for the connection.
  onlineManager.setEventListener((setOnline) => {
    setOnline(navigator.onLine);
    return subscribeToConnection(() => setOnline(navigator.onLine));
  });
  return new QueryClient({
    defaultOptions: {
      mutations: {
        // A save that fails as the connection drops is sent again once it's
        // back: the retry waits while offline. Online, a failure is final.
        retry: () => !onlineManager.isOnline(),
        retryDelay: 0,
      },
    },
  });
}

export function App({
  authClient,
  api,
}: {
  authClient: AuthClient;
  api: ApiClient;
}) {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(() =>
    createAppRouter({ authClient, api, queryClient })
  );
  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      // Until the account's own theme is known, the device's last one, or
      // Escuro without one (PRD §3.5).
      colorSchemeManager={colorSchemeCache}
      defaultColorScheme="dark"
    >
      <DatesProvider settings={{ locale: "pt-br" }}>
        <QueryClientProvider client={queryClient}>
          <ConnectionLock>
            <RouterProvider router={router} />
          </ConnectionLock>
        </QueryClientProvider>
      </DatesProvider>
    </MantineProvider>
  );
}
