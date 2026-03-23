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
    conditionImmunities: { type: 'array', items: { type: 'string' }, description: 'List of conditions this entity cannot suffer' }
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

export const CONTEXT_REGISTRY_SEED: Record<string, { id: string, label: string, rootSchema: SchemaNode }> = {
  intent: {
    id: 'intent',
    label: '1. Execution Intent',
    rootSchema: INTENT_PAYLOAD_SCHEMA
  },
  actor: {
    id: 'actor',
    label: '2. Actor (Source Entity)',
    rootSchema: MAGE_HAND_ENTITY_SCHEMA
  },
  action: {
    id: 'action',
    label: '3. Action Data',
    rootSchema: TOKEN_ACTION_SCHEMA
  },
  target: {
    id: 'target',
    label: '4. Target (Defender Entity)',
    rootSchema: MAGE_HAND_ENTITY_SCHEMA
  },
  targetResult: {
    id: 'targetResult',
    label: '5. Pipeline Output (Target Result)',
    rootSchema: TARGET_RESULT_SCHEMA
  }
};
