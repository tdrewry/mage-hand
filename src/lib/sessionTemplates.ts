import { GameMap } from '@/stores/mapStore';
import { CanvasRegion } from '@/stores/regionStore';
import { Role } from '@/stores/roleStore';
import { VisionProfile } from '@/stores/visionProfileStore';
import { FogSettings } from '@/stores/fogStore';

const TEMPLATES_STORAGE_KEY = 'd20pro-templates';

export interface SessionTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  isBuiltIn: boolean;
  createdAt: string;
  
  // Template data (structure without specific instances)
  maps: Omit<GameMap, 'id'>[];
  regions: Omit<CanvasRegion, 'id'>[];
  roles: Role[];
  visionProfiles: VisionProfile[];
  fogSettings: FogSettings;
  defaultTokenSize: { width: number; height: number };
  gridSettings: {
    size: number;
    color: string;
    enabled: boolean;
  };
}

// Built-in templates
export const BUILT_IN_TEMPLATES: SessionTemplate[] = [
  {
    id: 'blank-canvas',
    name: 'Blank Canvas',
    description: 'Start with a completely empty session. Perfect for building from scratch.',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    maps: [],
    regions: [],
    roles: [
      {
        id: 'dm',
        name: 'Dungeon Master',
        color: '#8b5cf6',
        isSystem: true,
        hostileToRoleIds: [],
        permissions: {
          canControlOwnTokens: true,
          canControlOtherTokens: true,
          canSeeAllFog: true,
          canSeeFriendlyVision: true,
          canSeeHostileVision: true,
          canSeeOwnTokens: true,
          canSeeOtherTokens: true,
          canSeeHiddenTokens: true,
          canCreateTokens: true,
          canDeleteOwnTokens: true,
          canDeleteOtherTokens: true,
          canManageRoles: true,
          canAssignRoles: true,
          canAssignTokenRoles: true,
          canManageHostility: true,
          canEditMap: true,
          canManageFog: true,
          canManageInitiative: true,
        },
      },
      {
        id: 'player',
        name: 'Player',
        color: '#3b82f6',
        isSystem: true,
        hostileToRoleIds: [],
        permissions: {
          canControlOwnTokens: true,
          canControlOtherTokens: false,
          canSeeAllFog: false,
          canSeeFriendlyVision: true,
          canSeeHostileVision: false,
          canSeeOwnTokens: true,
          canSeeOtherTokens: true,
          canSeeHiddenTokens: false,
          canCreateTokens: false,
          canDeleteOwnTokens: true,
          canDeleteOtherTokens: false,
          canManageRoles: false,
          canAssignRoles: false,
          canAssignTokenRoles: false,
          canManageHostility: false,
          canEditMap: false,
          canManageFog: false,
          canManageInitiative: false,
        },
      },
    ],
    visionProfiles: [
      {
        id: 'standard-vision',
        name: 'Standard Vision',
        visionRange: 6,
        useGradients: true,
        innerFadeStart: 0.7,
        midpointPosition: 0.85,
        midpointOpacity: 0.2,
        outerFadeStart: 0.95,
        centerOpacity: 0,
        innerOpacity: 0,
        midpointColorOpacity: 0.1,
        outerOpacity: 0.25,
        edgeOpacity: 0.4,
        color: '#FFD700',
      },
    ],
    fogSettings: {
      enabled: false,
      revealAll: false,
      visionRange: 6,
      fogOpacity: 0.95,
      exploredOpacity: 0.4,
      showExploredAreas: true,
      serializedExploredAreas: '',
      fogVersion: 1,
      useGradients: true,
      innerFadeStart: 0.7,
      midpointPosition: 0.85,
      midpointOpacity: 0.2,
      outerFadeStart: 0.9,
    },
    defaultTokenSize: { width: 1, height: 1 },
    gridSettings: {
      size: 50,
      color: '#333333',
      enabled: true,
    },
  },
  {
    id: 'dungeon-crawl',
    name: 'Dungeon Crawl',
    description: 'Pre-configured for dungeon exploration with fog of war and tactical grid combat.',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    maps: [],
    regions: [],
    roles: [
      {
        id: 'dm',
        name: 'Dungeon Master',
        color: '#8b5cf6',
        isSystem: true,
        hostileToRoleIds: [],
        permissions: {
          canControlOwnTokens: true,
          canControlOtherTokens: true,
          canSeeAllFog: true,
          canSeeFriendlyVision: true,
          canSeeHostileVision: true,
          canSeeOwnTokens: true,
          canSeeOtherTokens: true,
          canSeeHiddenTokens: true,
          canCreateTokens: true,
          canDeleteOwnTokens: true,
          canDeleteOtherTokens: true,
          canManageRoles: true,
          canAssignRoles: true,
          canAssignTokenRoles: true,
          canManageHostility: true,
          canEditMap: true,
          canManageFog: true,
          canManageInitiative: true,
        },
      },
      {
        id: 'player',
        name: 'Player',
        color: '#3b82f6',
        isSystem: true,
        hostileToRoleIds: [],
        permissions: {
          canControlOwnTokens: true,
          canControlOtherTokens: false,
          canSeeAllFog: false,
          canSeeFriendlyVision: true,
          canSeeHostileVision: false,
          canSeeOwnTokens: true,
          canSeeOtherTokens: true,
          canSeeHiddenTokens: false,
          canCreateTokens: false,
          canDeleteOwnTokens: true,
          canDeleteOtherTokens: false,
          canManageRoles: false,
          canAssignRoles: false,
          canAssignTokenRoles: false,
          canManageHostility: false,
          canEditMap: false,
          canManageFog: false,
          canManageInitiative: false,
        },
      },
    ],
    visionProfiles: [
      {
        id: 'darkvision',
        name: 'Darkvision (60ft)',
        visionRange: 12,
        useGradients: true,
        innerFadeStart: 0.75,
        midpointPosition: 0.85,
        midpointOpacity: 0.15,
        outerFadeStart: 0.93,
        centerOpacity: 0,
        innerOpacity: 0,
        midpointColorOpacity: 0.15,
        outerOpacity: 0.3,
        edgeOpacity: 0.5,
        color: '#9370DB',
      },
      {
        id: 'standard-vision',
        name: 'Normal Vision (30ft)',
        visionRange: 6,
        useGradients: true,
        innerFadeStart: 0.7,
        midpointPosition: 0.85,
        midpointOpacity: 0.2,
        outerFadeStart: 0.95,
        centerOpacity: 0,
        innerOpacity: 0,
        midpointColorOpacity: 0.1,
        outerOpacity: 0.25,
        edgeOpacity: 0.4,
        color: '#FFD700',
      },
      {
        id: 'low-light',
        name: 'Low-Light Vision (60ft)',
        visionRange: 12,
        useGradients: true,
        innerFadeStart: 0.65,
        midpointPosition: 0.8,
        midpointOpacity: 0.25,
        outerFadeStart: 0.9,
        centerOpacity: 0,
        innerOpacity: 0,
        midpointColorOpacity: 0.12,
        outerOpacity: 0.28,
        edgeOpacity: 0.45,
        color: '#87CEEB',
      },
    ],
    fogSettings: {
      enabled: true,
      revealAll: false,
      visionRange: 6,
      fogOpacity: 0.95,
      exploredOpacity: 0.5,
      showExploredAreas: true,
      serializedExploredAreas: '',
      fogVersion: 1,
      useGradients: true,
      innerFadeStart: 0.7,
      midpointPosition: 0.85,
      midpointOpacity: 0.2,
      outerFadeStart: 0.9,
    },
    defaultTokenSize: { width: 1, height: 1 },
    gridSettings: {
      size: 50,
      color: '#444444',
      enabled: true,
    },
  },
  {
    id: 'theater-of-mind',
    name: 'Theater of Mind',
    description: 'Minimal visual setup focused on narrative. No grid, no fog of war.',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    maps: [],
    regions: [],
    roles: [
      {
        id: 'dm',
        name: 'Dungeon Master',
        color: '#8b5cf6',
        isSystem: true,
        hostileToRoleIds: [],
        permissions: {
          canControlOwnTokens: true,
          canControlOtherTokens: true,
          canSeeAllFog: true,
          canSeeFriendlyVision: true,
          canSeeHostileVision: true,
          canSeeOwnTokens: true,
          canSeeOtherTokens: true,
          canSeeHiddenTokens: true,
          canCreateTokens: true,
          canDeleteOwnTokens: true,
          canDeleteOtherTokens: true,
          canManageRoles: true,
          canAssignRoles: true,
          canAssignTokenRoles: true,
          canManageHostility: true,
          canEditMap: true,
          canManageFog: true,
          canManageInitiative: true,
        },
      },
      {
        id: 'player',
        name: 'Player',
        color: '#3b82f6',
        isSystem: true,
        hostileToRoleIds: [],
        permissions: {
          canControlOwnTokens: true,
          canControlOtherTokens: false,
          canSeeAllFog: false,
          canSeeFriendlyVision: true,
          canSeeHostileVision: false,
          canSeeOwnTokens: true,
          canSeeOtherTokens: true,
          canSeeHiddenTokens: false,
          canCreateTokens: false,
          canDeleteOwnTokens: true,
          canDeleteOtherTokens: false,
          canManageRoles: false,
          canAssignRoles: false,
          canAssignTokenRoles: false,
          canManageHostility: false,
          canEditMap: false,
          canManageFog: false,
          canManageInitiative: false,
        },
      },
    ],
    visionProfiles: [],
    fogSettings: {
      enabled: false,
      revealAll: true,
      visionRange: 999,
      fogOpacity: 0,
      exploredOpacity: 0,
      showExploredAreas: false,
      serializedExploredAreas: '',
      fogVersion: 1,
      useGradients: false,
      innerFadeStart: 0.7,
      midpointPosition: 0.85,
      midpointOpacity: 0.2,
      outerFadeStart: 0.9,
    },
    defaultTokenSize: { width: 1, height: 1 },
    gridSettings: {
      size: 50,
      color: '#333333',
      enabled: false,
    },
  },
  {
    id: 'tactical-combat',
    name: 'Tactical Combat',
    description: 'Grid-focused setup optimized for precise tactical positioning and combat.',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    maps: [],
    regions: [],
    roles: [
      {
        id: 'dm',
        name: 'Dungeon Master',
        color: '#8b5cf6',
        isSystem: true,
        hostileToRoleIds: [],
        permissions: {
          canControlOwnTokens: true,
          canControlOtherTokens: true,
          canSeeAllFog: true,
          canSeeFriendlyVision: true,
          canSeeHostileVision: true,
          canSeeOwnTokens: true,
          canSeeOtherTokens: true,
          canSeeHiddenTokens: true,
          canCreateTokens: true,
          canDeleteOwnTokens: true,
          canDeleteOtherTokens: true,
          canManageRoles: true,
          canAssignRoles: true,
          canAssignTokenRoles: true,
          canManageHostility: true,
          canEditMap: true,
          canManageFog: true,
          canManageInitiative: true,
        },
      },
      {
        id: 'player',
        name: 'Player',
        color: '#3b82f6',
        isSystem: true,
        hostileToRoleIds: [],
        permissions: {
          canControlOwnTokens: true,
          canControlOtherTokens: false,
          canSeeAllFog: false,
          canSeeFriendlyVision: true,
          canSeeHostileVision: false,
          canSeeOwnTokens: true,
          canSeeOtherTokens: true,
          canSeeHiddenTokens: false,
          canCreateTokens: false,
          canDeleteOwnTokens: true,
          canDeleteOtherTokens: false,
          canManageRoles: false,
          canAssignRoles: false,
          canAssignTokenRoles: false,
          canManageHostility: false,
          canEditMap: false,
          canManageFog: false,
          canManageInitiative: false,
        },
      },
    ],
    visionProfiles: [
      {
        id: 'standard-vision',
        name: 'Normal Vision (30ft)',
        visionRange: 6,
        useGradients: false,
        innerFadeStart: 0.7,
        midpointPosition: 0.85,
        midpointOpacity: 0.2,
        outerFadeStart: 0.95,
        centerOpacity: 0,
        innerOpacity: 0,
        midpointColorOpacity: 0.1,
        outerOpacity: 0.25,
        edgeOpacity: 0.4,
        color: '#FFD700',
      },
    ],
    fogSettings: {
      enabled: false,
      revealAll: true,
      visionRange: 6,
      fogOpacity: 0.95,
      exploredOpacity: 0.4,
      showExploredAreas: false,
      serializedExploredAreas: '',
      fogVersion: 1,
      useGradients: false,
      innerFadeStart: 0.7,
      midpointPosition: 0.85,
      midpointOpacity: 0.2,
      outerFadeStart: 0.9,
    },
    defaultTokenSize: { width: 1, height: 1 },
    gridSettings: {
      size: 50,
      color: '#555555',
      enabled: true,
    },
  },
];

// Save custom template to localStorage
export const saveTemplate = (template: Omit<SessionTemplate, 'id' | 'createdAt'>): SessionTemplate => {
  const newTemplate: SessionTemplate = {
    ...template,
    id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  };

  const customTemplates = getCustomTemplates();
  customTemplates.push(newTemplate);
  
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(customTemplates));
    return newTemplate;
  } catch (error) {
    console.error('Failed to save template:', error);
    throw new Error('Failed to save template');
  }
};

// Get all custom templates from localStorage
export const getCustomTemplates = (): SessionTemplate[] => {
  try {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load custom templates:', error);
    return [];
  }
};

// Get all templates (built-in + custom)
export const getAllTemplates = (): SessionTemplate[] => {
  return [...BUILT_IN_TEMPLATES, ...getCustomTemplates()];
};

// Get a specific template by ID
export const getTemplate = (id: string): SessionTemplate | null => {
  const allTemplates = getAllTemplates();
  return allTemplates.find(t => t.id === id) || null;
};

// Delete a custom template
export const deleteTemplate = (id: string): void => {
  const customTemplates = getCustomTemplates();
  const filtered = customTemplates.filter(t => t.id !== id);
  
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete template:', error);
    throw new Error('Failed to delete template');
  }
};

// Create a template from current session data
export const createTemplateFromSession = (
  name: string,
  description: string,
  sessionData: {
    maps: GameMap[];
    regions: CanvasRegion[];
    roles: Role[];
    visionProfiles: VisionProfile[];
    fogSettings: FogSettings;
    gridSize: number;
  }
): SessionTemplate => {
  // Strip out IDs and specific instance data from maps
  const templateMaps = sessionData.maps.map(map => {
    const { id, ...mapData } = map;
    return mapData;
  });

  // Strip out IDs from regions
  const templateRegions = sessionData.regions.map(region => {
    const { id, ...regionData } = region;
    return regionData;
  });

  const template: Omit<SessionTemplate, 'id' | 'createdAt'> = {
    name,
    description,
    isBuiltIn: false,
    maps: templateMaps,
    regions: templateRegions,
    roles: sessionData.roles,
    visionProfiles: sessionData.visionProfiles,
    fogSettings: {
      ...sessionData.fogSettings,
      serializedExploredAreas: '', // Clear explored areas
    },
    defaultTokenSize: { width: 1, height: 1 },
    gridSettings: {
      size: sessionData.gridSize,
      color: '#333333',
      enabled: true,
    },
  };

  return saveTemplate(template);
};

// Apply a template to the current session
export const applyTemplate = (
  template: SessionTemplate,
  stores: {
    mapStore: any;
    regionStore: any;
    roleStore: any;
    visionProfileStore: any;
    fogStore: any;
  }
): void => {
  // Clear existing data
  stores.roleStore.clearRoles();
  stores.visionProfileStore.clearProfiles();
  
  // Apply template roles
  template.roles.forEach(role => {
    stores.roleStore.addRole(role);
  });

  // Apply template vision profiles
  template.visionProfiles.forEach(profile => {
    stores.visionProfileStore.addProfile(profile);
  });

  // Apply fog settings
  stores.fogStore.setEnabled(template.fogSettings.enabled);
  stores.fogStore.setRevealAll(template.fogSettings.revealAll);
  stores.fogStore.setVisionRange(template.fogSettings.visionRange);
  stores.fogStore.setFogOpacity(template.fogSettings.fogOpacity);
  stores.fogStore.setExploredOpacity(template.fogSettings.exploredOpacity);
  stores.fogStore.setShowExploredAreas(template.fogSettings.showExploredAreas);
  stores.fogStore.setUseGradients(template.fogSettings.useGradients);
  stores.fogStore.setInnerFadeStart(template.fogSettings.innerFadeStart);
  stores.fogStore.setMidpointPosition(template.fogSettings.midpointPosition);
  stores.fogStore.setMidpointOpacity(template.fogSettings.midpointOpacity);
  stores.fogStore.setOuterFadeStart(template.fogSettings.outerFadeStart);
  stores.fogStore.clearExploredAreas();

  // Apply template maps (with new IDs)
  template.maps.forEach(mapTemplate => {
    const newMap = {
      ...mapTemplate,
      id: `map-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    stores.mapStore.addMap(newMap);
  });

  // Apply template regions (with new IDs)
  template.regions.forEach(regionTemplate => {
    const newRegion = {
      ...regionTemplate,
      id: `region-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    stores.regionStore.addRegion(newRegion);
  });
};
