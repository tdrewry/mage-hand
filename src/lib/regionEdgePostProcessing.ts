/**
 * Region Edge Post-Processing Layer
 * Uses PixiJS to apply GPU-accelerated hatching effects to region edges
 */

import * as PIXI from 'pixi.js';
import { DysonHatchingFilter, DysonHatchingOptions, DEFAULT_HATCHING_OPTIONS } from './shaders/dysonHatchingFilter';
import { Z_INDEX } from './zIndex';
import type { CanvasRegion } from '../stores/regionStore';

export interface RegionEdgeConfig {
  width: number;
  height: number;
  resolution?: number;
}

let pixiApp: PIXI.Application | null = null;
let regionSprite: PIXI.Sprite | null = null;
let regionTexture: PIXI.Texture | null = null;
let hatchingFilter: DysonHatchingFilter | null = null;
let containerRef: HTMLElement | null = null;
let isInitialized = false;
let currentOptions: Required<DysonHatchingOptions> = { ...DEFAULT_HATCHING_OPTIONS };

// Canvas for rendering region mask
let regionMaskCanvas: HTMLCanvasElement | null = null;
let regionMaskCtx: CanvasRenderingContext2D | null = null;

// Cache key for avoiding redundant updates
let lastRegionsCacheKey: string = '';

/**
 * Initialize the region edge post-processing layer
 */
export async function initRegionEdgeProcessing(
  container: HTMLElement,
  config: RegionEdgeConfig
): Promise<boolean> {
  try {
    // Clean up any existing instance
    if (pixiApp) {
      await cleanupRegionEdgeProcessing();
    }

    // Create PixiJS application
    pixiApp = new PIXI.Application();

    await pixiApp.init({
      width: config.width,
      height: config.height,
      backgroundAlpha: 0,
      antialias: true,
      resolution: config.resolution ?? 1,
      autoDensity: true,
    });

    // Style the canvas for overlay positioning
    const canvas = pixiApp.canvas as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = `${config.width}px`;
    canvas.style.height = `${config.height}px`;
    canvas.style.pointerEvents = 'none';
    // Position above regions but below fog
    canvas.style.zIndex = String(Z_INDEX.CANVAS_ELEMENTS.REGIONS + 100);

    container.appendChild(canvas);
    containerRef = container;

    // Create hatching filter
    hatchingFilter = new DysonHatchingFilter(currentOptions);

    // Create container with filter
    const filterContainer = new PIXI.Container();
    filterContainer.filters = [hatchingFilter];
    pixiApp.stage.addChild(filterContainer);

    // Create sprite for region mask
    regionSprite = new PIXI.Sprite();
    regionSprite.width = config.width;
    regionSprite.height = config.height;
    filterContainer.addChild(regionSprite);

    // Create off-screen canvas for region mask
    regionMaskCanvas = document.createElement('canvas');
    regionMaskCanvas.width = config.width;
    regionMaskCanvas.height = config.height;
    regionMaskCtx = regionMaskCanvas.getContext('2d');

    isInitialized = true;
    console.log('✅ Region edge post-processing initialized');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize region edge processing:', error);
    return false;
  }
}

/**
 * Render regions to the mask canvas
 * The alpha channel defines the shape (inside vs outside)
 */
export function renderRegionMask(
  regions: CanvasRegion[],
  transform: { x: number; y: number; zoom: number }
): void {
  if (!regionMaskCtx || !regionMaskCanvas) return;

  const ctx = regionMaskCtx;
  const { x: offsetX, y: offsetY, zoom } = transform;

  // Clear canvas (fully transparent = outside)
  ctx.clearRect(0, 0, regionMaskCanvas.width, regionMaskCanvas.height);

  // Draw all visible regions as solid white (alpha = 1 means inside)
  ctx.fillStyle = 'white';

  for (const region of regions) {

    ctx.save();

    // Apply transform
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoom, zoom);

    if (region.pathPoints && region.pathPoints.length > 0) {
      // Path-based region
      const centerX = region.x + region.width / 2;
      const centerY = region.y + region.height / 2;

      if (region.rotation) {
        ctx.translate(centerX, centerY);
        ctx.rotate((region.rotation * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);
      }

      ctx.beginPath();

      if (region.bezierControlPoints && region.bezierControlPoints.length > 0) {
        // Bezier curve path
        ctx.moveTo(region.pathPoints[0].x, region.pathPoints[0].y);
        for (let i = 0; i < region.pathPoints.length; i++) {
          const nextIndex = (i + 1) % region.pathPoints.length;
          const cp = region.bezierControlPoints[i];
          ctx.bezierCurveTo(
            cp.cp1.x,
            cp.cp1.y,
            cp.cp2.x,
            cp.cp2.y,
            region.pathPoints[nextIndex].x,
            region.pathPoints[nextIndex].y
          );
        }
      } else {
        // Polygon path
        ctx.moveTo(region.pathPoints[0].x, region.pathPoints[0].y);
        for (let i = 1; i < region.pathPoints.length; i++) {
          ctx.lineTo(region.pathPoints[i].x, region.pathPoints[i].y);
        }
      }

      ctx.closePath();
      ctx.fill();
    } else {
      // Rectangle region
      if (region.rotation) {
        const centerX = region.x + region.width / 2;
        const centerY = region.y + region.height / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate((region.rotation * Math.PI) / 180);
        ctx.fillRect(-region.width / 2, -region.height / 2, region.width, region.height);
      } else {
        ctx.fillRect(region.x, region.y, region.width, region.height);
      }
    }

    ctx.restore();
  }
}

/**
 * Generate a cache key for regions to detect changes
 */
function generateRegionsCacheKey(
  regions: CanvasRegion[],
  transform: { x: number; y: number; zoom: number }
): string {
  const regionData = regions
    .map((r) => `${r.id}:${r.x}:${r.y}:${r.width}:${r.height}:${r.rotation || 0}`)
    .join('|');
  return `${regionData}:${transform.x.toFixed(1)}:${transform.y.toFixed(1)}:${transform.zoom.toFixed(3)}`;
}

/**
 * Update the region texture from regions data
 */
export function updateRegionTexture(
  regions: CanvasRegion[],
  transform: { x: number; y: number; zoom: number }
): boolean {
  if (!pixiApp || !regionSprite || !regionMaskCanvas || !isInitialized) return false;

  // Check if regions have changed
  const cacheKey = generateRegionsCacheKey(regions, transform);
  if (cacheKey === lastRegionsCacheKey) {
    return false; // No update needed
  }
  lastRegionsCacheKey = cacheKey;

  try {
    // Render regions to mask canvas
    renderRegionMask(regions, transform);

    // Update or create texture
    if (
      regionTexture &&
      regionTexture.source &&
      regionTexture.source.width === regionMaskCanvas.width &&
      regionTexture.source.height === regionMaskCanvas.height
    ) {
      // Update existing texture in-place
      regionTexture.source.resource = regionMaskCanvas;
      regionTexture.source.update();
    } else {
      // Create new texture
      if (regionTexture) {
        regionTexture.destroy(true);
      }
      regionTexture = PIXI.Texture.from(regionMaskCanvas);
      regionSprite.texture = regionTexture;
    }

    return true;
  } catch (error) {
    console.error('Failed to update region texture:', error);
    return false;
  }
}

/**
 * Update hatching filter settings
 */
export function updateHatchingSettings(opts: Partial<DysonHatchingOptions>): void {
  currentOptions = { ...currentOptions, ...opts };

  if (hatchingFilter) {
    hatchingFilter.updateOptions(opts);
  }
}

/**
 * Get current hatching settings
 */
export function getHatchingSettings(): Required<DysonHatchingOptions> {
  return { ...currentOptions };
}

/**
 * Resize the region edge processing layer
 */
export function resizeRegionEdgeProcessing(width: number, height: number): void {
  if (!pixiApp || !isInitialized) return;

  pixiApp.renderer.resize(width, height);

  const canvas = pixiApp.canvas as HTMLCanvasElement;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  if (regionSprite) {
    regionSprite.width = width;
    regionSprite.height = height;
  }

  if (regionMaskCanvas) {
    regionMaskCanvas.width = width;
    regionMaskCanvas.height = height;
  }

  // Invalidate cache to force re-render
  lastRegionsCacheKey = '';
}

/**
 * Show/hide the region edge processing layer
 */
export function setRegionEdgeVisible(visible: boolean): void {
  if (!pixiApp || !isInitialized) return;

  const canvas = pixiApp.canvas as HTMLCanvasElement;
  canvas.style.display = visible ? 'block' : 'none';
}

/**
 * Check if region edge processing is ready
 */
export function isRegionEdgeReady(): boolean {
  return isInitialized && pixiApp !== null;
}

/**
 * Render one frame of region edge effects
 */
export function renderRegionEdges(): void {
  if (!pixiApp || !isInitialized) return;
  pixiApp.render();
}

/**
 * Clean up the region edge processing layer
 */
export async function cleanupRegionEdgeProcessing(): Promise<void> {
  try {
    if (regionTexture) {
      regionTexture.destroy(true);
      regionTexture = null;
    }

    if (hatchingFilter) {
      hatchingFilter.destroy();
      hatchingFilter = null;
    }

    if (regionSprite) {
      regionSprite.destroy();
      regionSprite = null;
    }

    if (pixiApp) {
      const canvas = pixiApp.canvas as HTMLCanvasElement;
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      pixiApp.destroy(true, { children: true, texture: true });
      pixiApp = null;
    }

    regionMaskCanvas = null;
    regionMaskCtx = null;
    containerRef = null;
    isInitialized = false;
    lastRegionsCacheKey = '';

    console.log('🧹 Region edge post-processing cleaned up');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}
