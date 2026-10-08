export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** A clock that starts at `start` and then moves with real time. */
export function shiftedClock(start: Date | string): Clock {
  const offset = new Date(start).getTime() - Date.now();
  return { now: () => new Date(Date.now() + offset) };
}

/** A clock for tests that only moves when told to. */
export function fixedClock(start: Date | string) {
  let current = new Date(start);
  return {
    now: () => new Date(current),
    set(to: Date | string) {
      current = new Date(to);
    },
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}

export const DAY_MS = 24 * 60 * 60 * 1000;
