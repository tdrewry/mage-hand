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
import type { BaseNodeType } from '../types/execution';
import { useMapStore } from '@/stores/mapStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useFogStore } from '@/stores/fogStore';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';
import { useCampaignStore } from '@/stores/campaignStore';
import { toast } from 'sonner';

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

// ============= EXECUTION BRIDGE =============

/**
 * Execute a campaign node — called by the CampaignSceneRunner when the DM
 * advances or activates a scene. Each node type triggers different Magehand
 * store actions.
 */
export function executeNode(node: BaseFlowNode): void {
  const nodeType = (node.nodeType || 'encounter') as BaseNodeType;
  const custom = (node.customData || {}) as Record<string, unknown>;

  switch (nodeType) {
    case 'encounter':
      executeEncounterNode(node, custom);
      break;
    case 'narrative':
      executeNarrativeNode(node);
      break;
    case 'dialog':
      executeDialogNode(node);
      break;
    case 'rest':
      executeRestNode(node, custom);
      break;
    default:
      toast.info(`Scene: ${node.nodeData.name}`);
  }
}

function executeEncounterNode(node: BaseFlowNode, custom: Record<string, unknown>): void {
  const mapId = custom.mapId as string;
  const deploymentZoneId = custom.deploymentZoneId as string;
  const fogPreset = (custom.fogPreset as string) || 'keep';
  const tokenGroupId = custom.tokenGroupId as string;

  // 1. Switch to target map
  if (mapId) {
    const mapStore = useMapStore.getState();
    const map = mapStore.maps.find((m) => m.id === mapId);
    if (map) {
      mapStore.setSelectedMap(mapId);
      // Activate the map if it isn't already
      if (!map.active) mapStore.updateMap(mapId, { active: true });
      toast.success(`Map: ${map.name}`);
    } else {
      toast.error(`Map not found: ${mapId}`);
    }
  }

  // 2. Handle fog preset
  if (fogPreset !== 'keep' && mapId) {
    const fogStore = useFogStore.getState();
    if (fogPreset === 'reveal-all') {
      fogStore.setMapFogSettings(mapId, { enabled: true, revealAll: true });
    } else if (fogPreset === 'reset') {
      fogStore.setMapFogSettings(mapId, { enabled: true, revealAll: false });
      fogStore.setSerializedExploredAreasForMap(mapId, '');
    }
  }

  // 3. Place tokens in deployment zone
  if (deploymentZoneId && mapId) {
    const zone = useMapObjectStore.getState().mapObjects.find(
      (o) => o.id === deploymentZoneId && o.category === 'deployment-zone'
    );
    if (zone) {
      const sessionStore = useSessionStore.getState();
      const tokens = sessionStore.tokens.filter((t) => {
        if (tokenGroupId) {
          // Filter by group name or roleId
          return t.roleId === tokenGroupId || t.name === tokenGroupId;
        }
        // Default: all player-role tokens
        return t.roleId === 'player';
      });

      // Spread tokens within the zone bounds
      const zoneX = zone.x;
      const zoneY = zone.y;
      const zoneW = zone.width;
      const zoneH = zone.height;
      const cols = Math.max(1, Math.floor(Math.sqrt(tokens.length)));

      tokens.forEach((token, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const spacing = Math.min(zoneW / (cols + 1), zoneH / (Math.ceil(tokens.length / cols) + 1));
        const newX = zoneX + spacing * (col + 1);
        const newY = zoneY + spacing * (row + 1);
        sessionStore.updateToken(token.id, { x: newX, y: newY });
      });

      toast.info(`Placed ${tokens.length} token${tokens.length !== 1 ? 's' : ''} in deployment zone`);
    }
  }
}

function executeNarrativeNode(node: BaseFlowNode): void {
  // Build markdown content from dialog lines
  const lines = node.dialogLines || [];
  const markdown = lines
    .map((l) => (l.speaker ? `**${l.speaker}:** ${l.text}` : l.text))
    .join('\n\n');

  if (!markdown) {
    toast.info(`Scene: ${node.nodeData.name}`);
    return;
  }

  // Open a HandoutViewer card with inline content
  const cardStore = useCardStore.getState();
  const existingCard = cardStore.cards.find(
    (c) => c.type === CardType.HANDOUT_VIEWER && c.metadata?.campaignNodeId === node.id
  );

  if (existingCard) {
    cardStore.setVisibility(existingCard.id, true);
  } else {
    cardStore.registerCard({
      type: CardType.HANDOUT_VIEWER,
      title: node.nodeData.name || 'Narrative',
      defaultPosition: { x: window.innerWidth / 2 - 250, y: 100 },
      defaultSize: { width: 500, height: 600 },
      minSize: { width: 360, height: 400 },
      isResizable: true,
      isClosable: true,
      defaultVisible: true,
      metadata: {
        handoutId: `__campaign_narrative__`,
        campaignNodeId: node.id,
        inlineContent: markdown,
        title: node.nodeData.name,
      },
    });
  }

  toast.info(`📜 ${node.nodeData.name}`);
}

function executeDialogNode(node: BaseFlowNode): void {
  // For now, present dialog choices as a toast with info about checking chat
  const lines = node.dialogLines || [];
  const outcomes = node.outcomes || [];

  if (lines.length > 0) {
    const firstLine = lines[0];
    const speaker = firstLine.speaker ? `${firstLine.speaker}: ` : '';
    toast.info(`💬 ${speaker}${firstLine.text}`);
  }

  if (outcomes.length > 0) {
    toast.info(
      `Decision: ${outcomes.map((o) => o.label).join(' / ')}`,
      { duration: 8000 }
    );
  }
}

function executeRestNode(node: BaseFlowNode, custom: Record<string, unknown>): void {
  const reason = (custom.narrativeReason as string) || node.nodeData.name || 'The party rests...';
  toast.info(`🏕️ ${reason}`, { duration: 5000 });
}

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
  });
}
