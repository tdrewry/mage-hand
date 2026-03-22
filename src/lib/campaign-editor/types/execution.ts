/**
 * Node Execution API types for the Campaign Editor.
 */

import type { BaseTerrainTile, BaseObjective, DeploymentZone } from './base';

export type BaseNodeType = 'combat' | 'cutscene' | 'dialog' | 'downtime' | 'encounter' | 'narrative' | 'rest' | 'rule' | 'function_node';

export interface NodeResult {
  outcome: 'success' | 'failure' | 'choice';
  choiceId?: string;
  flagsSet?: Record<string, boolean>;
  metadata?: Record<string, unknown>;
}

export interface CombatNodePayload<TTerrainId extends string = string> {
  nodeId: string;
  name: string;
  description?: string;
  environment?: string;
  difficulty?: string;
  gridWidth: number;
  gridHeight: number;
  terrain: BaseTerrainTile<TTerrainId>[];
  deploymentZone: DeploymentZone;
  objectives: BaseObjective[];
  extra?: Record<string, unknown>;
}

export interface ExecutionDialogLine {
  speaker?: string;
  text: string;
  artRef?: string;
  emotion?: string;
}

export interface CutsceneNodePayload {
  nodeId: string;
  name: string;
  lines: ExecutionDialogLine[];
  backgroundArt?: string;
  musicRef?: string;
  sfxRef?: string;
  autoAdvance?: boolean;
  autoAdvanceMs?: number;
}

export interface ExecutionDialogOutcome {
  id: string;
  label: string;
  color: string;
  setsFlags?: Record<string, boolean>;
}

export interface DialogNodePayload {
  nodeId: string;
  name: string;
  lines: ExecutionDialogLine[];
  outcomes: ExecutionDialogOutcome[];
  backgroundArt?: string;
  musicRef?: string;
  sfxRef?: string;
}

export interface DowntimeNodePayload {
  nodeId: string;
  name: string;
  availableActions?: string[];
  allowFullRepair: boolean;
  actionsPerPilot: number;
  restrictions?: string[];
  narrativeReason?: string;
}

export interface NodeExecutionHandler<
  TContext = unknown,
  TTerrainId extends string = string,
> {
  onCombatNode(
    payload: CombatNodePayload<TTerrainId>,
    context: TContext,
  ): Promise<NodeResult>;

  onCutsceneNode(
    payload: CutsceneNodePayload,
    context: TContext,
  ): Promise<NodeResult>;

  onDialogNode(
    payload: DialogNodePayload,
    context: TContext,
  ): Promise<NodeResult>;

  onDowntimeNode(
    payload: DowntimeNodePayload,
    context: TContext,
  ): Promise<NodeResult>;

  onNodeComplete(
    nodeId: string,
    result: NodeResult,
    context: TContext,
  ): void;
}
