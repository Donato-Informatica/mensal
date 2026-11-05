import type { CSSProperties } from "react";
import { useSession } from "./session.ts";
import classes from "./snow.module.css";

/**
 * Whether `date`, on the device's own calendar, falls in the holiday season
 * of the Snow preference (PRD §3.5, §7): 3 November through 5 January.
 */
export function inSnowSeason(date: Date): boolean {
  const month = date.getMonth();
  const day = date.getDate();
  return (
    (month === 10 && day >= 3) || month === 11 || (month === 0 && day <= 5)
  );
}

const flakes = Array.from({ length: 36 }, (_, i) => i);

/**
 * Falling snow over the signed-in app, in the holiday season, unless the user
 * turned the Snow preference off (PRD §7). Pure decoration: it takes no
 * clicks, is hidden from assistive technology, and CSS leaves it out when the
 * device asks for reduced motion.
 */
export function Snow() {
  const { snow } = useSession().user;
  if (!snow || !inSnowSeason(new Date())) return null;
  return (
    <div className={classes.snow} aria-hidden="true" data-testid="snow">
      {flakes.map((i) => (
        <span
          key={i}
          className={classes.flake}
          // Spread by fixed steps, so every render falls the same way.
          style={
            {
              "--x": `${(i * 37) % 100}vw`,
              "--size": `${3 + (i % 4)}px`,
              "--duration": `${9 + ((i * 7) % 9)}s`,
              "--delay": `${-((i * 13) % 17)}s`,
              "--drift": `${((i % 5) - 2) * 15}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
