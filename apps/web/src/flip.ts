import { useLayoutEffect, useRef } from "react";

const DURATION = 280;
// Exponential ease-out: lands quickly, settles softly.
const EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const SURFACE = "var(--mantine-color-dark-6)";

type Seen = { top: number; group: string };

/**
 * Glides the rows of the monthly list to their new places after a render: a
 * settled row crossing into "Liquidadas e puladas" travels there and its
 * neighbours close the gap, instead of everything jumping. Rows opt in with
 * `data-flip-id` and `data-flip-group`. Another month's rows are replaced,
 * not moved, so a new `scope` resets the memory.
 */
export function useFlip<T extends HTMLElement>(scope: string) {
  const ref = useRef<T>(null);
  const seen = useRef<{ scope: string; rows: Map<string, Seen> }>({
    scope,
    rows: new Map(),
  });

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const rows = [...root.querySelectorAll<HTMLElement>("[data-flip-id]")];
    // Rewind any glide still running so positions are the real ones.
    for (const row of rows) {
      for (const animation of row.getAnimations?.() ?? []) animation.cancel();
    }
    const before = seen.current.scope === scope ? seen.current.rows : null;
    const after = new Map<string, Seen>();
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    for (const row of rows) {
      const id = row.dataset.flipId ?? "";
      const group = row.dataset.flipGroup ?? "";
      const top = row.getBoundingClientRect().top + window.scrollY;
      after.set(id, { top, group });
      const was = before?.get(id);
      if (!was || reduceMotion || typeof row.animate !== "function") continue;
      const delta = was.top - top;
      if (Math.abs(delta) < 1) continue;
      const crossed = was.group !== group;
      const animation = row.animate(
        [
          { transform: `translateY(${delta}px)` },
          { transform: "translateY(0)" },
        ],
        { duration: DURATION, easing: EASING }
      );
      if (crossed) {
        // The traveller rides above its neighbours, opaque over the gaps.
        row.style.position = "relative";
        row.style.zIndex = "1";
        row.style.backgroundColor = SURFACE;
        const clear = () => {
          row.style.position = "";
          row.style.zIndex = "";
          row.style.backgroundColor = "";
        };
        animation.addEventListener("finish", clear);
        animation.addEventListener("cancel", clear);
      }
    }
    seen.current = { scope, rows: after };
  });

  return ref;
}
