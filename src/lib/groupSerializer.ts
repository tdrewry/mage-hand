/**
 * Group Serializer – Prefab Export / Import
 * 
 * Exports a group's entities as a self-contained `.d20prefab` JSON file,
 * normalizing coordinates relative to the group bounds.
 * Imports a prefab, re-creating all entities with fresh IDs.
 */

import { useSessionStore, type Token } from '@/stores/sessionStore';
import { useRegionStore, type CanvasRegion } from '@/stores/regionStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { useLightStore, type LightSource } from '@/stores/lightStore';
import { useGroupStore } from '@/stores/groupStore';
import type { MapObject } from '@/types/mapObjectTypes';
import type { EntityGroup, GroupMember, EntityGeometry } from './groupTransforms';
import { toast } from 'sonner';

// ============= Prefab Data Types =============

export interface PrefabData {
  version: string;
  name: string;
  bounds: { width: number; height: number };
  tokens: PrefabToken[];
  regions: PrefabRegion[];
  mapObjects: PrefabMapObject[];
  lights: PrefabLight[];
}

// Stripped-down entity types with origin-relative coordinates
type PrefabToken = Omit<Token, 'id'> & { _origId: string };
type PrefabRegion = Omit<CanvasRegion, 'id'> & { _origId: string };
type PrefabMapObject = Omit<MapObject, 'id'> & { _origId: string };
type PrefabLight = Omit<LightSource, 'id'> & { _origId: string };

// ============= Export =============

export function exportGroupToPrefab(groupId: string): void {
  const group = useGroupStore.getState().groups.find(g => g.id === groupId);
  if (!group) {
    toast.error('Group not found');
    return;
  }

  const tokens = useSessionStore.getState().tokens;
  const regions = useRegionStore.getState().regions;
  const mapObjects = useMapObjectStore.getState().mapObjects;
  const lights = useLightStore.getState().lights;

  const originX = group.bounds.x;
  const originY = group.bounds.y;

  const prefabTokens: PrefabToken[] = [];
  const prefabRegions: PrefabRegion[] = [];
  const prefabMapObjects: PrefabMapObject[] = [];
  const prefabLights: PrefabLight[] = [];

  for (const member of group.members) {
    switch (member.type) {
      case 'token': {
        const t = tokens.find(tok => tok.id === member.id);
        if (t) {
          const { id, ...rest } = t;
          prefabTokens.push({
            ...rest,
            x: rest.x - originX,
            y: rest.y - originY,
            _origId: id,
          });
        }
        break;
      }
      case 'region': {
        const r = regions.find(reg => reg.id === member.id);
        if (r) {
          const { id, ...rest } = r;
          const shifted: PrefabRegion = {
            ...rest,
            x: rest.x - originX,
            y: rest.y - originY,
            _origId: id,
          };
          // Shift path points too
          if (shifted.pathPoints) {
            shifted.pathPoints = shifted.pathPoints.map(p => ({
              x: p.x - originX,
              y: p.y - originY,
            }));
          }
          if (shifted.bezierControlPoints) {
            shifted.bezierControlPoints = shifted.bezierControlPoints.map(cp => ({
              cp1: { x: cp.cp1.x - originX, y: cp.cp1.y - originY },
              cp2: { x: cp.cp2.x - originX, y: cp.cp2.y - originY },
            }));
          }
          prefabRegions.push(shifted);
        }
        break;
      }
      case 'mapObject': {
        const obj = mapObjects.find(o => o.id === member.id);
        if (obj) {
          const { id, ...rest } = obj;
          const shifted: PrefabMapObject = {
            ...rest,
            position: {
              x: rest.position.x - originX,
              y: rest.position.y - originY,
            },
            _origId: id,
          };
          if (shifted.wallPoints) {
            shifted.wallPoints = shifted.wallPoints.map(p => ({
              x: p.x - originX,
              y: p.y - originY,
            }));
          }
          prefabMapObjects.push(shifted);
        }
        break;
      }
      case 'light': {
        const l = lights.find(lt => lt.id === member.id);
        if (l) {
          const { id, ...rest } = l;
          prefabLights.push({
            ...rest,
            position: {
              x: rest.position.x - originX,
              y: rest.position.y - originY,
            },
            _origId: id,
          });
        }
        break;
      }
    }
  }

  const prefab: PrefabData = {
    version: '1.0',
    name: group.name,
    bounds: { width: group.bounds.width, height: group.bounds.height },
    tokens: prefabTokens,
    regions: prefabRegions,
    mapObjects: prefabMapObjects,
    lights: prefabLights,
  };

  // Download as file
  const blob = new Blob([JSON.stringify(prefab, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${group.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.d20prefab`;
  a.click();
  URL.revokeObjectURL(url);

  toast.success(`Exported prefab "${group.name}"`);
}

// ============= Import =============

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export async function importPrefabFromFile(file: File, placement: { x: number; y: number }): Promise<EntityGroup | null> {
  try {
    const text = await file.text();
    const prefab: PrefabData = JSON.parse(text);

    if (!prefab.version || !prefab.name) {
      toast.error('Invalid prefab file');
      return null;
    }

    return importPrefabToMap(prefab, placement);
  } catch (e) {
    toast.error('Failed to parse prefab file');
    console.error('Prefab import error:', e);
    return null;
  }
}

export function importPrefabToMap(prefab: PrefabData, placement: { x: number; y: number }): EntityGroup {
  const { addToken } = useSessionStore.getState();
  const { addRegion } = useRegionStore.getState();
  const { addMapObject } = useMapObjectStore.getState();
  const { addLight } = useLightStore.getState();
  const { addGroup } = useGroupStore.getState();

  const members: GroupMember[] = [];
  const geometries: EntityGeometry[] = [];

  // Import tokens
  for (const pt of prefab.tokens) {
    const { _origId, ...rest } = pt;
    const newId = `token-${generateId()}`;
    const x = rest.x + placement.x;
    const y = rest.y + placement.y;
    addToken({ ...rest, id: newId, x, y });
    members.push({ id: newId, type: 'token' });
    geometries.push({ id: newId, x, y, width: (rest.gridWidth || 1) * 40, height: (rest.gridHeight || 1) * 40 });
  }

  // Import regions
  for (const pr of prefab.regions) {
    const { _origId, ...rest } = pr;
    const newId = `region-${generateId()}`;
    const x = rest.x + placement.x;
    const y = rest.y + placement.y;

    const regionData: any = { ...rest, id: newId, x, y };
    if (regionData.pathPoints) {
      regionData.pathPoints = regionData.pathPoints.map((p: { x: number; y: number }) => ({
        x: p.x + placement.x,
        y: p.y + placement.y,
      }));
    }
    if (regionData.bezierControlPoints) {
      regionData.bezierControlPoints = regionData.bezierControlPoints.map((cp: any) => ({
        cp1: { x: cp.cp1.x + placement.x, y: cp.cp1.y + placement.y },
        cp2: { x: cp.cp2.x + placement.x, y: cp.cp2.y + placement.y },
      }));
    }
    addRegion(regionData);
    members.push({ id: newId, type: 'region' });
    geometries.push({ id: newId, x, y, width: rest.width, height: rest.height });
  }

  // Import map objects
  for (const pm of prefab.mapObjects) {
    const { _origId, ...rest } = pm;
    const newId = `mapobj-${generateId()}`;
    const pos = { x: rest.position.x + placement.x, y: rest.position.y + placement.y };
    const objData: any = { ...rest, id: newId, position: pos, selected: false };
    if (objData.wallPoints) {
      objData.wallPoints = objData.wallPoints.map((p: { x: number; y: number }) => ({
        x: p.x + placement.x,
        y: p.y + placement.y,
      }));
    }
    addMapObject(objData);
    members.push({ id: newId, type: 'mapObject' });
    geometries.push({ id: newId, x: pos.x, y: pos.y, width: rest.width || 40, height: rest.height || 40 });
  }

  // Import lights
  for (const pl of prefab.lights) {
    const { _origId, ...rest } = pl;
    const pos = { x: rest.position.x + placement.x, y: rest.position.y + placement.y };
    const newId = addLight({ ...rest, position: pos });
    members.push({ id: newId, type: 'light' });
    geometries.push({ id: newId, x: pos.x, y: pos.y, width: 30, height: 30 });
  }

  // Create the group
  const group = addGroup(prefab.name, members, geometries);
  toast.success(`Imported prefab "${prefab.name}" with ${members.length} entities`);
  return group;
}
