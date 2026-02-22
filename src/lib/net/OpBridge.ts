// src/lib/net/OpBridge.ts
// Translates between EngineOps and Zustand stores.
// Handles echo prevention via isApplyingRemote flag.

import type { EngineOp, UserId, Iso8601, OpSeq } from "../../../networking/contract/v1";
import { toast } from "sonner";

/** Handler for a specific op kind. Receives the op data and the userId who sent it. */
export type OpHandler = (data: unknown, userId: UserId) => void;

/** A single op entry from an opBatch. */
export interface RemoteOpEntry {
  seq: OpSeq;
  userId: UserId;
  ts: Iso8601;
  op: EngineOp;
}

class OpBridgeImpl {
  /** True while applying remote ops — outgoing emission is suppressed. */
  isApplyingRemote = false;

  /** Registry of op kind handlers. Add new kinds here without modifying core logic. */
  private handlers = new Map<string, OpHandler>();

  /** Reference to the netManager's proposeOp (set after construction to avoid circular import). */
  private _proposeOp?: (op: EngineOp, clientOpId?: string) => void;

  constructor() {
    // Register built-in op kinds
    this.register("ping", (data) => {
      const d = data as { message?: string };
      console.log("🏓 [OpBridge] Ping received:", d.message ?? "");
      toast.info(`Ping: ${d.message ?? "pong"}`);
    });

    this.register("chat.post", (data, userId) => {
      const d = data as { text: string };
      console.log(`💬 [OpBridge] Chat from ${userId}: ${d.text}`);
      toast(`${userId}: ${d.text}`);
    });

    this.register("token.move", (data) => {
      const d = data as { tokenId: string; x: number; y: number };
      import("@/stores/sessionStore").then(({ useSessionStore }) => {
        useSessionStore.getState().updateTokenPosition(d.tokenId, d.x, d.y);
      });
    });

    this.register("token.sync", (data) => {
      const d = data as { tokens: Array<{ id: string; name: string; x: number; y: number; gridWidth: number; gridHeight: number; color?: string; label: string }> };
      import("@/stores/sessionStore").then(({ useSessionStore }) => {
        const store = useSessionStore.getState();
        for (const t of d.tokens) {
          const existing = store.tokens.find((tok) => tok.id === t.id);
          if (existing) {
            store.updateTokenPosition(t.id, t.x, t.y);
          } else {
            store.addToken({
              id: t.id,
              name: t.name,
              imageUrl: "",
              x: t.x,
              y: t.y,
              gridWidth: t.gridWidth,
              gridHeight: t.gridHeight,
              label: t.label,
              labelPosition: "below",
              roleId: "",
              isHidden: false,
              color: t.color,
            });
          }
        }
        toast.info(`Synced ${d.tokens.length} token(s) from remote`);
      });
    });
  }

  /** Register a handler for an op kind. */
  register(kind: string, handler: OpHandler): void {
    this.handlers.set(kind, handler);
  }

  /** Set the proposeOp function (called by NetManager after construction). */
  setProposeOp(fn: (op: EngineOp, clientOpId?: string) => void): void {
    this._proposeOp = fn;
  }

  /**
   * Apply a batch of remote ops to local state.
   * Sets isApplyingRemote to prevent echo loops.
   */
  applyRemoteOps(ops: RemoteOpEntry[]): void {
    this.isApplyingRemote = true;
    try {
      for (const entry of ops) {
        const handler = this.handlers.get(entry.op.kind);
        if (handler) {
          try {
            handler(entry.op.data, entry.userId);
          } catch (err) {
            console.error(`[OpBridge] Error handling op "${entry.op.kind}":`, err);
          }
        } else {
          console.warn(`[OpBridge] No handler for op kind: "${entry.op.kind}"`);
        }
      }
    } finally {
      this.isApplyingRemote = false;
    }
  }

  /**
   * Emit a local operation to the network.
   * Skipped when isApplyingRemote is true (echo prevention).
   */
  emitLocalOp(op: EngineOp, clientOpId?: string): void {
    if (this.isApplyingRemote) return;
    if (!this._proposeOp) {
      console.warn("[OpBridge] proposeOp not wired yet — op dropped:", op.kind);
      return;
    }
    this._proposeOp(op, clientOpId);
  }
}

/** Singleton OpBridge instance. */
export const opBridge = new OpBridgeImpl();
