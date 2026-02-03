import type { DndBeyondCharacter } from '@/types/creatureTypes';
import { getAbilityModifier } from '@/types/creatureTypes';

/**
 * Generate a blank character template JSON
 */
export function generateBlankTemplate(): DndBeyondCharacter {
  const timestamp = new Date().toISOString();
  
  return {
    id: `custom-${Date.now()}`,
    name: "Character Name",
    portraitUrl: undefined,
    level: 1,
    classes: [{ name: "Fighter", level: 1 }],
    race: "Human",
    background: "Soldier",
    abilities: {
      strength: { score: 10, modifier: 0 },
      dexterity: { score: 10, modifier: 0 },
      constitution: { score: 10, modifier: 0 },
      intelligence: { score: 10, modifier: 0 },
      wisdom: { score: 10, modifier: 0 },
      charisma: { score: 10, modifier: 0 },
    },
    armorClass: 10,
    hitPoints: { current: 10, max: 10, temp: 0 },
    speed: 30,
    initiative: 0,
    proficiencyBonus: 2,
    skills: [
      { name: "Acrobatics", modifier: 0, proficient: false },
      { name: "Animal Handling", modifier: 0, proficient: false },
      { name: "Arcana", modifier: 0, proficient: false },
      { name: "Athletics", modifier: 0, proficient: false },
      { name: "Deception", modifier: 0, proficient: false },
      { name: "History", modifier: 0, proficient: false },
      { name: "Insight", modifier: 0, proficient: false },
      { name: "Intimidation", modifier: 0, proficient: false },
      { name: "Investigation", modifier: 0, proficient: false },
      { name: "Medicine", modifier: 0, proficient: false },
      { name: "Nature", modifier: 0, proficient: false },
      { name: "Perception", modifier: 0, proficient: false },
      { name: "Performance", modifier: 0, proficient: false },
      { name: "Persuasion", modifier: 0, proficient: false },
      { name: "Religion", modifier: 0, proficient: false },
      { name: "Sleight of Hand", modifier: 0, proficient: false },
      { name: "Stealth", modifier: 0, proficient: false },
      { name: "Survival", modifier: 0, proficient: false },
    ],
    savingThrows: [
      { ability: "Strength", modifier: 0, proficient: false },
      { ability: "Dexterity", modifier: 0, proficient: false },
      { ability: "Constitution", modifier: 0, proficient: false },
      { ability: "Intelligence", modifier: 0, proficient: false },
      { ability: "Wisdom", modifier: 0, proficient: false },
      { ability: "Charisma", modifier: 0, proficient: false },
    ],
    proficiencies: {
      armor: [],
      weapons: [],
      tools: [],
      languages: ["Common"],
    },
    passivePerception: 10,
    features: [],
    actions: [],
    conditions: [],
    sourceUrl: "manual://custom",
    lastUpdated: timestamp,
  };
}

/**
 * Generate a pre-filled template based on a quick template selection
 */
export function generateFilledTemplate(
  templateType: 'fighter' | 'wizard' | 'rogue' | 'cleric' | 'barbarian' | 'paladin' | 'ranger' | 'warlock'
): DndBeyondCharacter {
  const timestamp = new Date().toISOString();
  const baseTemplate = generateBlankTemplate();
  
  const templates: Record<string, Partial<DndBeyondCharacter>> = {
    fighter: {
      name: "Human Fighter",
      race: "Human",
      classes: [{ name: "Fighter", level: 1 }],
      level: 1,
      abilities: {
        strength: { score: 16, modifier: 3 },
        dexterity: { score: 14, modifier: 2 },
        constitution: { score: 14, modifier: 2 },
        intelligence: { score: 10, modifier: 0 },
        wisdom: { score: 12, modifier: 1 },
        charisma: { score: 10, modifier: 0 },
      },
      armorClass: 18,
      hitPoints: { current: 12, max: 12, temp: 0 },
      speed: 30,
      initiative: 2,
      proficiencies: {
        armor: ["Light", "Medium", "Heavy", "Shields"],
        weapons: ["Simple", "Martial"],
        tools: [],
        languages: ["Common"],
      },
      features: [
        { name: "Fighting Style", description: "Choose a fighting style specialty", source: "Fighter 1" },
        { name: "Second Wind", description: "Regain 1d10 + level HP as bonus action (1/short rest)", source: "Fighter 1" },
      ],
      actions: [
        { name: "Longsword", attackBonus: 5, damage: "1d8+3", damageType: "slashing", range: "5 ft.", description: "Melee weapon attack" },
        { name: "Longbow", attackBonus: 4, damage: "1d8+2", damageType: "piercing", range: "150/600 ft.", description: "Ranged weapon attack" },
      ],
      savingThrows: [
        { ability: "Strength", modifier: 5, proficient: true },
        { ability: "Dexterity", modifier: 2, proficient: false },
        { ability: "Constitution", modifier: 4, proficient: true },
        { ability: "Intelligence", modifier: 0, proficient: false },
        { ability: "Wisdom", modifier: 1, proficient: false },
        { ability: "Charisma", modifier: 0, proficient: false },
      ],
    },
    wizard: {
      name: "High Elf Wizard",
      race: "High Elf",
      classes: [{ name: "Wizard", level: 1 }],
      level: 1,
      abilities: {
        strength: { score: 8, modifier: -1 },
        dexterity: { score: 14, modifier: 2 },
        constitution: { score: 14, modifier: 2 },
        intelligence: { score: 16, modifier: 3 },
        wisdom: { score: 12, modifier: 1 },
        charisma: { score: 10, modifier: 0 },
      },
      armorClass: 12,
      hitPoints: { current: 8, max: 8, temp: 0 },
      speed: 30,
      initiative: 2,
      proficiencies: {
        armor: [],
        weapons: ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light Crossbows"],
        tools: [],
        languages: ["Common", "Elvish", "Draconic"],
      },
      features: [
        { name: "Arcane Recovery", description: "Recover spell slots on short rest (1/day)", source: "Wizard 1" },
        { name: "Spellcasting", description: "Intelligence-based arcane spellcasting", source: "Wizard 1" },
      ],
      actions: [
        { name: "Dagger", attackBonus: 4, damage: "1d4+2", damageType: "piercing", range: "20/60 ft.", description: "Finesse, light, thrown" },
        { name: "Fire Bolt", attackBonus: 5, damage: "1d10", damageType: "fire", range: "120 ft.", description: "Cantrip spell attack" },
      ],
      spells: {
        spellcastingAbility: "Intelligence",
        spellSaveDC: 13,
        spellAttackBonus: 5,
        cantrips: [{ name: "Fire Bolt" }, { name: "Mage Hand" }, { name: "Prestidigitation" }],
        spellsByLevel: [
          {
            level: 1,
            slots: 2,
            slotsUsed: 0,
            spells: [
              { name: "Magic Missile", prepared: true },
              { name: "Shield", prepared: true },
              { name: "Mage Armor", prepared: true },
              { name: "Detect Magic", prepared: false },
            ],
          },
        ],
      },
      savingThrows: [
        { ability: "Strength", modifier: -1, proficient: false },
        { ability: "Dexterity", modifier: 2, proficient: false },
        { ability: "Constitution", modifier: 2, proficient: false },
        { ability: "Intelligence", modifier: 5, proficient: true },
        { ability: "Wisdom", modifier: 3, proficient: true },
        { ability: "Charisma", modifier: 0, proficient: false },
      ],
    },
    rogue: {
      name: "Lightfoot Halfling Rogue",
      race: "Lightfoot Halfling",
      classes: [{ name: "Rogue", level: 1 }],
      level: 1,
      abilities: {
        strength: { score: 10, modifier: 0 },
        dexterity: { score: 16, modifier: 3 },
        constitution: { score: 14, modifier: 2 },
        intelligence: { score: 12, modifier: 1 },
        wisdom: { score: 10, modifier: 0 },
        charisma: { score: 14, modifier: 2 },
      },
      armorClass: 14,
      hitPoints: { current: 10, max: 10, temp: 0 },
      speed: 25,
      initiative: 3,
      proficiencies: {
        armor: ["Light"],
        weapons: ["Simple", "Hand Crossbows", "Longswords", "Rapiers", "Shortswords"],
        tools: ["Thieves' Tools"],
        languages: ["Common", "Halfling", "Thieves' Cant"],
      },
      features: [
        { name: "Sneak Attack", description: "1d6 extra damage with advantage or ally adjacent", source: "Rogue 1" },
        { name: "Expertise", description: "Double proficiency in two skills", source: "Rogue 1" },
        { name: "Lucky", description: "Reroll 1s on d20s", source: "Halfling Racial" },
        { name: "Naturally Stealthy", description: "Hide behind Medium or larger creatures", source: "Lightfoot Halfling" },
      ],
      actions: [
        { name: "Rapier", attackBonus: 5, damage: "1d8+3", damageType: "piercing", range: "5 ft.", description: "Finesse weapon" },
        { name: "Shortbow", attackBonus: 5, damage: "1d6+3", damageType: "piercing", range: "80/320 ft.", description: "Ranged weapon" },
      ],
      savingThrows: [
        { ability: "Strength", modifier: 0, proficient: false },
        { ability: "Dexterity", modifier: 5, proficient: true },
        { ability: "Constitution", modifier: 2, proficient: false },
        { ability: "Intelligence", modifier: 3, proficient: true },
        { ability: "Wisdom", modifier: 0, proficient: false },
        { ability: "Charisma", modifier: 2, proficient: false },
      ],
    },
    cleric: {
      name: "Hill Dwarf Cleric",
      race: "Hill Dwarf",
      classes: [{ name: "Cleric", level: 1 }],
      level: 1,
      abilities: {
        strength: { score: 14, modifier: 2 },
        dexterity: { score: 10, modifier: 0 },
        constitution: { score: 16, modifier: 3 },
        intelligence: { score: 10, modifier: 0 },
        wisdom: { score: 16, modifier: 3 },
        charisma: { score: 10, modifier: 0 },
      },
      armorClass: 18,
      hitPoints: { current: 11, max: 11, temp: 0 },
      speed: 25,
      initiative: 0,
      proficiencies: {
        armor: ["Light", "Medium", "Heavy", "Shields"],
        weapons: ["Simple", "Battleaxe", "Handaxe", "Warhammer"],
        tools: [],
        languages: ["Common", "Dwarvish", "Celestial"],
      },
      features: [
        { name: "Divine Domain", description: "Choose a domain (Life, Light, etc.)", source: "Cleric 1" },
        { name: "Spellcasting", description: "Wisdom-based divine spellcasting", source: "Cleric 1" },
        { name: "Dwarven Resilience", description: "Advantage on saves vs. poison, resistance to poison", source: "Dwarf Racial" },
      ],
      actions: [
        { name: "Warhammer", attackBonus: 4, damage: "1d8+2", damageType: "bludgeoning", range: "5 ft.", description: "Versatile (1d10)" },
        { name: "Sacred Flame", attackBonus: 0, damage: "1d8", damageType: "radiant", range: "60 ft.", description: "DEX save cantrip" },
      ],
      spells: {
        spellcastingAbility: "Wisdom",
        spellSaveDC: 13,
        spellAttackBonus: 5,
        cantrips: [{ name: "Sacred Flame" }, { name: "Guidance" }, { name: "Light" }],
        spellsByLevel: [
          {
            level: 1,
            slots: 2,
            slotsUsed: 0,
            spells: [
              { name: "Cure Wounds", prepared: true },
              { name: "Bless", prepared: true },
              { name: "Shield of Faith", prepared: true },
              { name: "Healing Word", prepared: false },
            ],
          },
        ],
      },
      savingThrows: [
        { ability: "Strength", modifier: 2, proficient: false },
        { ability: "Dexterity", modifier: 0, proficient: false },
        { ability: "Constitution", modifier: 3, proficient: false },
        { ability: "Intelligence", modifier: 0, proficient: false },
        { ability: "Wisdom", modifier: 5, proficient: true },
        { ability: "Charisma", modifier: 2, proficient: true },
      ],
    },
    barbarian: {
      name: "Half-Orc Barbarian",
      race: "Half-Orc",
      classes: [{ name: "Barbarian", level: 1 }],
      level: 1,
      abilities: {
        strength: { score: 16, modifier: 3 },
        dexterity: { score: 14, modifier: 2 },
        constitution: { score: 16, modifier: 3 },
        intelligence: { score: 8, modifier: -1 },
        wisdom: { score: 10, modifier: 0 },
        charisma: { score: 10, modifier: 0 },
      },
      armorClass: 15,
      hitPoints: { current: 15, max: 15, temp: 0 },
      speed: 30,
      initiative: 2,
      proficiencies: {
        armor: ["Light", "Medium", "Shields"],
        weapons: ["Simple", "Martial"],
        tools: [],
        languages: ["Common", "Orc"],
      },
      features: [
        { name: "Rage", description: "+2 damage, resistance to B/P/S, advantage on STR checks (2/long rest)", source: "Barbarian 1" },
        { name: "Unarmored Defense", description: "AC = 10 + DEX + CON when not wearing armor", source: "Barbarian 1" },
        { name: "Relentless Endurance", description: "Drop to 1 HP instead of 0 (1/long rest)", source: "Half-Orc Racial" },
        { name: "Savage Attacks", description: "Extra weapon die on crits", source: "Half-Orc Racial" },
      ],
      actions: [
        { name: "Greataxe", attackBonus: 5, damage: "1d12+3", damageType: "slashing", range: "5 ft.", description: "Heavy, two-handed" },
        { name: "Javelin", attackBonus: 5, damage: "1d6+3", damageType: "piercing", range: "30/120 ft.", description: "Thrown" },
      ],
      savingThrows: [
        { ability: "Strength", modifier: 5, proficient: true },
        { ability: "Dexterity", modifier: 2, proficient: false },
        { ability: "Constitution", modifier: 5, proficient: true },
        { ability: "Intelligence", modifier: -1, proficient: false },
        { ability: "Wisdom", modifier: 0, proficient: false },
        { ability: "Charisma", modifier: 0, proficient: false },
      ],
    },
    paladin: {
      name: "Dragonborn Paladin",
      race: "Dragonborn",
      classes: [{ name: "Paladin", level: 1 }],
      level: 1,
      abilities: {
        strength: { score: 16, modifier: 3 },
        dexterity: { score: 10, modifier: 0 },
        constitution: { score: 14, modifier: 2 },
        intelligence: { score: 10, modifier: 0 },
        wisdom: { score: 12, modifier: 1 },
        charisma: { score: 14, modifier: 2 },
      },
      armorClass: 18,
      hitPoints: { current: 12, max: 12, temp: 0 },
      speed: 30,
      initiative: 0,
      proficiencies: {
        armor: ["Light", "Medium", "Heavy", "Shields"],
        weapons: ["Simple", "Martial"],
        tools: [],
        languages: ["Common", "Draconic"],
      },
      features: [
        { name: "Divine Sense", description: "Detect celestials, fiends, and undead within 60 ft.", source: "Paladin 1" },
        { name: "Lay on Hands", description: "Heal 5 HP from a pool (refreshes on long rest)", source: "Paladin 1" },
        { name: "Breath Weapon", description: "15 ft. cone, 2d6 damage (DEX save)", source: "Dragonborn Racial" },
      ],
      actions: [
        { name: "Longsword", attackBonus: 5, damage: "1d8+3", damageType: "slashing", range: "5 ft.", description: "Versatile (1d10)" },
        { name: "Breath Weapon", attackBonus: 0, damage: "2d6", damageType: "fire", range: "15 ft. cone", description: "DC 12 DEX save" },
      ],
      savingThrows: [
        { ability: "Strength", modifier: 3, proficient: false },
        { ability: "Dexterity", modifier: 0, proficient: false },
        { ability: "Constitution", modifier: 2, proficient: false },
        { ability: "Intelligence", modifier: 0, proficient: false },
        { ability: "Wisdom", modifier: 3, proficient: true },
        { ability: "Charisma", modifier: 4, proficient: true },
      ],
    },
    ranger: {
      name: "Wood Elf Ranger",
      race: "Wood Elf",
      classes: [{ name: "Ranger", level: 1 }],
      level: 1,
      abilities: {
        strength: { score: 12, modifier: 1 },
        dexterity: { score: 16, modifier: 3 },
        constitution: { score: 14, modifier: 2 },
        intelligence: { score: 10, modifier: 0 },
        wisdom: { score: 14, modifier: 2 },
        charisma: { score: 10, modifier: 0 },
      },
      armorClass: 15,
      hitPoints: { current: 12, max: 12, temp: 0 },
      speed: 35,
      initiative: 3,
      proficiencies: {
        armor: ["Light", "Medium", "Shields"],
        weapons: ["Simple", "Martial"],
        tools: [],
        languages: ["Common", "Elvish", "Sylvan"],
      },
      features: [
        { name: "Favored Enemy", description: "Advantage on Survival to track, INT to recall info", source: "Ranger 1" },
        { name: "Natural Explorer", description: "Expertise in one terrain type", source: "Ranger 1" },
        { name: "Mask of the Wild", description: "Hide in natural phenomena", source: "Wood Elf Racial" },
      ],
      actions: [
        { name: "Longbow", attackBonus: 5, damage: "1d8+3", damageType: "piercing", range: "150/600 ft.", description: "Ranged weapon" },
        { name: "Shortsword", attackBonus: 5, damage: "1d6+3", damageType: "piercing", range: "5 ft.", description: "Finesse, light" },
      ],
      savingThrows: [
        { ability: "Strength", modifier: 3, proficient: true },
        { ability: "Dexterity", modifier: 5, proficient: true },
        { ability: "Constitution", modifier: 2, proficient: false },
        { ability: "Intelligence", modifier: 0, proficient: false },
        { ability: "Wisdom", modifier: 2, proficient: false },
        { ability: "Charisma", modifier: 0, proficient: false },
      ],
    },
    warlock: {
      name: "Tiefling Warlock",
      race: "Tiefling",
      classes: [{ name: "Warlock", level: 1 }],
      level: 1,
      abilities: {
        strength: { score: 8, modifier: -1 },
        dexterity: { score: 14, modifier: 2 },
        constitution: { score: 14, modifier: 2 },
        intelligence: { score: 12, modifier: 1 },
        wisdom: { score: 10, modifier: 0 },
        charisma: { score: 16, modifier: 3 },
      },
      armorClass: 13,
      hitPoints: { current: 10, max: 10, temp: 0 },
      speed: 30,
      initiative: 2,
      proficiencies: {
        armor: ["Light"],
        weapons: ["Simple"],
        tools: [],
        languages: ["Common", "Infernal", "Abyssal"],
      },
      features: [
        { name: "Otherworldly Patron", description: "Choose a patron (Fiend, Archfey, Great Old One, etc.)", source: "Warlock 1" },
        { name: "Pact Magic", description: "Charisma-based pact spellcasting", source: "Warlock 1" },
        { name: "Hellish Resistance", description: "Resistance to fire damage", source: "Tiefling Racial" },
      ],
      actions: [
        { name: "Eldritch Blast", attackBonus: 5, damage: "1d10", damageType: "force", range: "120 ft.", description: "Cantrip spell attack" },
        { name: "Dagger", attackBonus: 4, damage: "1d4+2", damageType: "piercing", range: "20/60 ft.", description: "Finesse, light, thrown" },
      ],
      spells: {
        spellcastingAbility: "Charisma",
        spellSaveDC: 13,
        spellAttackBonus: 5,
        cantrips: [{ name: "Eldritch Blast" }, { name: "Minor Illusion" }],
        spellsByLevel: [
          {
            level: 1,
            slots: 1,
            slotsUsed: 0,
            spells: [
              { name: "Hex", prepared: true },
              { name: "Armor of Agathys", prepared: true },
            ],
          },
        ],
      },
      savingThrows: [
        { ability: "Strength", modifier: -1, proficient: false },
        { ability: "Dexterity", modifier: 2, proficient: false },
        { ability: "Constitution", modifier: 2, proficient: false },
        { ability: "Intelligence", modifier: 1, proficient: false },
        { ability: "Wisdom", modifier: 2, proficient: true },
        { ability: "Charisma", modifier: 5, proficient: true },
      ],
    },
  };

  const templateData = templates[templateType] || {};
  
  return {
    ...baseTemplate,
    ...templateData,
    id: `template-${templateType}-${Date.now()}`,
    sourceUrl: "manual://template",
    lastUpdated: timestamp,
  } as DndBeyondCharacter;
}

/**
 * Download a JSON file
 */
export function downloadJson(data: object, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download the JSON schema file
 */
export function downloadSchema(): void {
  window.open('/schemas/character-import-schema.json', '_blank');
}
