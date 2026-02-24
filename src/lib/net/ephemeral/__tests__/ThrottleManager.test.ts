// src/lib/net/ephemeral/__tests__/ThrottleManager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ThrottleManager } from "../ThrottleManager";

describe("ThrottleManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires immediately on first call", () => {
    const tm = new ThrottleManager();
    const fn = vi.fn();
    tm.throttle("key1", 100, fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throttles rapid calls to configured rate", () => {
    const tm = new ThrottleManager();
    const fn = vi.fn();

    // First call fires immediately
    tm.throttle("key1", 100, fn);
    expect(fn).toHaveBeenCalledTimes(1);

    // Rapid calls within window — should NOT fire immediately
    tm.throttle("key1", 100, fn);
    tm.throttle("key1", 100, fn);
    tm.throttle("key1", 100, fn);
    expect(fn).toHaveBeenCalledTimes(1);

    // After interval, trailing edge fires with latest payload
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2); // trailing edge
  });

  it("preserves latest payload on trailing edge", () => {
    const tm = new ThrottleManager();
    const calls: number[] = [];

    tm.throttle("k", 100, () => calls.push(1));
    tm.throttle("k", 100, () => calls.push(2));
    tm.throttle("k", 100, () => calls.push(3)); // latest

    vi.advanceTimersByTime(100);
    expect(calls).toEqual([1, 3]); // immediate + trailing (latest)
  });

  it("uses intervalMs 0 to fire every call immediately", () => {
    const tm = new ThrottleManager();
    const fn = vi.fn();

    tm.throttle("k", 0, fn);
    tm.throttle("k", 0, fn);
    tm.throttle("k", 0, fn);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("flushAll fires all pending payloads", () => {
    const tm = new ThrottleManager();
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    tm.throttle("a", 200, fn1); // fires immediately
    tm.throttle("b", 200, fn2); // fires immediately
    tm.throttle("a", 200, fn1); // pending
    tm.throttle("b", 200, fn2); // pending

    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);

    tm.flushAll();
    expect(fn1).toHaveBeenCalledTimes(2);
    expect(fn2).toHaveBeenCalledTimes(2);
  });

  it("dispose clears all timers and state", () => {
    const tm = new ThrottleManager();
    const fn = vi.fn();

    tm.throttle("k", 200, fn);
    tm.throttle("k", 200, fn); // pending

    tm.dispose();
    vi.advanceTimersByTime(300);

    // Only the initial immediate call
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
