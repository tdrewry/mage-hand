/**
 * Built-in Effect Template Library
 *
 * Common D&D spell and hazard templates ready to use out-of-the-box.
 * All dimensions are in grid units (1 unit = 5 ft by default).
 */

import type { EffectTemplate } from '@/types/effectTypes';

// ---------------------------------------------------------------------------
// Spell templates
// ---------------------------------------------------------------------------

export const FIREBALL: EffectTemplate = {
  id: 'builtin-fireball',
  name: 'Fireball',
  shape: 'circle',
  radius: 4,               // 20 ft radius
  placementMode: 'free',
  persistence: 'instant',
  color: '#FF4500',
  secondaryColor: '#FFD700',
  opacity: 0.55,
  animation: 'expand',
  animationSpeed: 1.5,
  category: 'spell',
  level: 3,
  damageType: 'fire',
  damageDice: [{ formula: '8d6', damageType: 'fire' }],
  description: 'A bright streak flashes to a point and blossoms into a 20-foot-radius explosion of flame.',
  isBuiltIn: true,
  ranged: true,
};

export const LIGHTNING_BOLT: EffectTemplate = {
  id: 'builtin-lightning-bolt',
  name: 'Lightning Bolt',
  shape: 'line',
  length: 20,              // 100 ft length
  width: 1,                // 5 ft wide
  placementMode: 'caster',
  persistence: 'instant',
  color: '#00BFFF',
  secondaryColor: '#E0FFFF',
  opacity: 0.7,
  animation: 'crackle',
  animationSpeed: 2.0,
  category: 'spell',
  level: 3,
  damageType: 'lightning',
  damageDice: [{ formula: '8d6', damageType: 'lightning' }],
  description: 'A stroke of lightning forming a 100-foot line, 5 feet wide, blasts out from you.',
  isBuiltIn: true,
};

export const CONE_OF_COLD: EffectTemplate = {
  id: 'builtin-cone-of-cold',
  name: 'Cone of Cold',
  shape: 'cone',
  length: 12,              // 60 ft cone
  angle: 53,               // ~53° to match 5e cone geometry
  placementMode: 'caster',
  persistence: 'instant',
  color: '#87CEEB',
  secondaryColor: '#F0F8FF',
  opacity: 0.5,
  animation: 'expand',
  animationSpeed: 1.2,
  category: 'spell',
  level: 5,
  damageType: 'cold',
  damageDice: [{ formula: '8d8', damageType: 'cold' }],
  description: 'A blast of cold air erupts in a 60-foot cone.',
  isBuiltIn: true,
};

export const WALL_OF_FIRE: EffectTemplate = {
  id: 'builtin-wall-of-fire',
  name: 'Wall of Fire',
  shape: 'polyline',
  maxLength: 12,             // 60 ft total length
  segmentWidth: 0.2,         // 1 ft thick
  placementMode: 'free',
  persistence: 'persistent',
  durationRounds: 10,        // concentration, up to 1 minute
  color: '#FF6600',
  secondaryColor: '#FF0000',
  opacity: 0.65,
  animation: 'flicker',
  animationSpeed: 1.0,
  category: 'spell',
  level: 4,
  damageType: 'fire',
  damageDice: [{ formula: '5d8', damageType: 'fire' }],
  description: 'A wall of fire up to 60 feet long, 20 feet high, and 1 foot thick appears. Click waypoints to draw, double-click or Enter to finish.',
  isBuiltIn: true,
  ranged: true,
};

export const GREASE: EffectTemplate = {
  id: 'builtin-grease',
  name: 'Grease',
  shape: 'rectangle',
  width: 2,                // 10 ft square
  length: 2,
  placementMode: 'free',
  persistence: 'persistent',
  durationRounds: 10,
  color: '#8B7355',
  secondaryColor: '#6B5B45',
  opacity: 0.4,
  animation: 'none',
  animationSpeed: 1.0,
  category: 'spell',
  level: 1,
  damageType: undefined,
  description: 'Slick grease covers a 10-foot square. The area becomes difficult terrain.',
  isBuiltIn: true,
  ranged: true,
};

export const WEB: EffectTemplate = {
  id: 'builtin-web',
  name: 'Web',
  shape: 'rectangle',
  width: 4,                // 20 ft cube
  length: 4,
  placementMode: 'free',
  persistence: 'persistent',
  durationRounds: 60,      // 1 hour concentration
  color: '#D3D3D3',
  secondaryColor: '#FFFFFF',
  opacity: 0.45,
  animation: 'pulse',
  animationSpeed: 0.3,
  category: 'spell',
  level: 2,
  damageType: undefined,
  description: 'Thick, sticky webbing fills a 20-foot cube. The area is difficult terrain.',
  isBuiltIn: true,
  ranged: true,
};

export const BURNING_HANDS: EffectTemplate = {
  id: 'builtin-burning-hands',
  name: 'Burning Hands',
  shape: 'cone',
  length: 3,               // 15 ft cone
  angle: 53,
  placementMode: 'caster',
  persistence: 'instant',
  color: '#FF4500',
  secondaryColor: '#FFA500',
  opacity: 0.55,
  animation: 'expand',
  animationSpeed: 1.8,
  category: 'spell',
  level: 1,
  damageType: 'fire',
  damageDice: [{ formula: '3d6', damageType: 'fire' }],
  description: 'A thin sheet of flames shoots forth from your outstretched fingertips in a 15-foot cone.',
  isBuiltIn: true,
};

export const DARKNESS: EffectTemplate = {
  id: 'builtin-darkness',
  name: 'Darkness',
  shape: 'circle',
  radius: 3,               // 15 ft radius
  placementMode: 'free',
  persistence: 'persistent',
  durationRounds: 100,     // 10 minutes concentration
  color: '#1A1A2E',
  secondaryColor: '#000000',
  opacity: 0.85,
  animation: 'swirl',
  animationSpeed: 0.4,
  category: 'spell',
  level: 2,
  damageType: undefined,
  description: 'Magical darkness spreads from a point within range to fill a 15-foot-radius sphere.',
  isBuiltIn: true,
  ranged: true,
};

export const SPIRIT_GUARDIANS: EffectTemplate = {
  id: 'builtin-spirit-guardians',
  name: 'Spirit Guardians',
  shape: 'circle-burst',
  radius: 3,               // 15 ft radius around caster
  placementMode: 'caster',
  persistence: 'persistent',
  durationRounds: 100,
  color: '#DAA520',
  secondaryColor: '#FFFACD',
  opacity: 0.35,
  animation: 'swirl',
  animationSpeed: 0.8,
  category: 'spell',
  level: 3,
  damageType: 'radiant',
  damageDice: [{ formula: '3d8', damageType: 'radiant' }],
  description: 'Spirits flit around you in a 15-foot radius. Enemies take damage when entering or starting their turn.',
  isBuiltIn: true,
  ranged: true,
};

export const THUNDERWAVE: EffectTemplate = {
  id: 'builtin-thunderwave',
  name: 'Thunderwave',
  shape: 'rectangle-burst',
  width: 3,                // 15 ft cube from caster
  length: 3,
  placementMode: 'caster',
  persistence: 'instant',
  color: '#4169E1',
  secondaryColor: '#87CEEB',
  opacity: 0.5,
  animation: 'expand',
  animationSpeed: 2.0,
  category: 'spell',
  level: 1,
  damageType: 'thunder',
  damageDice: [{ formula: '2d8', damageType: 'thunder' }],
  description: 'A wave of thunderous force sweeps out from you in a 15-foot cube.',
  isBuiltIn: true,
};

// ---------------------------------------------------------------------------
// Trap / hazard templates
// ---------------------------------------------------------------------------

export const PIT_TRAP: EffectTemplate = {
  id: 'builtin-pit-trap',
  name: 'Pit Trap',
  shape: 'rectangle',
  width: 2,                // 10 ft square
  length: 2,
  placementMode: 'free',
  persistence: 'persistent',
  durationRounds: 0,       // until dismissed
  color: '#2F1B0E',
  secondaryColor: '#000000',
  opacity: 0.6,
  animation: 'none',
  animationSpeed: 1.0,
  category: 'trap',
  damageType: 'bludgeoning',
  description: 'A 10-foot-square section of floor gives way, revealing a pit below.',
  isBuiltIn: true,
};

export const POISON_GAS_CLOUD: EffectTemplate = {
  id: 'builtin-poison-gas',
  name: 'Poison Gas Cloud',
  shape: 'circle',
  radius: 3,               // 15 ft radius
  placementMode: 'free',
  persistence: 'persistent',
  durationRounds: 10,
  color: '#00FF00',
  secondaryColor: '#228B22',
  opacity: 0.4,
  animation: 'swirl',
  animationSpeed: 0.5,
  category: 'hazard',
  damageType: 'poison',
  description: 'A cloud of noxious green gas fills the area.',
  isBuiltIn: true,
};

// ---------------------------------------------------------------------------
// Multi-drop spell templates
// ---------------------------------------------------------------------------

export const STORM_OF_VENGEANCE_BOLTS: EffectTemplate = {
  id: 'builtin-storm-vengeance-bolts',
  name: 'Storm of Vengeance (Bolts)',
  shape: 'circle',
  radius: 1,               // 5 ft per bolt
  placementMode: 'free',
  persistence: 'instant',
  color: '#FFD700',
  secondaryColor: '#FFFFFF',
  opacity: 0.7,
  animation: 'crackle',
  animationSpeed: 2.0,
  category: 'spell',
  level: 9,
  damageType: 'lightning',
  damageDice: [{ formula: '10d6', damageType: 'lightning' }],
  description: 'Six bolts of lightning strike six creatures of your choice under the storm cloud. Each bolt hits a 5-ft area.',
  isBuiltIn: true,
  ranged: true,
  multiDrop: {
    count: 6,
    perDropRadius: 1,
  },
};

export const METEOR_SWARM: EffectTemplate = {
  id: 'builtin-meteor-swarm',
  name: 'Meteor Swarm',
  shape: 'circle',
  radius: 8,               // 40 ft radius per meteor
  placementMode: 'free',
  persistence: 'instant',
  color: '#FF4500',
  secondaryColor: '#FF8C00',
  opacity: 0.65,
  animation: 'expand',
  animationSpeed: 1.5,
  category: 'spell',
  level: 9,
  damageType: 'fire',
  damageDice: [
    { formula: '20d6', damageType: 'fire' },
    { formula: '20d6', damageType: 'bludgeoning' },
  ],
  description: 'Four blazing orbs crash to the ground at different points, each creating a 40-foot-radius sphere of fire.',
  isBuiltIn: true,
  ranged: true,
  multiDrop: {
    count: 4,
    perDropRadius: 8,
  },
};

// ---------------------------------------------------------------------------
// Multi-damage-type spell templates
// ---------------------------------------------------------------------------

export const FLAME_STRIKE: EffectTemplate = {
  id: 'builtin-flame-strike',
  name: 'Flame Strike',
  shape: 'circle',
  radius: 2,               // 10 ft radius
  placementMode: 'free',
  persistence: 'instant',
  color: '#FF6347',
  secondaryColor: '#FFD700',
  opacity: 0.6,
  animation: 'expand',
  animationSpeed: 1.5,
  category: 'spell',
  level: 5,
  damageType: 'fire',
  damageDice: [
    { formula: '4d6', damageType: 'fire' },
    { formula: '4d6', damageType: 'radiant' },
  ],
  description: 'A vertical column of divine fire roars down. Half fire, half radiant damage in a 10-foot-radius, 40-foot-high cylinder.',
  isBuiltIn: true,
  ranged: true,
};

// ---------------------------------------------------------------------------
// Polyline wall spell templates
// ---------------------------------------------------------------------------

export const WALL_OF_FORCE: EffectTemplate = {
  id: 'builtin-wall-of-force',
  name: 'Wall of Force',
  shape: 'polyline',
  maxLength: 20,             // 100 ft total length (ten 10-ft panels)
  segmentWidth: 0.05,        // ~3 inches thick (nearly invisible barrier)
  placementMode: 'free',
  persistence: 'persistent',
  durationRounds: 100,       // 10 minutes concentration
  color: '#88CCFF',
  secondaryColor: '#FFFFFF',
  opacity: 0.3,
  animation: 'pulse',
  animationSpeed: 0.5,
  category: 'spell',
  level: 5,
  damageType: undefined,
  description: 'An invisible wall of force up to 100 feet long springs into existence. Click waypoints to draw, double-click or Enter to finish.',
  isBuiltIn: true,
  ranged: true,
};

export const WALL_OF_THORNS: EffectTemplate = {
  id: 'builtin-wall-of-thorns',
  name: 'Wall of Thorns',
  shape: 'polyline',
  maxLength: 12,             // 60 ft long
  segmentWidth: 1,           // 5 ft thick
  placementMode: 'free',
  persistence: 'persistent',
  durationRounds: 100,       // 10 minutes concentration
  color: '#2E5A1E',
  secondaryColor: '#4A7A2E',
  opacity: 0.6,
  animation: 'none',
  animationSpeed: 1.0,
  category: 'spell',
  level: 6,
  damageType: 'piercing',
  description: 'A tangled wall of tough, pliable thorny brush up to 60 feet long and 5 feet thick. Click waypoints to draw, double-click or Enter to finish.',
  isBuiltIn: true,
  ranged: true,
};

// ---------------------------------------------------------------------------
// Aggregate collections
// ---------------------------------------------------------------------------

export const BUILT_IN_EFFECT_TEMPLATES: EffectTemplate[] = [
  FIREBALL,
  LIGHTNING_BOLT,
  CONE_OF_COLD,
  BURNING_HANDS,
  FLAME_STRIKE,
  WALL_OF_FIRE,
  WALL_OF_FORCE,
  WALL_OF_THORNS,
  GREASE,
  WEB,
  DARKNESS,
  SPIRIT_GUARDIANS,
  THUNDERWAVE,
  PIT_TRAP,
  POISON_GAS_CLOUD,
  STORM_OF_VENGEANCE_BOLTS,
  METEOR_SWARM,
];

/**
 * Lookup a built-in template by ID.
 */
export function getBuiltInTemplate(id: string): EffectTemplate | undefined {
  return BUILT_IN_EFFECT_TEMPLATES.find(t => t.id === id);
}
