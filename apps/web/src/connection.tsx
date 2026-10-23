import { Text } from "@mantine/core";
import { IconWifiOff } from "@tabler/icons-react";
import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore, type ReactNode } from "react";
import classes from "./connection.module.css";
import { portalTargetId } from "./theme.ts";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Whether the browser reports a connection: its signal only, never a failed request. */
function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine);
}

// React Query reads the same signal. On its own it assumes a connection until
// the first `offline` event, so an app opened offline would fail its requests
// instead of waiting on its loading state for the connection.
onlineManager.setEventListener((setOnline) => {
  setOnline(navigator.onLine);
  return subscribe(() => setOnline(navigator.onLine));
});

/**
 * The connection lock (PRD §7.16): while the browser is offline, the "Sem
 * conexão" banner over `children`, which stay on screen but inert, portals
 * included. React Query keeps its own online mode, so requests pause offline
 * and resume, and data is refetched, once the connection is back.
 */
export function ConnectionLock({ children }: { children: ReactNode }) {
  const online = useOnline();
  return (
    <>
      {online ? null : (
        <div role="status" className={classes.banner}>
          <IconWifiOff size={18} aria-hidden />
          <Text fz="sm" fw={600} c="inherit">
            Sem conexão. O Mensal volta a funcionar quando a conexão voltar.
          </Text>
        </div>
      )}
      <div inert={!online}>
        {children}
        <div id={portalTargetId} />
      </div>
    </>
  );
}
