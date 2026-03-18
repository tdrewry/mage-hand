# Mage-Hand Core Lexicon

This document establishes the canonical terminology, interface shapes, and schema definitions used throughout the Mage-Hand codebase. Consistency in these terms is vital for maintainability and clear communication.

## Canvas Entity (Umbrella Term)

A **Canvas Entity** is any object that can be placed, selected, moved, grouped, and rendered on the map canvas. Canvas Entities support shared operations: bulk selection, bulk delete, grouping, and drag-move.

| Canonical Name | TypeScript Type | Store | Selectable? | Bulk Delete? |
|---|---|---|---|---|
| **Token** | `Token` | `sessionStore` | ✅ | ✅ |
| **Region** | `CanvasRegion` | `regionStore` | ✅ | ✅ |
| **Map Object** | `MapObject` | `mapObjectStore` | ✅ | ✅ (respects lock) |
| **Light** | `LightSource` | `lightStore` | ✅ | ✅ |
| **Group** | `EntityGroup` | `groupStore` | ✅ | ✅ (dissolves container) |
| **Effect** | `PlacedEffect` | `effectStore` | ✅ | — (dismissed, not deleted) |

> **Usage:** When writing code or documentation that applies across multiple entity types, use "canvas entity" / "canvas entities" rather than an ad-hoc list like "tokens, regions, and objects."

---

## Core Entities

### Token (`Token`)
The fundamental unit of representation on the map. Represents Characters, Monsters, NPCs, and sometimes generic markers.
*   **Key Fields:** `id`, `x`, `y`, `gridWidth`, `gridHeight`, `imageHash`, `roleId`, `hp`, `ac`, `initiative`.
*   **Location:** `src/stores/sessionStore.ts`
*   **Sync Target:** `JazzToken` (Fine-grained sync)

### Map Object (`MapObject`)
Interactive, static elements placed on the grid. They can block movement, block vision, and cast shadows.
*   **Categories:** `door`, `wall`, `column`, `furniture`, `light`, `portal`, etc.
*   **Key Fields:** `position`, `width`, `height`, `shape`, `blocksVision`, `isOpen` (for doors).
*   **Location:** `src/types/mapObjectTypes.ts`
*   **Sync Target:** `JazzMapObject`

### Region (`CanvasRegion`)
Drawn vector shapes on the canvas used for terrain, hazards, annotations, or logical zones.
*   **Types:** Fog, Water, Traps, etc.
*   **Key Fields:** `pathPoints`, `bezierControlPoints`, `gridSnapping`.
*   **Location:** `src/stores/regionStore.ts`
*   **Sync Target:** `JazzRegion`

### Light (`LightSource`)
A point or ambient light emitter placed on the map. Affects fog-of-war visibility calculations and shadow casting.
*   **Key Fields:** `position`, `radius`, `color`, `intensity`, `castsShadows`.
*   **Location:** `src/stores/lightStore.ts`
*   **Sync Target:** `JazzIlluminationSource`

### Group (`EntityGroup`)
A named container that binds two or more Canvas Entities together. Selecting any member selects the whole group. Groups can be locked to prevent accidental edits. Dissolving a group removes the container but leaves all member entities intact.
*   **Key Fields:** `name`, `members` (array of `{ id, type }`), `locked`.
*   **Location:** `src/stores/groupStore.ts`

### Effect (`PlacedEffect`)
A spell, capability, or hazard dropped onto the map, created from an `EffectTemplate`. Handles area-of-effect calculations and hit-testing against Tokens and MapObjects.
*   **Key Fields:** `templateId`, `origin`, `direction`, `casterId`, `impactedTargets`, `roundsRemaining`.
*   **Location:** `src/types/effectTypes.ts`
*   **Sync Target:** `JazzPlacedEffect`

### Creature / StatBlock
The complex data underlying a Token, representing its full D&D 5e mechanical capabilities (actions, skills, abilities). Can originate from an importer (e.g., 5e.tools, D&D Beyond).
*   **Key Definitions:** `Monster5eTools`, `DndBeyondCharacter`, `CreatureRef`
*   **Location:** `src/types/creatureTypes.ts`

### Action (`ActionQueueEntry`)
The representation of an ongoing or resolved interaction between entities (e.g., an Attack or Spell cast). Tracks the multi-step flow of target selection, rolling, damage calculation, and GM resolution.
*   **Key Fields:** `phase`, `sourceTokenId`, `targets`, `rollResults`, `damageResults`.
*   **Location:** `src/types/actionTypes.ts`

## System Concepts

### Jazz CoValue
The foundational data structure of the Jazz transport layer. A Conflict-free Replicated Data Type (CRDT) that automatically resolves multi-client concurrent edits.
*   **`co.map`**: A key-value CoValue.
*   **`co.list`**: An ordered list CoValue.
*   **`co.feed`**: An append-only feed (used for cursors and chat).

### Sync Patch
The Zustand middleware (`syncPatch`) that intercepts local store mutations to broadcast them, or applies incoming network patches to the local store safely without triggering an echo.

### Durable Objects (DO)
A legacy terminology in the codebase referring to holistic JSON state blobs that are synced via the `JazzDOBlob` mechanism rather than fine-grained CoValues (e.g., Initiative Order, Fog of War state).
*   **Location:** `src/lib/durableObjects.ts`

### Hit-Testing
The process of determining which Tokens or MapObjects intersect with an Effect area (cone, line, circle) and calculating their overlap percentage.

### Multi-Writer
The architecture pattern where any connected client (Player or DM) can mutate state directly, reliant on the Jazz engine to merge these changes deterministically without a central authoritative server doing the conflict resolution.
