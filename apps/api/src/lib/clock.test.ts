import { expect, test } from "bun:test";
import { DAY_MS, fixedClock } from "./clock";

test("fixedClock only moves when told to", () => {
  const clock = fixedClock("2026-10-02T00:00:00.000Z");
  expect(clock.now().toISOString()).toBe("2026-10-02T00:00:00.000Z");
  clock.advance(DAY_MS);
  expect(clock.now().toISOString()).toBe("2026-10-03T00:00:00.000Z");
  clock.set("2027-01-01T00:00:00.000Z");
  expect(clock.now().toISOString()).toBe("2027-01-01T00:00:00.000Z");
});

test("fixedClock returns copies callers cannot mutate", () => {
  const clock = fixedClock("2026-10-02T00:00:00.000Z");
  clock.now().setFullYear(1999);
  expect(clock.now().getUTCFullYear()).toBe(2026);
});
