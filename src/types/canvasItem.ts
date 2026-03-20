/**
 * CanvasItem — Generic canvas entity for interactive world objects
 * 
 * Items represent physical objects on the map: torches, weapons, chests, etc.
 * They can emit light, be picked up by tokens, contain other items (containers),
 * and carry a simplified data sheet (actions, features, resistances).
 * 
 * Items supersede the old LightSource type (STEP-002/STEP-007).
 * 
 * @see Plans/STEP-007-item-canvas-entity-system.md
 */

import type { IlluminationSource } from './illumination';
import type { EntityAction, EntityFeature } from './entitySheet';

// ─── Item-specific Action / Feature sub-types ─────────────────────────────────
// These are simpler than the full EntitySheet variants (no formula engine needed).

export interface ItemAction {
  id: string;
  name: string;
  description: string;
  /** Optional formula expression (STEP-009 engine). */
  formula?: string;
}

export interface ItemFeature {
  id: string;
  name: string;
  description: string;
}

// ─── Illumination Preset ──────────────────────────────────────────────────────

/**
 * A named illumination preset that can be attached to a CanvasItem.
 * When an item is picked up, this preset is copied into the carrying token's
 * illuminationSources array, granting the token its light properties.
 */
export interface IlluminationPreset {
  /** Human-readable name shown in the item sheet (e.g. "Torch (20ft)"). */
  name: string;
  range: number;               // Grid units
  brightZone: number;          // 0–1, end of bright zone as % of range
  brightIntensity: number;     // 0–1
  dimIntensity: number;        // 0–1
  color: string;               // Hex color for tint
  colorEnabled: boolean;
  colorIntensity: number;      // 0–1
  softEdge: boolean;
  softEdgeRadius: number;
  animation: IlluminationSource['animation'];
  animationSpeed: number;
  animationIntensity: number;
}

// ─── CanvasItem ───────────────────────────────────────────────────────────────

export interface CanvasItem {
  id: string;
  name: string;
  description?: string;

  /** Map this item belongs to (matches mapStore.selectedMapId). */
  mapId: string;

  position: { x: number; y: number };

  // ── Rendering ──────────────────────────────────────────────────────────────
  imageHash?: string;          // Sprite/icon hash (resolved from indexedDB)
  imageUrl?: string;           // Resolved locally; NOT synced via Jazz
  scale: number;               // Default 1.0
  rotation?: number;           // Degrees
  renderOrder?: number;        // Z-order (higher = front)

  // ── Illumination ───────────────────────────────────────────────────────────
  /** If set, this item emits light when placed on the map. */
  illuminationPreset?: IlluminationPreset;
  /** Active IlluminationSource id in illuminationStore (populated when item is on map). */
  illuminationSourceId?: string;

  // ── Item data ──────────────────────────────────────────────────────────────
  material?: string;           // e.g. "Iron", "Oak", "Enchanted Crystal"
  /** Durability 0–100; null/undefined = indestructible. */
  durability?: number;
  resistances?: string[];      // e.g. ["fire", "physical"]
  actions?: ItemAction[];
  features?: ItemFeature[];

  // ── Container ──────────────────────────────────────────────────────────────
  isContainer: boolean;
  /** Child item IDs contained within this item. */
  inventory?: string[];
  maxCapacity?: number;

  // ── State ──────────────────────────────────────────────────────────────────
  isHidden: boolean;
  /** True when this item is carried by a token (hidden from map rendering). */
  isPickedUp: boolean;
  /** Token ID of the carrier (when isPickedUp = true). */
  carriedByTokenId?: string;

  // ── Selection (ephemeral, not synced) ─────────────────────────────────────
  selected?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a default empty CanvasItem at a given position on the current map. */
export function createCanvasItem(
  params: Pick<CanvasItem, 'name' | 'position' | 'mapId'> & Partial<CanvasItem>
): CanvasItem {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: params.name,
    description: params.description,
    mapId: params.mapId,
    position: params.position,
    imageHash: params.imageHash,
    imageUrl: params.imageUrl,
    scale: params.scale ?? 1.0,
    rotation: params.rotation,
    renderOrder: params.renderOrder ?? 100,
    illuminationPreset: params.illuminationPreset,
    material: params.material,
    durability: params.durability,
    resistances: params.resistances,
    actions: params.actions ?? [],
    features: params.features ?? [],
    isContainer: params.isContainer ?? false,
    inventory: params.inventory,
    maxCapacity: params.maxCapacity,
    isHidden: params.isHidden ?? false,
    isPickedUp: params.isPickedUp ?? false,
    carriedByTokenId: params.carriedByTokenId,
  };
}

/** Convert a CanvasItem's illuminationPreset into an IlluminationSource for placement on the map. */
export function presetToIlluminationSource(
  item: CanvasItem
): Omit<IlluminationSource, 'id'> | null {
  const p = item.illuminationPreset;
  if (!p) return null;
  return {
    name: p.name,
    enabled: !item.isPickedUp && !item.isHidden,
    position: item.position,
    range: p.range,
    brightZone: p.brightZone,
    brightIntensity: p.brightIntensity,
    dimIntensity: p.dimIntensity,
    color: p.color,
    colorEnabled: p.colorEnabled,
    colorIntensity: p.colorIntensity,
    softEdge: p.softEdge,
    softEdgeRadius: p.softEdgeRadius,
    animation: p.animation,
    animationSpeed: p.animationSpeed,
    animationIntensity: p.animationIntensity,
    mapId: item.mapId,
  };
}
