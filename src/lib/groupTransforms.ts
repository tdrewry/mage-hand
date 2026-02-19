/**
 * Universal Group Transformation System
 * 
 * Handles grouped entity operations with proper transformation matrices.
 * Supports rotation, scaling, and translation for groups of any entity type
 * (tokens, regions, map objects, lights).
 */

// ============= Types =============

export type EntityType = 'token' | 'region' | 'mapObject' | 'light';

export interface GroupMember {
  id: string;
  type: EntityType;
}

export interface EntityGroup {
  id: string;
  name: string;
  members: GroupMember[];
  pivot: { x: number; y: number };
  bounds: { x: number; y: number; width: number; height: number };
  locked: boolean;
  visible: boolean;
}

/** Position and size data for any entity, used for bounds calculation */
export interface EntityGeometry {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TransformMatrix {
  a: number; // scaleX
  b: number; // skewY  
  c: number; // skewX
  d: number; // scaleY
  e: number; // translateX
  f: number; // translateY
}

export interface GroupTransformHandles {
  rotation: { x: number; y: number; size: number };
  scale: { x: number; y: number; size: number };
  corners: Array<{ x: number; y: number; type: 'nw' | 'ne' | 'sw' | 'se' }>;
}

// ============= Matrix Math (entity-agnostic) =============

export const createIdentityMatrix = (): TransformMatrix => ({
  a: 1, b: 0, c: 0, d: 1, e: 0, f: 0
});

export const createTransformMatrix = (
  translateX: number = 0,
  translateY: number = 0, 
  rotation: number = 0,
  scaleX: number = 1,
  scaleY: number = 1,
  pivotX: number = 0,
  pivotY: number = 0
): TransformMatrix => {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  
  return {
    a: cos * scaleX,
    b: sin * scaleY,
    c: -sin * scaleX,
    d: cos * scaleY,
    e: translateX + pivotX * (1 - cos * scaleX) + pivotY * sin * scaleX,
    f: translateY + pivotY * (1 - cos * scaleY) - pivotX * sin * scaleY
  };
};

export const transformPoint = (point: { x: number; y: number }, matrix: TransformMatrix): { x: number; y: number } => ({
  x: matrix.a * point.x + matrix.c * point.y + matrix.e,
  y: matrix.b * point.x + matrix.d * point.y + matrix.f
});

export const multiplyMatrices = (m1: TransformMatrix, m2: TransformMatrix): TransformMatrix => ({
  a: m1.a * m2.a + m1.c * m2.b,
  b: m1.b * m2.a + m1.d * m2.b,
  c: m1.a * m2.c + m1.c * m2.d,
  d: m1.b * m2.c + m1.d * m2.d,
  e: m1.a * m2.e + m1.c * m2.f + m1.e,
  f: m1.b * m2.e + m1.d * m2.f + m1.f
});

// ============= Universal Bounds =============

/** Calculate bounds from an array of entity geometries (store-agnostic) */
export const calculateEntityBounds = (geometries: EntityGeometry[]): { x: number; y: number; width: number; height: number } => {
  if (geometries.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const geo of geometries) {
    minX = Math.min(minX, geo.x);
    minY = Math.min(minY, geo.y);
    maxX = Math.max(maxX, geo.x + geo.width);
    maxY = Math.max(maxY, geo.y + geo.height);
  }
  
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

export const calculateGroupPivot = (bounds: { x: number; y: number; width: number; height: number }): { x: number; y: number } => ({
  x: bounds.x + bounds.width / 2,
  y: bounds.y + bounds.height / 2
});

// ============= Group Factory =============

export const createEntityGroup = (
  name: string,
  members: GroupMember[],
  geometries: EntityGeometry[]
): EntityGroup => {
  const bounds = calculateEntityBounds(geometries);
  const pivot = calculateGroupPivot(bounds);
  
  return {
    id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    members,
    pivot,
    bounds,
    locked: false,
    visible: true
  };
};

/** Recalculate group bounds from fresh geometry data */
export const recalculateGroupBounds = (group: EntityGroup, geometries: EntityGeometry[]): EntityGroup => {
  const memberIds = new Set(group.members.map(m => m.id));
  const memberGeometries = geometries.filter(g => memberIds.has(g.id));
  const bounds = calculateEntityBounds(memberGeometries);
  const pivot = calculateGroupPivot(bounds);
  
  return { ...group, bounds, pivot };
};

// ============= Transform Handles =============

export const generateGroupHandles = (group: EntityGroup, bounds?: { x: number; y: number; width: number; height: number }): GroupTransformHandles => {
  const b = bounds || group.bounds;
  const pivot = calculateGroupPivot(b);
  const identity = createIdentityMatrix();
  
  const corners = [
    { x: b.x, y: b.y, type: 'nw' as const },
    { x: b.x + b.width, y: b.y, type: 'ne' as const },
    { x: b.x, y: b.y + b.height, type: 'sw' as const },
    { x: b.x + b.width, y: b.y + b.height, type: 'se' as const }
  ].map(corner => ({
    ...transformPoint(corner, identity),
    type: corner.type
  }));
  
  const topCenter = { x: pivot.x, y: b.y - 40 };
  const rotation = transformPoint(topCenter, identity);
  const scale = corners.find(c => c.type === 'se')!;
  
  return {
    rotation: { ...rotation, size: 12 },
    scale: { ...scale, size: 10 },
    corners
  };
};

export const hitTestGroupHandles = (
  point: { x: number; y: number }, 
  handles: GroupTransformHandles
): { type: 'rotation' | 'scale' | 'corner'; corner?: string } | null => {
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

  if (dist(point, handles.rotation) <= handles.rotation.size) return { type: 'rotation' };
  if (dist(point, handles.scale) <= handles.scale.size) return { type: 'scale' };
  
  for (const corner of handles.corners) {
    if (dist(point, corner) <= 8) return { type: 'corner', corner: corner.type };
  }
  
  return null;
};

// ============= Backward Compatibility =============
// Re-export old name for files that haven't migrated yet

/** @deprecated Use EntityGroup instead */
export type TokenGroup = EntityGroup;

/** @deprecated Use createEntityGroup instead */
export const createTokenGroup = (name: string, tokens: { id: string; x: number; y: number; gridWidth: number; gridHeight: number }[]): EntityGroup => {
  const members: GroupMember[] = tokens.map(t => ({ id: t.id, type: 'token' as const }));
  const geometries: EntityGeometry[] = tokens.map(t => ({
    id: t.id,
    x: t.x,
    y: t.y,
    width: t.gridWidth * 50,
    height: t.gridHeight * 50,
  }));
  return createEntityGroup(name, members, geometries);
};

/** @deprecated Use recalculateGroupBounds instead */
export const updateGroupBounds = (group: EntityGroup, tokens: { id: string; x: number; y: number; gridWidth: number; gridHeight: number }[]): EntityGroup => {
  const geometries: EntityGeometry[] = tokens.map(t => ({
    id: t.id,
    x: t.x,
    y: t.y,
    width: t.gridWidth * 50,
    height: t.gridHeight * 50,
  }));
  return recalculateGroupBounds(group, geometries);
};

/** @deprecated Use calculateEntityBounds instead */
export const calculateGroupBounds = calculateEntityBounds;
