/**
 * Effect Hit-Testing Engine
 *
 * Computes which tokens and map objects are impacted by a placed effect.
 * Supports all 6 effect shapes: circle, line, cone, rectangle,
 * circle-burst, rectangle-burst.
 *
 * Hit-testing works in world-coordinate space (pixels). Shape dimensions
 * stored in grid units are converted using the supplied gridSize.
 */

import type {
  EffectTemplate,
  EffectImpact,
  EffectShape,
} from '@/types/effectTypes';
import { isBurstShape } from '@/types/effectTypes';
import type { Token } from '@/stores/sessionStore';
import type { MapObject } from '@/types/mapObjectTypes';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface HitTestParams {
  template: EffectTemplate;
  origin: { x: number; y: number };
  /** Direction in radians (from +X axis). Required for cone/line shapes. */
  direction: number;
  /** Grid cell size in pixels */
  gridSize: number;
  /** Tokens to test against */
  tokens: Token[];
  /** Map objects to test against */
  mapObjects: MapObject[];
  /** Token ID of the caster (excluded from burst shapes) */
  casterId?: string;
  /** Only test tokens/objects on this map */
  mapId?: string;
  /** Set of currently active map IDs – tokens/objects on inactive maps are excluded */
  activeMapIds?: Set<string>;
}

/**
 * Run hit-testing for a placed effect and return sorted impacts.
 */
export function computeEffectImpacts(params: HitTestParams): EffectImpact[] {
  const {
    template,
    origin,
    direction,
    gridSize,
    tokens,
    mapObjects,
    casterId,
    mapId,
    activeMapIds,
  } = params;

  const impacts: EffectImpact[] = [];
  const isBurst = isBurstShape(template.shape);

  // Build the effect polygon / geometry in world pixels
  const effectGeom = buildEffectGeometry(template, origin, direction, gridSize);

  // --- Test tokens ---
  let filteredTokens = mapId
    ? tokens.filter((t) => t.mapId === mapId || !t.mapId)
    : tokens;
  if (activeMapIds && activeMapIds.size > 0) {
    filteredTokens = filteredTokens.filter((t) => !t.mapId || activeMapIds.has(t.mapId));
  }

  for (const token of filteredTokens) {
    // Burst exclusion: skip caster for burst shapes
    if (isBurst && casterId && token.id === casterId) continue;
    // Token-sourced exclusion: skip caster unless targetCaster is true
    if (!isBurst && casterId && token.id === casterId && !template.targetCaster) continue;

    const footprint = tokenFootprintRect(token, gridSize);
    const overlap = computeOverlap(effectGeom, footprint);
    if (overlap <= 0) continue;

    const dist = distancePx(origin, { x: token.x, y: token.y }) / gridSize;
    impacts.push({
      targetId: token.id,
      targetType: 'token',
      distanceFromOrigin: Math.round(dist * 100) / 100,
      overlapPercent: Math.round(overlap * 100) / 100,
    });
  }

  // --- Test map objects ---
  let filteredObjects = mapId
    ? mapObjects.filter((o) => (o as any).mapId === mapId || !(o as any).mapId)
    : mapObjects;
  if (activeMapIds && activeMapIds.size > 0) {
    filteredObjects = filteredObjects.filter((o) => !(o as any).mapId || activeMapIds.has((o as any).mapId));
  }

  for (const obj of filteredObjects) {
    const footprint = mapObjectFootprintRect(obj);
    const overlap = computeOverlap(effectGeom, footprint);
    if (overlap <= 0) continue;

    const center = rectCenter(footprint);
    const dist = distancePx(origin, center) / gridSize;
    impacts.push({
      targetId: obj.id,
      targetType: 'mapObject',
      distanceFromOrigin: Math.round(dist * 100) / 100,
      overlapPercent: Math.round(overlap * 100) / 100,
    });
  }

  // Sort by distance ascending
  impacts.sort((a, b) => a.distanceFromOrigin - b.distanceFromOrigin);
  return impacts;
}

// ---------------------------------------------------------------------------
// Geometry types (internal)
// ---------------------------------------------------------------------------

/** Axis-aligned bounding rectangle */
interface Rect {
  x: number; y: number; width: number; height: number;
}

/**
 * Convex polygon represented as ordered vertices.
 * All effect shapes are converted to this for uniform overlap testing.
 */
interface ConvexPoly {
  vertices: { x: number; y: number }[];
  /** Axis-aligned bounding box for quick rejection */
  bounds: Rect;
}

// ---------------------------------------------------------------------------
// Build effect geometry from template
// ---------------------------------------------------------------------------

function buildEffectGeometry(
  template: EffectTemplate,
  origin: { x: number; y: number },
  direction: number,
  gridSize: number,
): ConvexPoly {
  switch (template.shape) {
    case 'circle':
    case 'circle-burst':
      return buildCirclePoly(origin, (template.radius ?? 4) * gridSize);
    case 'rectangle':
    case 'rectangle-burst':
      return buildRectanglePoly(
        origin,
        (template.width ?? 2) * gridSize,
        (template.length ?? 2) * gridSize,
        direction,
      );
    case 'line':
      return buildLinePoly(
        origin,
        (template.length ?? 12) * gridSize,
        (template.width ?? 1) * gridSize,
        direction,
      );
    case 'cone':
      return buildConePoly(
        origin,
        (template.length ?? 6) * gridSize,
        (template.angle ?? 53) * (Math.PI / 180),
        direction,
      );
    default:
      // Fallback: tiny circle at origin
      return buildCirclePoly(origin, gridSize);
  }
}

// ---------------------------------------------------------------------------
// Shape builders → ConvexPoly
// ---------------------------------------------------------------------------

/**
 * Approximate a circle as a 16-sided polygon.
 */
function buildCirclePoly(center: { x: number; y: number }, radius: number): ConvexPoly {
  const N = 16;
  const vertices: { x: number; y: number }[] = [];
  for (let i = 0; i < N; i++) {
    const angle = (i / N) * Math.PI * 2;
    vertices.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  }
  return { vertices, bounds: polyBounds(vertices) };
}

/**
 * Build a rotated rectangle centered at origin.
 * For rectangle-burst the origin is the caster position.
 */
function buildRectanglePoly(
  origin: { x: number; y: number },
  width: number,
  length: number,
  direction: number,
): ConvexPoly {
  const hw = width / 2;
  const hl = length / 2;
  // Local-space corners (length along X, width along Y)
  const locals = [
    { x: -hl, y: -hw },
    { x: hl, y: -hw },
    { x: hl, y: hw },
    { x: -hl, y: hw },
  ];
  const cos = Math.cos(direction);
  const sin = Math.sin(direction);
  const vertices = locals.map((p) => ({
    x: origin.x + p.x * cos - p.y * sin,
    y: origin.y + p.x * sin + p.y * cos,
  }));
  return { vertices, bounds: polyBounds(vertices) };
}

/**
 * Build a line (thin rectangle) from origin extending in `direction`.
 */
function buildLinePoly(
  origin: { x: number; y: number },
  length: number,
  width: number,
  direction: number,
): ConvexPoly {
  const hw = width / 2;
  // Local space: line extends from 0 to +length along X axis
  const locals = [
    { x: 0, y: -hw },
    { x: length, y: -hw },
    { x: length, y: hw },
    { x: 0, y: hw },
  ];
  const cos = Math.cos(direction);
  const sin = Math.sin(direction);
  const vertices = locals.map((p) => ({
    x: origin.x + p.x * cos - p.y * sin,
    y: origin.y + p.x * sin + p.y * cos,
  }));
  return { vertices, bounds: polyBounds(vertices) };
}

/**
 * Build a cone polygon. The cone originates at `origin`, extends
 * `length` pixels in `direction`, spreading `angle` radians wide.
 * Approximated as a fan with 8 edge segments + the apex.
 */
function buildConePoly(
  origin: { x: number; y: number },
  length: number,
  angle: number,
  direction: number,
): ConvexPoly {
  const halfAngle = angle / 2;
  const N = 8; // segments along the arc
  const vertices: { x: number; y: number }[] = [origin];

  for (let i = 0; i <= N; i++) {
    const a = direction - halfAngle + (angle * i) / N;
    vertices.push({
      x: origin.x + Math.cos(a) * length,
      y: origin.y + Math.sin(a) * length,
    });
  }
  return { vertices, bounds: polyBounds(vertices) };
}

// ---------------------------------------------------------------------------
// Token / MapObject footprint helpers
// ---------------------------------------------------------------------------

function tokenFootprintRect(token: Token, gridSize: number): Rect {
  const w = (token.gridWidth ?? 1) * gridSize;
  const h = (token.gridHeight ?? 1) * gridSize;
  return {
    x: token.x - w / 2,
    y: token.y - h / 2,
    width: w,
    height: h,
  };
}

function mapObjectFootprintRect(obj: MapObject): Rect {
  return {
    x: obj.position.x,
    y: obj.position.y,
    width: obj.width,
    height: obj.height,
  };
}

// ---------------------------------------------------------------------------
// Overlap computation (SAT-based for convex polygons)
// ---------------------------------------------------------------------------

/**
 * Compute overlap fraction of the target rect that intersects the effect poly.
 * Returns 0-1. Uses Separating Axis Theorem for broad test, then estimates
 * overlap via sample points for efficiency.
 */
function computeOverlap(effect: ConvexPoly, target: Rect): number {
  // Quick AABB rejection
  if (!aabbOverlap(effect.bounds, target)) return 0;

  // Convert target rect to vertices for SAT
  const targetVerts = rectToVertices(target);

  // SAT test
  if (!satOverlap(effect.vertices, targetVerts)) return 0;

  // Estimate overlap using a grid of sample points inside the target
  return estimateOverlapFraction(effect, target);
}

/**
 * Sample a grid of points inside the target rect and check what fraction
 * falls inside the effect polygon. Uses a 3×3 grid for small targets,
 * 5×5 for larger ones.
 */
function estimateOverlapFraction(effect: ConvexPoly, target: Rect): number {
  const samples = target.width * target.height > 2500 ? 5 : 3;
  let inside = 0;
  const total = samples * samples;

  for (let row = 0; row < samples; row++) {
    for (let col = 0; col < samples; col++) {
      const px = target.x + ((col + 0.5) / samples) * target.width;
      const py = target.y + ((row + 0.5) / samples) * target.height;
      if (pointInConvexPoly(px, py, effect.vertices)) {
        inside++;
      }
    }
  }

  return inside / total;
}

// ---------------------------------------------------------------------------
// SAT (Separating Axis Theorem) for convex polygons
// ---------------------------------------------------------------------------

function satOverlap(
  polyA: { x: number; y: number }[],
  polyB: { x: number; y: number }[],
): boolean {
  return !hasSeparatingAxis(polyA, polyB) && !hasSeparatingAxis(polyB, polyA);
}

function hasSeparatingAxis(
  poly: { x: number; y: number }[],
  other: { x: number; y: number }[],
): boolean {
  const len = poly.length;
  for (let i = 0; i < len; i++) {
    const j = (i + 1) % len;
    // Edge normal
    const nx = poly[j].y - poly[i].y;
    const ny = -(poly[j].x - poly[i].x);

    let minA = Infinity, maxA = -Infinity;
    for (const v of poly) {
      const d = nx * v.x + ny * v.y;
      if (d < minA) minA = d;
      if (d > maxA) maxA = d;
    }

    let minB = Infinity, maxB = -Infinity;
    for (const v of other) {
      const d = nx * v.x + ny * v.y;
      if (d < minB) minB = d;
      if (d > maxB) maxB = d;
    }

    if (maxA < minB || maxB < minA) return true; // separating axis found
  }
  return false;
}

// ---------------------------------------------------------------------------
// Point-in-convex-polygon (winding / cross-product)
// ---------------------------------------------------------------------------

function pointInConvexPoly(
  px: number,
  py: number,
  vertices: { x: number; y: number }[],
): boolean {
  const n = vertices.length;
  if (n < 3) return false;

  // Use cross-product sign consistency
  let positive = 0;
  let negative = 0;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross =
      (vertices[j].x - vertices[i].x) * (py - vertices[i].y) -
      (vertices[j].y - vertices[i].y) * (px - vertices[i].x);

    if (cross > 0) positive++;
    else if (cross < 0) negative++;

    if (positive > 0 && negative > 0) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Geometry utilities
// ---------------------------------------------------------------------------

function aabbOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function rectToVertices(r: Rect): { x: number; y: number }[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ];
}

function polyBounds(vertices: { x: number; y: number }[]): Rect {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function rectCenter(r: Rect): { x: number; y: number } {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

function distancePx(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
