/**
 * Adapter interfaces for customizing the Campaign Editor.
 */

import {
  BaseCampaign,
  BaseFlowNode,
  BaseNodeData,
  BaseTerrainType,
  BaseTerrainTile,
  BaseObjective,
  DeploymentZone,
  GridConfig,
  ValidationResult,
} from './base';

import type { NodeExecutionHandler } from './execution';
import type { NodeTypeConfig } from './nodeConfig';

// ============= TERRAIN ADAPTER =============

export interface TerrainConfig<T extends BaseTerrainType = BaseTerrainType> {
  types: T[];
  getDefaultType?: () => string;
  renderTile?: (tile: BaseTerrainTile, terrainType: T) => React.ReactNode;
}

// ============= PROCEDURAL GENERATION =============

export interface GenerationOptions {
  template: string;
  width: number;
  height: number;
  density?: 'sparse' | 'moderate' | 'dense';
  seed?: number;
}

export interface GenerationResult<T extends string = string> {
  terrain: BaseTerrainTile<T>[];
  deploymentZone: DeploymentZone;
  objectives?: BaseObjective[];
}

export interface ProceduralTemplate {
  id: string;
  name: string;
  description: string;
  icon?: React.ReactNode;
}

// ============= STORAGE ADAPTER =============

export interface StorageAdapter<C extends BaseCampaign = BaseCampaign> {
  save(campaign: C): Promise<void>;
  load(campaignId: string): Promise<C | null>;
  loadAll(): Promise<C[]>;
  delete(campaignId: string): Promise<boolean>;
  export(campaign: C): Promise<string>;
  import(data: string): Promise<C>;
}

// ============= EDITOR THEME =============

export interface EditorTheme {
  accentColor?: string;
  gridColor?: string;
  deploymentZoneColor?: string;
  objectiveColors?: {
    primary?: string;
    secondary?: string;
    bonus?: string;
  };
  flowCanvasColors?: {
    nodeBorder?: string;
    nodeBackground?: string;
    connectionLine?: string;
    startNode?: string;
    endNode?: string;
  };
}

// ============= MAIN ADAPTER =============

export interface CampaignEditorAdapter<
  TTerrainId extends string = string,
  TTerrain extends BaseTerrainType = BaseTerrainType,
  TNodeData extends BaseNodeData<TTerrainId> = BaseNodeData<TTerrainId>,
  TNode extends BaseFlowNode<TNodeData> = BaseFlowNode<TNodeData>,
  TCampaign extends BaseCampaign<TNode> = BaseCampaign<TNode>
> {
  terrainTypes: TTerrain[];
  getTerrainType(id: TTerrainId): TTerrain | undefined;
  createEmptyNode(id: string): TNode;
  createEmptyNodeData(): TNodeData;
  createEmptyCampaign(): TCampaign;
  validateCampaign(campaign: TCampaign): ValidationResult;

  proceduralTemplates?: ProceduralTemplate[];
  generateTerrain?: (options: GenerationOptions) => GenerationResult<TTerrainId>;
  storage?: StorageAdapter<TCampaign>;
  gridDefaults?: GridConfig;
  theme?: EditorTheme;

  labels?: {
    campaign?: string;
    node?: string;
    terrain?: string;
    objective?: string;
  };

  executionHandler?: NodeExecutionHandler<unknown, TTerrainId>;
  nodeTypes?: NodeTypeConfig[];
}

// ============= ADAPTER FACTORY =============

export interface CreateAdapterOptions<
  TTerrainId extends string = string,
  TTerrain extends BaseTerrainType = BaseTerrainType,
  TNodeData extends BaseNodeData<TTerrainId> = BaseNodeData<TTerrainId>,
  TNode extends BaseFlowNode<TNodeData> = BaseFlowNode<TNodeData>,
  TCampaign extends BaseCampaign<TNode> = BaseCampaign<TNode>
> {
  terrainTypes: TTerrain[];
  gridDefaults?: GridConfig;
  nodeTemplate?: Partial<TNodeData>;
  campaignTemplate?: Partial<TCampaign>;
  proceduralTemplates?: ProceduralTemplate[];
  generateTerrain?: (options: GenerationOptions) => GenerationResult<TTerrainId>;
  storage?: StorageAdapter<TCampaign>;
  theme?: EditorTheme;
  labels?: CampaignEditorAdapter['labels'];
  customValidation?: (campaign: TCampaign) => ValidationResult;
  executionHandler?: NodeExecutionHandler<unknown, TTerrainId>;
  nodeTypes?: NodeTypeConfig[];
}
