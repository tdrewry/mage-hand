# Complex Effect Types Plan

## Overview
Extend the effect template system to support multi-drop effects and variable-shape walls.

## 1. Multi-Drop Effects
**Use case**: Storm of Vengeance (6× 5ft circles), Meteor Swarm (4× 40ft spheres)

### Data Model
```typescript
// Add to EffectTemplate
multiDrop?: {
  count: number;           // how many instances to place
  perDropShape?: EffectShape; // override shape per drop (defaults to template shape)
  perDropRadius?: number;     // override radius per drop
};
```

### Placement Flow
- Enter placement mode → user clicks `count` times on map
- Each click places one sub-effect; a shared `groupId` links them
- All sub-effects share the same `groupId` for unified targeting/resolution
- Preview shows remaining count ("3 of 6 placed")
- Right-click or Escape cancels remaining placements
- Hit-testing unions all sub-effect impacts into one Action Card

### PlacedEffect Changes
```typescript
// Add to PlacedEffect
groupId?: string;  // links multi-drop instances for shared resolution
```

## 2. Variable-Shape Walls (Polyline)
**Use case**: Wall of Fire (60ft), Wall of Force (100ft in panels), Wall of Thorns

### Approach: Polyline Shape
Add `'polyline'` as a new `EffectShape`. The user clicks waypoints to draw the wall path.

### Data Model
```typescript
// Add to EffectShape union
type EffectShape = ... | 'polyline';

// Add to EffectTemplate
maxLength?: number;  // max total path length in grid units (e.g., 12 for 60ft)
segmentWidth?: number; // wall thickness in grid units (default: 0.2 or 1ft)

// Add to PlacedEffect
waypoints?: { x: number; y: number }[]; // polyline vertices (world coords)
```

### Placement Flow
- Enter placement mode → click to add waypoints
- Live preview shows wall segments with remaining length indicator
- Double-click or press Enter to finalize
- Each segment snaps to grid if alignToGrid is enabled
- Total length is enforced: when maxLength is reached, auto-finalize

### Hit-Testing
- Walk each segment of the polyline
- For each segment, treat as a rotated rectangle (segment length × wall width)
- Union all segment hit results

### Rendering
- Draw each segment as a filled rectangle along the polyline path
- Apply texture/animation uniformly across all segments
- Joints get rounded caps or mitered corners

## 3. Token-Assigned Actions (Future)
- Tokens will have configured actions that can launch specific effect templates
- This bridges the Action Card system with the Effect system
- Will be addressed after the card-based effect flow is stable
- Likely model: `TokenAction { effectTemplateId, damageFormula, ... }`

## Implementation Status
1. ✅ **Multi-drop** — implemented with `groupId` + count-based placement loop. Templates: Storm of Vengeance, Meteor Swarm.
2. ✅ **Polyline walls** — new `'polyline'` shape type with waypoint placement, max length enforcement, segment hit-testing, and rendering. Wall of Fire converted to polyline.
3. **Token actions** — separate task, depends on stable effect + action card integration

## Design Notes
- Multi-drop effects resolve as ONE action in the Action Card (all targets merged)
- Polyline walls are persistent by default (walls don't make sense as instant)
- Both features work with ranged placement (origin away from caster)
