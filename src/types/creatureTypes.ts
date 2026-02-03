// D&D Beyond Character Data Structure
export interface DndBeyondCharacter {
  id: string;
  name: string;
  portraitUrl?: string;
  level: number;
  classes: Array<{ name: string; level: number }>;
  race: string;
  background?: string;
  
  // Ability Scores
  abilities: {
    strength: { score: number; modifier: number };
    dexterity: { score: number; modifier: number };
    constitution: { score: number; modifier: number };
    intelligence: { score: number; modifier: number };
    wisdom: { score: number; modifier: number };
    charisma: { score: number; modifier: number };
  };
  
  // Combat Stats
  armorClass: number;
  hitPoints: { current: number; max: number; temp: number };
  speed: number;
  initiative: number;
  proficiencyBonus: number;
  
  // Skills & Proficiencies
  skills: Array<{ name: string; modifier: number; proficient: boolean; expertise?: boolean }>;
  savingThrows: Array<{ ability: string; modifier: number; proficient: boolean }>;
  proficiencies: {
    armor: string[];
    weapons: string[];
    tools: string[];
    languages: string[];
  };
  
  // Senses
  passivePerception: number;
  passiveInvestigation?: number;
  passiveInsight?: number;
  
  // Features & Actions
  features: Array<{ name: string; description: string; source: string }>;
  actions: Array<{ 
    name: string; 
    attackBonus?: number; 
    damage?: string; 
    damageType?: string;
    range?: string;
    description: string;
  }>;
  spells?: {
    spellcastingAbility?: string;
    spellSaveDC?: number;
    spellAttackBonus?: number;
    cantrips: Array<{ name: string }>;
    spellsByLevel: Array<{
      level: number;
      slots: number;
      slotsUsed: number;
      spells: Array<{ name: string; prepared: boolean }>;
    }>;
  };
  
  // Conditions
  conditions: string[];
  
  // Equipment (optional)
  equipment?: Array<{ name: string; quantity: number; equipped?: boolean }>;
  
  // Source tracking
  sourceUrl: string;
  lastUpdated: string; // ISO date string for serialization
}

// 5e.tools Monster Data Structure
export interface Monster5eTools {
  id: string;
  name: string;
  source: string;  // Book source (e.g., "MM", "VGM", "PHB")
  page?: number;
  
  // Classification
  size: MonsterSize;
  type: MonsterType;
  alignment?: string[];
  
  // Combat Stats
  ac: Array<{ ac: number; from?: string[]; condition?: string }>;
  hp: { average: number; formula: string };
  speed: MonsterSpeed;
  
  // Ability Scores
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  
  // Challenge
  cr: string | number;  // Can be "1/4", "1/2", etc.
  
  // Saves & Skills
  save?: { [key: string]: string }; // e.g., { "dex": "+6", "con": "+13" }
  skill?: { [key: string]: string }; // e.g., { "perception": "+13" }
  
  // Defenses
  senses?: string[];
  passive: number;  // Passive Perception
  languages?: string[];
  immune?: string[];  // Damage immunities
  resist?: string[];  // Damage resistances
  vulnerable?: string[];
  conditionImmune?: string[];
  
  // Actions & Traits
  trait?: MonsterEntry[];
  action?: MonsterEntry[];
  legendary?: MonsterEntry[];
  legendaryActions?: number;
  legendaryHeader?: string[];
  reaction?: MonsterEntry[];
  bonus?: MonsterEntry[]; // Bonus actions
  
  // Spellcasting
  spellcasting?: MonsterSpellcasting[];
  
  // Lair & Regional
  lair?: { action?: MonsterEntry[]; regionalEffects?: MonsterEntry[] };
  
  // Images
  tokenUrl?: string;
  fluffImages?: Array<{ url: string; type?: string }>;
  
  // Environment
  environment?: string[];
}

export type MonsterSize = 'T' | 'S' | 'M' | 'L' | 'H' | 'G';

export interface MonsterType {
  type: string;
  tags?: string[];
  swarmSize?: MonsterSize;
}

export interface MonsterSpeed {
  walk?: number | { number: number; condition: string };
  fly?: number | { number: number; condition: string };
  swim?: number | { number: number; condition: string };
  climb?: number | { number: number; condition: string };
  burrow?: number | { number: number; condition: string };
  hover?: boolean;
  canHover?: boolean;
}

export interface MonsterEntry {
  name: string;
  entries: (string | MonsterEntryNested)[];
}

export interface MonsterEntryNested {
  type: string;
  items?: string[];
  entries?: string[];
  style?: string;
}

export interface MonsterSpellcasting {
  name: string;
  headerEntries?: string[];
  footerEntries?: string[];
  ability?: string;
  will?: string[];
  daily?: { [key: string]: string[] }; // e.g., "1e": ["spell1", "spell2"]
  spells?: { [level: string]: { slots?: number; spells: string[] } };
}

// Unified creature reference for token linking
export interface CreatureRef {
  type: 'character' | 'monster';
  id: string;
}

// Helper functions for size conversion
export const MONSTER_SIZE_NAMES: Record<MonsterSize, string> = {
  'T': 'Tiny',
  'S': 'Small',
  'M': 'Medium',
  'L': 'Large',
  'H': 'Huge',
  'G': 'Gargantuan',
};

export const MONSTER_SIZE_GRID: Record<MonsterSize, number> = {
  'T': 0.5,
  'S': 1,
  'M': 1,
  'L': 2,
  'H': 3,
  'G': 4,
};

// CR to XP mapping
export const CR_XP_TABLE: Record<string, number> = {
  '0': 10,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
  '21': 33000,
  '22': 41000,
  '23': 50000,
  '24': 62000,
  '25': 75000,
  '26': 90000,
  '27': 105000,
  '28': 120000,
  '29': 135000,
  '30': 155000,
};

// Helper to calculate ability modifier
export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

// Helper to format modifier as string
export function formatModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

// Helper to get XP from CR
export function getCRXP(cr: string | number): number {
  const crString = String(cr);
  return CR_XP_TABLE[crString] || 0;
}

// Helper to format speed
export function formatSpeed(speed: MonsterSpeed): string {
  const parts: string[] = [];
  
  const formatSpeedValue = (value: number | { number: number; condition: string } | undefined, type?: string): string | null => {
    if (value === undefined) return null;
    const num = typeof value === 'number' ? value : value.number;
    const condition = typeof value === 'object' ? ` (${value.condition})` : '';
    return type ? `${type} ${num} ft.${condition}` : `${num} ft.${condition}`;
  };
  
  const walk = formatSpeedValue(speed.walk);
  if (walk) parts.push(walk);
  
  const fly = formatSpeedValue(speed.fly, 'fly');
  if (fly) parts.push(fly + (speed.hover || speed.canHover ? ' (hover)' : ''));
  
  const swim = formatSpeedValue(speed.swim, 'swim');
  if (swim) parts.push(swim);
  
  const climb = formatSpeedValue(speed.climb, 'climb');
  if (climb) parts.push(climb);
  
  const burrow = formatSpeedValue(speed.burrow, 'burrow');
  if (burrow) parts.push(burrow);
  
  return parts.join(', ') || '0 ft.';
}
