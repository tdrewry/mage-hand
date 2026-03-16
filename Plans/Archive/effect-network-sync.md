# Effect & Aura Network Sync Plan

## Summary

Add networking for the entire effect system — placement, dismissal, cancellation, and aura state updates. This also requires updating `docs/NETWORKING-MATRIX.md` with a new **Section 12: Effects & Auras**.

## Current State

- Effects have **zero** network sync. All placement/dismissal is local-only.
- Aura state (tokensInsideArea, impacts) is computed locally at ~5 Hz and never broadcast.
- The networking matrix (`docs/NETWORKING-MATRIX.md`) has no section for effects.

## Architecture

### Layer Classification

| Action | Layer | Op Kind | Notes |
|--------|-------|---------|-------|
| Effect placed | **Durable** | `effect.place` | Template snapshot + origin + direction + casterId + mapId + aura fields |
| Effect dismissed (fade-out) | **Durable** | `effect.dismiss` | effectId |
| Effect cancelled (revert modifiers) | **Durable** | `effect.cancel` | effectId |
| Effect round tick (duration countdown) | **Durable** | `effect.tick` | effectId + roundsRemaining |
| Aura tokensInsideArea update | **Ephemeral** | `effect.aura.state` | effectId + insideIds + impacts, 5 Hz throttle, 500 ms TTL |
| Effect placement preview (ghost) | **Ephemeral** | `effect.placement.preview` | templateId + origin + direction, 15 Hz throttle, 300 ms TTL |

### Rationale

- **Durable for place/dismiss/cancel**: These are authoritative state changes that must survive reconnection, appear in snapshots, and be consistent across all clients.
- **Ephemeral for aura state**: Aura hit-testing runs at 5 Hz and is position-derived (can be recomputed locally). Broadcasting is a convenience for non-DM clients who may not have wall geometry access. Safe to drop frames.
- **Ephemeral for placement preview**: Same pattern as `token.drag.preview` — shows other users where an effect is about to land.

## Implementation Phases

### Phase 1: Durable Effect Ops (Core)

**Files touched:**
- `src/lib/net/OpBridge.ts` — register handlers for `effect.place`, `effect.dismiss`, `effect.cancel`
- `src/stores/effectStore.ts` — emit ops from `placeEffect()`, `dismissEffect()`, `cancelEffect()`
- `networking/contract/v1.ts` — document new op kinds (optional, ops are stringly-typed)
- `docs/NETWORKING-MATRIX.md` — add Section 12

**Op payloads:**

```typescript
// effect.place
{
  kind: "effect.place",
  data: {
    id: string;           // pre-generated effect ID
    templateId: string;
    template: EffectTemplate; // snapshot (includes scaling)
    origin: { x: number; y: number };
    direction?: number;
    casterId?: string;
    mapId: string;
    impactedTargets: EffectImpact[];
    groupId?: string;
    castLevel?: number;
    waypoints?: { x: number; y: number }[];
    isAura?: boolean;
    anchorTokenId?: string;
  }
}

// effect.dismiss
{
  kind: "effect.dismiss",
  data: { effectId: string }
}

// effect.cancel
{
  kind: "effect.cancel",
  data: { effectId: string }
}
```

**Echo prevention:** Use the existing `OpBridge.isApplyingRemote` flag. The store methods already check this.

**Late-join / snapshot:** Effects are part of the session state serialized by `projectSerializer`. A full `session.sync` op (when implemented) would include `placedEffects`. Until then, late-joiners won't see existing effects — acceptable for MVP.

### Phase 2: Ephemeral Aura State

**Files touched:**
- `docs/EPHEMERAL-NETWORKING-CONTRACT.md` — add aura state entry
- `src/lib/net/ephemeral/types.ts` — add `effect.aura.state` op kind
- `src/lib/net/ephemeral/effectHandlers.ts` (new) — outbound emit + inbound handler
- `src/components/SimpleTabletop.tsx` — emit after `tickAuras()` returns events
- `src/stores/effectStore.ts` — `updateAuraState` already exists; inbound handler calls it

**Throttle:** 5 Hz (matches existing tick interval), 500 ms TTL.

**Payload:**
```typescript
{
  kind: "effect.aura.state",
  data: {
    effectId: string;
    origin: { x: number; y: number };
    insideIds: string[];
    impacts: EffectImpact[];
  }
}
```

**Authority:** Only the DM (or the aura owner) computes and broadcasts. Other clients receive and apply. This avoids conflicts from multiple clients computing slightly different results.

### Phase 3: Placement Preview (Optional)

**Files touched:**
- `src/lib/net/ephemeral/effectHandlers.ts` — add preview ops
- `src/components/SimpleTabletop.tsx` — emit during placement mode, render remote previews

Lower priority — nice-to-have for player coordination.

## Dependencies

- Phases are independent and can be implemented in order.
- Phase 1 has no prerequisites beyond the existing OpBridge.
- Phase 2 requires the EphemeralBus (already implemented).
- Phase 3 is optional and depends on Phase 1 for context.

## Testing

- Place an effect as DM → verify it appears on a connected player's canvas.
- Dismiss/cancel → verify removal propagates.
- Move a token through an aura → verify `tokensInsideArea` updates on remote client.
- Reconnect a client → effects placed before join are NOT visible (expected for MVP; full sync deferred to session snapshot work).

## Open Questions

1. **Modifier application on remote clients:** When `effect.place` arrives with an aura, should the remote client also run `applyEffectModifiers`? Currently modifiers mutate local character snapshots. If character data is also synced, this could cause double-application. **Recommendation:** Defer modifier sync until character state networking is designed. For now, only sync visual state.
2. **Round tick authority:** Who broadcasts `effect.tick`? Recommend: only the DM's client runs `tickRound` and emits the op.
3. **Template sync:** The `effect.place` op includes a full template snapshot. This avoids needing template libraries to be in sync across clients, but increases payload size. Acceptable for now.
