
# Plan: Convert Styles Card to Map Card with Tabbed Interface

## Overview
This plan refactors the "Styles" button and card into a "Map" button with a tabbed panel containing two sections: **Utilities** (with door controls) and **Styles** (existing hatching and edge style controls).

## Changes Summary

### 1. Rename CardType and Update References

**File: `src/types/cardTypes.ts`**
- Rename `CardType.STYLES` to `CardType.MAP_UTILITIES` (or keep as STYLES for backward compatibility, but update the display title)

**Approach**: Keep `CardType.STYLES` internally but update the display title to "Map" in the UI. This minimizes breaking changes to saved layouts.

---

### 2. Add `closeAllDoors` Action to Map Object Store

**File: `src/stores/mapObjectStore.ts`**

Add a new action to close all doors on the map:

```typescript
// Add to interface
closeAllDoors: () => void;

// Implementation
closeAllDoors: () => {
  set((state) => ({
    mapObjects: state.mapObjects.map((obj) => {
      if (obj.category === 'door') {
        return {
          ...obj,
          isOpen: false,
          blocksVision: true,
        };
      }
      return obj;
    }),
  }));
},
```

---

### 3. Create Tabbed Map Card Component

**File: `src/components/cards/StylesCard.tsx`** (refactored)

Restructure the component to use Radix UI Tabs:

```text
+----------------------------------+
| [Utilities]  [Styles]            |  <- Tab list
+----------------------------------+
| Utilities Tab:                   |
|  - Close All Doors button        |
|  - (Future utility actions)      |
|                                  |
+----------------------------------+
| Styles Tab:                      |
|  - Edge Hatching controls        |
|  - Quick Presets                 |
|  - Current Style display         |
|  - Manual Controls               |
+----------------------------------+
```

Structure:
- Wrap content in `<Tabs defaultValue="utilities">` 
- Create `<TabsList>` with two triggers: "Utilities" and "Styles"
- Move existing styles content into `<TabsContent value="styles">`
- Create new `<TabsContent value="utilities">` with door controls

---

### 4. Update Toolbar Button Labels

**File: `src/components/VerticalToolbar.tsx`**

Update the Styles button to show "Map" instead:

- **Edit mode (line ~291)**: Change `label="Styles"` to `label="Map"`
- **Play mode (line ~394)**: Change `label="Styles"` to `label="Map"`

---

### 5. Update Card Store Title

**File: `src/stores/cardStore.ts`**

Update the default config for the STYLES card:
- Change `title: 'Styles'` to `title: 'Map'`

---

### 6. Update CardManager Title Mapping

**File: `src/components/CardManager.tsx`**

Update the `getCardTitle` function:
- Change `[CardType.STYLES]: 'Styles'` to `[CardType.STYLES]: 'Map'`

---

## Implementation Details

### Utilities Tab Content

```tsx
<TabsContent value="utilities" className="space-y-4">
  <div className="p-4 space-y-4">
    {/* Doors Section */}
    <div className="space-y-3">
      <Label className="text-sm font-semibold">Doors</Label>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          closeAllDoors();
          toast.success('All doors closed');
        }}
        className="w-full"
      >
        <DoorClosed className="h-4 w-4 mr-2" />
        Close All Doors
      </Button>
      <p className="text-xs text-muted-foreground">
        Closes all doors on the map, blocking vision through them.
      </p>
    </div>
  </div>
</TabsContent>
```

### Dependencies
- Use existing `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs`
- Import `DoorClosed` icon from `lucide-react` (or use existing door-related icon)
- Import `useMapObjectStore` to access `closeAllDoors`

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/stores/mapObjectStore.ts` | Add `closeAllDoors()` action |
| `src/components/cards/StylesCard.tsx` | Add tabs structure with Utilities and Styles tabs |
| `src/components/VerticalToolbar.tsx` | Change button labels from "Styles" to "Map" |
| `src/stores/cardStore.ts` | Update default title to "Map" |
| `src/components/CardManager.tsx` | Update title mapping to "Map" |

---

## Future Extensibility

The Utilities tab provides a home for additional map-wide actions:
- "Open All Doors"
- "Reset All Token Positions"
- "Clear All Fog"
- "Show/Hide All Labels"
