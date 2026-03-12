/**
 * Factory function for creating Campaign Editor adapters.
 */

import {
  BaseCampaign,
  BaseFlowNode,
  BaseNodeData,
  BaseTerrainType,
  DEFAULT_GRID_CONFIG,
  GridConfig,
  ValidationResult,
} from '../types/base';

import {
  CampaignEditorAdapter,
  CreateAdapterOptions,
} from '../types/adapter';

import { validateCampaign } from './validation';

export function createAdapter<
  TTerrainId extends string = string,
  TTerrain extends BaseTerrainType = BaseTerrainType,
  TNodeData extends BaseNodeData<TTerrainId> = BaseNodeData<TTerrainId>,
  TNode extends BaseFlowNode<TNodeData> = BaseFlowNode<TNodeData>,
  TCampaign extends BaseCampaign<TNode> = BaseCampaign<TNode>
>(
  options: CreateAdapterOptions<TTerrainId, TTerrain, TNodeData, TNode, TCampaign>
): CampaignEditorAdapter<TTerrainId, TTerrain, TNodeData, TNode, TCampaign> {
  const {
    terrainTypes,
    gridDefaults = DEFAULT_GRID_CONFIG,
    nodeTemplate = {},
    campaignTemplate = {},
    proceduralTemplates,
    generateTerrain,
    storage,
    theme,
    labels,
    customValidation,
    executionHandler,
    nodeTypes,
  } = options;

  const terrainMap = new Map<string, TTerrain>(
    terrainTypes.map(t => [t.id, t])
  );

  return {
    terrainTypes,

    getTerrainType(id: TTerrainId): TTerrain | undefined {
      return terrainMap.get(id);
    },

    createEmptyNode(id: string): TNode {
      const nodeData = this.createEmptyNodeData();
      return {
        id,
        nodeData,
        nextOnSuccess: [],
        nextOnFailure: 'retry',
        prerequisites: [],
        title: 'New Node',
        isStartNode: false,
        isEndNode: false,
      } as TNode;
    },

    createEmptyNodeData(): TNodeData {
      return {
        name: 'Untitled',
        gridWidth: gridDefaults.width ?? 40,
        gridHeight: gridDefaults.height ?? 40,
        terrain: [],
        deploymentZone: {
          minX: 0,
          maxX: 4,
          minY: Math.floor((gridDefaults.height ?? 40) / 2) - 8,
          maxY: Math.floor((gridDefaults.height ?? 40) / 2) + 8,
        },
        objectives: [],
        ...nodeTemplate,
      } as TNodeData;
    },

    createEmptyCampaign(): TCampaign {
      const now = new Date().toISOString();
      const startNodeId = 'start-node';
      const startNode = this.createEmptyNode(startNodeId);
      startNode.isStartNode = true;
      startNode.title = 'Chapter 1';

      return {
        id: `campaign-${Date.now()}`,
        name: 'Untitled Campaign',
        description: '',
        author: 'Unknown',
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        nodes: [startNode],
        startNodeId,
        difficulty: 'medium',
        estimatedNodes: 1,
        tags: [],
        isBuiltIn: false,
        isPublished: false,
        ...campaignTemplate,
      } as TCampaign;
    },

    validateCampaign(campaign: TCampaign): ValidationResult {
      const baseResult = validateCampaign(campaign);
      if (customValidation) {
        const customResult = customValidation(campaign);
        return {
          isValid: baseResult.isValid && customResult.isValid,
          errors: [...baseResult.errors, ...customResult.errors],
          warnings: [...baseResult.warnings, ...customResult.warnings],
        };
      }
      return baseResult;
    },

    proceduralTemplates,
    generateTerrain,
    storage,
    gridDefaults,
    theme,
    labels,
    executionHandler,
    nodeTypes,
  };
}
