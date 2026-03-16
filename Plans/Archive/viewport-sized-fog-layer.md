# Fog of War: Viewport-Sized PixiJS Layer (v0.7.139) + Join Recovery (v0.7.140)

## Status: Implemented

## v0.7.139 Summary
- Switched fog post-processing from content-sized to viewport-sized.
- Removed zoom-time renderer resizing and CSS offset tracking.
- Eliminated zoom flash and alignment drift from mixed coordinate systems.

## v0.7.140 Follow-up Fix
### Problem
On host/DM, when a player joined in Jazz tandem mode, `pushAllToJazz` could cause brief fog rendering disruption until the next interaction (pan/zoom/token move).

### Fix
After auto-sync on peer join, dispatch a DM-side fog refresh event:
- `window.dispatchEvent(new CustomEvent('fog:force-refresh'))` (delayed 100ms)
- This reinitializes fog masks/post-processing immediately, without waiting for manual interaction.

### Files Changed
- `src/lib/net/NetManager.ts`
- `src/lib/version.ts` (0.7.140)

## External Impact
- Impacts join-time Jazz/WebSocket tandem sync behavior only.
- No server protocol/schema changes; no websocket/jazz service restart required.
