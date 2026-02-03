
# Phase 5: Token-Creature Linking Implementation

## Overview

Phase 5 completes the token-creature integration by enabling users to:
1. **Link existing tokens** to creatures from the library
2. **Unlink tokens** from their linked creature data

This allows tokens placed manually (not from the Creature Library) to be connected to creature data after the fact.

---

## Components to Modify

### 1. LinkedCreatureSection.tsx

**Current State**: Already displays linked creature quick stats, has an `onUnlink` prop that is not being passed.

**Changes**:
- Add a "Link Creature" UI when no creature is linked
- Include a search input with dropdown results showing both characters and monsters
- Clicking a creature links it to the token

**New UI Flow**:
```text
+--------------------------------------------------+
| No Linked Creature                               |
| Create tokens from the Creature Library to...    |
|                                                  |
| [🔗 Link to Creature]                            |
+--------------------------------------------------+

When clicked, expands to:
+--------------------------------------------------+
| 🔍 [Search creatures...]              [Cancel]   |
|--------------------------------------------------|
| Monsters:                                        |
|   🦴 Goblin (CR 1/4, Small humanoid)            |
|   🦴 Orc (CR 1/2, Medium humanoid)              |
| Characters:                                      |
|   👤 Tordek (Lvl 5 Dwarf Fighter)               |
+--------------------------------------------------+
```

### 2. TokenContextMenu.tsx

**Current State**: Renders `LinkedCreatureSection` without passing `onUnlink`.

**Changes**:
- Pass `onUnlink` handler to `LinkedCreatureSection`
- Pass `onLinkCreature` handler for linking functionality
- Wire up `updateTokenEntityRef` from sessionStore

---

## Technical Implementation

### LinkedCreatureSection Props Update

```typescript
interface LinkedCreatureSectionProps {
  token: Token | null;
  onViewStats: () => void;
  onUnlink?: () => void;
  onLinkCreature?: (creatureId: string, creatureType: 'character' | 'monster') => void;
}
```

### Link Creature Search UI

The search UI will:
1. Use a local state to toggle between "placeholder" and "search" modes
2. Query `searchMonsters` and `searchCharacters` with the input value
3. Display combined results (max 5-8 items) with type indicators
4. On selection, call `onLinkCreature` with the creature ID and type

### Unlink Handler in TokenContextMenu

```typescript
const handleUnlinkCreature = () => {
  if (!currentToken) return;
  updateTokenEntityRef(currentToken.id, undefined);
  toast.success('Creature unlinked from token');
};
```

### Link Handler in TokenContextMenu

```typescript
const handleLinkCreature = (creatureId: string, creatureType: 'character' | 'monster') => {
  if (!currentToken) return;
  updateTokenEntityRef(currentToken.id, {
    type: 'local',
    entityId: creatureId,
    projectionType: creatureType === 'monster' ? 'stat-block' : 'character',
  });
  toast.success(`Token linked to ${creatureType}`);
};
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/components/LinkedCreatureSection.tsx` | Add "Link Creature" search UI with character/monster results |
| `src/components/TokenContextMenu.tsx` | Wire up `onUnlink` and `onLinkCreature` handlers |
| `.lovable/plan.md` | Mark Phase 5 as complete |

---

## User Experience

### Linking a Token to a Creature
1. Right-click a token → Edit Token
2. Go to "Details" tab
3. Click "Link to Creature" button
4. Type to search creatures in the library
5. Click a result to link it
6. Token now shows creature quick stats

### Unlinking a Token
1. Right-click a linked token → Edit Token
2. Go to "Details" tab
3. Click the "Unlink" button (chain-break icon)
4. Creature data is removed, token remains unchanged visually

### Edge Cases Handled
- **Empty library**: Show message "No creatures in library. Import from Creature Library first."
- **Multi-selection**: Link/unlink disabled for multi-selection (too complex for batch operations)
- **Already linked**: Shows current creature with unlink option

