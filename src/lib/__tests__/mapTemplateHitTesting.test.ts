import { describe, it, expect } from 'vitest';
import { computeEffectImpacts, type HitTestParams } from '@/lib/mapTemplateHitTesting';
import type { MapTemplateDefinition } from '@/types/effectTypes';
import type { Token } from '@/stores/sessionStore';

// Helper to build a minimal token at a position
function makeToken(id: string, x: number, y: number, gridWidth = 1, gridHeight = 1): Token {
  return {
    id, name: id, imageUrl: '', x, y,
    gridWidth, gridHeight, label: '', labelPosition: 'below',
    roleId: 'test', isHidden: false,
  } as Token;
}

const GRID = 50; // 50px per grid cell

// ---------------------------------------------------------------------------
// Circle
// ---------------------------------------------------------------------------
describe('Circle effect hit-testing', () => {
  const circleTemplate: MapTemplateDefinition = {
    id: 't1', name: 'Fireball', shape: 'circle', radius: 4,
    placementMode: 'free', persistence: 'instant',
    color: '#FF0000', opacity: 0.5, animation: 'none', animationSpeed: 1,
    category: 'spell',
  };

  it('detects token inside circle', () => {
    const params: HitTestParams = {
      template: circleTemplate,
      origin: { x: 300, y: 300 },
      direction: 0,
      gridSize: GRID,
      tokens: [makeToken('a', 320, 310)],
      mapObjects: [],
    };
    const impacts = computeEffectImpacts(params);
    expect(impacts).toHaveLength(1);
    expect(impacts[0].targetId).toBe('a');
    expect(impacts[0].overlapPercent).toBeGreaterThan(0);
  });

  it('misses token far outside circle', () => {
    const params: HitTestParams = {
      template: circleTemplate,
      origin: { x: 300, y: 300 },
      direction: 0,
      gridSize: GRID,
      tokens: [makeToken('far', 900, 900)],
      mapObjects: [],
    };
    expect(computeEffectImpacts(params)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Line
// ---------------------------------------------------------------------------
describe('Line effect hit-testing', () => {
  const lineTemplate: MapTemplateDefinition = {
    id: 't2', name: 'Lightning Bolt', shape: 'line', length: 10, width: 1,
    placementMode: 'caster', persistence: 'instant',
    color: '#00F', opacity: 0.5, animation: 'none', animationSpeed: 1,
    category: 'spell',
  };

  it('detects token along the line', () => {
    // Line goes from origin rightward (+X direction = 0 radians)
    const impacts = computeEffectImpacts({
      template: lineTemplate,
      origin: { x: 100, y: 200 },
      direction: 0, // rightward
      gridSize: GRID,
      tokens: [makeToken('inline', 300, 200)],
      mapObjects: [],
    });
    expect(impacts).toHaveLength(1);
  });

  it('misses token perpendicular to line', () => {
    const impacts = computeEffectImpacts({
      template: lineTemplate,
      origin: { x: 100, y: 200 },
      direction: 0,
      gridSize: GRID,
      tokens: [makeToken('off', 300, 500)],
      mapObjects: [],
    });
    expect(impacts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Cone
// ---------------------------------------------------------------------------
describe('Cone effect hit-testing', () => {
  const coneTemplate: MapTemplateDefinition = {
    id: 't3', name: 'Cone of Cold', shape: 'cone', length: 6, angle: 90,
    placementMode: 'caster', persistence: 'instant',
    color: '#0FF', opacity: 0.5, animation: 'none', animationSpeed: 1,
    category: 'spell',
  };

  it('detects token inside the cone', () => {
    // Cone points right (direction = 0), so token at +x, slightly +y should be inside 90° cone
    const impacts = computeEffectImpacts({
      template: coneTemplate,
      origin: { x: 100, y: 200 },
      direction: 0,
      gridSize: GRID,
      tokens: [makeToken('in', 250, 220)],
      mapObjects: [],
    });
    expect(impacts).toHaveLength(1);
  });

  it('misses token behind the cone', () => {
    const impacts = computeEffectImpacts({
      template: coneTemplate,
      origin: { x: 100, y: 200 },
      direction: 0,
      gridSize: GRID,
      tokens: [makeToken('behind', -100, 200)],
      mapObjects: [],
    });
    expect(impacts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Burst exclusion
// ---------------------------------------------------------------------------
describe('Burst caster exclusion', () => {
  const burstTemplate: MapTemplateDefinition = {
    id: 't4', name: 'Spirit Guardians', shape: 'circle-burst', radius: 3,
    placementMode: 'caster', persistence: 'persistent',
    color: '#FFD700', opacity: 0.5, animation: 'none', animationSpeed: 1,
    category: 'spell',
  };

  it('excludes the caster from circle-burst', () => {
    const caster = makeToken('caster', 200, 200);
    const ally = makeToken('ally', 250, 200);
    const impacts = computeEffectImpacts({
      template: burstTemplate,
      origin: { x: 200, y: 200 },
      direction: 0,
      gridSize: GRID,
      tokens: [caster, ally],
      mapObjects: [],
      casterId: 'caster',
    });
    expect(impacts.find((i) => i.targetId === 'caster')).toBeUndefined();
    expect(impacts.find((i) => i.targetId === 'ally')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Rectangle
// ---------------------------------------------------------------------------
describe('Rectangle effect hit-testing', () => {
  const rectTemplate: MapTemplateDefinition = {
    id: 't5', name: 'Grease', shape: 'rectangle', width: 4, length: 4,
    placementMode: 'free', persistence: 'persistent',
    color: '#8B7355', opacity: 0.4, animation: 'none', animationSpeed: 1,
    category: 'spell',
  };

  it('detects token inside rectangle', () => {
    const impacts = computeEffectImpacts({
      template: rectTemplate,
      origin: { x: 300, y: 300 },
      direction: 0,
      gridSize: GRID,
      tokens: [makeToken('in', 310, 310)],
      mapObjects: [],
    });
    expect(impacts).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------
describe('Impact sorting by distance', () => {
  const circleTemplate: MapTemplateDefinition = {
    id: 't6', name: 'Big', shape: 'circle', radius: 20,
    placementMode: 'free', persistence: 'instant',
    color: '#F00', opacity: 0.5, animation: 'none', animationSpeed: 1,
    category: 'spell',
  };

  it('sorts results by distance from origin (nearest first)', () => {
    const impacts = computeEffectImpacts({
      template: circleTemplate,
      origin: { x: 0, y: 0 },
      direction: 0,
      gridSize: GRID,
      tokens: [
        makeToken('far', 400, 0),
        makeToken('near', 50, 0),
        makeToken('mid', 200, 0),
      ],
      mapObjects: [],
    });
    expect(impacts.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < impacts.length; i++) {
      expect(impacts[i].distanceFromOrigin).toBeGreaterThanOrEqual(
        impacts[i - 1].distanceFromOrigin,
      );
    }
  });
});
