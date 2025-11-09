/**
 * Render Optimization System
 * 
 * Provides advanced rendering optimizations including:
 * - Dirty region tracking to minimize redraws
 * - Object pooling for frequently created/destroyed objects
 * - Canvas layering for different element types
 * - Viewport culling for performance
 */

import { Token } from '../stores/sessionStore';
import { CanvasRegion } from '../stores/regionStore';
import { TokenGroup } from './groupTransforms';

export interface DirtyRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  timestamp: number;
}

export interface RenderLayer {
  id: string;
  name: string;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  zIndex: number;
  visible: boolean;
  dirty: boolean;
}

export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderCache {
  tokens: Map<string, ImageBitmap | HTMLImageElement>;
  regions: Map<string, Path2D>;
  grids: Map<string, ImageData>;
  lastUsed: Map<string, number>;
}

export interface ObjectPool<T> {
  create: () => T;
  reset: (obj: T) => void;
  available: T[];
  active: Set<T>;
}

// Dirty region manager for optimized redraws
export class DirtyRegionManager {
  private regions: DirtyRegion[] = [];
  private mergeThreshold = 50; // Merge regions closer than this distance
  private maxRegions = 10; // Maximum dirty regions before full redraw

  addRegion(x: number, y: number, width: number, height: number): void {
    const newRegion: DirtyRegion = {
      x: Math.floor(x),
      y: Math.floor(y),
      width: Math.ceil(width),
      height: Math.ceil(height),
      timestamp: Date.now()
    };

    // Try to merge with existing regions
    let merged = false;
    for (let i = 0; i < this.regions.length; i++) {
      if (this.canMergeRegions(this.regions[i], newRegion)) {
        this.regions[i] = this.mergeRegions(this.regions[i], newRegion);
        merged = true;
        break;
      }
    }

    if (!merged) {
      this.regions.push(newRegion);
    }

    // If too many regions, merge all into one
    if (this.regions.length > this.maxRegions) {
      this.regions = [this.getBoundingRegion()];
    }
  }

  getDirtyRegions(): DirtyRegion[] {
    return [...this.regions];
  }

  clear(): void {
    this.regions = [];
  }

  private canMergeRegions(a: DirtyRegion, b: DirtyRegion): boolean {
    const distanceX = Math.abs((a.x + a.width / 2) - (b.x + b.width / 2));
    const distanceY = Math.abs((a.y + a.height / 2) - (b.y + b.height / 2));
    
    return distanceX < this.mergeThreshold && distanceY < this.mergeThreshold;
  }

  private mergeRegions(a: DirtyRegion, b: DirtyRegion): DirtyRegion {
    const minX = Math.min(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxX = Math.max(a.x + a.width, b.x + b.width);
    const maxY = Math.max(a.y + a.height, b.y + b.height);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      timestamp: Math.max(a.timestamp, b.timestamp)
    };
  }

  private getBoundingRegion(): DirtyRegion {
    if (this.regions.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0, timestamp: Date.now() };
    }

    const minX = Math.min(...this.regions.map(r => r.x));
    const minY = Math.min(...this.regions.map(r => r.y));
    const maxX = Math.max(...this.regions.map(r => r.x + r.width));
    const maxY = Math.max(...this.regions.map(r => r.y + r.height));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      timestamp: Date.now()
    };
  }
}

// Multi-layer canvas system
export class LayerManager {
  private layers: Map<string, RenderLayer> = new Map();
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.createDefaultLayers();
  }

  private createDefaultLayers(): void {
    const layerConfigs = [
      { id: 'background', name: 'Background', zIndex: 1 },
      { id: 'grid', name: 'Grid', zIndex: 2 },
      { id: 'regions', name: 'Regions', zIndex: 3 },
      { id: 'tokens', name: 'Tokens', zIndex: 4 },
      { id: 'effects', name: 'Effects', zIndex: 5 },
      { id: 'ui', name: 'UI Overlays', zIndex: 6 }
    ];

    layerConfigs.forEach(config => {
      this.createLayer(config.id, config.name, config.zIndex);
    });
  }

  createLayer(id: string, name: string, zIndex: number): RenderLayer {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Failed to create canvas context');
    }

    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = zIndex.toString();
    canvas.style.pointerEvents = 'none';

    this.container.appendChild(canvas);

    const layer: RenderLayer = {
      id,
      name,
      canvas,
      context,
      zIndex,
      visible: true,
      dirty: true
    };

    this.layers.set(id, layer);
    return layer;
  }

  getLayer(id: string): RenderLayer | undefined {
    return this.layers.get(id);
  }

  setLayerVisibility(id: string, visible: boolean): void {
    const layer = this.layers.get(id);
    if (layer) {
      layer.visible = visible;
      layer.canvas.style.display = visible ? 'block' : 'none';
    }
  }

  markLayerDirty(id: string): void {
    const layer = this.layers.get(id);
    if (layer) {
      layer.dirty = true;
    }
  }

  clearLayer(id: string): void {
    const layer = this.layers.get(id);
    if (layer) {
      layer.context.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      layer.dirty = false;
    }
  }

  resizeLayers(width: number, height: number): void {
    this.layers.forEach(layer => {
      layer.canvas.width = width;
      layer.canvas.height = height;
      layer.dirty = true;
    });
  }

  getDirtyLayers(): RenderLayer[] {
    return Array.from(this.layers.values()).filter(layer => layer.dirty);
  }
}

// Object pooling for performance
export function createObjectPool<T>(
  createFn: () => T,
  resetFn: (obj: T) => void,
  initialSize: number = 10
): ObjectPool<T> {
  const pool: ObjectPool<T> = {
    create: createFn,
    reset: resetFn,
    available: [],
    active: new Set()
  };

  // Pre-populate pool
  for (let i = 0; i < initialSize; i++) {
    pool.available.push(createFn());
  }

  return pool;
}

export function borrowFromPool<T>(pool: ObjectPool<T>): T {
  let obj = pool.available.pop();
  
  if (!obj) {
    obj = pool.create();
  }
  
  pool.active.add(obj);
  return obj;
}

export function returnToPool<T>(pool: ObjectPool<T>, obj: T): void {
  if (pool.active.has(obj)) {
    pool.active.delete(obj);
    pool.reset(obj);
    pool.available.push(obj);
  }
}

// Viewport culling for performance
export const isInViewport = (
  bounds: { x: number; y: number; width: number; height: number },
  viewport: ViewportBounds,
  margin: number = 100
): boolean => {
  return !(
    bounds.x + bounds.width < viewport.x - margin ||
    bounds.x > viewport.x + viewport.width + margin ||
    bounds.y + bounds.height < viewport.y - margin ||
    bounds.y > viewport.y + viewport.height + margin
  );
};

// Render cache management
export class RenderCacheManager {
  private cache: RenderCache = {
    tokens: new Map(),
    regions: new Map(),
    grids: new Map(),
    lastUsed: new Map()
  };
  private maxCacheSize = 100;
  private maxAge = 5 * 60 * 1000; // 5 minutes

  getTokenImage(tokenId: string): ImageBitmap | HTMLImageElement | undefined {
    this.markUsed(tokenId);
    return this.cache.tokens.get(tokenId);
  }

  setTokenImage(tokenId: string, image: ImageBitmap | HTMLImageElement): void {
    this.cache.tokens.set(tokenId, image);
    this.markUsed(tokenId);
    this.cleanup();
  }

  getRegionPath(regionId: string): Path2D | undefined {
    this.markUsed(regionId);
    return this.cache.regions.get(regionId);
  }

  setRegionPath(regionId: string, path: Path2D): void {
    this.cache.regions.set(regionId, path);
    this.markUsed(regionId);
    this.cleanup();
  }

  clear(): void {
    // Dispose of ImageBitmaps to free memory
    this.cache.tokens.forEach(image => {
      if (image instanceof ImageBitmap) {
        image.close();
      }
    });
    
    this.cache.tokens.clear();
    this.cache.regions.clear();
    this.cache.grids.clear();
    this.cache.lastUsed.clear();
  }

  private markUsed(id: string): void {
    this.cache.lastUsed.set(id, Date.now());
  }

  private cleanup(): void {
    const now = Date.now();
    const totalItems = this.cache.tokens.size + this.cache.regions.size + this.cache.grids.size;

    // Remove items that are too old
    this.cache.lastUsed.forEach((lastUsed, id) => {
      if (now - lastUsed > this.maxAge) {
        this.removeItem(id);
      }
    });

    // If still too many items, remove least recently used
    if (totalItems > this.maxCacheSize) {
      const sorted = Array.from(this.cache.lastUsed.entries())
        .sort((a, b) => a[1] - b[1]);

      const toRemove = sorted.slice(0, totalItems - this.maxCacheSize);
      toRemove.forEach(([id]) => this.removeItem(id));
    }
  }

  private removeItem(id: string): void {
    const tokenImage = this.cache.tokens.get(id);
    if (tokenImage instanceof ImageBitmap) {
      tokenImage.close();
    }
    
    this.cache.tokens.delete(id);
    this.cache.regions.delete(id);
    this.cache.grids.delete(id);
    this.cache.lastUsed.delete(id);
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private frameCount = 0;
  private lastTime = Date.now();
  private fps = 0;
  private renderTimes: number[] = [];

  startFrame(): number {
    return performance.now();
  }

  endFrame(startTime: number): void {
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    this.renderTimes.push(renderTime);
    if (this.renderTimes.length > 60) {
      this.renderTimes.shift();
    }

    this.frameCount++;
    const now = Date.now();
    
    if (now - this.lastTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastTime = now;
    }
  }

  getFPS(): number {
    return this.fps;
  }

  getAverageRenderTime(): number {
    if (this.renderTimes.length === 0) return 0;
    const sum = this.renderTimes.reduce((a, b) => a + b, 0);
    return sum / this.renderTimes.length;
  }

  getMaxRenderTime(): number {
    return this.renderTimes.length > 0 ? Math.max(...this.renderTimes) : 0;
  }

  shouldOptimize(): boolean {
    return this.fps < 30 || this.getAverageRenderTime() > 16; // 60fps target
  }
}