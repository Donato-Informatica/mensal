import "@fontsource-variable/inter";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.tsx";
import { createAuthClient } from "./auth-client.ts";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App authClient={createAuthClient()} />
  </StrictMode>
);
