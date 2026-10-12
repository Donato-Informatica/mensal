import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useState } from "react";
import type { AuthClient } from "./auth-client.ts";
import { createAppRouter } from "./router.tsx";
import { theme } from "./theme.ts";

export function App({ authClient }: { authClient: AuthClient }) {
  const [queryClient] = useState(() => new QueryClient());
  const [router] = useState(() => createAppRouter({ authClient, queryClient }));
  return (
    <MantineProvider theme={theme} forceColorScheme="dark">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MantineProvider>
  );
}
