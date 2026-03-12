/**
 * @module campaign-editor/types/base
 * @description Base types for the generic Campaign Editor module.
 * Copied from Mech Tactics Legacy, stripped of terrain-painter-specific docs.
 */

import { ReactNode } from 'react';

// ============= GRID & POSITION =============

export interface GridPosition {
  x: number;
  y: number;
}

export interface GridConfig {
  width: number;
  height: number;
  cellSize?: number;
  isometric?: boolean;
}

export const DEFAULT_GRID_CONFIG: GridConfig = {
  width: 40,
  height: 40,
  cellSize: 20,
  isometric: false,
};

// ============= TERRAIN TYPES =============

export interface BaseTerrainType {
  id: string;
  name: string;
  color: string;
  icon?: ReactNode;
  movementCost?: number;
  providesHardCover?: boolean;
  providesSoftCover?: boolean;
  isImpassable?: boolean;
  isDangerous?: boolean;
  description?: string;
}

export interface BaseTerrainTile<T extends string = string> {
  position: GridPosition;
  type: T;
  name: string;
  size?: number;
  hp?: number;
  maxHp?: number;
}

// ============= OBJECTIVES =============

export interface BaseObjective {
  id: string;
  type: 'primary' | 'secondary' | 'bonus';
  description: string;
  completed: boolean;
  targetPosition?: GridPosition;
  targetCount?: number;
  currentCount?: number;
}

export interface BaseObjectiveMarker {
  id: string;
  objectiveId: string;
  position: GridPosition;
  markerType: string;
  name: string;
  isCompleted: boolean;
}

// ============= DEPLOYMENT ZONE =============

export interface DeploymentZone {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// ============= NODE / MISSION DATA =============

export interface BaseNodeData<T extends string = string> {
  name: string;
  description?: string;
  environment?: string;
  difficulty?: string;

  gridWidth: number;
  gridHeight: number;

  terrain: BaseTerrainTile<T>[];
  deploymentZone: DeploymentZone;
  objectives: BaseObjective[];

  proceduralTemplate?: string;
}

// ============= FLOW NODE =============

export interface BaseFlowNode<D extends BaseNodeData = BaseNodeData> {
  id: string;
  nodeData: D;

  nodeType?: import('./execution').BaseNodeType;

  // Flow connections
  nextOnSuccess: string[];
  nextOnFailure: string | 'retry' | 'end';
  isChoicePoint?: boolean;

  prerequisites: string[];

  // Story content
  title?: string;
  prologue?: string;
  successEpilogue?: string;
  failureEpilogue?: string;

  // Unified content model
  dialogLines?: { speaker?: string; text: string; artRef?: string; emotion?: string }[];
  sceneSettings?: {
    backgroundArt?: string;
    musicRef?: string;
    sfxRef?: string;
  };
  autoAdvance?: boolean;
  autoAdvanceMs?: number;
  outcomes?: { id: string; label: string; color: string; targetNodeId?: string; setsFlags?: Record<string, boolean> }[];
  narrativeReason?: string;

  /** Handouts linked to this node — shown as buttons the DM can click to open/share */
  handouts?: { id: string; label: string; handoutId: string }[];

  /** Treasure / loot items associated with this node */
  treasure?: { id: string; name: string; quantity?: number; description?: string }[];

  /** Game-specific data. Shape defined by adapter's NodeTypeConfig.customFields. */
  customData?: Record<string, unknown>;

  // Legacy compat (deprecated)
  /** @deprecated */
  cutsceneContent?: {
    lines: { speaker?: string; text: string; artRef?: string; emotion?: string }[];
    backgroundArt?: string;
    musicRef?: string;
    sfxRef?: string;
    autoAdvance?: boolean;
    autoAdvanceMs?: number;
  };
  /** @deprecated */
  dialogContent?: {
    lines: { speaker?: string; text: string; artRef?: string; emotion?: string }[];
    outcomes: { id: string; label: string; color: string; targetNodeId?: string; setsFlags?: Record<string, boolean> }[];
    backgroundArt?: string;
    musicRef?: string;
    sfxRef?: string;
  };
  /** @deprecated */
  downtimeConfig?: {
    availableActions?: string[];
    allowFullRepair: boolean;
    actionsPerPilot: number;
    restrictions?: string[];
    narrativeReason?: string;
  };

  // Metadata
  isStartNode?: boolean;
  isEndNode?: boolean;
  chapter?: number;
}

export interface FlowNodePosition {
  x: number;
  y: number;
}

// ============= CAMPAIGN =============

export interface BaseCampaign<N extends BaseFlowNode = BaseFlowNode> {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  createdAt: string;
  updatedAt: string;

  nodes: N[];
  startNodeId: string;

  difficulty?: string;
  estimatedNodes?: number;
  tags?: string[];
  coverImage?: string;

  isBuiltIn?: boolean;
  isPublished?: boolean;
}

// ============= VALIDATION =============

export type ValidationErrorType =
  | 'missing-start'
  | 'orphaned-node'
  | 'invalid-branch'
  | 'circular-required'
  | 'missing-node'
  | 'custom';

export type ValidationWarningType =
  | 'unreachable-node'
  | 'dead-end'
  | 'no-failure-path'
  | 'custom';

export interface ValidationError {
  type: ValidationErrorType;
  nodeId?: string;
  message: string;
}

export interface ValidationWarning {
  type: ValidationWarningType;
  nodeId?: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
