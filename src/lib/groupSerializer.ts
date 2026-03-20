/**
 * Group Serializer - Prefab Export/Import System
 * 
 * Exports groups as portable .d20prefab JSON files containing all member
 * entities with positions normalized to the group's top-left boundary.
 * Imports prefabs by creating fresh entities at a target placement position.
 */

import { Token } from '../stores/sessionStore';
import { CanvasRegion } from '../stores/regionStore';
import { MapObject } from '../types/mapObjectTypes';
import { IlluminationSource } from '../types/illumination';
import { EntityGroup, GroupMember, EntityGeometry, createEntityGroup } from './groupTransforms';
import { getAllTextures, getAllRegionMappings, importTextures } from './textureStorage';
import { getAllTokenMappings, importTokenTextures } from './textureStorage';

// ============= Prefab Data Structure =============

export interface EmbeddedPrefabTextures {
  textures: Record<string, string>;
  regionMappings: Record<string, string>;
  tokenMappings: Record<string, string>;
}

export interface PrefabData {
  version: string;
  name: string;
  bounds: { width: number; height: number };
  tokens: Token[];
  regions: CanvasRegion[];
  mapObjects: MapObject[];
  lights: IlluminationSource[];
  embeddedTextures?: EmbeddedPrefabTextures;
}

export const PREFAB_VERSION = '1.0.0';

// ============= Export =============

/**
 * Export a group to a portable prefab format.
 * Positions are normalized relative to the group's top-left corner.
 */
export async function exportGroupToPrefab(
  group: EntityGroup,
  tokens: Token[],
  regions: CanvasRegion[],
  mapObjects: MapObject[],
  lights: IlluminationSource[],
): Promise<PrefabData> {
  const memberTokenIds = new Set(group.members.filter(m => m.type === 'token').map(m => m.id));
  const memberRegionIds = new Set(group.members.filter(m => m.type === 'region').map(m => m.id));
  const memberMapObjectIds = new Set(group.members.filter(m => m.type === 'mapObject').map(m => m.id));
  const memberLightIds = new Set(group.members.filter(m => m.type === 'light').map(m => m.id));

  const prefabTokens = tokens.filter(t => memberTokenIds.has(t.id));
  const prefabRegions = regions.filter(r => memberRegionIds.has(r.id));
  const prefabMapObjects = mapObjects.filter(o => memberMapObjectIds.has(o.id));
  const prefabLights = lights.filter(l => memberLightIds.has(l.id));

  const originX = group.bounds.x;
  const originY = group.bounds.y;

  // Normalize positions relative to origin
  const normalizedTokens = prefabTokens.map(t => ({
    ...t,
    x: t.x - originX,
    y: t.y - originY,
  }));

  const normalizedRegions = prefabRegions.map(r => ({
    ...r,
    x: r.x - originX,
    y: r.y - originY,
    pathPoints: r.pathPoints?.map(p => ({ x: p.x - originX, y: p.y - originY })),
    bezierControlPoints: r.bezierControlPoints?.map(bp => ({
      cp1: { x: bp.cp1.x - originX, y: bp.cp1.y - originY },
      cp2: { x: bp.cp2.x - originX, y: bp.cp2.y - originY },
    })),
    selected: false,
  }));

  const normalizedMapObjects = prefabMapObjects.map(o => ({
    ...o,
    position: { x: o.position.x - originX, y: o.position.y - originY },
    wallPoints: o.wallPoints?.map(p => ({ x: p.x - originX, y: p.y - originY })),
    selected: false,
  }));

  const normalizedLights = prefabLights.map(l => ({
    ...l,
    position: { x: l.position.x - originX, y: l.position.y - originY },
  }));

  // Embed textures
  let embeddedTextures: EmbeddedPrefabTextures | undefined;
  try {
    const allTextureDetails = await getAllTextures();
    const regionMappingsMap = await getAllRegionMappings();
    const tokenMappingsMap = await getAllTokenMappings();

    // Convert Maps to Records
    const regionMappings: Record<string, string> = {};
    regionMappingsMap.forEach((hash, id) => { regionMappings[id] = hash; });
    const tokenMappings: Record<string, string> = {};
    tokenMappingsMap.forEach((hash, id) => { tokenMappings[id] = hash; });

    // Filter to only textures used by prefab members
    const usedHashes = new Set<string>();
    normalizedRegions.forEach(r => { if (r.textureHash) usedHashes.add(r.textureHash); });
    normalizedTokens.forEach(t => { if (t.imageHash) usedHashes.add(t.imageHash); });

    const filteredTextures: Record<string, string> = {};
    for (const detail of allTextureDetails) {
      if (usedHashes.has(detail.hash)) filteredTextures[detail.hash] = detail.dataUrl;
    }

    const filteredRegionMappings: Record<string, string> = {};
    for (const [id, hash] of Object.entries(regionMappings)) {
      if (memberRegionIds.has(id)) filteredRegionMappings[id] = hash;
    }

    const filteredTokenMappings: Record<string, string> = {};
    for (const [id, hash] of Object.entries(tokenMappings)) {
      if (memberTokenIds.has(id)) filteredTokenMappings[id] = hash;
    }

    if (Object.keys(filteredTextures).length > 0) {
      embeddedTextures = {
        textures: filteredTextures,
        regionMappings: filteredRegionMappings,
        tokenMappings: filteredTokenMappings,
      };
    }
  } catch (e) {
    console.warn('Failed to embed textures in prefab:', e);
  }

  return {
    version: PREFAB_VERSION,
    name: group.name,
    bounds: { width: group.bounds.width, height: group.bounds.height },
    tokens: normalizedTokens,
    regions: normalizedRegions,
    mapObjects: normalizedMapObjects,
    lights: normalizedLights,
    embeddedTextures,
  };
}

/**
 * Download a prefab as a .d20prefab file.
 */
export function downloadPrefab(prefab: PrefabData): void {
  const json = JSON.stringify(prefab, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${prefab.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.d20prefab`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============= Import =============

const freshId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

type IdMap = Map<string, string>;

export interface ImportResult {
  tokens: Token[];
  regions: CanvasRegion[];
  mapObjects: MapObject[];
  lights: IlluminationSource[];
  group: EntityGroup;
  idMap: IdMap;
}

/**
 * Import a prefab, creating new entities offset to a placement position.
 */
export async function importPrefabToMap(
  prefab: PrefabData,
  placementX: number,
  placementY: number,
): Promise<ImportResult> {
  const idMap: IdMap = new Map();

  const newTokens: Token[] = prefab.tokens.map(t => {
    const newId = freshId('token');
    idMap.set(t.id, newId);
    return { ...t, id: newId, x: t.x + placementX, y: t.y + placementY };
  });

  const newRegions: CanvasRegion[] = prefab.regions.map(r => {
    const newId = freshId('region');
    idMap.set(r.id, newId);
    return {
      ...r,
      id: newId,
      x: r.x + placementX,
      y: r.y + placementY,
      pathPoints: r.pathPoints?.map(p => ({ x: p.x + placementX, y: p.y + placementY })),
      bezierControlPoints: r.bezierControlPoints?.map(bp => ({
        cp1: { x: bp.cp1.x + placementX, y: bp.cp1.y + placementY },
        cp2: { x: bp.cp2.x + placementX, y: bp.cp2.y + placementY },
      })),
      selected: false,
    };
  });

  const newMapObjects: MapObject[] = prefab.mapObjects.map(o => {
    const newId = freshId('map-object');
    idMap.set(o.id, newId);
    return {
      ...o,
      id: newId,
      position: { x: o.position.x + placementX, y: o.position.y + placementY },
      wallPoints: o.wallPoints?.map(p => ({ x: p.x + placementX, y: p.y + placementY })),
      selected: false,
    };
  });

  const newLights: IlluminationSource[] = prefab.lights.map(l => {
    const newId = freshId('light');
    idMap.set(l.id, newId);
    return {
      ...l,
      id: newId,
      position: { x: l.position.x + placementX, y: l.position.y + placementY },
    };
  });

  // Import embedded textures with remapped IDs
  if (prefab.embeddedTextures) {
    try {
      // Remap region texture mappings to new IDs
      const newRegionMappings: Record<string, string> = {};
      for (const [oldId, hash] of Object.entries(prefab.embeddedTextures.regionMappings)) {
        const newId = idMap.get(oldId);
        if (newId) newRegionMappings[newId] = hash;
      }

      await importTextures(prefab.embeddedTextures.textures, newRegionMappings);

      // Update region textureHash to point to correct hashes
      for (const [regionId, hash] of Object.entries(newRegionMappings)) {
        const region = newRegions.find(r => r.id === regionId);
        if (region) region.textureHash = hash;
      }

      // Remap token texture mappings
      const newTokenMappings: Record<string, string> = {};
      for (const [oldId, hash] of Object.entries(prefab.embeddedTextures.tokenMappings)) {
        const newId = idMap.get(oldId);
        if (newId) newTokenMappings[newId] = hash;
      }

      await importTokenTextures(prefab.embeddedTextures.textures, newTokenMappings);

      for (const [tokenId, hash] of Object.entries(newTokenMappings)) {
        const token = newTokens.find(t => t.id === tokenId);
        if (token) token.imageHash = hash;
      }
    } catch (e) {
      console.warn('Failed to import prefab textures:', e);
    }
  }

  // Build new group
  const members: GroupMember[] = [
    ...newTokens.map(t => ({ id: t.id, type: 'token' as const })),
    ...newRegions.map(r => ({ id: r.id, type: 'region' as const })),
    ...newMapObjects.map(o => ({ id: o.id, type: 'mapObject' as const })),
    ...newLights.map(l => ({ id: l.id, type: 'light' as const })),
  ];

  const geometries: EntityGeometry[] = [
    ...newTokens.map(t => ({ id: t.id, x: t.x, y: t.y, width: t.gridWidth * 50, height: t.gridHeight * 50 })),
    ...newRegions.map(r => ({ id: r.id, x: r.x, y: r.y, width: r.width, height: r.height })),
    ...newMapObjects.map(o => ({ id: o.id, x: o.position.x, y: o.position.y, width: o.width, height: o.height })),
    ...newLights.map(l => ({ id: l.id, x: l.position.x, y: l.position.y, width: 30, height: 30 })),
  ];

  const group = createEntityGroup(prefab.name, members, geometries);

  return { tokens: newTokens, regions: newRegions, mapObjects: newMapObjects, lights: newLights, group, idMap };
}

/**
 * Parse a .d20prefab file and validate its structure.
 */
export function parsePrefabFile(json: string): PrefabData {
  const data = JSON.parse(json);
  if (!data.version || !data.name || !data.bounds) {
    throw new Error('Invalid prefab file: missing required fields');
  }
  return data as PrefabData;
}
