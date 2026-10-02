import { describe, expect, test } from "bun:test";
import { fixedClock } from "./clock";
import { FailureLimiter } from "./rate-limit";

const setup = () => {
  const clock = fixedClock("2026-10-02T12:00:00.000Z");
  return { clock, limiter: new FailureLimiter(clock, 5, 60_000) };
};

describe("FailureLimiter", () => {
  test("blocks on the 5th failure within the window", () => {
    const { limiter } = setup();
    for (let i = 0; i < 4; i++) limiter.recordFailure("alice");
    expect(limiter.isBlocked("alice")).toBe(false);
    limiter.recordFailure("alice");
    expect(limiter.isBlocked("alice")).toBe(true);
  });

  test("keys are independent", () => {
    const { limiter } = setup();
    for (let i = 0; i < 5; i++) limiter.recordFailure("alice");
    expect(limiter.isBlocked("bob")).toBe(false);
  });

  test("old failures fall out of the sliding window", () => {
    const { clock, limiter } = setup();
    for (let i = 0; i < 3; i++) limiter.recordFailure("alice");
    clock.advance(30_000);
    for (let i = 0; i < 2; i++) limiter.recordFailure("alice");
    expect(limiter.isBlocked("alice")).toBe(true);
    clock.advance(30_001);
    expect(limiter.isBlocked("alice")).toBe(false);
  });

  test("reset clears a key", () => {
    const { limiter } = setup();
    for (let i = 0; i < 5; i++) limiter.recordFailure("alice");
    limiter.reset("alice");
    expect(limiter.isBlocked("alice")).toBe(false);
  });
});
