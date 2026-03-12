/**
 * Magehand TTRPG Adapter for the Campaign Editor.
 *
 * Replaces the terrain-grid concept with Magehand map layers and deployment zones.
 * Encounter nodes reference maps by ID and deployment-zone MapObjects by ID.
 *
 * Node types:
 * - encounter: activates a map + teleports tokens to deployment zone
 * - narrative: opens a handout viewer with dialog lines
 * - dialog: presents player choices via chat or modal
 * - rest: toast notification, no map change
 */

import { createAdapter } from '../lib/createAdapter';
import { createLocalStorageAdapter } from '../lib/storage';
import type { NodeTypeConfig } from '../types/nodeConfig';
import type {
  BaseTerrainType,
  BaseNodeData,
  BaseFlowNode,
  BaseCampaign,
} from '../types/base';
import type { CampaignEditorAdapter } from '../types/adapter';

// ============= NODE TYPE CONFIGS =============

export const MAGEHAND_ENCOUNTER_CONFIG: NodeTypeConfig = {
  id: 'encounter',
  label: 'Encounter',
  icon: 'swords',
  color: '0 70% 50%',
  description: 'Activate a map and place tokens in a deployment zone',
  features: {
    hasMap: false, // We use mapId picker instead of terrain painter
    hasVictoryDefeat: true,
    hasBriefing: true,
  },
  customFields: [
    {
      key: 'mapId',
      label: 'Map',
      type: 'select',
      defaultValue: '',
      description: 'The Magehand map to activate for this encounter',
      options: [], // Populated dynamically from mapStore
      group: 'Map',
    },
    {
      key: 'deploymentZoneId',
      label: 'Deployment Zone',
      type: 'select',
      defaultValue: '',
      description: 'The deployment zone MapObject to place tokens in',
      options: [], // Populated dynamically, filtered by selected mapId
      group: 'Map',
    },
    {
      key: 'fogPreset',
      label: 'Fog Preset',
      type: 'select',
      defaultValue: 'keep',
      options: [
        { value: 'keep', label: 'Keep Current' },
        { value: 'reveal-all', label: 'Reveal All' },
        { value: 'reset', label: 'Reset Fog' },
      ],
      group: 'Map',
    },
    {
      key: 'tokenGroupId',
      label: 'Token Group',
      type: 'string',
      defaultValue: '',
      description: 'Optional token group or role to auto-place (empty = all party tokens)',
      group: 'Tokens',
    },
  ],
};

export const MAGEHAND_NARRATIVE_CONFIG: NodeTypeConfig = {
  id: 'narrative',
  label: 'Narrative',
  icon: 'scroll',
  color: '270 60% 55%',
  description: 'Present narrative content via handout viewer',
  features: {
    hasDialogLines: true,
    hasSceneSettings: true,
    hasAutoAdvance: true,
    hasContinue: true,
  },
};

export const MAGEHAND_DIALOG_CONFIG: NodeTypeConfig = {
  id: 'dialog',
  label: 'Decision',
  icon: 'message-square',
  color: '45 85% 55%',
  description: 'Present player choices with branching outcomes',
  features: {
    hasDialogLines: true,
    hasOutcomes: true,
    hasSceneSettings: true,
    hasContinue: true,
  },
};

export const MAGEHAND_REST_CONFIG: NodeTypeConfig = {
  id: 'rest',
  label: 'Rest / Travel',
  icon: 'tent',
  color: '170 60% 45%',
  description: 'Downtime or travel interstitial',
  features: {
    hasAutoAdvance: true,
    hasContinue: true,
  },
  customFields: [
    {
      key: 'narrativeReason',
      label: 'Narrative Reason',
      type: 'string',
      defaultValue: '',
      description: 'Reason shown in the toast notification (e.g. "The party rests at the inn")',
      group: 'Content',
    },
  ],
};

export const MAGEHAND_NODE_TYPE_CONFIGS: NodeTypeConfig[] = [
  MAGEHAND_ENCOUNTER_CONFIG,
  MAGEHAND_NARRATIVE_CONFIG,
  MAGEHAND_DIALOG_CONFIG,
  MAGEHAND_REST_CONFIG,
];

// ============= ADAPTER FACTORY =============

/**
 * Create the Magehand TTRPG adapter for the campaign editor.
 *
 * - terrainTypes is empty (Magehand uses image-based maps)
 * - encounter nodes link to maps by ID and deployment zones by ID
 * - storage uses localStorage keyed 'magehand-campaigns'
 */
export function createMagehandTTRPGAdapter(): CampaignEditorAdapter {
  return createAdapter({
    terrainTypes: [] as BaseTerrainType[], // No terrain painting

    gridDefaults: { width: 1, height: 1 }, // Irrelevant — maps are image-based

    campaignTemplate: {
      difficulty: 'normal',
      tags: ['ttrpg', 'magehand'],
    },

    storage: createLocalStorageAdapter('magehand-campaigns'),

    nodeTypes: MAGEHAND_NODE_TYPE_CONFIGS,

    theme: {
      accentColor: '#3b82f6', // Magehand blue
      deploymentZoneColor: '#22c55e',
      flowCanvasColors: {
        nodeBorder: '#52525b',
        nodeBackground: '#18181b',
        connectionLine: '#a1a1aa',
        startNode: '#22c55e',
        endNode: '#ef4444',
      },
    },

    labels: {
      campaign: 'Campaign',
      node: 'Scene',
      terrain: 'Map',
      objective: 'Goal',
    },

    // executionHandler wired in Phase 4 (runtime bridge)
  });
}
