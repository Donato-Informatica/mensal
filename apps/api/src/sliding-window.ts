/**
 * Counts what happened lately, per key: at most `max` times in the last
 * `windowMs`, on the injected clock. In memory, as the app runs as one
 * container.
 */
export interface SlidingWindow {
  /** Whether `key` has already happened `max` times within the window. */
  isFull(key: string): boolean;
  /** Counts one more time for `key`, now. */
  add(key: string): void;
}

export function slidingWindow({
  max,
  windowMs,
  now,
}: {
  max: number;
  windowMs: number;
  now: () => Date;
}): SlidingWindow {
  /** When each key happened lately (epoch ms). */
  const times = new Map<string, number[]>();

  /** The key's times still inside the window; forgets the key when none. */
  function recent(key: string): number[] {
    const since = now().getTime() - windowMs;
    const kept = (times.get(key) ?? []).filter((at) => at > since);
    if (kept.length > 0) times.set(key, kept);
    else times.delete(key);
    return kept;
  }

  return {
    isFull: (key) => recent(key).length >= max,
    add: (key) => {
      times.set(key, [...recent(key), now().getTime()]);
    },
  };
}
