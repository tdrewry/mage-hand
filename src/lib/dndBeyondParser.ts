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
