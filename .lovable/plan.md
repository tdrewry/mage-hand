
# Tabbed Edit Token Modal with ECS-Aware Architecture

## ✅ IMPLEMENTED

## Overview
Refactored the Edit Token modal into a three-tab interface (Label, Appearance, Details) with forward-compatible architecture for a future Entity Component System (ECS) where tokens act as visual pointers to entity data rather than containers of that data.

## Current State Analysis

The Edit Token modal (lines 523-657 of `TokenContextMenu.tsx`) currently displays all properties in a single view:
- Token Name (internal identifier)
- Display Label and Position
- Label Style Presets
- Token Image (upload/change)

**Missing functionality:**
- Token size editing (gridWidth/gridHeight exist but aren't editable)
- Character/creature data storage
- Entity linking capability

## Proposed Tab Structure

```text
+------------------------------------------+
|           Edit Token                      |
+------------------------------------------+
| [Label]  [Appearance]  [Details]          |
+------------------------------------------+
|                                           |
|   Tab content area                        |
|                                           |
+------------------------------------------+
```

---

## Tab 1: Label
All text and display-related properties (moved from current modal):

| Field | Description |
|-------|-------------|
| Token Name | Internal identifier |
| Display Label | Text shown on/near token |
| Label Position | Above / Center / Below buttons |
| Label Style | Preset grid (Default, Hostile, Friendly, Neutral, Warning, Stealth) |

---

## Tab 2: Appearance
Visual representation and size configuration:

| Field | Description |
|-------|-------------|
| Token Image | Preview + Change/Clear buttons |
| Token Size | Preset buttons + custom inputs |

**Size Presets (D&D-style):**
```text
+-----------+ +-----------+ +-----------+ +-----------+
|   Tiny    | |  Small/   | |   Large   | |   Huge    |
|   0.5x0.5 | |  Medium   | |    2x2    | |    3x3    |
|           | |    1x1    | |           | |           |
+-----------+ +-----------+ +-----------+ +-----------+
                                          
            +-----------+
            |Gargantuan |
            |    4x4    |
            +-----------+

Custom: [___] x [___] grid units
```

---

## Tab 3: Details (ECS-Aware Design)

This tab is architected as a **pointer interface** rather than a data container, anticipating future ECS integration.

### Current Implementation (Phase 1)
Simple fields that establish the pattern:

| Field | Purpose |
|-------|---------|
| Entity Link Section | Placeholder UI showing "Entity linking coming soon" with disabled dropdown |
| Quick Reference URL | Interim field for external links (D&D Beyond, wikis, etc.) |
| Token Notes | GM-only notes that stay on the token (not part of entity data) |

### Future Vision (Phase 2+)
When ECS is implemented, this tab transforms into:

```text
+------------------------------------------+
| Entity Reference                          |
| [Select entity...              v]         |
|                                           |
| Projection Type                           |
| [Stat Block v] [Character] [Creature]     |
|                                           |
| Source: local | remote                    |
| Endpoint: https://api.example.com/...     |
|                                           |
+------------------------------------------+
| Token Notes (local, not synced to entity) |
| [________________________]                |
+------------------------------------------+
```

### ECS-Ready Data Model

The Token interface will include an `entityRef` field designed for future expansion:

```typescript
// Phase 1: Simple structure
entityRef?: {
  type: 'none' | 'local' | 'remote';
  entityId?: string;         // Pointer to entity in ECS store
  source?: string;           // URL or storage key
  projectionType?: string;   // 'stat-block' | 'character' | 'creature' | etc.
};

// Token-specific data (NOT part of entity)
notes?: string;              // GM notes attached to this token instance
quickReferenceUrl?: string;  // Temporary bridge field
```

**Key Design Principle:** The token's `notes` field is intentionally separate from entity data. This allows:
- Same entity linked to multiple tokens with different notes
- Token-specific combat notes without polluting entity data
- Entity data to be managed independently of tokens

---

## Technical Implementation

### 1. Extend Token Interface
**File:** `src/stores/sessionStore.ts`

Add new fields to the Token interface:

```typescript
export interface Token {
  // ... existing fields ...
  
  // ECS-ready entity reference (Phase 1: mostly unused)
  entityRef?: {
    type: 'none' | 'local' | 'remote';
    entityId?: string;
    source?: string;
    projectionType?: string;
  };
  
  // Token-instance data (separate from linked entity)
  notes?: string;              // GM notes for this token instance
  quickReferenceUrl?: string;  // Bridge field for external links
}
```

### 2. Add Store Methods
**File:** `src/stores/sessionStore.ts`

```typescript
// Update token size
updateTokenSize: (tokenId: string, gridWidth: number, gridHeight: number) => void;

// Update token details (notes and reference URL)
updateTokenDetails: (tokenId: string, notes?: string, quickReferenceUrl?: string) => void;

// Future: Update entity reference
updateTokenEntityRef: (tokenId: string, entityRef: Token['entityRef']) => void;
```

### 3. Refactor Edit Token Modal
**File:** `src/components/TokenContextMenu.tsx`

**New state variables:**
```typescript
const [activeTab, setActiveTab] = useState<'label' | 'appearance' | 'details'>('label');
const [gridWidthValue, setGridWidthValue] = useState(1);
const [gridHeightValue, setGridHeightValue] = useState(1);
const [notesValue, setNotesValue] = useState('');
const [quickReferenceUrlValue, setQuickReferenceUrlValue] = useState('');
```

**Modal structure transformation:**
```tsx
<DialogContent className="max-w-md">
  <DialogHeader>...</DialogHeader>
  
  <Tabs value={activeTab} onValueChange={setActiveTab}>
    <TabsList className="grid w-full grid-cols-3">
      <TabsTrigger value="label">Label</TabsTrigger>
      <TabsTrigger value="appearance">Appearance</TabsTrigger>
      <TabsTrigger value="details">Details</TabsTrigger>
    </TabsList>
    
    <TabsContent value="label">
      {/* Name, Label, Position, Style Presets */}
    </TabsContent>
    
    <TabsContent value="appearance">
      {/* Image preview, Size presets, Custom size */}
    </TabsContent>
    
    <TabsContent value="details">
      {/* Entity link placeholder, Quick URL, Notes */}
    </TabsContent>
  </Tabs>
  
  <DialogFooter>...</DialogFooter>
</DialogContent>
```

### 4. Add Undo/Redo Support
**File:** `src/lib/commands/tokenCommands.ts`

Add `UpdateTokenSizeCommand` and `UpdateTokenDetailsCommand` for undo/redo support.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/stores/sessionStore.ts` | Add `entityRef`, `notes`, `quickReferenceUrl` fields; add `updateTokenSize`, `updateTokenDetails` methods |
| `src/components/TokenContextMenu.tsx` | Refactor Edit modal to use Tabs; add size selection; add Details tab UI |
| `src/lib/commands/tokenCommands.ts` | Add `UpdateTokenSizeCommand`, `UpdateTokenDetailsCommand` |

---

## Multi-Selection Handling

| Tab | Behavior |
|-----|----------|
| Label | Empty fields allow batch update; entering value applies to all |
| Appearance | Size shows "Mixed" if different; image change applies to all |
| Details | Shows notice "Multiple tokens selected"; notes/URL apply to all (with implicit confirmation) |

---

## Edge Cases

1. **Entity linking (future):** When ECS is added, selecting an entity will auto-populate projection options based on available schema
2. **Notes vs Entity data:** Clear UI distinction - notes are token-local, entity data comes from the linked entity
3. **Mixed sizes:** Display current sizes and allow override with explicit "Apply to all" semantics
4. **URL validation:** Basic format check for quickReferenceUrl, but accept any valid URL

---

## Future ECS Integration Path

When the Entity Component System is ready:

1. Replace "Entity linking coming soon" placeholder with actual entity picker
2. Add projection type selector that queries available schema
3. Implement data fetching from local store or remote endpoint
4. Display read-only entity data in a collapsible preview section
5. Keep `notes` field separate as token-instance data

This architecture ensures tokens remain lightweight visual representations while entity data lives in the appropriate ECS store.
