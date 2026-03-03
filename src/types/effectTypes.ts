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
  | 'rectangle-burst'
  | 'polyline';

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

// Damage dice entry (supports multiple damage types, e.g. Flame Strike)
export interface DamageDiceEntry {
  formula: string;     // e.g. "4d6", "2d10+4"
  damageType: string;  // e.g. "fire", "radiant"
}

// Multi-drop configuration (e.g. Storm of Vengeance, Meteor Swarm)
export interface MultiDropConfig {
  count: number;                // how many instances to place
  perDropShape?: EffectShape;   // override shape per drop (defaults to template shape)
  perDropRadius?: number;       // override radius per drop
}

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
  maxLength?: number;     // polyline — max total path length in grid units
  segmentWidth?: number;  // polyline — wall thickness in grid units (default 0.2)

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
  damageType?: string;     // fire, cold, lightning, etc. (legacy single type)
  /** Multiple damage dice entries — e.g. Flame Strike: 4d6 fire + 4d6 radiant */
  damageDice?: DamageDiceEntry[];
  description?: string;

  /** If true this is a built-in template that cannot be deleted */
  isBuiltIn?: boolean;

  /** If true, the caster token is included in hit-testing (default false) */
  targetCaster?: boolean;

  /** If true, effect can be placed at a distance from the source token (ranged spell) */
  ranged?: boolean;

  /** If true, skip the rotation/direction step during placement (e.g. circles that don't need aiming) */
  skipRotation?: boolean;

  /** Multi-drop configuration for effects that place multiple instances */
  multiDrop?: MultiDropConfig;
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

  /** Links multi-drop instances for shared resolution */
  groupId?: string;

  /** Polyline waypoints (world coords) — for polyline shape */
  waypoints?: { x: number; y: number }[];
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

export type EffectPlacementStep = 'origin' | 'direction' | 'polyline';

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

  // Multi-drop tracking
  /** Shared group ID for all drops in this multi-drop placement */
  multiDropGroupId?: string;
  /** Total number of drops to place */
  multiDropTotal?: number;
  /** Number of drops already placed (0-indexed) */
  multiDropPlaced?: number;

  // Polyline waypoint tracking
  /** Committed waypoints so far (world coords) */
  polylineWaypoints?: { x: number; y: number }[];
  /** Total polyline length used so far (in grid units) */
  polylineLengthUsed?: number;
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

/**
 * Returns true if the shape is a polyline (wall-style waypoint placement).
 */
export function isPolylineShape(shape: EffectShape): boolean {
  return shape === 'polyline';
}
