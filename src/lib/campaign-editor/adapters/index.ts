// Adapter exports — stripped of sci-fi adapter

// Magehand TTRPG adapter (primary)
export {
  createMagehandTTRPGAdapter,
  MAGEHAND_NODE_TYPE_CONFIGS,
} from './magehand-ttrpg';

// Fantasy Dungeon Crawler adapter (reference)
export {
  createFantasyDungeonAdapter,
  FANTASY_TERRAIN_TYPES,
  FANTASY_PROCEDURAL_TEMPLATES,
  type FantasyTerrainId,
} from './fantasy-dungeon';
export { FANTASY_NODE_TYPE_CONFIGS } from './fantasyNodeConfigs';
