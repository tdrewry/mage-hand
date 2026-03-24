// src/lib/net/OpBridge.ts
// Translates between EngineOps and Zustand stores.
// Handles echo prevention via isApplyingRemote flag.

import type { EngineOp, UserId, Iso8601, OpSeq } from "../../../networking/contract/v1";
import { toast } from "sonner";
import { triggerSound } from "@/lib/soundEngine";
import { useSessionStore } from "@/stores/sessionStore";
import { useRegionStore } from "@/stores/regionStore";
import { useMapTemplateStore } from "@/stores/mapTemplateStore";
import { useMapObjectStore } from "@/stores/mapObjectStore";
import { BUILT_IN_EFFECT_TEMPLATES } from "@/lib/mapTemplateLibrary";
// dragPreviewStore handlers moved to ephemeral tokenHandlers.ts

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
      useSessionStore.getState().updateTokenPosition(d.tokenId, d.x, d.y);
      triggerSound('movement.commit');
    });

    this.register("token.sync", (data) => {
      console.log("🔄 [OpBridge] token.sync handler ENTERED, data:", JSON.stringify(data).slice(0, 500));
      const d = data as { tokens: Array<{ id: string; name: string; x: number; y: number; gridWidth: number; gridHeight: number; color?: string; label: string }> };
      if (!d || !Array.isArray(d.tokens)) {
        console.error("🔄 [OpBridge] token.sync: invalid data shape!", data);
        return;
      }
      const store = useSessionStore.getState();
      console.log(`🔄 [OpBridge] token.sync: ${d.tokens.length} incoming, ${store.tokens.length} existing`);
      let created = 0, updated = 0;
      for (const t of d.tokens) {
        const existing = store.tokens.find((tok) => tok.id === t.id);
        if (existing) {
          store.updateTokenPosition(t.id, t.x, t.y);
          updated++;
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
          created++;
        }
      }
      const afterCount = useSessionStore.getState().tokens.length;
      console.log(`🔄 [OpBridge] token.sync DONE: created=${created}, updated=${updated}, total tokens now=${afterCount}`);
      toast.info(`Synced ${d.tokens.length} token(s): ${created} new, ${updated} updated`);
    });

    this.register("token.update", (data) => {
      const d = data as Record<string, unknown>;
      if (!d || typeof d.id !== 'string') return;
      const store = useSessionStore.getState();
      const existing = store.tokens.find(t => t.id === d.id);
      if (!existing) {
        console.warn(`[OpBridge] token.update: token ${d.id} not found locally`);
        return;
      }
      // Merge all provided fields into the token
      useSessionStore.setState((state) => ({
        tokens: state.tokens.map(t =>
          t.id === d.id ? { ...t, ...d } : t
        ),
      }));
      console.log(`🔄 [OpBridge] token.update applied for ${d.id}`);
    });

    this.register("region.update", (data) => {
      const d = data as Record<string, unknown>;
      if (!d || typeof d.id !== 'string') return;
      const store = useRegionStore.getState();
      const existing = store.regions.find(r => r.id === d.id);
      if (!existing) {
        console.warn(`[OpBridge] region.update: region ${d.id} not found locally`);
        return;
      }
      useRegionStore.setState((state) => ({
        regions: state.regions.map(r =>
          r.id === d.id ? { ...r, ...d } : r
        ),
      }));
      console.log(`🔄 [OpBridge] region.update applied for ${d.id}`);
    });

    this.register("effect.update", (data) => {
      const d = data as Record<string, unknown>;
      if (!d || typeof d.id !== 'string') return;
      const store = useMapTemplateStore.getState();
      // Effect templates are synced via customTemplates
      const existing = store.allTemplates.find(t => t.id === d.id);
      if (!existing) {
        console.warn(`[OpBridge] effect.update: template ${d.id} not found locally`);
        return;
      }
      store.updateCustomTemplate(d.id as string, d as Record<string, unknown>);
      console.log(`🔄 [OpBridge] effect.update applied for ${d.id}`);
    });

    // ── Durable effect ops: place / dismiss / cancel ──

    this.register("effect.place", (data) => {
      const d = data as {
        id: string;
        templateId: string;
        template?: any;
        origin: { x: number; y: number };
        direction?: number;
        casterId?: string;
        mapId: string;
        impactedTargets?: any[];
        groupId?: string;
        castLevel?: number;
        waypoints?: { x: number; y: number }[];
        isAura?: boolean;
        anchorTokenId?: string;
      };
      if (!d || !d.id || !d.templateId) return;
      const store = useMapTemplateStore.getState();
      // Skip if effect already exists locally (echo from our own placement)
      if (store.placedEffects.some(e => e.id === d.id)) return;

      // Reconstruct template: use embedded snapshot if provided, else look up locally
      let template = d.template ?? store.getTemplate(d.templateId);
      if (!template) {
        console.warn(`[OpBridge] effect.place: template ${d.templateId} not found`);
        return;
      }

      const effect: any = {
        id: d.id,
        templateId: d.templateId,
        template: { ...template },
        origin: d.origin,
        direction: d.direction,
        casterId: d.casterId,
        placedAt: performance.now(),
        roundsRemaining: template.persistence === 'persistent' ? (template.durationRounds ?? 0) : undefined,
        mapId: d.mapId,
        impactedTargets: d.impactedTargets ?? [],
        triggeredTokenIds: [],
        groupId: d.groupId,
        castLevel: d.castLevel,
        waypoints: d.waypoints,
        ...(d.isAura ? { isAura: true, anchorTokenId: d.anchorTokenId, tokensInsideArea: [] } : {}),
      };

      useMapTemplateStore.setState((s) => ({
        placedEffects: [...s.placedEffects, effect],
      }));
      triggerSound('effect.placed');
      console.log(`🔄 [OpBridge] effect.place applied: ${d.id}`);
    });

    this.register("effect.dismiss", (data) => {
      const d = data as { effectId: string };
      if (!d?.effectId) return;
      const store = useMapTemplateStore.getState();
      const existing = store.placedEffects.find(e => e.id === d.effectId);
      if (!existing || existing.dismissedAt) return;
      useMapTemplateStore.setState((s) => ({
        placedEffects: s.placedEffects.map(e =>
          e.id === d.effectId ? { ...e, dismissedAt: performance.now() } : e
        ),
      }));
      triggerSound('effect.removed');
      console.log(`🔄 [OpBridge] effect.dismiss applied: ${d.effectId}`);
    });

    this.register("effect.cancel", (data) => {
      const d = data as { effectId: string };
      if (!d?.effectId) return;
      const store = useMapTemplateStore.getState();
      const existing = store.placedEffects.find(e => e.id === d.effectId);
      if (!existing || existing.cancelledAt) return;
      useMapTemplateStore.setState((s) => ({
        placedEffects: s.placedEffects.map(e =>
          e.id === d.effectId
            ? { ...e, cancelledAt: performance.now(), dismissedAt: e.dismissedAt ?? performance.now() }
            : e
        ),
      }));
      console.log(`🔄 [OpBridge] effect.cancel applied: ${d.effectId}`);
    });

    this.register("effect.template.add", (data) => {
      const d = data as { template: any };
      if (!d?.template?.id) return;
      const store = useMapTemplateStore.getState();
      // Skip if template already exists
      if (store.customTemplates.some(t => t.id === d.template.id)) {
        // Update instead
        store.updateCustomTemplate(d.template.id, d.template);
      } else {
        // Direct setState to preserve the original ID (addCustomTemplate generates new ones)
        useMapTemplateStore.setState((s) => {
          const newCustom = [...s.customTemplates, { ...d.template, isBuiltIn: false }];
          const customIds = new Set(newCustom.map(t => t.id));
          const hiddenSet = new Set(s.hiddenBuiltInIds);
          const visibleBuiltIns = BUILT_IN_EFFECT_TEMPLATES.filter((t: any) => !hiddenSet.has(t.id) && !customIds.has(t.id));
          return {
            customTemplates: newCustom,
            allTemplates: [...visibleBuiltIns, ...newCustom],
          };
        });
      }
      console.log(`🔄 [OpBridge] effect.template.add applied: ${d.template.id}`);
    });

    this.register("mapObject.update", (data) => {
      const d = data as Record<string, unknown>;
      if (!d || typeof d.id !== 'string') return;
      const store = useMapObjectStore.getState();
      const existing = store.mapObjects.find(o => o.id === d.id);
      if (!existing) {
        console.warn(`[OpBridge] mapObject.update: object ${d.id} not found locally`);
        return;
      }
      store.updateMapObject(d.id as string, d as Record<string, unknown>);
      console.log(`🔄 [OpBridge] mapObject.update applied for ${d.id}`);
    });

    // Token drag preview ops moved to ephemeral tokenHandlers.ts (Priority 1 migration)
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
    console.log(`📥 [OpBridge] applyRemoteOps called with ${ops.length} op(s):`, ops.map(o => o.op.kind));
    this.isApplyingRemote = true;
    try {
      for (const entry of ops) {
        const handler = this.handlers.get(entry.op.kind);
        if (handler) {
          try {
            console.log(`📥 [OpBridge] Dispatching "${entry.op.kind}" from ${entry.userId}`);
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
    if (this.isApplyingRemote) {
      console.log(`🚫 [OpBridge] emitLocalOp SKIPPED (isApplyingRemote): ${op.kind}`);
      return;
    }
    if (!this._proposeOp) {
      console.warn("[OpBridge] proposeOp not wired yet — op dropped:", op.kind);
      return;
    }
    console.log(`📤 [OpBridge] emitLocalOp: ${op.kind}`, JSON.stringify(op.data).slice(0, 200));
    this._proposeOp(op, clientOpId);
  }
}

/** Singleton OpBridge instance. */
export const opBridge = new OpBridgeImpl();
