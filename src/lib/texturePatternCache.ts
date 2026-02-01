/**
 * Texture Pattern Cache
 * 
 * Caches CanvasPattern objects to avoid expensive pattern recreation on every frame.
 * This is critical for performance when many textured regions are displayed.
 */

import { animatedTextureManager } from './animatedTextureManager';

export interface CachedPattern {
  pattern: CanvasPattern;
  patternCanvas: HTMLCanvasElement;
  timestamp: number;
  imageUrl: string;
  scale: number;
  repeat: string;
}

export interface PatternCacheStats {
  patternCount: number;
  canvasCount: number;
  hitCount: number;
  missCount: number;
}

export class TexturePatternCache {
  private patterns: Map<string, CachedPattern> = new Map();
  private canvasPool: HTMLCanvasElement[] = [];
  private maxPoolSize = 20;
  private maxPatterns = 100;
  private maxAge = 5 * 60 * 1000; // 5 minutes
  
  // Statistics for monitoring
  private hitCount = 0;
  private missCount = 0;

  /**
   * Generate cache key from pattern parameters
   */
  private getCacheKey(imageUrl: string, scale: number, repeat: string): string {
    // Use a hash of the imageUrl for shorter keys (first 32 chars of data URL are sufficient)
    const urlKey = imageUrl.length > 100 
      ? imageUrl.substring(0, 100) + '_' + imageUrl.length 
      : imageUrl;
    return `${urlKey}_${scale.toFixed(3)}_${repeat}`;
  }

  /**
   * Borrow a canvas from the pool or create a new one
   */
  private borrowCanvas(width: number, height: number): HTMLCanvasElement {
    let canvas = this.canvasPool.pop();
    
    if (!canvas) {
      canvas = document.createElement('canvas');
    }
    
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    
    return canvas;
  }

  /**
   * Return a canvas to the pool for reuse
   */
  private returnCanvas(canvas: HTMLCanvasElement): void {
    if (this.canvasPool.length < this.maxPoolSize) {
      // Clear the canvas before pooling
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      this.canvasPool.push(canvas);
    }
  }

  /**
   * Get or create a cached pattern for the given image and parameters
   */
  getPattern(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    imageUrl: string,
    scale: number,
    repeat: string
  ): CanvasPattern | null {
    const cacheKey = this.getCacheKey(imageUrl, scale, repeat);
    
    // Check cache first
    const cached = this.patterns.get(cacheKey);
    if (cached) {
      cached.timestamp = Date.now(); // Update LRU timestamp
      this.hitCount++;
      return cached.pattern;
    }
    
    this.missCount++;
    
    // Create new pattern
    const scaledWidth = Math.max(1, img.naturalWidth * scale);
    const scaledHeight = Math.max(1, img.naturalHeight * scale);
    
    const patternCanvas = this.borrowCanvas(scaledWidth, scaledHeight);
    const patternCtx = patternCanvas.getContext('2d');
    
    if (!patternCtx) {
      this.returnCanvas(patternCanvas);
      return null;
    }
    
    patternCtx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
    const pattern = ctx.createPattern(patternCanvas, repeat);
    
    if (!pattern) {
      this.returnCanvas(patternCanvas);
      return null;
    }
    
    // Cache the pattern
    this.patterns.set(cacheKey, {
      pattern,
      patternCanvas,
      timestamp: Date.now(),
      imageUrl,
      scale,
      repeat
    });
    
    // Cleanup if over limit
    this.cleanup();
    
    return pattern;
  }

  /**
   * Invalidate patterns for a specific image URL
   */
  invalidateImage(imageUrl: string): void {
    const keysToDelete: string[] = [];
    
    this.patterns.forEach((cached, key) => {
      if (cached.imageUrl === imageUrl) {
        keysToDelete.push(key);
        this.returnCanvas(cached.patternCanvas);
      }
    });
    
    keysToDelete.forEach(key => this.patterns.delete(key));
  }

  /**
   * Invalidate all patterns (e.g., when context is lost)
   */
  invalidateAll(): void {
    this.patterns.forEach(cached => {
      this.returnCanvas(cached.patternCanvas);
    });
    this.patterns.clear();
  }

  /**
   * Remove old or excess patterns
   */
  private cleanup(): void {
    const now = Date.now();
    
    // Remove old patterns
    const keysToDelete: string[] = [];
    this.patterns.forEach((cached, key) => {
      if (now - cached.timestamp > this.maxAge) {
        keysToDelete.push(key);
        this.returnCanvas(cached.patternCanvas);
      }
    });
    keysToDelete.forEach(key => this.patterns.delete(key));
    
    // If still over limit, remove least recently used
    if (this.patterns.size > this.maxPatterns) {
      const sorted = Array.from(this.patterns.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = sorted.slice(0, this.patterns.size - this.maxPatterns);
      toRemove.forEach(([key, cached]) => {
        this.returnCanvas(cached.patternCanvas);
        this.patterns.delete(key);
      });
    }
  }

  /**
   * Get cache statistics for debugging
   */
  getStats(): PatternCacheStats {
    return {
      patternCount: this.patterns.size,
      canvasCount: this.canvasPool.length,
      hitCount: this.hitCount,
      missCount: this.missCount
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Check if an image URL should bypass pattern caching (e.g., animated GIFs)
   * Animated textures need fresh draws each frame, so pattern caching is counterproductive.
   */
  shouldBypassCache(imageUrl: string): boolean {
    return animatedTextureManager.isAnimated(imageUrl);
  }
}

// Singleton instance for global use
export const texturePatternCache = new TexturePatternCache();
