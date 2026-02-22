# Fog Pan Performance Optimization

## Problem
Canvas drag (pan) was extremely slow when GPU post-processing was enabled with 2-3 illumination sources. Every mouse-move during pan triggered:
1. Fog computation useEffect (with Paper.js scope activation + async overhead)
2. Full Canvas 2D fog redraw (clip paths, gradients, fills per source)
3. Two texture uploads to GPU (fog + illumination)
4. PixiJS render

## Root Causes
1. `transform.x, transform.y, transform.zoom` in fog computation useEffect deps caused unnecessary Paper.js computation triggers during pan (always early-exited but still had overhead)
2. `applyFogPostProcessing` re-rendered the entire fog bitmap every frame during pan even though world-space fog content hadn't changed

## Solution: CSS-Offset Fast Path
During pan (no zoom change, no fog/illumination data change):
- Skip the entire Canvas 2D fog redraw
- Reposition the PixiJS canvas via CSS `left`/`top` to match the pan delta
- Force a full redraw every 100ms to prevent long-term drift
- On full redraw, reset CSS offset to canonical position

### Files Changed
- `src/lib/postProcessingLayer.ts` — Added `setLastRenderTransform`, `panOffsetPostProcessing`, `resetPostProcessingOffset`
- `src/lib/fogPostProcessing.ts` — Added fast-path detection in `applyFogPostProcessing`, tracking refs for masks/illumination identity
- `src/components/SimpleTabletop.tsx` — Removed `transform.x/y/zoom` from fog computation useEffect deps
