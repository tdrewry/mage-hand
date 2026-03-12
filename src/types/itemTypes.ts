/**
 * Item Library types — flexible schema with D&D 5e defaults.
 * Items can define attacks, spells, and traits that become available when equipped.
 */

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'very-rare' | 'legendary' | 'artifact';

export type ItemCategory =
  | 'weapon'
  | 'armor'
  | 'potion'
  | 'scroll'
  | 'wondrous'
  | 'ring'
  | 'wand'
  | 'staff'
  | 'rod'
  | 'ammunition'
  | 'adventuring-gear'
  | 'tool'
  | 'trade-good'
  | 'treasure'
  | 'other';

export interface ItemAttack {
  name: string;
  attackBonus?: number;
  damage?: string;        // e.g. "1d8+3"
  damageType?: string;    // e.g. "slashing", "fire"
  range?: string;         // e.g. "5 ft." or "30/120 ft."
  description?: string;
  effectTemplateId?: string;
}

export interface ItemSpell {
  name: string;
  level?: number;
  charges?: number;       // How many charges used per cast
  description?: string;
  effectTemplateId?: string;
}

export interface ItemTrait {
  name: string;
  description: string;
}

export interface LibraryItem {
  id: string;
  name: string;
  category: ItemCategory;
  rarity?: ItemRarity;
  description?: string;   // Flavor text
  weight?: number;        // in lbs
  value?: string;         // e.g. "50 gp", "250 gp"
  requiresAttunement?: boolean;
  attunementRequirement?: string; // e.g. "by a cleric or paladin"

  // Mechanical properties
  armorClass?: number;
  properties?: string[];  // e.g. ["finesse", "light", "thrown"]

  // Granted capabilities when equipped
  attacks?: ItemAttack[];
  spells?: ItemSpell[];
  traits?: ItemTrait[];

  // Charges system (wands, staves, etc.)
  maxCharges?: number;
  rechargeRule?: string;  // e.g. "1d6+1 at dawn"

  // Freeform custom fields for extensibility
  customFields?: Record<string, string | number | boolean>;

  // Metadata
  source?: string;        // e.g. "DMG", "PHB", "Homebrew"
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export const ITEM_RARITY_COLORS: Record<ItemRarity, string> = {
  common: 'hsl(var(--muted-foreground))',
  uncommon: 'hsl(142, 71%, 45%)',
  rare: 'hsl(217, 91%, 60%)',
  'very-rare': 'hsl(271, 81%, 56%)',
  legendary: 'hsl(45, 93%, 47%)',
  artifact: 'hsl(0, 84%, 60%)',
};

export const ITEM_RARITY_LABELS: Record<ItemRarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  'very-rare': 'Very Rare',
  legendary: 'Legendary',
  artifact: 'Artifact',
};

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  potion: 'Potion',
  scroll: 'Scroll',
  wondrous: 'Wondrous Item',
  ring: 'Ring',
  wand: 'Wand',
  staff: 'Staff',
  rod: 'Rod',
  ammunition: 'Ammunition',
  'adventuring-gear': 'Adventuring Gear',
  tool: 'Tool',
  'trade-good': 'Trade Good',
  treasure: 'Treasure',
  other: 'Other',
};
