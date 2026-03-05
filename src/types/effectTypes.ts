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
// Level-scaling types
// ---------------------------------------------------------------------------

/** Describes how a template property scales per upcast level above baseLevel. */
export interface ScalingRule {
  /** Which property to scale */
  property: 'damageDice' | 'radius' | 'width' | 'length' | 'multiDropCount';
  /** Amount added per scaling step */
  perLevel: number;
  /** How many levels constitute one scaling step (default 1). E.g. 2 = scales every 2 levels. */
  perLevels?: number;
  /** For damageDice scaling: which damageDice entry index to modify (default 0) */
  diceIndex?: number;
}

/** Full override of template values at a specific cast level. Fields present replace computed values. */
export interface LevelOverride {
  level: number;
  damageDice?: DamageDiceEntry[];
  radius?: number;
  width?: number;
  length?: number;
  multiDropCount?: number;
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

  /** If true, render this effect above tokens instead of below (e.g. visual spell overlays) */
  renderAboveTokens?: boolean;

  /** Multi-drop configuration for effects that place multiple instances */
  multiDrop?: MultiDropConfig;

  // Level-scaling
  /** Lowest level this effect can be cast at (e.g. 3 for Fireball) */
  baseLevel?: number;
  /** Rules describing how properties scale per upcast level */
  scaling?: ScalingRule[];
  /** Explicit overrides for specific cast levels */
  levelOverrides?: LevelOverride[];

  // Extended impact types
  /** Attack roll configuration (e.g. spell attack) */
  attackRoll?: EffectAttackRoll;
  /** Stat modifiers to apply to targets */
  modifiers?: EffectModifier[];
  /** Conditions to apply/remove on targets */
  conditions?: EffectCondition[];
  /** Temporary actions granted to targets */
  grantedActions?: EffectGrantedAction[];

  // Aura
  /** If set, this effect is an aura: it locks to a token and continuously hit-tests with wall-blocking */
  aura?: AuraConfig;
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

  /** When set, the effect has been cancelled — all non-damage impacts reverted */
  cancelledAt?: number;

  /** The level this effect was cast at (for display/history) */
  castLevel?: number;

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
  template: EffectTemplate;
  casterId?: string;
  /** Override damage formula for this placement (e.g. "8d6") */
  damageFormula?: string;
  /** The level this effect is being cast at (for scaling) */
  castLevel?: number;
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
// Attack roll configuration
// ---------------------------------------------------------------------------

export interface EffectAttackRoll {
  enabled: boolean;
  /** Which ability mod to use: 'spellcasting' | 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha' */
  abilitySource: string;
  /** Fixed bonus override (if not using token's data) */
  fixedBonus?: number;
  /** Whether to add proficiency bonus */
  addProficiency?: boolean;
}

// ---------------------------------------------------------------------------
// Effect modifiers (non-damage impacts)
// ---------------------------------------------------------------------------

export type EffectModifierTarget =
  | 'armorClass'
  | 'speed'
  | 'hitPoints.temp'
  | 'abilities.strength.score'
  | 'abilities.dexterity.score'
  | 'abilities.constitution.score'
  | 'abilities.intelligence.score'
  | 'abilities.wisdom.score'
  | 'abilities.charisma.score'
  | 'proficiencyBonus'
  | 'initiative'
  | string;

/** Known modifier targets with human-readable labels */
export const EFFECT_MODIFIER_TARGETS: { value: EffectModifierTarget; label: string; group: string }[] = [
  { value: 'armorClass', label: 'Armor Class', group: 'Combat' },
  { value: 'speed', label: 'Speed', group: 'Combat' },
  { value: 'initiative', label: 'Initiative', group: 'Combat' },
  { value: 'proficiencyBonus', label: 'Proficiency Bonus', group: 'Combat' },
  { value: 'hitPoints.temp', label: 'Temp HP', group: 'Hit Points' },
  { value: 'abilities.strength.score', label: 'Strength', group: 'Ability Scores' },
  { value: 'abilities.dexterity.score', label: 'Dexterity', group: 'Ability Scores' },
  { value: 'abilities.constitution.score', label: 'Constitution', group: 'Ability Scores' },
  { value: 'abilities.intelligence.score', label: 'Intelligence', group: 'Ability Scores' },
  { value: 'abilities.wisdom.score', label: 'Wisdom', group: 'Ability Scores' },
  { value: 'abilities.charisma.score', label: 'Charisma', group: 'Ability Scores' },
];

export type EffectModifierOperation = 'add' | 'set' | 'multiply';

export interface EffectModifier {
  id: string;
  /** The character property path to modify */
  target: EffectModifierTarget;
  /** How to apply */
  operation: EffectModifierOperation;
  /** The numeric value */
  value: number;
  /** Human-readable label */
  label?: string;
  /** When this modifier triggers relative to token position in the effect area */
  timing?: EffectTriggerTiming;
}

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

/** Standard D&D 5e conditions */
export const DND_5E_CONDITIONS = [
  'blinded', 'charmed', 'deafened', 'frightened', 'grappled',
  'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned',
  'prone', 'restrained', 'stunned', 'unconscious', 'exhaustion',
] as const;

export interface EffectCondition {
  condition: string;
  apply: boolean; // true = add, false = remove
  /** When this condition triggers relative to token position in the effect area */
  timing?: EffectTriggerTiming;
}

// ---------------------------------------------------------------------------
// Granted temporary actions
// ---------------------------------------------------------------------------

export interface EffectGrantedAction {
  name: string;
  type?: 'attack' | 'spell' | 'trait' | 'feature';
  attackBonus?: number;
  damageFormula?: string;
  damageType?: string;
  description?: string;
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

// ---------------------------------------------------------------------------
// Level-scaling computation
// ---------------------------------------------------------------------------

/**
 * Scale a dice formula by adding `increment` to the dice count.
 * e.g. scaleDiceFormula("8d6", 2) → "10d6"
 *      scaleDiceFormula("2d10+4", 1) → "3d10+4"
 */
function scaleDiceFormula(formula: string, increment: number): string {
  // Match the first NdX group
  const match = formula.match(/^(\d+)(d\d+.*)$/);
  if (!match) return formula; // can't parse, return as-is
  const currentCount = parseInt(match[1]);
  return `${currentCount + increment}${match[2]}`;
}

/**
 * Compute a scaled version of a template for a given cast level.
 * Returns a new EffectTemplate with adjusted values.
 * If castLevel is undefined or equal to baseLevel, returns the template unchanged.
 */
export function computeScaledTemplate(template: EffectTemplate, castLevel?: number): EffectTemplate {
  if (castLevel === undefined || !template.baseLevel || castLevel <= template.baseLevel) {
    return template;
  }

  const rawDelta = castLevel - template.baseLevel;
  let scaled = { ...template };

  // Deep-clone damageDice so we can mutate
  if (scaled.damageDice) {
    scaled.damageDice = scaled.damageDice.map(d => ({ ...d }));
  }

  // Apply scaling rules
  if (template.scaling) {
    for (const rule of template.scaling) {
      const step = rule.perLevels ?? 1;
      const steps = Math.floor(rawDelta / step);
      if (steps <= 0) continue;
      const increment = steps * rule.perLevel;
      switch (rule.property) {
        case 'damageDice': {
          const idx = rule.diceIndex ?? 0;
          if (scaled.damageDice && scaled.damageDice[idx]) {
            scaled.damageDice[idx] = {
              ...scaled.damageDice[idx],
              formula: scaleDiceFormula(scaled.damageDice[idx].formula, increment),
            };
          }
          break;
        }
        case 'radius':
          scaled.radius = (scaled.radius ?? 0) + increment;
          break;
        case 'width':
          scaled.width = (scaled.width ?? 0) + increment;
          break;
        case 'length':
          scaled.length = (scaled.length ?? 0) + increment;
          break;
        case 'multiDropCount':
          if (scaled.multiDrop) {
            scaled.multiDrop = { ...scaled.multiDrop, count: scaled.multiDrop.count + increment };
          }
          break;
      }
    }
  }

  // Apply level overrides (replace computed values)
  if (template.levelOverrides) {
    const override = template.levelOverrides.find(o => o.level === castLevel);
    if (override) {
      if (override.damageDice) scaled.damageDice = override.damageDice.map(d => ({ ...d }));
      if (override.radius !== undefined) scaled.radius = override.radius;
      if (override.width !== undefined) scaled.width = override.width;
      if (override.length !== undefined) scaled.length = override.length;
      if (override.multiDropCount !== undefined) {
        scaled.multiDrop = { ...(scaled.multiDrop ?? { count: 1 }), count: override.multiDropCount };
      }
    }
  }

  return scaled;
}
