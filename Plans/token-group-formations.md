# Token Group & Formation System

## Overview
Token groups are **logical** groupings of tokens (e.g. "The Party", "Kobold Patrol") 
separate from the spatial entity-groups in `groupStore`. They persist across maps and 
sessions, support named formations, and integrate with the Campaign Editor's deployment 
zone placement.

## Data Model
- **TokenGroup**: `{ id, name, tokenIds[], formation, color?, icon? }`
- **Formation**: `'freeform' | 'line' | 'wedge' | 'circle' | 'square' | 'column'`
- Formations define relative offsets from a centroid, applied when moving the group as a 
  unit or deploying into a zone.

## Formation Presets (BG2/BG3 inspired)
| Formation | Description |
|-----------|-------------|
| freeform  | No automatic positioning (default) |
| line      | Single horizontal row |
| column    | Single-file vertical line |
| wedge     | V-shape with leader at front |
| circle    | Ring around center |
| square    | Grid/box arrangement |

## Store: `tokenGroupStore.ts`
- CRUD for token groups
- Formation getter that returns `{dx, dy}[]` offsets for N members
- Persisted via zustand/persist

## UI
- New card `TokenGroupManagerCard` accessible from Menu → DM Tools
- List view: shows all groups, click to edit
- Edit view: name, color, formation picker, token multi-select
- Formation preview: small visual showing dot arrangement

## Campaign Editor Integration
- Encounter node's `tokenGroupId` field should reference token groups by ID
- Deployment zone placement uses the group's active formation to spread tokens

## Version
Bumps APP_VERSION on implementation.
