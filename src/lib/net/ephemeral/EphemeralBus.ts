// src/lib/net/ephemeral/EphemeralBus.ts
// Central hub for publishing and receiving ephemeral events.
// Combines ThrottleManager (outbound) + TTLCache (inbound) + handler registry.

import type { EngineOp, UserId } from "../../../../networking/contract/v1";
import type { EphemeralOpKind, EphemeralPayloadMap, EphemeralOpConfig } from "./types";
import { EPHEMERAL_OP_CONFIG } from "./types";
import { TTLCache, type TTLEntry } from "./TTLCache";
import { ThrottleManager } from "./ThrottleManager";
import { useMultiplayerStore } from "@/stores/multiplayerStore";

// ── Types ───────────────────────────────────────────────────────

export type EphemeralHandler<K extends EphemeralOpKind = EphemeralOpKind> = (
  data: EphemeralPayloadMap[K],
  userId: UserId,
) => void;

export interface EphemeralEvent {
  kind: EphemeralOpKind;
  data: unknown;
  userId: UserId;
  ts: number;
}

// ── Helpers ─────────────────────────────────────────────────────

const EPHEMERAL_OP_KINDS = new Set<string>(Object.keys(EPHEMERAL_OP_CONFIG));

/** Check if an EngineOp kind is ephemeral. */
export function isEphemeralOp(kind: string): kind is EphemeralOpKind {
  return EPHEMERAL_OP_KINDS.has(kind);
}

/**
 * Build the deduplication / TTL cache key for an event.
 * Strategy is defined per op kind in EPHEMERAL_OP_CONFIG.
 */
function buildCacheKey(kind: EphemeralOpKind, userId: UserId, data: unknown, config: EphemeralOpConfig): string {
  switch (config.keyStrategy) {
    case "userId":
      return `${kind}::${userId}`;
    case "entityId": {
      // Try to extract an entity id from common payload fields
      const d = data as Record<string, unknown> | null;
      const entityId = d?.tokenId ?? d?.regionId ?? d?.objectId ?? d?.groupId ?? d?.assetId ?? "unknown";
      return `${kind}::${String(entityId)}`;
    }
    case "session":
      return `${kind}::session`;
    case "none":
    default:
      return `${kind}::${userId}::${Date.now()}`;
  }
}

// ── EphemeralBus ────────────────────────────────────────────────

export class EphemeralBus {
  /** Inbound TTL cache — stores latest ephemeral state for rendering overlays. */
  readonly cache: TTLCache<EphemeralEvent>;

  /** Outbound throttle manager. */
  private throttle = new ThrottleManager();

  /** Per-kind handler registry. */
  private handlers = new Map<string, EphemeralHandler<any>>();

  /** Reference to the network send function (set after construction). */
  private _sendFn?: (op: EngineOp) => void;

  /** Callbacks fired whenever the cache changes (for driving reactive stores). */
  private _cacheChangeListeners: Array<(key: string, entry: TTLEntry<EphemeralEvent> | null) => void> = [];

  constructor() {
    this.cache = new TTLCache<EphemeralEvent>({
      onChange: (key, entry) => {
        for (const fn of this._cacheChangeListeners) fn(key, entry);
      },
    });
  }

  // ── Configuration ───────────────────────────────────────────

  /** Wire the outbound send function (called by NetManager/index after construction). */
  setSendFn(fn: (op: EngineOp) => void): void {
    this._sendFn = fn;
  }

  /** Add a callback for cache changes (for reactive overlay stores). Returns unsubscribe fn. */
  onCacheChange(fn: (key: string, entry: TTLEntry<EphemeralEvent> | null) => void): () => void {
    this._cacheChangeListeners.push(fn);
    return () => {
      this._cacheChangeListeners = this._cacheChangeListeners.filter((l) => l !== fn);
    };
  }

  // ── Handler Registry ────────────────────────────────────────

  /** Register a handler for an ephemeral op kind. */
  on<K extends EphemeralOpKind>(kind: K, handler: EphemeralHandler<K>): () => void {
    this.handlers.set(kind, handler);
    return () => { this.handlers.delete(kind); };
  }

  // ── Outbound (local → network) ─────────────────────────────

  /**
   * Emit an ephemeral op to the network.
   * Applies throttling per the op's config. DM-only ops are gated client-side.
   */
  emit<K extends EphemeralOpKind>(kind: K, data: EphemeralPayloadMap[K]): void {
    const config = EPHEMERAL_OP_CONFIG[kind];
    if (!config) {
      console.warn(`[EphemeralBus] Unknown ephemeral op kind: ${kind}`);
      return;
    }

    // Skip ephemeral broadcasts during Jazz inbound hydration —
    // store side-effects (e.g. actionStore.broadcastActionQueue) fire during
    // blob pull, but the player shouldn't re-broadcast DM state they just received.
    try {
      const { isFromJazz } = require('@/lib/jazz/bridge');
      if (isFromJazz()) return;
    } catch { /* bridge not loaded — continue normally */ }

    // DM-only gate (client-side check)
    if (config.dmOnly) {
      const roles = useMultiplayerStore.getState().roles;
      if (!roles.includes("dm")) {
        console.warn(`[EphemeralBus] DM-only op "${kind}" blocked — user roles:`, roles);
        return;
      }
    }

    if (!this._sendFn) {
      console.warn(`[EphemeralBus] sendFn not wired — ephemeral op dropped: ${kind}`);
      return;
    }

    const userId = useMultiplayerStore.getState().currentUserId ?? "local";
    const cacheKey = buildCacheKey(kind, userId, data, config);

    this.throttle.throttle(cacheKey, config.throttleMs, () => {
      const op: EngineOp = { kind, data };
      this._sendFn!(op);
    });
  }

  // ── Inbound (network → local) ──────────────────────────────

  /**
   * Receive an ephemeral event from the network.
   * Stores in TTL cache and dispatches to registered handler.
   * Skips events from the local user (echo prevention).
   */
  receive(kind: EphemeralOpKind, data: unknown, userId: UserId): void {
    // Echo prevention: skip our own ephemeral events
    const localUserId = useMultiplayerStore.getState().currentUserId;
    if (userId === localUserId) return;

    const config = EPHEMERAL_OP_CONFIG[kind];
    if (!config) {
      console.warn(`[EphemeralBus] Unknown inbound ephemeral kind: ${kind}`);
      return;
    }

    const event: EphemeralEvent = { kind, data, userId, ts: Date.now() };
    const cacheKey = buildCacheKey(kind, userId, data, config);

    // Store in TTL cache (auto-expires)
    this.cache.set(cacheKey, event, userId, config.ttlMs);

    // Dispatch to handler
    const handler = this.handlers.get(kind);
    if (handler) {
      try {
        handler(data as any, userId);
      } catch (err) {
        console.error(`[EphemeralBus] Handler error for "${kind}":`, err);
      }
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────

  /** Flush all pending throttled outbound ops. */
  flush(): void {
    this.throttle.flushAll();
  }

  /** Clean up all state — call on disconnect. */
  dispose(): void {
    this.throttle.dispose();
    this.cache.dispose();
    this.handlers.clear();
    this._sendFn = undefined;
    this._cacheChangeListeners = [];
  }
}
