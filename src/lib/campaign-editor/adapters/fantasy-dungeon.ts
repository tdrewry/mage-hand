/**
 * Fantasy Dungeon Crawler Adapter — kept as reference.
 * The primary adapter for Magehand is magehand-ttrpg.ts.
 */

import { createAdapter } from '../lib/createAdapter';
import { createLocalStorageAdapter } from '../lib/storage';
import { FANTASY_NODE_TYPE_CONFIGS } from './fantasyNodeConfigs';
import {
  BaseTerrainType,
  BaseTerrainTile,
  BaseNodeData,
  BaseFlowNode,
  BaseCampaign,
  DeploymentZone,
  BaseObjective,
} from '../types/base';
import {
  CampaignEditorAdapter,
  ProceduralTemplate,
  GenerationOptions,
  GenerationResult,
} from '../types/adapter';

export type FantasyTerrainId =
  | 'stone_floor' | 'stone_wall' | 'wooden_floor' | 'water'
  | 'lava' | 'pit' | 'rubble' | 'vegetation' | 'ice' | 'magic_circle';

export const FANTASY_TERRAIN_TYPES: BaseTerrainType[] = [
  { id: 'stone_floor', name: 'Stone Floor', color: '#6B7280', movementCost: 1 },
  { id: 'stone_wall', name: 'Stone Wall', color: '#374151', isImpassable: true, providesHardCover: true },
  { id: 'wooden_floor', name: 'Wooden Floor', color: '#92400E', movementCost: 1 },
  { id: 'water', name: 'Shallow Water', color: '#3B82F6', movementCost: 2, providesSoftCover: true },
  { id: 'lava', name: 'Lava', color: '#DC2626', isDangerous: true, movementCost: 1 },
  { id: 'pit', name: 'Pit', color: '#1F2937', isImpassable: true },
  { id: 'rubble', name: 'Rubble', color: '#9CA3AF', movementCost: 2, providesSoftCover: true },
  { id: 'vegetation', name: 'Undergrowth', color: '#22C55E', movementCost: 2, providesSoftCover: true },
  { id: 'ice', name: 'Ice', color: '#BAE6FD', movementCost: 1, isDangerous: true },
  { id: 'magic_circle', name: 'Magic Circle', color: '#A855F7', movementCost: 1 },
];

export const FANTASY_PROCEDURAL_TEMPLATES: ProceduralTemplate[] = [
  { id: 'dungeon-rooms', name: 'Classic Dungeon', description: 'Interconnected stone rooms with corridors' },
  { id: 'cave-system', name: 'Natural Cavern', description: 'Organic cave layout with water features' },
  { id: 'ruined-temple', name: 'Ruined Temple', description: 'Ancient temple with magic circles and rubble' },
  { id: 'volcanic-lair', name: 'Volcanic Lair', description: 'Dangerous terrain with lava flows' },
  { id: 'frozen-tomb', name: 'Frozen Tomb', description: 'Icy dungeon with slippery surfaces' },
];

export function createFantasyDungeonAdapter(): CampaignEditorAdapter<
  FantasyTerrainId, BaseTerrainType,
  BaseNodeData<FantasyTerrainId>,
  BaseFlowNode<BaseNodeData<FantasyTerrainId>>,
  BaseCampaign<BaseFlowNode<BaseNodeData<FantasyTerrainId>>>
> {
  return createAdapter({
    terrainTypes: FANTASY_TERRAIN_TYPES,
    gridDefaults: { width: 30, height: 30, cellSize: 24, isometric: false },
    nodeTemplate: { environment: 'dungeon', difficulty: 'normal' },
    campaignTemplate: { difficulty: 'normal', tags: ['fantasy', 'dungeon'] },
    proceduralTemplates: FANTASY_PROCEDURAL_TEMPLATES,
    storage: createLocalStorageAdapter('fantasy-dungeon-campaigns'),
    nodeTypes: FANTASY_NODE_TYPE_CONFIGS,
    theme: {
      accentColor: '#A855F7',
      gridColor: '#4B5563',
      deploymentZoneColor: '#22C55E',
      objectiveColors: { primary: '#EF4444', secondary: '#F59E0B', bonus: '#8B5CF6' },
      flowCanvasColors: { nodeBorder: '#6B7280', nodeBackground: '#1F2937', connectionLine: '#9CA3AF', startNode: '#22C55E', endNode: '#EF4444' },
    },
    labels: { campaign: 'Adventure', node: 'Dungeon Level', terrain: 'Tile', objective: 'Quest Goal' },
  });
}
