# Effect Template System

## Overview
A system for placing animated spell effects, traps, and environmental hazards on the map. Effects perform hit-testing to identify impacted tokens/map objects and feed results into the Action Card for damage resolution.

## Shapes
1. **Circle/Sphere** — radius from a point (fireball, darkness, silence)
2. **Line/Wall** — width × length from origin (lightning bolt, wall of fire)
3. **Cone** — angular spread from origin (burning hands, cone of cold)
4. **Rectangle/Cube** — rectangular area (grease, web, cloud)
5. **Burst variants** — Circle Burst / Rectangle Burst centered on caster, radiating outward, **excluding caster from effect**

## Placement Modes
- **Free placement**: Click a point on the map; effect appears there. Optional drag to aim (for cones/lines).
- **Caster-relative**: Select a casting token first, then drag to aim/place relative to caster position. Used for cones, lines, and bursts.
- Templates define which mode(s) they support.

## Persistence
- **Instant**: Flash + fade animation (fireball explosion), then removed. Hit-test runs once on placement.
- **Persistent**: Stays on map (wall of fire, cloud). Hit-test runs on placement AND when tokens enter/exit the area. DM can dismiss manually or set duration (rounds).
- Template metadata defines which type.

## Visual Properties
- **Texture/Color**: Base fill color, optional texture image (fire, ice, lightning patterns)
- **Transparency**: Alpha level for the effect overlay
- **Animation**: Per-shape animation type:
  - `flicker` — fire effects (wall of fire, fireball)
  - `crackle` — lightning/electric effects
  - `pulse` — magical aura effects
  - `expand` — explosion/burst (instant effects)
  - `swirl` — vortex/cloud effects
  - `none` — static effect
- **Border**: Optional animated border glow

## Hit-Testing
- On placement (or trigger for traps): compute which tokens and map objects overlap the effect shape
- Uses grid-aware intersection: token footprint (considering size/hex) vs effect geometry
- Returns `EffectImpact[]` with target refs, sorted by distance from origin
- **Burst exclusion**: Burst variants exclude the caster token from the impact list
- Results feed directly into Action Card for multi-target damage resolution

## Data Model

```typescript
// Effect template definition (library of reusable templates)
interface EffectTemplate {
  id: string;
  name: string;           // "Fireball", "Wall of Fire", "Lightning Bolt"
  shape: EffectShape;     // 'circle' | 'line' | 'cone' | 'rectangle' | 'circle-burst' | 'rectangle-burst'
  
  // Dimensions (in grid units)
  radius?: number;        // circle/burst
  length?: number;        // line/cone
  width?: number;         // line/rectangle
  angle?: number;         // cone (degrees)
  
  // Placement
  placementMode: 'free' | 'caster' | 'both';
  
  // Persistence
  persistence: 'instant' | 'persistent';
  durationRounds?: number; // for persistent effects, 0 = until dismissed
  
  // Visual
  color: string;          // primary color (hex)
  secondaryColor?: string;
  opacity: number;        // 0-1
  texture?: string;       // texture data URL or key
  animation: EffectAnimationType;
  animationSpeed: number; // multiplier
  
  // Metadata
  category: 'spell' | 'trap' | 'hazard' | 'custom';
  level?: number;         // spell level
  damageType?: string;    // fire, cold, lightning, etc.
  description?: string;
}

// Placed effect instance on the map
interface PlacedEffect {
  id: string;
  templateId: string;
  template: EffectTemplate; // snapshot of template at placement time
  
  // Position (world coordinates)
  origin: { x: number; y: number };
  direction?: number;     // radians, for cones/lines
  
  // Caster info
  casterId?: string;      // token ID of caster
  
  // State
  placedAt: number;       // timestamp
  roundsRemaining?: number;
  mapId: string;
  
  // Computed on placement
  impactedTargets: EffectImpact[];
}

interface EffectImpact {
  targetId: string;
  targetType: 'token' | 'mapObject';
  distanceFromOrigin: number; // grid units
  overlapPercent: number;     // 0-1, how much of the target is in the effect
}

type EffectShape = 'circle' | 'line' | 'cone' | 'rectangle' | 'circle-burst' | 'rectangle-burst';
type EffectAnimationType = 'none' | 'flicker' | 'crackle' | 'pulse' | 'expand' | 'swirl';
```

## UI Integration

### Toolbar Button
- New toolbar button (wand/sparkle icon) opens an **Effects Panel** flyout
- Panel shows template library grouped by category (Spells, Traps, Hazards, Custom)
- Select a template → enter placement mode (cursor changes, shows preview outline)
- Click/drag on map to place

### Action Card Integration
- When effect is placed from a caster token → Action Card opens with:
  - Effect name + visual
  - List of impacted targets (auto-populated from hit-test)
  - Damage/save resolution controls (reusing existing Action Card multi-target flow)
- When a persistent effect is triggered (token walks into it) → same Action Card flow
- Trap effects: placed by DM in setup, hidden from players, trigger when token enters

### Canvas Rendering
- Effects render on a dedicated canvas layer (above regions, below UI overlays)
- Use existing animation loop timing for effect animations
- Persistent effects participate in the render loop
- Instant effects run a brief animation sequence then self-remove

## Implementation Phases

### Phase 1: Core Types & Store
- Define types in `src/types/effectTypes.ts`
- Create `src/stores/effectStore.ts` (Zustand)
- Built-in template library (Fireball, Lightning Bolt, Cone of Cold, Wall of Fire, Grease, Web)

### Phase 2: Hit-Testing Engine
- `src/lib/effectHitTesting.ts` — geometry intersection for all shapes vs token footprints
- Handle burst exclusion, multi-size tokens, hex grids

### Phase 3: Canvas Rendering
- `src/lib/effectRenderer.ts` — draw effects on canvas with animations
- Integrate into SimpleTabletop render loop

### Phase 4: Placement UI
- Placement mode in SimpleTabletop (preview outline, cursor, click/drag)
- Toolbar button + Effects Panel card

### Phase 5: Action Card Integration
- Wire hit-test results into Action Card multi-target flow
- Trap trigger detection (token movement into persistent effect area)

### Phase 6: Polish
- Preset texture library for common damage types
- Sound effect hooks (future)
- Network sync for multiplayer
