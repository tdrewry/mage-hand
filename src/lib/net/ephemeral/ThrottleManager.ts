// src/lib/net/ephemeral/ThrottleManager.ts
// Per-key throttle manager for ephemeral op emission.
// Keys are composite: `${opKind}::${entityKey}`.

/**
 * ThrottleManager enforces per-key send rate limits.
 *
 * For each unique key (e.g. "cursor.update::user42"), it ensures the
 * callback fires at most once per `intervalMs`. The most recent payload
 * is always preserved and sent on the trailing edge.
 */
export class ThrottleManager {
  private lastFired = new Map<string, number>();
  private pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private pendingPayloads = new Map<string, () => void>();

  /**
   * Attempt to fire `fn` for the given key, respecting the throttle interval.
   * If within the interval, `fn` is deferred and the latest call wins.
   */
  throttle(key: string, intervalMs: number, fn: () => void): void {
    // No throttle — fire immediately
    if (intervalMs <= 0) {
      fn();
      return;
    }

    const now = Date.now();
    const last = this.lastFired.get(key) ?? 0;
    const elapsed = now - last;

    if (elapsed >= intervalMs) {
      // Enough time has passed — fire immediately
      this.lastFired.set(key, now);
      fn();

      // Clear any pending trailing call
      const pending = this.pendingTimers.get(key);
      if (pending !== undefined) {
        clearTimeout(pending);
        this.pendingTimers.delete(key);
        this.pendingPayloads.delete(key);
      }
    } else {
      // Within throttle window — store latest and schedule trailing edge
      this.pendingPayloads.set(key, fn);

      if (!this.pendingTimers.has(key)) {
        const remaining = intervalMs - elapsed;
        const timer = setTimeout(() => {
          this.pendingTimers.delete(key);
          const latestFn = this.pendingPayloads.get(key);
          this.pendingPayloads.delete(key);
          if (latestFn) {
            this.lastFired.set(key, Date.now());
            latestFn();
          }
        }, remaining);
        this.pendingTimers.set(key, timer);
      }
    }
  }

  /** Flush a specific key's pending payload immediately. */
  flush(key: string): void {
    const timer = this.pendingTimers.get(key);
    if (timer !== undefined) clearTimeout(timer);
    this.pendingTimers.delete(key);

    const fn = this.pendingPayloads.get(key);
    this.pendingPayloads.delete(key);
    if (fn) {
      this.lastFired.set(key, Date.now());
      fn();
    }
  }

  /** Flush all pending payloads. */
  flushAll(): void {
    for (const key of [...this.pendingTimers.keys()]) {
      this.flush(key);
    }
  }

  /** Clean up all timers. */
  dispose(): void {
    for (const timer of this.pendingTimers.values()) clearTimeout(timer);
    this.pendingTimers.clear();
    this.pendingPayloads.clear();
    this.lastFired.clear();
  }
}
