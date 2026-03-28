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
  | 'swirl'
  | 'rotate';

export type EffectPlacementMode = 'free' | 'caster' | 'both';
/** Rotation direction for 'rotate' animation */
export type EffectRotateDirection = 'cw' | 'ccw';
export type EffectPersistence = 'instant' | 'persistent';
export type EffectCategory = 'spell' | 'trap' | 'hazard' | 'trait' | 'custom';

// ---------------------------------------------------------------------------
// Duration & timing enums (v0.6.36)
// ---------------------------------------------------------------------------

/** Unified duration model */
export type EffectDurationType = 'instantaneous' | 'timed' | 'infinite';

/** Whether the template shape persists on the map or is removed after targeting */
export type EffectTemplateMode = 'persistent' | 'targeting-only';

/** When an impact (modifier/condition) triggers relative to a token's position in the effect area */
export type EffectTriggerTiming = 'on-enter' | 'on-exit' | 'on-stay';

// ---------------------------------------------------------------------------
// Aura configuration
// ---------------------------------------------------------------------------

/** Configuration for aura-type effects that lock to a token */
export interface AuraConfig {
  /** Whether the aura affects the source token itself (default false) */
  affectSelf?: boolean;
  /** Whether the aura is blocked by walls (default true) */
  wallBlocked?: boolean;
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

export interface MapTemplateDefinition {
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

  // Persistence (legacy)
  persistence: EffectPersistence;
  durationRounds?: number; // persistent effects: 0 = until dismissed
  /** If true, triggeredTokenIds reset each round so tokens re-trigger. Default: true for persistent effects. */
  recurring?: boolean;

  // Duration model (v0.6.36 — unified replacement for persistence + durationRounds)
  /** Unified duration type: instantaneous (one-shot), timed (N rounds), infinite (until dismissed/cancelled) */
  durationType?: EffectDurationType;
  /** Whether the visual template stays on the map or is removed after initial targeting */
  templateMode?: EffectTemplateMode;

  // Visual
  color: string;           // primary colour (hex)
  secondaryColor?: string; // gradient/accent colour
  opacity: number;         // 0-1
  texture?: string;        // data URL or asset key
  /** SHA-256 hash of the texture for IndexedDB recovery (localStorage stores only this) */
  textureHash?: string;
  textureScale?: number;   // scale multiplier for texture (default 1)
  textureOffsetX?: number; // horizontal offset in pixels
  textureOffsetY?: number; // vertical offset in pixels
  textureRepeat?: boolean; // if true, tile texture instead of cover-fit
  animation: EffectAnimationType;
  animationSpeed: number;  // multiplier (0.5-3)
  /** Rotation direction for 'rotate' animation: 'cw' (clockwise, default) or 'ccw' */
  rotateDirection?: EffectRotateDirection;

  // Metadata
  category: EffectCategory;
  description?: string;

  /** If true this is a built-in template that cannot be deleted */
  isBuiltIn?: boolean;

  /** If true, the caster token is included in hit-testing (default false) */
  targetCaster?: boolean;

  /** If true, effect can be placed at a distance from the source token (ranged spell) */
  ranged?: boolean;

  /** If true, skip the rotation/direction step during placement (e.g. circles that don't need aiming) */
  skipRotation?: boolean;

  /** If true, render this effect above tokens instead of below (e.g. visual spell overlays) */
  renderAboveTokens?: boolean;

  /** Multi-drop configuration for effects that place multiple instances */
  multiDrop?: MultiDropConfig;

  // Spell/trap game data
  /** Spell level or trap CR */
  level?: number;
  /** Base spell level for scaling */
  baseLevel?: number;
  /** Damage type (e.g. 'fire', 'bludgeoning') */
  damageType?: string;
  /** Damage dice formulas */
  damageDice?: Array<{ formula: string; damageType: string }>;
  /** Scaling rules per level */
  scaling?: Array<{ property: string; perLevel: number; diceIndex?: number }>;

  // Effect modifiers & conditions
  /** Stat modifiers applied to tokens in the effect area */
  modifiers?: EffectModifier[];
  /** Conditions applied to tokens in the effect area */
  conditions?: EffectCondition[];

  // Aura
  /** If set, this effect is an aura: it locks to a token and continuously hit-tests with wall-blocking */
  aura?: AuraConfig;
}

// ---------------------------------------------------------------------------
// Effect Modifiers & Conditions
// ---------------------------------------------------------------------------

export interface EffectModifier {
  id: string;
  target: string;
  operation: 'add' | 'subtract' | 'set' | 'multiply';
  value: number | string;
  label?: string;
  timing?: EffectTriggerTiming;
}

export interface EffectCondition {
  condition: string;
  apply: boolean;
  timing?: EffectTriggerTiming;
}

// ---------------------------------------------------------------------------
// Placed instance (on the map)
// ---------------------------------------------------------------------------

export interface PlacedMapTemplate {
  id: string;
  templateId: string;
  /** Snapshot of the template at placement time */
  template: MapTemplateDefinition;

  // World-coordinate origin
  origin: { x: number; y: number };
  /** Direction the effect points (radians from +X). Used for cones/lines. */
  direction?: number;

  // Caster
  casterId?: string; // token ID
  /** Spell cast level (may differ from template level due to upcasting) */
  castLevel?: number;

  // Lifecycle
  placedAt: number;         // performance.now() or Date.now()
  roundsRemaining?: number; // persistent effects
  mapId: string;

  /** When set (performance.now()), the effect is fading out and will be auto-removed */
  dismissedAt?: number;

  /** When set, the effect has been cancelled — all non-damage impacts reverted */
  cancelledAt?: number;

  /** When true, the effect's animation is paused (renders static) */
  animationPaused?: boolean;

  // Hit-test results (computed on placement / trigger)
  impactedTargets: EffectImpact[];

  /** Token IDs that have already triggered this effect (prevents re-triggering) */
  triggeredTokenIds: string[];

  /** Token IDs currently inside the effect area (for on-exit tracking) */
  tokensInsideArea?: string[];

  /** Links multi-drop instances for shared resolution */
  groupId?: string;

  /** Polyline waypoints (world coords) — for polyline shape */
  waypoints?: { x: number; y: number }[];

  // Aura tracking
  /** Token ID this aura is anchored to (moves with the token) */
  anchorTokenId?: string;
  /** Whether this placed effect is an aura */
  isAura?: boolean;
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
  template: MapTemplateDefinition;
  casterId?: string;

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

