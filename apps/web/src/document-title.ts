import { useEffect } from "react";

const appName = "Mensal";

/** Titles the browser tab `Mensal | <screen>`, back to plain `Mensal` on leaving. */
export function useDocumentTitle(screen: string) {
  useEffect(() => {
    document.title = `${appName} | ${screen}`;
    return () => {
      document.title = appName;
    };
  }, [screen]);
}
