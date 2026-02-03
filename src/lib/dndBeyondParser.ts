import type { DndBeyondCharacter } from '@/types/creatureTypes';
import { getAbilityModifier } from '@/types/creatureTypes';

/**
 * Parses D&D Beyond character data from scraped HTML/markdown content.
 * This parser extracts structured data from the public character sheet page.
 */

// Skill name mappings
const SKILLS = [
  'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics',
  'Deception', 'History', 'Insight', 'Intimidation',
  'Investigation', 'Medicine', 'Nature', 'Perception',
  'Performance', 'Persuasion', 'Religion', 'Sleight of Hand',
  'Stealth', 'Survival'
] as const;

const ABILITY_NAMES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'] as const;

interface ParseResult {
  success: boolean;
  character?: DndBeyondCharacter;
  error?: string;
}

/**
 * Extract a number from text, handling various formats
 */
function extractNumber(text: string, defaultValue = 0): number {
  const match = text.match(/[-+]?\d+/);
  return match ? parseInt(match[0], 10) : defaultValue;
}

/**
 * Extract modifier from text like "+3" or "-1"
 */
function extractModifier(text: string): number {
  const match = text.match(/([+-]?\d+)/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Parse classes from text like "Artificer 3 / Wizard 2"
 */
function parseClasses(classText: string): Array<{ name: string; level: number }> {
  const classes: Array<{ name: string; level: number }> = [];
  
  // Split by common delimiters
  const parts = classText.split(/[\/,&]/).map(p => p.trim());
  
  for (const part of parts) {
    // Match "ClassName Level" or "ClassName (Level)"
    const match = part.match(/([A-Za-z\s]+?)\s*(\d+)/);
    if (match) {
      classes.push({
        name: match[1].trim(),
        level: parseInt(match[2], 10),
      });
    }
  }
  
  return classes;
}

/**
 * Calculate total level from classes
 */
function calculateTotalLevel(classes: Array<{ name: string; level: number }>): number {
  return classes.reduce((sum, cls) => sum + cls.level, 0);
}

/**
 * Parse ability scores from content
 */
function parseAbilityScores(content: string): DndBeyondCharacter['abilities'] | null {
  const abilities: DndBeyondCharacter['abilities'] = {
    strength: { score: 10, modifier: 0 },
    dexterity: { score: 10, modifier: 0 },
    constitution: { score: 10, modifier: 0 },
    intelligence: { score: 10, modifier: 0 },
    wisdom: { score: 10, modifier: 0 },
    charisma: { score: 10, modifier: 0 },
  };
  
  // Try to find ability scores in various formats
  const abilityPatterns = [
    /STR\s*:?\s*(\d+)/i,
    /DEX\s*:?\s*(\d+)/i,
    /CON\s*:?\s*(\d+)/i,
    /INT\s*:?\s*(\d+)/i,
    /WIS\s*:?\s*(\d+)/i,
    /CHA\s*:?\s*(\d+)/i,
  ];
  
  const abilityKeys: (keyof typeof abilities)[] = [
    'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'
  ];
  
  abilityPatterns.forEach((pattern, index) => {
    const match = content.match(pattern);
    if (match) {
      const score = parseInt(match[1], 10);
      abilities[abilityKeys[index]] = {
        score,
        modifier: getAbilityModifier(score),
      };
    }
  });
  
  // Also try full names
  ABILITY_NAMES.forEach((name, index) => {
    const pattern = new RegExp(`${name}\\s*:?\\s*(\\d+)`, 'i');
    const match = content.match(pattern);
    if (match) {
      const score = parseInt(match[1], 10);
      abilities[abilityKeys[index]] = {
        score,
        modifier: getAbilityModifier(score),
      };
    }
  });
  
  return abilities;
}

/**
 * Parse skills from content
 */
function parseSkills(content: string): DndBeyondCharacter['skills'] {
  const skills: DndBeyondCharacter['skills'] = [];
  
  for (const skillName of SKILLS) {
    // Look for patterns like "Acrobatics +5" or "Acrobatics: +5" or "* Acrobatics +5" (proficient)
    const pattern = new RegExp(`(\\*)?\\s*${skillName}\\s*:?\\s*([+-]?\\d+)`, 'i');
    const match = content.match(pattern);
    
    if (match) {
      skills.push({
        name: skillName,
        modifier: extractModifier(match[2]),
        proficient: match[1] === '*',
      });
    } else {
      // Default skill with no modifier info
      skills.push({
        name: skillName,
        modifier: 0,
        proficient: false,
      });
    }
  }
  
  return skills;
}

/**
 * Parse actions/attacks from content
 */
function parseActions(content: string): DndBeyondCharacter['actions'] {
  const actions: DndBeyondCharacter['actions'] = [];
  
  // Look for attack patterns like "Longsword +5 to hit, 1d8+3 slashing"
  const attackPattern = /([A-Za-z\s]+?)\s*\+(\d+)\s*to hit.*?(\d+d\d+(?:\s*\+\s*\d+)?)\s*(\w+)?/gi;
  let match;
  
  while ((match = attackPattern.exec(content)) !== null) {
    actions.push({
      name: match[1].trim(),
      attackBonus: parseInt(match[2], 10),
      damage: match[3],
      damageType: match[4],
      description: match[0],
    });
  }
  
  return actions;
}

/**
 * Parse features from content
 */
function parseFeatures(content: string): DndBeyondCharacter['features'] {
  const features: DndBeyondCharacter['features'] = [];
  
  // Look for feature headers - commonly bold or with specific formatting
  const featurePattern = /\*\*([^*]+)\*\*[.:]\s*([^*\n]+)/g;
  let match;
  
  while ((match = featurePattern.exec(content)) !== null) {
    features.push({
      name: match[1].trim(),
      description: match[2].trim(),
      source: 'Unknown', // Would need more context to determine source
    });
  }
  
  return features;
}

/**
 * Extract portrait URL from content
 */
function extractPortraitUrl(content: string): string | undefined {
  // Look for image URLs that might be portraits
  const imgPattern = /https?:\/\/[^\s"']+(?:avatar|portrait|character)[^\s"']*/gi;
  const match = content.match(imgPattern);
  return match?.[0];
}

/**
 * Main parsing function - takes scraped content and returns structured character data
 */
export function parseDndBeyondCharacter(
  content: string,
  sourceUrl: string
): ParseResult {
  try {
    // Extract character ID from URL
    const urlMatch = sourceUrl.match(/characters\/(\d+)/);
    const characterId = urlMatch ? `dndb-${urlMatch[1]}` : `dndb-${Date.now()}`;
    
    // Extract name - usually in a prominent heading
    const nameMatch = content.match(/(?:^|\n)#\s*([^\n]+)|<h1[^>]*>([^<]+)/i);
    const name = nameMatch ? (nameMatch[1] || nameMatch[2]).trim() : 'Unknown Character';
    
    // Extract race/species
    const raceMatch = content.match(/(?:Race|Species)[:\s]*([A-Za-z\s-]+)/i);
    const race = raceMatch ? raceMatch[1].trim() : 'Unknown';
    
    // Extract class info
    const classMatch = content.match(/(?:Class(?:es)?)[:\s]*([A-Za-z\s\d\/,&]+)/i);
    const classes = classMatch ? parseClasses(classMatch[1]) : [{ name: 'Unknown', level: 1 }];
    
    // Calculate total level
    const level = calculateTotalLevel(classes);
    
    // Extract AC
    const acMatch = content.match(/(?:AC|Armor Class)[:\s]*(\d+)/i);
    const armorClass = acMatch ? parseInt(acMatch[1], 10) : 10;
    
    // Extract HP
    const hpMatch = content.match(/(?:HP|Hit Points)[:\s]*(\d+)\s*(?:\/\s*(\d+))?/i);
    const hitPoints = {
      current: hpMatch ? parseInt(hpMatch[1], 10) : 10,
      max: hpMatch && hpMatch[2] ? parseInt(hpMatch[2], 10) : (hpMatch ? parseInt(hpMatch[1], 10) : 10),
      temp: 0,
    };
    
    // Extract Speed
    const speedMatch = content.match(/Speed[:\s]*(\d+)/i);
    const speed = speedMatch ? parseInt(speedMatch[1], 10) : 30;
    
    // Extract Initiative
    const initMatch = content.match(/Initiative[:\s]*([+-]?\d+)/i);
    
    // Extract Proficiency Bonus
    const profMatch = content.match(/(?:Proficiency|Prof\.?\s*Bonus)[:\s]*\+?(\d+)/i);
    const proficiencyBonus = profMatch ? parseInt(profMatch[1], 10) : 2;
    
    // Parse ability scores
    const abilities = parseAbilityScores(content) || {
      strength: { score: 10, modifier: 0 },
      dexterity: { score: 10, modifier: 0 },
      constitution: { score: 10, modifier: 0 },
      intelligence: { score: 10, modifier: 0 },
      wisdom: { score: 10, modifier: 0 },
      charisma: { score: 10, modifier: 0 },
    };
    
    // Initiative defaults to DEX modifier if not specified
    const initiative = initMatch 
      ? extractModifier(initMatch[1]) 
      : abilities.dexterity.modifier;
    
    // Parse skills
    const skills = parseSkills(content);
    
    // Parse saving throws
    const savingThrows = ABILITY_NAMES.map((ability) => {
      const shortName = ability.slice(0, 3).toUpperCase();
      const pattern = new RegExp(`${shortName}\\s*(?:Save|Saving)[:\\s]*([+-]?\\d+)`, 'i');
      const match = content.match(pattern);
      return {
        ability,
        modifier: match ? extractModifier(match[1]) : abilities[ability.toLowerCase() as keyof typeof abilities].modifier,
        proficient: false, // Would need more context
      };
    });
    
    // Extract passive perception
    const passivePercMatch = content.match(/Passive\s*(?:Wisdom\s*)?\(Perception\)[:\s]*(\d+)|Passive Perception[:\s]*(\d+)/i);
    const passivePerception = passivePercMatch 
      ? parseInt(passivePercMatch[1] || passivePercMatch[2], 10)
      : 10 + abilities.wisdom.modifier;
    
    // Parse actions
    const actions = parseActions(content);
    
    // Parse features
    const features = parseFeatures(content);
    
    // Extract portrait
    const portraitUrl = extractPortraitUrl(content);
    
    const character: DndBeyondCharacter = {
      id: characterId,
      name,
      portraitUrl,
      level,
      classes,
      race,
      abilities,
      armorClass,
      hitPoints,
      speed,
      initiative,
      proficiencyBonus,
      skills,
      savingThrows,
      proficiencies: {
        armor: [],
        weapons: [],
        tools: [],
        languages: [],
      },
      passivePerception,
      features,
      actions,
      conditions: [],
      sourceUrl,
      lastUpdated: new Date().toISOString(),
    };
    
    return { success: true, character };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse character data',
    };
  }
}

/**
 * Create a manual character entry (fallback when scraping fails)
 */
export function createManualCharacter(
  name: string,
  sourceUrl: string
): DndBeyondCharacter {
  const urlMatch = sourceUrl.match(/characters\/(\d+)/);
  const characterId = urlMatch ? `dndb-${urlMatch[1]}` : `dndb-${Date.now()}`;
  
  return {
    id: characterId,
    name,
    level: 1,
    classes: [{ name: 'Unknown', level: 1 }],
    race: 'Unknown',
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
    skills: SKILLS.map((name) => ({ name, modifier: 0, proficient: false })),
    savingThrows: ABILITY_NAMES.map((ability) => ({
      ability,
      modifier: 0,
      proficient: false,
    })),
    proficiencies: { armor: [], weapons: [], tools: [], languages: [] },
    passivePerception: 10,
    features: [],
    actions: [],
    conditions: [],
    sourceUrl,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Validate a D&D Beyond URL
 */
export function isValidDndBeyondUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?dndbeyond\.com\/characters\/\d+/.test(url);
}

/**
 * Extract character ID from URL
 */
export function extractCharacterId(url: string): string | null {
  const match = url.match(/characters\/(\d+)/);
  return match ? match[1] : null;
}

// ============================================================================
// D&D Beyond Official JSON Export Parser
// ============================================================================

interface DndBeyondExportResult {
  success: boolean;
  character?: DndBeyondCharacter;
  error?: string;
}

/**
 * Parse the official D&D Beyond character export JSON format.
 * This handles the JSON structure from the "Export Character" feature.
 */
export function parseDndBeyondExport(data: unknown): DndBeyondExportResult {
  try {
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Invalid data format' };
    }

    const json = data as Record<string, unknown>;
    
    // Extract character ID
    const rawId = json.id ?? json.characterId ?? Date.now();
    const characterId = `dndb-${rawId}`;
    
    // Extract name (required)
    const name = (json.name as string)?.trim();
    if (!name) {
      return { success: false, error: 'Character name is missing' };
    }

    // Extract race
    const raceData = json.race as Record<string, unknown> | undefined;
    const race = (raceData?.fullName as string) || 
                 (raceData?.baseName as string) || 
                 (json.species as Record<string, unknown>)?.fullName as string ||
                 'Unknown';

    // Extract classes
    const classesRaw = json.classes as Array<Record<string, unknown>> || [];
    const classes = classesRaw.map((cls) => {
      const definition = cls.definition as Record<string, unknown> | undefined;
      return {
        name: (definition?.name as string) || (cls.name as string) || 'Unknown',
        level: (cls.level as number) || 1,
      };
    });
    
    if (classes.length === 0) {
      classes.push({ name: 'Unknown', level: 1 });
    }

    const totalLevel = classes.reduce((sum, c) => sum + c.level, 0);

    // Extract ability scores
    // D&D Beyond format: stats is an array with id (1-6) and value
    const statsRaw = json.stats as Array<{ id?: number; value?: number }> || [];
    const bonusStatsRaw = json.bonusStats as Array<{ id?: number; value?: number }> || [];
    const overrideStatsRaw = json.overrideStats as Array<{ id?: number; value?: number | null }> || [];
    
    // Racial bonuses
    const racialBonuses = extractRacialBonuses(json);
    
    const getStatValue = (statId: number): number => {
      // Check for override first
      const override = overrideStatsRaw.find(s => s.id === statId);
      if (override?.value !== null && override?.value !== undefined) {
        return override.value;
      }
      
      // Base stat + bonuses
      const base = statsRaw.find(s => s.id === statId)?.value || 10;
      const bonus = bonusStatsRaw.find(s => s.id === statId)?.value || 0;
      const racial = racialBonuses[statId] || 0;
      
      return base + bonus + racial;
    };

    const abilities = {
      strength: { score: getStatValue(1), modifier: getAbilityModifier(getStatValue(1)) },
      dexterity: { score: getStatValue(2), modifier: getAbilityModifier(getStatValue(2)) },
      constitution: { score: getStatValue(3), modifier: getAbilityModifier(getStatValue(3)) },
      intelligence: { score: getStatValue(4), modifier: getAbilityModifier(getStatValue(4)) },
      wisdom: { score: getStatValue(5), modifier: getAbilityModifier(getStatValue(5)) },
      charisma: { score: getStatValue(6), modifier: getAbilityModifier(getStatValue(6)) },
    };

    // Calculate HP
    const baseHitPoints = (json.baseHitPoints as number) || 0;
    const bonusHitPoints = (json.bonusHitPoints as number) || 0;
    const temporaryHitPoints = (json.temporaryHitPoints as number) || 0;
    const removedHitPoints = (json.removedHitPoints as number) || 0;
    const overrideHitPoints = json.overrideHitPoints as number | null;
    
    const constitutionBonus = abilities.constitution.modifier * totalLevel;
    const maxHP = overrideHitPoints ?? (baseHitPoints + bonusHitPoints + constitutionBonus);
    const currentHP = Math.max(0, maxHP - removedHitPoints);

    // Calculate AC
    let armorClass = 10 + abilities.dexterity.modifier;
    if (json.overrideArmorClass !== null && json.overrideArmorClass !== undefined) {
      armorClass = json.overrideArmorClass as number;
    }
    // Check for armor in inventory for better AC calculation could be added here

    // Speed
    const speedData = json.race as Record<string, unknown> | undefined;
    const weightSpeeds = speedData?.weightSpeeds as Record<string, Record<string, number>> | undefined;
    const walkingSpeed = (weightSpeeds?.normal?.walk as number) || 
                         (json.baseWalkingSpeed as number) || 30;

    // Proficiency bonus
    const proficiencyBonus = Math.ceil(totalLevel / 4) + 1;

    // Initiative
    const initiative = abilities.dexterity.modifier;

    // Portrait URL
    const decorations = json.decorations as Record<string, unknown> | undefined;
    const portraitUrl = (decorations?.avatarUrl as string) || 
                        (decorations?.frameAvatarUrl as string) ||
                        (json.avatarUrl as string);

    // Background
    const backgroundData = json.background as Record<string, unknown> | undefined;
    const background = (backgroundData?.definition as Record<string, unknown>)?.name as string ||
                       (backgroundData?.name as string);

    // Build the character object
    const character: DndBeyondCharacter = {
      id: characterId,
      name,
      portraitUrl,
      level: totalLevel,
      classes,
      race,
      background,
      abilities,
      armorClass,
      hitPoints: {
        current: currentHP,
        max: maxHP,
        temp: temporaryHitPoints,
      },
      speed: walkingSpeed,
      initiative,
      proficiencyBonus,
      skills: extractSkills(json, abilities, proficiencyBonus),
      savingThrows: extractSavingThrows(json, abilities, proficiencyBonus),
      proficiencies: extractProficiencies(json),
      passivePerception: 10 + abilities.wisdom.modifier,
      features: extractFeatures(json),
      actions: extractActions(json),
      conditions: [],
      sourceUrl: '',
      lastUpdated: new Date().toISOString(),
    };

    return { success: true, character };
  } catch (error) {
    console.error('Failed to parse D&D Beyond export:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    };
  }
}

// Helper to extract racial ability bonuses
function extractRacialBonuses(json: Record<string, unknown>): Record<number, number> {
  const bonuses: Record<number, number> = {};
  
  const modifiers = json.modifiers as Record<string, Array<Record<string, unknown>>> | undefined;
  if (!modifiers) return bonuses;
  
  const raceModifiers = modifiers.race || [];
  for (const mod of raceModifiers) {
    if (mod.type === 'bonus' && mod.subType?.toString().includes('-score')) {
      const statId = mod.statId as number;
      const value = mod.value as number || 0;
      if (statId) {
        bonuses[statId] = (bonuses[statId] || 0) + value;
      }
    }
  }
  
  return bonuses;
}

// Helper to extract skills
function extractSkills(
  json: Record<string, unknown>,
  abilities: DndBeyondCharacter['abilities'],
  profBonus: number
): DndBeyondCharacter['skills'] {
  const skillAbilityMap: Record<string, keyof typeof abilities> = {
    'Acrobatics': 'dexterity',
    'Animal Handling': 'wisdom',
    'Arcana': 'intelligence',
    'Athletics': 'strength',
    'Deception': 'charisma',
    'History': 'intelligence',
    'Insight': 'wisdom',
    'Intimidation': 'charisma',
    'Investigation': 'intelligence',
    'Medicine': 'wisdom',
    'Nature': 'intelligence',
    'Perception': 'wisdom',
    'Performance': 'charisma',
    'Persuasion': 'charisma',
    'Religion': 'intelligence',
    'Sleight of Hand': 'dexterity',
    'Stealth': 'dexterity',
    'Survival': 'wisdom',
  };

  return Object.entries(skillAbilityMap).map(([skillName, ability]) => {
    const baseMod = abilities[ability].modifier;
    // Would need to check proficiencies in modifiers for accurate proficiency detection
    return {
      name: skillName,
      modifier: baseMod,
      proficient: false,
    };
  });
}

// Helper to extract saving throws
function extractSavingThrows(
  json: Record<string, unknown>,
  abilities: DndBeyondCharacter['abilities'],
  profBonus: number
): DndBeyondCharacter['savingThrows'] {
  const abilityNames: Array<{ name: string; key: keyof typeof abilities }> = [
    { name: 'Strength', key: 'strength' },
    { name: 'Dexterity', key: 'dexterity' },
    { name: 'Constitution', key: 'constitution' },
    { name: 'Intelligence', key: 'intelligence' },
    { name: 'Wisdom', key: 'wisdom' },
    { name: 'Charisma', key: 'charisma' },
  ];

  return abilityNames.map(({ name, key }) => ({
    ability: name,
    modifier: abilities[key].modifier,
    proficient: false, // Would need class data for accurate detection
  }));
}

// Helper to extract proficiencies
function extractProficiencies(json: Record<string, unknown>): DndBeyondCharacter['proficiencies'] {
  // Basic extraction - could be expanded with modifiers parsing
  return {
    armor: [],
    weapons: [],
    tools: [],
    languages: ['Common'],
  };
}

// Helper to extract features
function extractFeatures(json: Record<string, unknown>): DndBeyondCharacter['features'] {
  const features: DndBeyondCharacter['features'] = [];
  
  // Extract from class features
  const classesData = json.classes as Array<Record<string, unknown>> || [];
  for (const cls of classesData) {
    const classFeatures = cls.classFeatures as Array<Record<string, unknown>> || [];
    for (const feature of classFeatures) {
      const definition = feature.definition as Record<string, unknown> | undefined;
      if (definition?.name) {
        features.push({
          name: definition.name as string,
          description: (definition.description as string) || '',
          source: (cls.definition as Record<string, unknown>)?.name as string || 'Class',
        });
      }
    }
  }

  return features.slice(0, 20); // Limit to avoid huge lists
}

// Helper to extract actions
function extractActions(json: Record<string, unknown>): DndBeyondCharacter['actions'] {
  const actions: DndBeyondCharacter['actions'] = [];
  
  // Extract from actions/attacks
  const actionsData = json.actions as Record<string, Array<Record<string, unknown>>> | undefined;
  if (actionsData?.class) {
    for (const action of actionsData.class) {
      if (action.name) {
        actions.push({
          name: action.name as string,
          description: (action.snippet as string) || '',
        });
      }
    }
  }

  return actions;
}
