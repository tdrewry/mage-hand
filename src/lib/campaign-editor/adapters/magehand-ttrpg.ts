/**
 * Magehand TTRPG Adapter for the Campaign Editor.
 *
 * Replaces the terrain-grid concept with Magehand map layers and deployment zones.
 * Encounter nodes reference maps by ID and deployment-zone MapObjects by ID.
 *
 * Node types:
 * - encounter: activates a map + teleports tokens to deployment zone
 * - narrative: presents handouts the DM can share on demand
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
import { useTokenGroupStore, getFormationOffsets } from '@/stores/tokenGroupStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useFogStore } from '@/stores/fogStore';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';
import { useCampaignStore } from '@/stores/campaignStore';
import { getHandoutById } from '@/lib/handouts';
import { toast } from 'sonner';

// ============= NODE TYPE CONFIGS =============

export const MAGEHAND_ENCOUNTER_CONFIG: NodeTypeConfig = {
  id: 'encounter',
  label: 'Encounter',
  icon: 'swords',
  color: '0 70% 50%',
  description: 'Activate a map and place tokens in a deployment zone',
  features: {
    hasMap: false,
    hasVictoryDefeat: true,
    hasBriefing: true,
    hasHandouts: true,
    hasTreasure: true,
  },
  customFields: [
    {
      key: 'mapId',
      label: 'Map',
      type: 'select',
      defaultValue: '',
      description: 'The Magehand map to activate for this encounter',
      options: [],
      group: 'Map',
    },
    {
      key: 'deploymentZoneId',
      label: 'Deployment Zone',
      type: 'select',
      defaultValue: '',
      description: 'The deployment zone MapObject to place tokens in',
      options: [],
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
      type: 'select',
      defaultValue: '',
      description: 'Token group to deploy (empty = all player tokens)',
      options: [],
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
    hasHandouts: true,
    hasTreasure: true,
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
    hasHandouts: true,
    hasTreasure: true,
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
    hasHandouts: true,
    hasTreasure: true,
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

      // Resolve tokens: check token group store first, then fall back to role/name match
      let tokens = sessionStore.tokens;
      let formation: ReturnType<typeof getFormationOffsets> | null = null;

      if (tokenGroupId) {
        const tokenGroup = useTokenGroupStore.getState().getGroupById(tokenGroupId);
        if (tokenGroup) {
          const idSet = new Set(tokenGroup.tokenIds);
          tokens = tokens.filter((t) => idSet.has(t.id));
          formation = getFormationOffsets(tokenGroup.formation, tokens.length);
        } else {
          // Legacy fallback: match by roleId or name
          tokens = tokens.filter((t) => t.roleId === tokenGroupId || t.name === tokenGroupId);
        }
      } else {
        tokens = tokens.filter((t) => t.roleId === 'player');
      }

      // Place tokens using formation offsets or grid spread
      // Note: MapObject position is the CENTER of the object
      const zoneW = zone.width;
      const zoneH = zone.height;
      const centerX = zone.position.x;
      const centerY = zone.position.y;

      // Determine grid size from the first token or default 50
      const gridSize = 50;

      if (formation && formation.length === tokens.length) {
        tokens.forEach((token, i) => {
          const offset = formation![i];
          const newX = centerX + offset.dx * gridSize;
          const newY = centerY + offset.dy * gridSize;
          sessionStore.updateTokenPosition(token.id, newX, newY);
        });
      } else {
        // Fallback: spread evenly within zone, centered
        const cols = Math.max(1, Math.floor(Math.sqrt(tokens.length)));
        const rows = Math.ceil(tokens.length / cols);
        const spacingX = Math.min(zoneW / (cols + 1), gridSize);
        const spacingY = Math.min(zoneH / (rows + 1), gridSize);
        tokens.forEach((token, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const newX = centerX + (col - (cols - 1) / 2) * spacingX;
          const newY = centerY + (row - (rows - 1) / 2) * spacingY;
          sessionStore.updateTokenPosition(token.id, newX, newY);
        });
      }

      // 4. Move tokens to the target map so they're visible
      const { setTokens, tokens: allTokens } = useSessionStore.getState();
      const movedIds = new Set(tokens.map((t) => t.id));
      setTokens(
        allTokens.map((t) => movedIds.has(t.id) ? { ...t, mapId } : t)
      );

      toast.info(`Placed ${tokens.length} token${tokens.length !== 1 ? 's' : ''} in deployment zone`);
    }
  }
}

function executeNarrativeNode(node: BaseFlowNode): void {
  // Narrative nodes no longer auto-open handouts.
  // The DM clicks handout buttons in the scene runner / summary card to share them.
  toast.info(`📜 ${node.nodeData.name}`);
}

/**
 * Open a specific handout by its registry ID.
 * Called when the DM clicks a handout button in the scene runner or summary card.
 */
export function openHandoutById(handoutId: string, label?: string): void {
  const entry = getHandoutById(handoutId);
  const title = entry?.title || label || 'Handout';

  const cardStore = useCardStore.getState();
  const existing = cardStore.cards.find(
    (c) => c.type === CardType.HANDOUT_VIEWER && c.metadata?.handoutId === handoutId
  );

  if (existing) {
    cardStore.setVisibility(existing.id, true);
    cardStore.bringToFront(existing.id);
  } else {
    cardStore.registerCard({
      type: CardType.HANDOUT_VIEWER,
      title,
      defaultPosition: { x: Math.min(window.innerWidth - 520, 380), y: 60 },
      defaultSize: { width: 500, height: 650 },
      minSize: { width: 360, height: 400 },
      isResizable: true,
      isClosable: true,
      defaultVisible: true,
      metadata: { handoutId },
    });
  }
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
      campaign: 'Scenario',
      node: 'Scene',
      terrain: 'Map',
      objective: 'Goal',
    },
  });
}
