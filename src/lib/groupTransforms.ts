/**
 * Group Transformation System
 * 
 * Handles grouped token operations with proper transformation matrices
 * Supports rotation, scaling, and translation for token groups
 */

import { Token } from '../stores/sessionStore';

export interface TransformMatrix {
  a: number; // scaleX
  b: number; // skewY  
  c: number; // skewX
  d: number; // scaleY
  e: number; // translateX
  f: number; // translateY
}

export interface TokenGroup {
  id: string;
  name: string;
  tokenIds: string[];
  transform: TransformMatrix;
  pivot: { x: number; y: number };
  bounds: { x: number; y: number; width: number; height: number };
  locked: boolean;
  visible: boolean;
}

export interface GroupTransformHandles {
  rotation: { x: number; y: number; size: number };
  scale: { x: number; y: number; size: number };
  corners: Array<{ x: number; y: number; type: 'nw' | 'ne' | 'sw' | 'se' }>;
}

// Identity transformation matrix
export const createIdentityMatrix = (): TransformMatrix => ({
  a: 1, b: 0, c: 0, d: 1, e: 0, f: 0
});

// Create transformation matrix from translation, rotation, and scale
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
  
  // Create composite transformation: translate to pivot -> scale -> rotate -> translate back -> final translate
  return {
    a: cos * scaleX,
    b: sin * scaleY,
    c: -sin * scaleX,
    d: cos * scaleY,
    e: translateX + pivotX * (1 - cos * scaleX) + pivotY * sin * scaleX,
    f: translateY + pivotY * (1 - cos * scaleY) - pivotX * sin * scaleY
  };
};

// Apply transformation matrix to a point
export const transformPoint = (point: { x: number; y: number }, matrix: TransformMatrix): { x: number; y: number } => ({
  x: matrix.a * point.x + matrix.c * point.y + matrix.e,
  y: matrix.b * point.x + matrix.d * point.y + matrix.f
});

// Multiply two transformation matrices
export const multiplyMatrices = (m1: TransformMatrix, m2: TransformMatrix): TransformMatrix => ({
  a: m1.a * m2.a + m1.c * m2.b,
  b: m1.b * m2.a + m1.d * m2.b,
  c: m1.a * m2.c + m1.c * m2.d,
  d: m1.b * m2.c + m1.d * m2.d,
  e: m1.a * m2.e + m1.c * m2.f + m1.e,
  f: m1.b * m2.e + m1.d * m2.f + m1.f
});

// Calculate group bounds from tokens
export const calculateGroupBounds = (tokens: Token[]): { x: number; y: number; width: number; height: number } => {
  if (tokens.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  tokens.forEach(token => {
    const tokenWidth = token.gridWidth * 50; // Assume 50px per grid unit
    const tokenHeight = token.gridHeight * 50;
    
    minX = Math.min(minX, token.x);
    minY = Math.min(minY, token.y);
    maxX = Math.max(maxX, token.x + tokenWidth);
    maxY = Math.max(maxY, token.y + tokenHeight);
  });
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
};

// Calculate group pivot point (center of bounds)
export const calculateGroupPivot = (bounds: { x: number; y: number; width: number; height: number }): { x: number; y: number } => ({
  x: bounds.x + bounds.width / 2,
  y: bounds.y + bounds.height / 2
});

// Generate transformation handles for a group
export const generateGroupHandles = (group: TokenGroup): GroupTransformHandles => {
  const { bounds, transform } = group;
  const pivot = calculateGroupPivot(bounds);
  
  // Transform bounds corners
  const corners = [
    { x: bounds.x, y: bounds.y, type: 'nw' as const },
    { x: bounds.x + bounds.width, y: bounds.y, type: 'ne' as const },
    { x: bounds.x, y: bounds.y + bounds.height, type: 'sw' as const },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height, type: 'se' as const }
  ].map(corner => ({
    ...transformPoint(corner, transform),
    type: corner.type
  }));
  
  // Rotation handle - 40px above the top edge
  const topCenter = { x: pivot.x, y: bounds.y - 40 };
  const rotation = transformPoint(topCenter, transform);
  
  // Scale handle - at bottom-right corner
  const scale = corners.find(c => c.type === 'se')!;
  
  return {
    rotation: { ...rotation, size: 12 },
    scale: { ...scale, size: 10 },
    corners
  };
};

// Check if point hits a transformation handle
export const hitTestGroupHandles = (
  point: { x: number; y: number }, 
  handles: GroupTransformHandles
): { type: 'rotation' | 'scale' | 'corner'; corner?: string } | null => {
  
  // Check rotation handle
  const rotDist = Math.sqrt(
    Math.pow(point.x - handles.rotation.x, 2) + 
    Math.pow(point.y - handles.rotation.y, 2)
  );
  if (rotDist <= handles.rotation.size) {
    return { type: 'rotation' };
  }
  
  // Check scale handle
  const scaleDist = Math.sqrt(
    Math.pow(point.x - handles.scale.x, 2) + 
    Math.pow(point.y - handles.scale.y, 2)
  );
  if (scaleDist <= handles.scale.size) {
    return { type: 'scale' };
  }
  
  // Check corner handles
  for (const corner of handles.corners) {
    const cornerDist = Math.sqrt(
      Math.pow(point.x - corner.x, 2) + 
      Math.pow(point.y - corner.y, 2)
    );
    if (cornerDist <= 8) {
      return { type: 'corner', corner: corner.type };
    }
  }
  
  return null;
};

// Apply transformation to all tokens in a group
export const applyGroupTransformToTokens = (
  tokens: Token[],
  group: TokenGroup,
  deltaTransform: Partial<TransformMatrix>
): Token[] => {
  const newTransform = { ...group.transform, ...deltaTransform };
  
  return tokens.map(token => {
    if (!group.tokenIds.includes(token.id)) return token;
    
    const transformed = transformPoint({ x: token.x, y: token.y }, newTransform);
    return {
      ...token,
      x: transformed.x,
      y: transformed.y
    };
  });
};

// Create a new token group
export const createTokenGroup = (
  name: string,
  tokens: Token[]
): TokenGroup => {
  const bounds = calculateGroupBounds(tokens);
  const pivot = calculateGroupPivot(bounds);
  
  return {
    id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    tokenIds: tokens.map(t => t.id),
    transform: createIdentityMatrix(),
    pivot,
    bounds,
    locked: false,
    visible: true
  };
};

// Update group bounds when tokens change
export const updateGroupBounds = (group: TokenGroup, tokens: Token[]): TokenGroup => {
  const groupTokens = tokens.filter(t => group.tokenIds.includes(t.id));
  const bounds = calculateGroupBounds(groupTokens);
  const pivot = calculateGroupPivot(bounds);
  
  return {
    ...group,
    bounds,
    pivot
  };
};