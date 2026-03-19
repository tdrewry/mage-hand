# STEP-005 — Standard Canvas Redraw Command (Local + Remote)

## Overview

**Bug:** Switching map focus in the Map Tree only repaints regions/textures where maps overlap, leaving visual artifacts from the previous map.

**Broader need:** Several systems (map switch, fog refresh, entity delete, remote DM commands) need to trigger a complete canvas repaint. Currently each system has ad-hoc workarounds. We need a **standardized, reusable `forceRedraw()` command** with both a local variant and a remote ephemeral broadcast.

---

## Proposed API

### Local: `forceRedraw()`
A stable function importable by any component or hook that queues a full canvas repaint on the next animation frame.

```ts
// src/lib/canvas/redraw.ts
export function forceRedraw(reason?: string): void {
  // Increment a version counter stored in a lightweight Zustand slice
  // Canvas renderer watches this counter and repaints when it changes
  useCanvasStore.getState().incrementRedrawVersion(reason);
}
```

```ts
// src/stores/canvasStore.ts (new or add to existing UI store)
interface CanvasState {
  redrawVersion: number;
  lastRedrawReason?: string;
  incrementRedrawVersion: (reason?: string) => void;
  forceRedraw: () => void; // alias for incrementRedrawVersion
}
```

The canvas `useEffect` / `requestAnimationFrame` loop watches `redrawVersion` and triggers a full repaint when it changes.

### Remote: `remoteForceRedraw()`
Sends a `force_redraw` ephemeral message to all connected clients. Each client runs their local `forceRedraw()` on receipt.

```ts
// src/lib/canvas/redraw.ts
export function remoteForceRedraw(reason?: string): void {
  netManager.sendEphemeral('force_redraw', { reason });
}
```

Ephemeral receiver (in `ephemeral/mapHandlers.ts` or equivalent):
```ts
case 'force_redraw':
  forceRedraw(payload.reason);
  break;
```

---

## Map Switch Fix

After a map switch completes (map tree selection changes active map), call:
```ts
forceRedraw('map_switch');
```

This ensures:
1. Old map textures/regions are cleared
2. New map content is fully repainted without overlap artifacts
3. Fog of War recomputes for the new map's dimensions

---

## Use Cases for `forceRedraw()`

| Trigger | Local | Remote |
|---|---|---|
| Map switch | ✅ | ✅ (all clients switch maps) |
| Fog toggle | ✅ | — |
| Entity bulk delete | ✅ | — |
| DM sends "refresh view" command | ✅ | ✅ |
| Region texture loads | ✅ | — |
| Session reconnect | ✅ | — |

---

## Files to Create / Modify

- **NEW** `src/lib/canvas/redraw.ts` — `forceRedraw()` and `remoteForceRedraw()`
- **MODIFY** `src/stores/canvasStore.ts` (or `uiStateStore.ts`) — add `redrawVersion`
- **MODIFY** `src/components/SimpleTabletop.tsx` — watch `redrawVersion` in animation loop
- **MODIFY** Map tree / map switch handler — call `forceRedraw('map_switch')` after switch
- **MODIFY** `src/lib/net/ephemeral/mapHandlers.ts` — handle `force_redraw` ephemeral message

---

## Outstanding Questions for User Review

1. **Canvas repaint scope:** Should `forceRedraw` trigger a repaint of ONLY the canvas layers (tokens, regions, map objects, fog), or also the React UI layer? Typically canvas only is sufficient.
2. **Debouncing:** Should multiple rapid `forceRedraw()` calls within one animation frame be collapsed into one? (Yes, recommended — use a `requestAnimationFrame` coalesce.)
3. **Remote `forceRedraw` permissions:** Should clients be allowed to send `force_redraw` to the host, or is this DM-only? Recommend: any participant can request a local redraw, only DM can broadcast remote.
4. **Map switch fog recompute:** When the map switches, should fog caches be cleared before the redraw so the new map computes fresh fog? Or is this already handled by the map switch event?

---

## Verification
1. Switch map focus in Map Tree → verify no texture/region bleed from previous map
2. Call `forceRedraw('test')` from console → verify canvas fully repaints
3. Call `remoteForceRedraw()` on host → verify all clients repaint
4. Rapid map switch (5 switches in 1 second) → verify only one repaint occurs per animation frame
