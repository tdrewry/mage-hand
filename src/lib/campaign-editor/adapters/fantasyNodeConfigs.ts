/**
 * Fantasy Dungeon Crawler node type configurations — kept as reference.
 */

import type { NodeTypeConfig } from '../types/nodeConfig';

export const FANTASY_COMBAT_CONFIG: NodeTypeConfig = {
  id: 'combat', label: 'Encounter', icon: 'swords', color: '0 70% 50%',
  description: 'Tactical combat encounter in a dungeon room',
  features: { hasMap: true, hasVictoryDefeat: true, hasBriefing: true },
  customFields: [
    { key: 'encounterType', label: 'Encounter Type', type: 'select', defaultValue: 'ambush',
      options: [{ value: 'ambush', label: 'Ambush' }, { value: 'patrol', label: 'Patrol' }, { value: 'boss', label: 'Boss Fight' }, { value: 'lair', label: 'Lair Action' }, { value: 'puzzle-combat', label: 'Puzzle Combat' }], group: 'Encounter' },
    { key: 'challengeRating', label: 'Challenge Rating', type: 'number', defaultValue: 3, min: 1, max: 30, group: 'Encounter' },
    { key: 'monsterCount', label: 'Monster Count', type: 'number', defaultValue: 4, min: 1, max: 20, group: 'Enemies' },
    { key: 'hasMinionWaves', label: 'Reinforcement Waves', type: 'boolean', defaultValue: false, group: 'Enemies' },
    { key: 'trapDensity', label: 'Trap Density', type: 'select', defaultValue: 'none',
      options: [{ value: 'none', label: 'None' }, { value: 'light', label: 'Light' }, { value: 'moderate', label: 'Moderate' }, { value: 'heavy', label: 'Heavy' }], group: 'Hazards' },
    { key: 'lootTable', label: 'Loot Table', type: 'select', defaultValue: 'standard',
      options: [{ value: 'none', label: 'No Loot' }, { value: 'standard', label: 'Standard' }, { value: 'hoard', label: 'Treasure Hoard' }, { value: 'quest-item', label: 'Quest Item' }], group: 'Rewards' },
  ],
};

export const FANTASY_CUTSCENE_CONFIG: NodeTypeConfig = {
  id: 'cutscene', label: 'Narration', icon: 'scroll', color: '270 60% 55%',
  features: { hasDialogLines: true, hasSceneSettings: true, hasAutoAdvance: true, hasContinue: true },
  customFields: [
    { key: 'narrationStyle', label: 'Narration Style', type: 'select', defaultValue: 'descriptive',
      options: [{ value: 'descriptive', label: 'Descriptive' }, { value: 'dramatic', label: 'Dramatic Reveal' }, { value: 'flashback', label: 'Flashback' }, { value: 'prophecy', label: 'Prophecy / Vision' }], group: 'Presentation' },
  ],
};

export const FANTASY_DIALOG_CONFIG: NodeTypeConfig = {
  id: 'dialog', label: 'Conversation', icon: 'message-square', color: '45 85% 55%',
  features: { hasDialogLines: true, hasOutcomes: true, hasSceneSettings: true, hasContinue: true },
  customFields: [
    { key: 'skillCheckRequired', label: 'Skill Check', type: 'select', defaultValue: 'none',
      options: [{ value: 'none', label: 'None' }, { value: 'persuasion', label: 'Persuasion' }, { value: 'intimidation', label: 'Intimidation' }, { value: 'deception', label: 'Deception' }, { value: 'insight', label: 'Insight' }], group: 'Checks' },
    { key: 'checkDC', label: 'Check DC', type: 'number', defaultValue: 12, min: 5, max: 30, group: 'Checks' },
    { key: 'vendorAvailable', label: 'Vendor Available', type: 'boolean', defaultValue: false, group: 'Commerce' },
  ],
};

export const FANTASY_DOWNTIME_CONFIG: NodeTypeConfig = {
  id: 'downtime', label: 'Rest', icon: 'tent', color: '140 60% 40%',
  features: { hasContinue: true, hasBriefing: true },
  customFields: [
    { key: 'restType', label: 'Rest Type', type: 'select', defaultValue: 'long',
      options: [{ value: 'short', label: 'Short Rest' }, { value: 'long', label: 'Long Rest' }, { value: 'tavern', label: 'Tavern Stay' }, { value: 'camp', label: 'Wilderness Camp' }], group: 'Rest Rules' },
    { key: 'healToFull', label: 'Heal to Full', type: 'boolean', defaultValue: true, group: 'Rest Rules' },
    { key: 'randomEncounterChance', label: 'Random Encounter %', type: 'number', defaultValue: 0, min: 0, max: 100, group: 'Hazards' },
    { key: 'craftingAvailable', label: 'Allow Crafting', type: 'boolean', defaultValue: false, group: 'Activities' },
  ],
};

export const FANTASY_NODE_TYPE_CONFIGS: NodeTypeConfig[] = [
  FANTASY_COMBAT_CONFIG,
  FANTASY_CUTSCENE_CONFIG,
  FANTASY_DIALOG_CONFIG,
  FANTASY_DOWNTIME_CONFIG,
];
