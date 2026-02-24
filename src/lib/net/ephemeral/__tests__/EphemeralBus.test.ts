// src/lib/net/ephemeral/__tests__/EphemeralBus.test.ts
// Tests for: broadcast, echo prevention, TTL expiry cleanup, late-join non-replay,
// and no durable log pollution.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EphemeralBus } from "../EphemeralBus";

// Mock the multiplayerStore to control currentUserId
vi.mock("@/stores/multiplayerStore", () => ({
  useMultiplayerStore: {
    getState: () => ({
      currentUserId: "local-user",
      roles: ["dm"],
    }),
  },
}));

describe("EphemeralBus", () => {
  let bus: EphemeralBus;

  beforeEach(() => {
    vi.useFakeTimers();
    bus = new EphemeralBus();
  });

  afterEach(() => {
    bus.dispose();
    vi.useRealTimers();
  });

  // ── Test 1: Ephemeral broadcast ──
  it("receives ephemeral event and dispatches to handler", () => {
    const handler = vi.fn();
    bus.on("cursor.update", handler);

    bus.receive("cursor.update", { pos: { x: 10, y: 20 } }, "remote-user");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      { pos: { x: 10, y: 20 } },
      "remote-user"
    );
  });

  it("stores received event in TTL cache", () => {
    bus.receive("cursor.update", { pos: { x: 5, y: 5 } }, "remote-user");

    const cached = bus.cache.get("cursor.update::remote-user");
    expect(cached).toBeDefined();
    expect(cached!.data.kind).toBe("cursor.update");
    expect(cached!.userId).toBe("remote-user");
  });

  // ── Test 2: Echo prevention ──
  it("skips events from the local user (echo prevention)", () => {
    const handler = vi.fn();
    bus.on("cursor.update", handler);

    bus.receive("cursor.update", { pos: { x: 1, y: 1 } }, "local-user");

    expect(handler).not.toHaveBeenCalled();
    expect(bus.cache.get("cursor.update::local-user")).toBeUndefined();
  });

  // ── Test 3: TTL expiry ──
  it("expires cached events after TTL", () => {
    const cacheChanges: Array<[string, unknown]> = [];
    bus.onCacheChange((key, entry) => cacheChanges.push([key, entry]));

    bus.receive("token.hover", { tokenId: "t1" }, "remote-user");
    expect(bus.cache.get("token.hover::remote-user")).toBeDefined();

    // token.hover TTL = 500ms
    vi.advanceTimersByTime(600);

    expect(bus.cache.get("token.hover::remote-user")).toBeUndefined();
    // Should have onChange with null (removal)
    const removal = cacheChanges.find(([key, entry]) => key === "token.hover::remote-user" && entry === null);
    expect(removal).toBeDefined();
  });

  // ── Test 4: Late-join non-replay ──
  it("does not replay cached state to late-joining handlers", () => {
    // Receive event BEFORE handler is registered
    bus.receive("cursor.update", { pos: { x: 99, y: 99 } }, "remote-user");

    // Register handler AFTER the event
    const handler = vi.fn();
    bus.on("cursor.update", handler);

    // Handler should NOT have been called with the old event
    expect(handler).not.toHaveBeenCalled();

    // But cache still has the data (for overlay rendering)
    expect(bus.cache.get("cursor.update::remote-user")).toBeDefined();
  });

  // ── Test 5: No durable log pollution ──
  it("emits via sendFn but does not touch durable op mechanisms", () => {
    const sendFn = vi.fn();
    bus.setSendFn(sendFn);

    bus.emit("cursor.update", { pos: { x: 1, y: 2 } });

    expect(sendFn).toHaveBeenCalledTimes(1);
    const sentOp = sendFn.mock.calls[0][0];
    expect(sentOp.kind).toBe("cursor.update");
    // The op should be a plain EngineOp, NOT have sequence numbers or durable metadata
    expect(sentOp.seq).toBeUndefined();
    expect(sentOp.ack).toBeUndefined();
    expect(sentOp.durable).toBeUndefined();
  });

  // ── Test 6: DM-only gating ──
  it("blocks non-DM from emitting DM-only ops", async () => {
    // Re-mock with player role
    const { useMultiplayerStore } = await import("@/stores/multiplayerStore");
    const original = useMultiplayerStore.getState;
    (useMultiplayerStore as any).getState = () => ({
      currentUserId: "player1",
      roles: ["player"],
    });

    const sendFn = vi.fn();
    bus.setSendFn(sendFn);

    bus.emit("map.dm.viewport", { x: 0, y: 0, zoom: 1 });
    expect(sendFn).not.toHaveBeenCalled();

    // Restore
    (useMultiplayerStore as any).getState = original;
  });

  // ── Test 7: Throttle integration ──
  it("throttles outbound emissions per op config", () => {
    const sendFn = vi.fn();
    bus.setSendFn(sendFn);

    // cursor.update has 67ms throttle
    bus.emit("cursor.update", { pos: { x: 1, y: 1 } });
    bus.emit("cursor.update", { pos: { x: 2, y: 2 } });
    bus.emit("cursor.update", { pos: { x: 3, y: 3 } });

    // Only first should fire immediately
    expect(sendFn).toHaveBeenCalledTimes(1);

    // After throttle interval, trailing edge fires
    vi.advanceTimersByTime(70);
    expect(sendFn).toHaveBeenCalledTimes(2);

    // Verify latest payload was sent
    const lastPayload = sendFn.mock.calls[1][0];
    expect(lastPayload.data.pos).toEqual({ x: 3, y: 3 });
  });

  // ── Test 8: Multiple cache change listeners ──
  it("supports multiple onCacheChange listeners", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    bus.onCacheChange(listener1);
    bus.onCacheChange(listener2);

    bus.receive("cursor.update", { pos: { x: 1, y: 1 } }, "remote-user");

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe removes listener", () => {
    const listener = vi.fn();
    const unsub = bus.onCacheChange(listener);

    bus.receive("cursor.update", { pos: { x: 1, y: 1 } }, "remote-user");
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    bus.receive("token.hover", { tokenId: "t2" }, "remote-user");
    expect(listener).toHaveBeenCalledTimes(1); // not called again
  });
});
