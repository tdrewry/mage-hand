# Illumination as Client-Side Rendering (v0.7.100)

## Problem Fixed

### Illumination randomly drops out, color glow drifts from token during pan
**Root cause**: The Jazz bridge dispatched `fog:force-refresh` (soft) whenever it detected
`illuminationChanged` on inbound token sync. This soft refresh immediately invalidated the
`illuminationSourcesCacheRef` and called `redrawCanvas()` — but the fog computation `useEffect`
(which rebuilds `tokenVisibilityDataRef`) is debounced by 100ms.

During those 100ms, the illumination cache was rebuilt from **stale** visibility data (old
positions, old occlusion polygons). If the stale data happened to be empty or misaligned,
illumination would vanish. The color glow (which uses a separate GPU texture) would persist
at its last-known position, causing the "drift" artifact during pan.

## Fix

**Removed the `fog:force-refresh` dispatch from the Jazz bridge entirely for illumination changes.**

The fog `useEffect` already handles this correctly:
1. `filteredTokens` is in its dependency array → token store changes trigger it
2. It detects `illuminationSettingsChanged` via settings hash comparison
3. It detects `illuminationChangedTokens` via range comparison
4. It skips expensive polygon recomputation when only settings changed (`skipPolygonRecomputation`)
5. It rebuilds `tokenVisibilityDataRef` with fresh illumination data
6. It invalidates `illuminationSourcesCacheRef` and calls `redrawCanvas()`

This ensures illumination rendering only happens AFTER visibility data is up-to-date,
eliminating the race condition.

## Architecture Principle
Illumination is a **client-side rendering concern**. Network sync only transmits illumination
*settings* on tokens (range, brightZone, color, etc.). Each client independently:
- Detects setting changes via the fog `useEffect`
- Recomputes visibility polygons if range changed
- Rebuilds illumination source data with fresh occlusion paths
- Renders fog + illumination gradients locally

No `fog:force-refresh` is needed for illumination — only for geometry changes (wall edits,
region changes, initial load).

## Files Changed
| File | Change |
|------|--------|
| `src/lib/jazz/bridge.ts` | Removed `fog:force-refresh` dispatch for illumination changes |
| `src/lib/version.ts` | 0.7.100 |

## Impact on External Services
None — all changes are client-side. No WebSocket server or Jazz service changes needed.
