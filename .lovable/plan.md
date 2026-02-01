
# Token Appearance Variants - IMPLEMENTED ✓

## Overview
Tokens now support multiple saved "appearance variants" - combinations of image + size that can be quickly switched between. This supports use cases like:
- **Wild Shape**: Druid changes between humanoid form and various animal forms
- **Mounted/Unmounted**: Character on horseback vs on foot
- **Polymorphed**: Original form vs transformed creature
- **Rage/Combat Mode**: Visual indicator of combat state with different image

## Current State Analysis

The Token interface currently stores:
- `imageUrl`: The current image data (in-memory, not persisted)
- `imageHash`: Hash for texture sync to other clients
- `gridWidth` / `gridHeight`: Current token footprint

The Appearance tab in the Edit Token modal allows:
- Changing the current image
- Selecting size presets (Tiny, Small/Medium, Large, Huge, Gargantuan)
- Custom size input

**Missing**: No way to save and quickly switch between appearance configurations.

## Proposed Data Model

### New Interface: AppearanceVariant

```typescript
export interface AppearanceVariant {
  id: string;              // Unique identifier
  name: string;            // User-friendly name (e.g., "Bear Form", "Mounted")
  imageHash?: string;      // Hash reference to stored texture
  gridWidth: number;       // Footprint width in grid units
  gridHeight: number;      // Footprint height in grid units
  isDefault?: boolean;     // Mark one variant as the default/original
}
```

### Token Interface Extension

```typescript
export interface Token {
  // ... existing fields ...
  
  // Appearance variants - saved configurations of image + size
  appearanceVariants?: AppearanceVariant[];
  activeVariantId?: string;  // Which variant is currently active
}
```

### How It Works

1. **Saving a Variant**: User configures image + size in Appearance tab, clicks "Save as Variant", enters a name → stored in `appearanceVariants` array
2. **Switching Variants**: User selects from a dropdown or grid of saved variants → `activeVariantId` updates, and `imageHash`/`imageUrl`/`gridWidth`/`gridHeight` are updated to match
3. **Default Variant**: First variant or one marked `isDefault` represents the "base" appearance
4. **Sync**: Variants sync via JSON Patch (only `imageHash` for images, not full data)

---

## Technical Implementation

### 1. Extend Token Interface
**File:** `src/stores/sessionStore.ts`

Add new types and fields:

```typescript
// New interface for appearance presets
export interface AppearanceVariant {
  id: string;
  name: string;
  imageHash?: string;      // Hash reference (imageUrl loaded from IndexedDB)
  gridWidth: number;
  gridHeight: number;
  isDefault?: boolean;
}

export interface Token {
  // ... existing fields ...
  
  // Appearance variants system
  appearanceVariants?: AppearanceVariant[];
  activeVariantId?: string;
}
```

### 2. Add Store Methods
**File:** `src/stores/sessionStore.ts`

```typescript
// Add a new appearance variant to a token
addAppearanceVariant: (tokenId: string, variant: AppearanceVariant) => void;

// Remove an appearance variant from a token
removeAppearanceVariant: (tokenId: string, variantId: string) => void;

// Update an existing variant
updateAppearanceVariant: (tokenId: string, variantId: string, updates: Partial<AppearanceVariant>) => void;

// Switch to a different variant (applies its settings to the token)
setActiveVariant: (tokenId: string, variantId: string) => void;
```

### 3. Update TokenContextMenu Appearance Tab
**File:** `src/components/TokenContextMenu.tsx`

Restructure the Appearance tab to include:

```text
+------------------------------------------+
|           Appearance Tab                  |
+------------------------------------------+
| Current Appearance                        |
| ┌────────────────────────────────────────┐|
| │ [Image Preview]    Size: 2×2 Large     │|
| │ [Change Image] [Clear]                  │|
| │                                         │|
| │ Size: [Tiny] [Med] [Lrg] [Huge] [Garg] │|
| │ Custom: [___] × [___]                   │|
| └────────────────────────────────────────┘|
|                                           |
| Saved Variants                            |
| ┌────────────────────────────────────────┐|
| │ [+] Save Current as Variant            │|
| │                                         │|
| │ ┌──────┐ ┌──────┐ ┌──────┐            │|
| │ │ Bear │ │Hawk  │ │Wolf  │            │|
| │ │ 2×2  │ │ 0.5  │ │ 1×1  │            │|
| │ │[Use] │ │[Use] │ │[Use] │            │|
| │ │ [×]  │ │ [×]  │ │ [×]  │            │|
| │ └──────┘ └──────┘ └──────┘            │|
| └────────────────────────────────────────┘|
+------------------------------------------+
```

**UI Elements:**
- **Current Appearance Section**: Same as now - image preview, change/clear buttons, size presets
- **Save as Variant Button**: Saves current image + size as a named variant
- **Variant Grid**: Shows saved variants with thumbnail preview, name, size indicator
- **Use Button**: Switches to that variant
- **Delete Button (×)**: Removes the variant

### 4. Variant Selection Flow

When user clicks "Use" on a variant:

```typescript
const handleUseVariant = async (variant: AppearanceVariant) => {
  // 1. Set the variant as active
  setActiveVariant(tokenId, variant.id);
  
  // 2. Load the image from IndexedDB using imageHash
  if (variant.imageHash) {
    const imageUrl = await loadTokenTexture(variant.imageHash);
    setImageUrlValue(imageUrl);
  }
  
  // 3. Update size values
  setGridWidthValue(variant.gridWidth);
  setGridHeightValue(variant.gridHeight);
  
  // 4. Apply to token immediately
  updateTokenSize(tokenId, variant.gridWidth, variant.gridHeight);
  if (variant.imageHash) {
    updateTokenImage(tokenId, imageUrl, variant.imageHash);
  }
};
```

### 5. Save Variant Flow

```typescript
const handleSaveVariant = async () => {
  // Create variant from current settings
  const variant: AppearanceVariant = {
    id: `variant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: variantNameInput,  // User-provided name
    imageHash: currentToken.imageHash,
    gridWidth: gridWidthValue,
    gridHeight: gridHeightValue,
    isDefault: (currentToken.appearanceVariants?.length ?? 0) === 0, // First one is default
  };
  
  addAppearanceVariant(tokenId, variant);
};
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/stores/sessionStore.ts` | Add `AppearanceVariant` interface, extend `Token` with `appearanceVariants` and `activeVariantId`, add CRUD methods |
| `src/components/TokenContextMenu.tsx` | Restructure Appearance tab with variant management UI |
| `src/lib/commands/tokenCommands.ts` | (Optional) Add undo/redo commands for variant operations |

---

## UI/UX Details

### Saving a New Variant
1. User configures image and size in the Appearance tab
2. Clicks "Save as Variant" button
3. Small inline form appears or dialog asking for variant name
4. User enters name (e.g., "Bear Form") and confirms
5. Variant appears in the grid below

### Variant Card Design
```text
┌─────────────────────┐
│     ┌───────┐       │
│     │ [img] │       │  ← Circular thumbnail
│     └───────┘       │
│     Bear Form       │  ← Variant name
│     2×2 (Large)     │  ← Size description
│                     │
│  [Apply]   [Edit]   │  ← Action buttons
│     [Delete]        │
└─────────────────────┘
```

### Active Variant Indicator
- The currently active variant has a ring/border highlight
- When token is using a variant, show variant name somewhere visible

### Multi-Selection Handling
- When multiple tokens selected, variants section shows message: "Manage variants for individual tokens"
- Variant management disabled for multi-select to avoid complexity

---

## Sync Considerations

1. **Variants array syncs normally**: Small metadata, safe for JSON Patch
2. **imageHash references sync**: Actual texture data is handled by texture sync system
3. **No imageUrl in variants**: Only store hash, resolve URL from IndexedDB on client
4. **Persisted to localStorage**: Variants excluded from imageUrl issue (only hashes stored)

---

## Edge Cases

1. **Deleted texture**: If a variant references a hash that no longer exists in IndexedDB, show placeholder and option to re-upload
2. **Variant without image**: Allow variants that only change size (color token at different sizes)
3. **Default variant deletion**: Prompt user to select new default if deleting the default variant
4. **Duplicate names**: Allow (variants identified by ID), but warn user
5. **Maximum variants**: Soft limit of ~10 variants per token to keep UI manageable

---

## Future Enhancements

1. **Variant Hotkeys**: Assign keyboard shortcuts to variants for quick switching
2. **Conditional Variants**: Auto-switch based on HP, combat status, etc.
3. **Shared Variant Templates**: Save variant configurations to apply to other tokens
4. **Animation between variants**: Smooth transition when switching forms
