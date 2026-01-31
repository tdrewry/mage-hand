
# Vision & Illumination System Unification Plan

## Executive Summary

The current codebase has two parallel vision systems that don't communicate:
1. **Legacy Vision Profiles** (visionProfileStore) - sets `visionRange`, `useGradients` fields
2. **New Illumination System** (illuminationSources array) - used by the actual renderer

This creates three user-facing problems:
- Vision Profile selections from the bottom toolbar don't affect lighting
- Context menu "Set Vision Range" doesn't update illumination
- Changes don't immediately refresh the map

Additionally, the dim zone lacks a dedicated opacity control for fine-tuning visibility.

---

## Audit Results: Legacy Vision System Usage

### 1. Token State Fields (sessionStore.ts)

| Field | Status | Used By Renderer? |
|-------|--------|------------------|
| `hasVision` | Legacy | Yes - filters which tokens compute vision |
| `visionRange` | Legacy | Fallback only if `illuminationSources` empty |
| `visionProfileId` | Legacy | Not used by renderer |
| `useGradients` | Legacy | Not used by renderer |
| `illuminationSources[]` | Current | Primary source for illumination |

### 2. UI Components Setting Legacy Fields Only

**BulkOperationsToolbar.tsx (lines 105-126)**
- `handleApplyVisionProfile()` sets: `visionProfileId`, `visionRange`, `useGradients`
- Does NOT set `illuminationSources` - renderer ignores these changes

**TokenContextMenu.tsx (lines 381-407)**
- `applyVisionRange()` sets: `visionRange`, `useGradients`  
- Does NOT update `illuminationSources[0].range` - range change ignored by renderer

### 3. UI Components Using New System Correctly

**TokenContextMenu.tsx (lines 319-337)**
- `applyIlluminationPreset()` correctly calls `updateTokenIllumination()`
- Properly triggers `onUpdateCanvas?.()` for immediate refresh
- This is why presets work but vision profiles don't

### 4. Renderer Priority Chain (SimpleTabletop.tsx)

```
illuminationSources[0].range → token.visionRange → fogVisionRange (global)
```

The renderer only falls back to `visionRange` if no `illuminationSources` exist.

### 5. Token/Annotation Visibility (Darkness Returns Model)

Visibility is determined by checking if a point is within any active illumination polygon:
- Uses `isPointInVisibleArea()` with visibility polygons from tokens with vision
- Players see their own tokens regardless of lighting
- DMs have configurable visibility modes

---

## Implementation Plan

### Phase 1: Unify Vision Profile Selection with Illumination

**File: `src/components/BulkOperationsToolbar.tsx`**

Update `handleApplyVisionProfile()` to convert VisionProfile to IlluminationSource format:

```typescript
const handleApplyVisionProfile = (profileId: string) => {
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) return;
  
  // Convert legacy profile to illumination format
  const illuminationSettings = {
    range: profile.visionRange,
    brightZone: 0.5,
    brightIntensity: 1.0,
    dimIntensity: profile.useGradients ? 0.4 : 0.0, // Gradients = dim zone
    color: profile.color,
    colorEnabled: false,
    colorIntensity: 0.15,
    softEdge: profile.useGradients,
    softEdgeRadius: 8,
    animation: 'none' as const,
    animationSpeed: 1.0,
    animationIntensity: 0.3,
  };
  
  selectedTokens.forEach(token => {
    // Update both legacy AND new fields for compatibility
    useSessionStore.setState((state) => ({
      tokens: state.tokens.map((t) =>
        t.id === token.id
          ? {
              ...t,
              visionProfileId: profile.id,
              visionRange: profile.visionRange,
              useGradients: profile.useGradients,
            }
          : t
      ),
    }));
    
    // CRITICAL: Also update illuminationSources
    updateTokenIllumination(token.id, illuminationSettings);
  });
  
  onUpdateCanvas?.();
  toast.success(`Applied ${profile.name} to ${selectedTokens.length} token(s)`);
};
```

### Phase 2: Sync Context Menu Vision Range with Illumination

**File: `src/components/TokenContextMenu.tsx`**

Update `applyVisionRange()` to also update illumination source range:

```typescript
const applyVisionRange = () => {
  const range = visionRangeValue === '' ? undefined : parseFloat(visionRangeValue);
  
  if (range !== undefined && (isNaN(range) || range < 0)) {
    toast.error('Please enter a valid vision range');
    return;
  }
  
  targetTokens.forEach(token => {
    // Update legacy field
    useSessionStore.setState((state) => ({
      tokens: state.tokens.map((t) =>
        t.id === token.id
          ? {
              ...t,
              visionRange: range,
              useGradients: useGradientsValue,
            }
          : t
      ),
    }));
    
    // CRITICAL: Also sync to illuminationSources
    if (range !== undefined) {
      updateTokenIllumination(token.id, { 
        range,
        // Set dimIntensity based on gradient toggle
        dimIntensity: useGradientsValue ? 0.4 : 0.0,
        softEdge: useGradientsValue,
      });
    }
  });
  
  setShowVisionRangeModal(false);
  onUpdateCanvas?.();
  toast.success(`Vision settings updated for ${targetTokens.length} token(s)`);
};
```

### Phase 3: Add Dim Zone Opacity Control

This provides user control over how dark the dim zone appears.

**File: `src/stores/fogStore.ts`**

Add new setting:

```typescript
export interface FogEffectSettings {
  // ... existing fields
  dimZoneOpacity: number; // 0-1, how much fog remains in dim zone (default 0.4)
}

// In initial state:
effectSettings: {
  // ... existing
  dimZoneOpacity: 0.4, // 40% fog in dim zone
}

// Add action:
setDimZoneOpacity: (opacity: number) => {
  const clamped = Math.max(0, Math.min(1, opacity));
  set((state) => ({
    effectSettings: { ...state.effectSettings, dimZoneOpacity: clamped },
  }));
}
```

**File: `src/stores/defaultFogEffectSettings.ts`**

Update defaults:

```typescript
export const DEFAULT_FOG_EFFECT_SETTINGS: FogEffectSettings = {
  // ... existing
  dimZoneOpacity: 0.4,
};
```

**File: `src/components/cards/FogControlCard.tsx`**

Add slider after Light Falloff control:

```tsx
{/* Dim Zone Opacity */}
<div className="space-y-2">
  <div className="flex items-center justify-between">
    <Label className="text-sm font-medium flex items-center gap-2">
      <Circle className="h-3 w-3 opacity-50" />
      Dim Zone Darkness
    </Label>
    <span className="text-xs font-medium">{Math.round(effectSettings.dimZoneOpacity * 100)}%</span>
  </div>
  <Slider
    min={0}
    max={100}
    step={5}
    value={[effectSettings.dimZoneOpacity * 100]}
    onValueChange={([value]) => setDimZoneOpacity(value / 100)}
    disabled={!enabled || !effectSettings.postProcessingEnabled}
    className="w-full"
  />
  <p className="text-xs text-muted-foreground">
    How dark the outer edge of vision appears
  </p>
</div>
```

**File: `src/lib/fogPostProcessing.ts`**

Use global dimZoneOpacity as fallback when source lacks specific dimIntensity:

```typescript
// In applyFogPostProcessing, when computing dimIntensity:
const globalDimOpacity = getEffectSettings().dimZoneOpacity ?? 0.4;
const dimIntensity = (source.dimIntensity ?? globalDimOpacity) * animResult.intensityMod;
```

### Phase 4: Ensure Consistent Canvas Refresh

Verify all vision/illumination paths call refresh:

| Location | Action | Calls Refresh? |
|----------|--------|----------------|
| `TokenContextMenu.applyIlluminationPreset()` | ✅ | Yes |
| `TokenContextMenu.applyVisionRange()` | ✅ | Yes (already) |
| `BulkOperationsToolbar.handleApplyVisionProfile()` | ✅ | Yes (already) |
| `BulkOperationsToolbar.handleToggleVision()` | ✅ | Yes (already) |

**FIXED:** The fog computation useEffect now detects illumination range changes (not just position changes) and triggers visibility polygon recomputation. Also detects non-range illumination setting changes (color, animation, etc.) to update the visibility data for rendering without needing to recompute polygons.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/BulkOperationsToolbar.tsx` | Convert vision profile to illumination settings, call `updateTokenIllumination()` |
| `src/components/TokenContextMenu.tsx` | Sync `applyVisionRange()` to also update illumination range |
| `src/stores/fogStore.ts` | Add `dimZoneOpacity` setting and action |
| `src/stores/defaultFogEffectSettings.ts` | Add default for `dimZoneOpacity` |
| `src/components/cards/FogControlCard.tsx` | Add "Dim Zone Darkness" slider UI |
| `src/lib/fogPostProcessing.ts` | Use global `dimZoneOpacity` as fallback for per-source `dimIntensity` |

---

## Technical Details

### Why Vision Profiles Don't Work

```text
User clicks "Darkvision (60ft)" in Vision menu
    ↓
handleApplyVisionProfile() runs
    ↓
Sets token.visionRange = 12, token.visionProfileId = 'darkvision'
    ↓
onUpdateCanvas() triggers redraw
    ↓
Renderer checks token.illuminationSources → empty/unchanged
    ↓
Renderer falls back to legacy visionRange → visibility computed
    ↓
BUT: Illumination color/gradient/animation NOT applied (requires illuminationSources)
```

### Why Illumination Presets Work

```text
User clicks "Torch" in Apply Illumination Preset menu
    ↓
applyIlluminationPreset() runs
    ↓
Calls updateTokenIllumination() with full preset settings
    ↓
Updates token.illuminationSources[0] with range, color, animation, etc.
    ↓
onUpdateCanvas() triggers redraw
    ↓
Renderer uses illuminationSources → full illumination with gradients/color/animation
```

---

## Testing Checklist

After implementation:
1. Select token → Bottom toolbar Vision → Darkvision → Lighting should update immediately with 60ft range
2. Select token → Right-click → Set Vision Range → 10 → Illumination should update to 10 grid units
3. Select token → Right-click → Apply Illumination Preset → Torch → Flickering animation should appear
4. Adjust "Dim Zone Darkness" slider in Fog Controls → Outer ring of all vision should get darker/lighter
5. Overlap two tokens with vision → Intersection should never be darker than individual dim zones
