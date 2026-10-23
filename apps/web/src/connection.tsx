import { Text } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { IconWifiOff } from "@tabler/icons-react";
import {
  useId,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import classes from "./connection.module.css";

/**
 * Where Mantine's portals (dialogs, menus, popovers) render (theme.ts): an
 * element inside the part of the app the connection lock covers, so the lock
 * covers them too (PRD §7.16).
 */
export const portalTargetId = "mensal-portals";

/** Calls `onChange` whenever the browser's connection signal changes. */
export function subscribeToConnection(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Whether the browser reports a connection: its signal only, never a failed request. */
export function useOnline() {
  return useSyncExternalStore(subscribeToConnection, () => navigator.onLine);
}

/**
 * The connection lock (PRD §7.16): while the browser is offline, the "Sem
 * conexão" banner over `children`, which stay on screen but inert, portals
 * included. React Query keeps its own online mode (app.tsx), so requests pause
 * offline and resume, and data is refetched, once the connection is back.
 *
 * What sticks to the top of the page sticks below the banner:
 * `--mensal-sticky-top` is the banner's height while it shows.
 */
export function ConnectionLock({ children }: { children: ReactNode }) {
  const online = useOnline();
  const messageId = useId();
  const { ref, height } = useElementSize<HTMLDivElement>();
  return (
    <>
      {online ? null : (
        <div
          ref={ref}
          role="status"
          aria-labelledby={messageId}
          className={classes.banner}
        >
          {/* Padded inside, so the measured content box is the whole banner. */}
          <div className={classes.content}>
            <IconWifiOff size={18} aria-hidden />
            <Text id={messageId} fz="sm" fw={600} c="inherit">
              Sem conexão. O Mensal volta a funcionar quando a conexão voltar.
            </Text>
          </div>
        </div>
      )}
      <div
        inert={!online}
        style={
          {
            "--mensal-sticky-top": online ? "0px" : `${height}px`,
          } as CSSProperties
        }
      >
        {children}
        <div id={portalTargetId} />
      </div>
    </>
  );
}
