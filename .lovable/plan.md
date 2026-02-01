
# Consolidate Fog Control Settings with Illumination Settings

## Problem

The global fog control panel (when GPU post-processing is enabled) has settings that duplicate per-token illumination settings:

| Global Setting | Per-Token Setting | Relationship |
|---|---|---|
| Light Inner Zone | Bright Zone | Same concept - % of range that's fully bright |
| Dim Zone Darkness | Dim Intensity | Same concept - fog opacity in dim zone |

This creates confusion about which setting applies and when.

## Solution

Simplify the global fog settings to only show **true global defaults** and make the relationship clearer:

### Option A: Remove Overlapping Global Settings (Recommended)

Remove `Light Inner Zone` and `Dim Zone Darkness` from the global fog panel since these are really per-source settings. The global values only serve as defaults when tokens don't specify their own.

**Changes to FogControlCard:**
- Remove the "Light Inner Zone" slider (lines 333-360)
- Remove the "Dim Zone Darkness" slider (lines 362-384)
- Keep the global settings in the store as defaults but don't expose them as editable
- Add a brief note: "Configure light zones in Token Illumination settings"

### Option B: Keep Globals as "Default for New Tokens"

Rename the global settings to make their role clear:

| Current Name | New Name |
|---|---|
| Light Inner Zone | Default Bright Zone (for new tokens) |
| Dim Zone Darkness | Default Dim Intensity (for new tokens) |

Add helper text explaining these are defaults that individual tokens can override.

---

## Recommended Approach: Option A

The global settings add confusion without adding value. Users configuring individual tokens via the Illumination modal already have full control. Removing the duplicates simplifies the UI.

### Files to Modify

| File | Change |
|---|---|
| `src/components/cards/FogControlCard.tsx` | Remove Light Inner Zone and Dim Zone Darkness sliders |
| `src/stores/fogStore.ts` | Keep `lightFalloff` and `dimZoneOpacity` in effectSettings (used as defaults) but they become internal |
| `src/types/illumination.ts` | Update `DEFAULT_ILLUMINATION` to use `0.5` for brightZone and `0.4` for dimIntensity (current defaults) |

### UI After Changes

**Fog Control Panel (GPU Post-Processing section):**
```
[ ] GPU Post-Processing
├── Effect Quality: Balanced
├── Fog Edge Softness: 8px
└── [ ] Volumetric Fog
```

**Token Illumination Modal (unchanged):**
- Preset selector
- Range
- Bright Zone (always per-token control)
- Bright/Dim Intensity
- Color settings
- Animation settings

---

## Technical Notes

- The global `lightFalloff` will still exist in the store and be used as the default `brightZone` for new illumination sources
- The global `dimZoneOpacity` will still be used as a fallback when a source's `dimIntensity` is undefined (the rendering code in fogPostProcessing.ts already handles this at line 330-331)
- No changes needed to the rendering pipeline itself
