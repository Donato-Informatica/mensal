import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "dayjs/locale/pt-br";
import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useState } from "react";
import type { ApiClient } from "./api-client.ts";
import type { AuthClient } from "./auth-client.ts";
import { colorSchemeCache } from "./color-scheme.ts";
import { createAppRouter } from "./router.tsx";
import { cssVariablesResolver, theme } from "./theme.ts";

export function App({
  authClient,
  api,
}: {
  authClient: AuthClient;
  api: ApiClient;
}) {
  const [queryClient] = useState(() => new QueryClient());
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
          <RouterProvider router={router} />
        </QueryClientProvider>
      </DatesProvider>
    </MantineProvider>
  );
}
