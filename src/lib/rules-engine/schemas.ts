export interface SchemaNode {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'enum' | 'any';
  description?: string;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  enumValues?: string[];
}

export const TOKEN_ACTION_SCHEMA: SchemaNode = {
  type: 'object',
  description: 'The active ability, attack, trait, or spell being evaluated in the pipeline.',
  properties: {
    id: { type: 'string', description: 'Unique identifier for this action' },
    name: { type: 'string', description: 'Display name of the action (e.g. Longsword, Fireball)' },
    category: { type: 'enum', enumValues: ['attack', 'spell', 'skill', 'trait', 'bonus', 'reaction', 'legendary'], description: 'Mechanic category' },
    attackBonus: { type: 'number', description: 'Flat modifier to add to the d20 attack roll' },
    damageFormula: { type: 'string', description: 'Dice expression for damage/healing (e.g. 1d8+3)' },
    damageType: { type: 'string', description: 'Primary damage type name (e.g. slashing, radiant)' },
    range: { type: 'string', description: 'Range definition (e.g. 5 ft., 120 ft.)' },
    description: { type: 'string', description: 'Descriptive flavor text' },
    spellLevel: { type: 'number', description: 'Base level of the spell (0 for Cantrips)' },
    modifier: { type: 'number', description: 'Flat modifier for skills' },
    proficient: { type: 'boolean', description: 'Whether the actor is proficient in this' },
    pipelineId: { type: 'string', description: 'Bound Rules Engine pipeline UUID' },
  }
};

export const MAGE_HAND_ENTITY_SCHEMA: SchemaNode = {
  type: 'object',
  description: 'A full active Character or Monster sheet from the local map.',
  properties: {
    id: { type: 'string', description: 'Database ID of the entity' },
    name: { type: 'string', description: 'Entity true name' },
    type: { type: 'string', description: 'Entity classification (e.g. humanoid, beast)' },
    size: { type: 'string', description: 'Creature size (e.g. Medium, Large)' },
    alignment: { type: 'string', description: 'Moral alignment string' },
    hp: {
      type: 'object',
      properties: {
        current: { type: 'number' },
        max: { type: 'number' },
        temp: { type: 'number' },
        formula: { type: 'string', description: 'Hit dice formula (e.g. 2d8+2)' }
      }
    },
    ac: {
      type: 'object',
      properties: {
        value: { type: 'number', description: 'Total armor class' },
        flat: { type: 'number', description: 'Base unarmored/natural AC target' }
      }
    },
    speed: {
      type: 'object',
      properties: {
        walk: { type: 'number' },
        fly: { type: 'number' },
        swim: { type: 'number' },
        climb: { type: 'number' }
      }
    },
    attributes: {
      type: 'object',
      description: 'The big 6 ability stats',
      properties: {
        str: { type: 'number', description: 'Strength score (e.g. 18)' },
        dex: { type: 'number', description: 'Dexterity score' },
        con: { type: 'number', description: 'Constitution score' },
        int: { type: 'number', description: 'Intelligence score' },
        wis: { type: 'number', description: 'Wisdom score' },
        cha: { type: 'number', description: 'Charisma score' }
      }
    },
    saves: {
      type: 'object',
      description: 'Saving throw modifiers (bonuses only)',
      properties: {
        str: { type: 'number' },
        dex: { type: 'number' },
        con: { type: 'number' },
        int: { type: 'number' },
        wis: { type: 'number' },
        cha: { type: 'number' }
      }
    },
    skills: {
      type: 'object',
      description: 'Skill modifiers mapped by lowercase skill name (e.g. stealth, perception)',
      properties: {
        stealth: { type: 'number' },
        perception: { type: 'number' },
        athletics: { type: 'number' },
        acrobatics: { type: 'number' },
        insight: { type: 'number' }
      }
    },
    resistances: { type: 'array', items: { type: 'string' }, description: 'List of damage types this entity resists' },
    vulnerabilities: { type: 'array', items: { type: 'string' }, description: 'List of damage types this entity is vulnerable to' },
    immunities: { type: 'array', items: { type: 'string' }, description: 'List of damage types this entity is immune to' },
    conditionImmunities: { type: 'array', items: { type: 'string' }, description: 'List of conditions this entity cannot suffer' },
    adapter: { type: 'any', description: 'Dynamically mounted raw data from external adapters (e.g. 5e character JSON)' }
  }
};

export const INTENT_PAYLOAD_SCHEMA: SchemaNode = {
  type: 'object',
  description: 'The incoming trigger payload from the VTT when a player declares a move.',
  properties: {
    actorId: { type: 'string', description: 'UUID of the Map Token that initiated the action' },
    targets: { type: 'array', items: { type: 'string' }, description: 'Array of UUIDs of targeted Map Tokens' },
    actionId: { type: 'string', description: 'ID of the requested action' },
    actionType: { type: 'enum', enumValues: ['attack', 'spell', 'skill', 'item', 'trait'], description: 'Primary taxonomy of the request' },
    timestamp: { type: 'number', description: 'Epoch millisecond of the declaration' },
    modifiers: {
      type: 'object',
      description: 'Dynamic properties and flags injected by UI/Adapters',
      properties: {
        spellSlotLevel: { type: 'number', description: 'The level the spell was upcast at (if applicable)' },
        isAdvantage: { type: 'boolean', description: 'VTT enforced advantage' },
        isDisadvantage: { type: 'boolean', description: 'VTT enforced disadvantage' },
        isCriticalMiss: { type: 'boolean', description: 'VTT enforced auto-fail' },
        isCriticalHit: { type: 'boolean', description: 'VTT enforced auto-crit' }
      }
    }
  }
};

export const TARGET_RESULT_SCHEMA: SchemaNode = {
  type: 'object',
  description: 'The expected pipeline output mapping per-target.',
  properties: {
    challengeResult: {
      type: 'object',
      description: 'Outcome of an attack or save',
      properties: {
        rolls: { type: 'array', items: { type: 'number' }, description: 'Raw d20 rolls' },
        total: { type: 'number', description: 'Total modified roll amount' },
        isSuccess: { type: 'boolean', description: 'Did the target pass the save?' }
      }
    },
    damage: {
      type: 'object',
      description: 'Dynamic map of damage types (e.g., radiant, slashing) to their evaluated totals',
      properties: {
        '{damageType}': {
          type: 'object',
          properties: {
            amount: { type: 'number', description: 'Total damage amount' },
            rolls: { type: 'array', items: { type: 'number' } },
            formula: { type: 'string' }
          }
        }
      }
    },
    effectsApplied: {
      type: 'object',
      description: 'Dynamic map of effect condition names (e.g., Stunned) to durations'
    },
    suggestedResolution: {
      type: 'enum',
      enumValues: ['hit', 'miss', 'critical_hit', 'critical_miss', 'half', 'none'],
      description: 'The automatically calculated resolution of the attack or save'
    }
  }
};

export const FIFTH_EDITION_CHARACTER_SCHEMA: SchemaNode = {
  type: 'object',
  description: 'Native Character JSON structure.',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    level: { type: 'number' },
    classes: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, level: { type: 'number' } } }
    },
    race: { type: 'string' },
    background: { type: 'string' },
    abilities: {
      type: 'object',
      properties: {
        strength: { type: 'object', properties: { score: { type: 'number' }, modifier: { type: 'number' } } },
        dexterity: { type: 'object', properties: { score: { type: 'number' }, modifier: { type: 'number' } } },
        constitution: { type: 'object', properties: { score: { type: 'number' }, modifier: { type: 'number' } } },
        intelligence: { type: 'object', properties: { score: { type: 'number' }, modifier: { type: 'number' } } },
        wisdom: { type: 'object', properties: { score: { type: 'number' }, modifier: { type: 'number' } } },
        charisma: { type: 'object', properties: { score: { type: 'number' }, modifier: { type: 'number' } } }
      }
    },
    armorClass: { type: 'number' },
    hitPoints: {
      type: 'object',
      properties: { current: { type: 'number' }, max: { type: 'number' }, temp: { type: 'number' } }
    },
    speed: { type: 'number' },
    initiative: { type: 'number' },
    proficiencyBonus: { type: 'number' },
    skills: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, modifier: { type: 'number' }, proficient: { type: 'boolean' } }
      }
    },
    savingThrows: {
      type: 'array',
      items: {
        type: 'object',
        properties: { ability: { type: 'string' }, modifier: { type: 'number' }, proficient: { type: 'boolean' } }
      }
    },
    proficiencies: {
      type: 'object',
      properties: {
        armor: { type: 'array', items: { type: 'string' } },
        weapons: { type: 'array', items: { type: 'string' } },
        tools: { type: 'array', items: { type: 'string' } },
        languages: { type: 'array', items: { type: 'string' } }
      }
    },
    passivePerception: { type: 'number' },
    features: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, description: { type: 'string' }, source: { type: 'string' } }
      }
    },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          attackBonus: { type: 'number' },
          damage: { type: 'string' },
          damageType: { type: 'string' },
          range: { type: 'string' },
          description: { type: 'string' },
          targetingMode: { type: 'string' },
          executionPolicy: { type: 'string' }
        }
      }
    },
    conditions: {
      type: 'array',
      items: { type: 'string' }
    },
    sourceUrl: { type: 'string' },
    lastUpdated: { type: 'string' },
    spells: {
      type: 'object',
      properties: {
        spellcastingAbility: { type: 'string' },
        spellSaveDC: { type: 'number' },
        spellAttackBonus: { type: 'number' },
        cantrips: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' } } }
        },
        spellsByLevel: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              level: { type: 'number' },
              slots: { type: 'number' },
              slotsUsed: { type: 'number' },
              spells: {
                type: 'array',
                items: { type: 'object', properties: { name: { type: 'string' }, prepared: { type: 'boolean' } } }
              }
            }
          }
        }
      }
    }
  }
};

export const FIFTH_EDITION_CREATURE_SCHEMA: SchemaNode = {
  type: 'object',
  description: 'A 5e.tools aligned Monster JSON structure.',
  properties: {
    name: { type: 'string' },
    group: { type: 'array', items: { type: 'string' } },
    source: { type: 'string' },
    page: { type: 'number' },
    srd: { type: 'boolean' },
    otherSources: { type: 'array', items: { type: 'object', properties: { source: { type: 'string' } } } },
    reprintedAs: { type: 'array', items: { type: 'string' } },
    size: { type: 'array', items: { type: 'string' } },
    type: { type: 'any' },
    alignment: { type: 'array', items: { type: 'string' } },
    ac: {
      type: 'array',
      items: { type: 'object', properties: { ac: { type: 'number' }, from: { type: 'array', items: { type: 'string' } } } }
    },
    hp: {
      type: 'object',
      properties: { average: { type: 'number' }, formula: { type: 'string' } }
    },
    speed: { type: 'object', properties: { walk: { type: 'number' }, fly: { type: 'number' }, swim: { type: 'number' }, burrow: { type: 'number' }, climb: { type: 'number' } } },
    str: { type: 'number' },
    dex: { type: 'number' },
    con: { type: 'number' },
    int: { type: 'number' },
    wis: { type: 'number' },
    cha: { type: 'number' },
    save: { type: 'any' },
    skill: { type: 'any' },
    senses: { type: 'array', items: { type: 'string' } },
    passive: { type: 'number' },
    immune: { type: 'array', items: { type: 'any' } },
    vulnerable: { type: 'array', items: { type: 'any' } },
    resist: { type: 'array', items: { type: 'any' } },
    conditionImmune: { type: 'array', items: { type: 'any' } },
    languages: { type: 'array', items: { type: 'string' } },
    cr: { type: 'any' },
    trait: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, entries: { type: 'array', items: { type: 'any' } } } } },
    action: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, entries: { type: 'array', items: { type: 'any' } } } } },
    bonus: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, entries: { type: 'array', items: { type: 'any' } } } } },
    reaction: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, entries: { type: 'array', items: { type: 'any' } } } } },
    legendary: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, entries: { type: 'array', items: { type: 'any' } } } } },
    legendaryGroup: { type: 'object', properties: { name: { type: 'string' }, source: { type: 'string' } } },
    variant: { type: 'array', items: { type: 'any' } },
    environment: { type: 'array', items: { type: 'string' } },
    dragonCastingColor: { type: 'string' },
    dragonAge: { type: 'string' },
    soundClip: { type: 'object', properties: { type: { type: 'string' }, path: { type: 'string' } } },
    traitTags: { type: 'array', items: { type: 'string' } },
    senseTags: { type: 'array', items: { type: 'string' } },
    actionTags: { type: 'array', items: { type: 'string' } },
    languageTags: { type: 'array', items: { type: 'string' } },
    damageTags: { type: 'array', items: { type: 'string' } },
    damageTagsLegendary: { type: 'array', items: { type: 'string' } },
    miscTags: { type: 'array', items: { type: 'string' } },
    conditionInflict: { type: 'array', items: { type: 'string' } },
    conditionInflictLegendary: { type: 'array', items: { type: 'string' } },
    savingThrowForced: { type: 'array', items: { type: 'string' } },
    savingThrowForcedLegendary: { type: 'array', items: { type: 'string' } },
    hasToken: { type: 'boolean' },
    hasFluff: { type: 'boolean' },
    hasFluffImages: { type: 'boolean' },
    id: { type: 'string' }
  }
};

export const FIFTH_EDITION_ITEM_SCHEMA: SchemaNode = {
  type: 'object',
  description: 'A 5e.tools aligned Item JSON structure.',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    source: { type: 'string' },
    baseItem: { type: 'string' },
    type: { type: 'string', description: 'Item type (e.g. M, R, W)' },
    rarity: { type: 'string' },
    reqAttune: { type: 'boolean' },
    weight: { type: 'number' },
    value: { type: 'number' },
    dmg1: { type: 'string' },
    dmgType: { type: 'string' },
    weaponCategory: { type: 'string' },
    property: { type: 'array', items: { type: 'string' } }
  }
};

export const CONTEXT_REGISTRY_SEED: Record<string, { id: string, label: string, rootSchema: SchemaNode, role: 'system' | 'character' | 'creature' | 'item' | 'custom', sourceUrl?: string, version?: string }> = {
  intent: {
    id: 'intent',
    label: '1. Execution Intent',
    rootSchema: INTENT_PAYLOAD_SCHEMA,
    role: 'system'
  },
  actor: {
    id: 'actor',
    label: '2. Actor (Source Entity)',
    rootSchema: MAGE_HAND_ENTITY_SCHEMA,
    role: 'system'
  },
  action: {
    id: 'action',
    label: '3. Action Data',
    rootSchema: TOKEN_ACTION_SCHEMA,
    role: 'system'
  },
  target: {
    id: 'target',
    label: '4. Target (Defender Entity)',
    rootSchema: MAGE_HAND_ENTITY_SCHEMA,
    role: 'system'
  },
  targetResult: {
    id: 'targetResult',
    label: '5. Pipeline Output (Target Result)',
    rootSchema: TARGET_RESULT_SCHEMA,
    role: 'system'
  },
  '5e-character': {
    id: '5e-character',
    label: 'Native Character',
    rootSchema: FIFTH_EDITION_CHARACTER_SCHEMA,
    role: 'character',
    sourceUrl: 'Mage Hand Examples',
    version: '1.0.0'
  },
  '5e-creature': {
    id: '5e-creature',
    label: '5e.tools Creature',
    rootSchema: FIFTH_EDITION_CREATURE_SCHEMA,
    role: 'creature',
    sourceUrl: 'https://5e.tools/bestiary.schema.json',
    version: '1.0.0'
  },
  '5e-item': {
    id: '5e-item',
    label: '5e.tools Item',
    rootSchema: FIFTH_EDITION_ITEM_SCHEMA,
    role: 'item',
    sourceUrl: 'https://5e.tools/items.schema.json',
    version: '1.0.0'
  }
};

/**
 * Compiles a native Mage-Hand SchemaNode AST into a valid JSON Schema Draft-07 object
 * suitable for Monaco Editor diagnostics formatting and validation.
 */
export function compileToMonacoSchema(node: SchemaNode): any {
  if (!node) return {};
  
  const schema: any = {};
  
  if (node.description) schema.description = node.description;
  
  if (node.type === 'any') {
    // "any" in JSON Schema doesn't strictly need a 'type' property
  } else if (node.type === 'enum') {
    schema.type = 'string'; 
    if (node.enumValues) {
      schema.enum = node.enumValues;
    }
  } else {
    schema.type = node.type;
  }
  
  if (node.type === 'object' && node.properties) {
    schema.properties = {};
    for (const [key, childNode] of Object.entries(node.properties)) {
      schema.properties[key] = compileToMonacoSchema(childNode);
    }
    schema.additionalProperties = false; // Strictly enforce schema shape
  }
  
  if (node.type === 'array' && node.items) {
    schema.items = compileToMonacoSchema(node.items);
  }
  
  return schema;
}
