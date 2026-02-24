// src/lib/net/ephemeral/__tests__/TTLCache.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TTLCache } from "../TTLCache";

describe("TTLCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and retrieves an entry", () => {
    const cache = new TTLCache();
    cache.set("k1", { value: 42 }, "user1", 1000);
    const entry = cache.get("k1");
    expect(entry).toBeDefined();
    expect(entry!.data).toEqual({ value: 42 });
    expect(entry!.userId).toBe("user1");
  });

  it("expires entries after TTL", () => {
    const onChange = vi.fn();
    const cache = new TTLCache({ onChange });

    cache.set("k1", "hello", "u1", 500);
    expect(cache.get("k1")).toBeDefined();

    // Advance time past TTL
    vi.advanceTimersByTime(600);

    expect(cache.get("k1")).toBeUndefined();
    // onChange should have been called with null for removal
    expect(onChange).toHaveBeenCalledWith("k1", null);
  });

  it("overwrites existing entry and resets TTL", () => {
    const cache = new TTLCache();
    cache.set("k1", "v1", "u1", 500);

    vi.advanceTimersByTime(400);
    // Overwrite before expiry
    cache.set("k1", "v2", "u1", 500);

    vi.advanceTimersByTime(400);
    // Should still exist (new TTL started at 400ms mark)
    const entry = cache.get("k1");
    expect(entry).toBeDefined();
    expect(entry!.data).toBe("v2");

    vi.advanceTimersByTime(200);
    // Now past new TTL
    expect(cache.get("k1")).toBeUndefined();
  });

  it("fires onChange on set and delete", () => {
    const onChange = vi.fn();
    const cache = new TTLCache({ onChange });

    cache.set("k1", "data", "u1", 1000);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toBe("k1");
    expect(onChange.mock.calls[0][1]).not.toBeNull();

    cache.delete("k1");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1]).toEqual(["k1", null]);
  });

  it("clear() removes all entries and fires onChange for each", () => {
    const onChange = vi.fn();
    const cache = new TTLCache({ onChange });

    cache.set("a", 1, "u1", 5000);
    cache.set("b", 2, "u2", 5000);
    onChange.mockClear();

    cache.clear();
    expect(cache.size).toBe(0);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("entries with ttlMs <= 0 never expire", () => {
    const cache = new TTLCache();
    cache.set("permanent", "data", "u1", 0);

    vi.advanceTimersByTime(999999);
    expect(cache.get("permanent")).toBeDefined();
  });
});
