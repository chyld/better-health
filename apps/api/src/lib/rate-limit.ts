import type { Clock } from "./clock";

/** Counts failures per key in a sliding window. In memory: one process serves the app. */
export class FailureLimiter {
  private failures = new Map<string, number[]>();

  constructor(
    private readonly clock: Clock,
    private readonly maxFailures = 5,
    private readonly windowMs = 60_000,
  ) {}

  private recent(key: string): number[] {
    const cutoff = this.clock.now().getTime() - this.windowMs;
    const kept = (this.failures.get(key) ?? []).filter((t) => t > cutoff);
    if (kept.length > 0) this.failures.set(key, kept);
    else this.failures.delete(key);
    return kept;
  }

  isBlocked(key: string): boolean {
    return this.recent(key).length >= this.maxFailures;
  }

  recordFailure(key: string): void {
    this.failures.set(key, [...this.recent(key), this.clock.now().getTime()]);
  }

  reset(key: string): void {
    this.failures.delete(key);
  }
}
