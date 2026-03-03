/**
 * Effect Template System Types
 *
 * Defines the data model for spell effects, traps, and environmental hazards
 * that can be placed on the map. Effects perform hit-testing to identify
 * impacted tokens/map objects and feed results into the Action Card.
 */

// ---------------------------------------------------------------------------
// Shape & animation enums
// ---------------------------------------------------------------------------

export type EffectShape =
  | 'circle'
  | 'line'
  | 'cone'
  | 'rectangle'
  | 'circle-burst'
  | 'rectangle-burst';

export type EffectAnimationType =
  | 'none'
  | 'flicker'
  | 'crackle'
  | 'pulse'
  | 'expand'
  | 'swirl';

export type EffectPlacementMode = 'free' | 'caster' | 'both';
export type EffectPersistence = 'instant' | 'persistent';
export type EffectCategory = 'spell' | 'trap' | 'hazard' | 'custom';

// ---------------------------------------------------------------------------
// Template (library definition — reusable blueprint)
// ---------------------------------------------------------------------------

export interface EffectTemplate {
  id: string;
  name: string;

  // Shape & dimensions (in grid units)
  shape: EffectShape;
  radius?: number;        // circle / burst
  length?: number;        // line / cone
  width?: number;         // line / rectangle
  angle?: number;         // cone — full angle in degrees

  // Placement
  placementMode: EffectPlacementMode;
  /** If true, effect rotation snaps to the nearest 45° grid axis */
  alignToGrid?: boolean;

  // Persistence
  persistence: EffectPersistence;
  durationRounds?: number; // persistent effects: 0 = until dismissed
  /** If true, triggeredTokenIds reset each round so tokens re-trigger. Default: true for persistent effects. */
  recurring?: boolean;

  // Visual
  color: string;           // primary colour (hex)
  secondaryColor?: string; // gradient/accent colour
  opacity: number;         // 0-1
  texture?: string;        // data URL or asset key
  animation: EffectAnimationType;
  animationSpeed: number;  // multiplier (0.5-3)

  // Metadata
  category: EffectCategory;
  level?: number;          // spell level
  damageType?: string;     // fire, cold, lightning, etc.
  description?: string;

  /** If true this is a built-in template that cannot be deleted */
  isBuiltIn?: boolean;

  /** If true, the caster token is included in hit-testing (default false) */
  targetCaster?: boolean;
}

// ---------------------------------------------------------------------------
// Placed instance (on the map)
// ---------------------------------------------------------------------------

export interface PlacedEffect {
  id: string;
  templateId: string;
  /** Snapshot of the template at placement time */
  template: EffectTemplate;

  // World-coordinate origin
  origin: { x: number; y: number };
  /** Direction the effect points (radians from +X). Used for cones/lines. */
  direction?: number;

  // Caster
  casterId?: string; // token ID

  // Lifecycle
  placedAt: number;         // performance.now() or Date.now()
  roundsRemaining?: number; // persistent effects
  mapId: string;

  /** When set (performance.now()), the effect is fading out and will be auto-removed */
  dismissedAt?: number;

  /** When true, the effect's animation is paused (renders static) */
  animationPaused?: boolean;

  // Hit-test results (computed on placement / trigger)
  impactedTargets: EffectImpact[];

  /** Token IDs that have already triggered this effect (prevents re-triggering) */
  triggeredTokenIds: string[];
}

// ---------------------------------------------------------------------------
// Hit-test result
// ---------------------------------------------------------------------------

export interface EffectImpact {
  targetId: string;
  targetType: 'token' | 'mapObject';
  /** Distance from effect origin in grid units */
  distanceFromOrigin: number;
  /** 0-1 — how much of the target footprint overlaps the effect area */
  overlapPercent: number;
}

// ---------------------------------------------------------------------------
// Placement-mode state (while the user is aiming an effect)
// ---------------------------------------------------------------------------

export type EffectPlacementStep = 'origin' | 'direction';

export interface EffectPlacementState {
  templateId: string;
  template: EffectTemplate;
  casterId?: string;
  /** Override damage formula for this placement (e.g. "8d6") */
  damageFormula?: string;
  /** Current step in the two-step placement flow */
  step: EffectPlacementStep;
  /** Locked origin point (set after first click) */
  origin: { x: number; y: number } | null;
  /** Live preview position (world coords) — cursor position */
  previewOrigin: { x: number; y: number } | null;
  /** Live preview direction (radians) */
  previewDirection: number;

  /** Snapshot of the caster token's position and size (for token-sourced placement) */
  casterToken?: {
    x: number;
    y: number;
    gridWidth: number;
    gridHeight: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function createEffectId(): string {
  return `fx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Returns true if the shape is a burst variant (caster-centered, excludes caster).
 */
export function isBurstShape(shape: EffectShape): boolean {
  return shape === 'circle-burst' || shape === 'rectangle-burst';
}

/**
 * Returns true if the shape requires a direction (cones, lines).
 */
export function isDirectionalShape(shape: EffectShape): boolean {
  return shape === 'cone' || shape === 'line';
}
