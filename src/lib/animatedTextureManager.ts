/**
 * Animated Texture Manager
 * 
 * Manages animated GIF textures for canvas rendering.
 * Uses the WebCodecs ImageDecoder API to decode GIF frames and provides
 * the current frame based on timing for smooth animation playback.
 * 
 * Key features:
 * - Lazy loading: Only decodes when first requested
 * - Frame timing: Respects each frame's duration for proper playback
 * - Memory efficient: Limits max frames and resolution
 * - Fallback: Returns null for static images or unsupported browsers
 */

interface AnimatedTexture {
  frames: ImageBitmap[];
  frameDurations: number[];  // Duration of each frame in ms
  totalDuration: number;
  currentFrameIndex: number;
  startTime: number;
}

interface PendingLoad {
  promise: Promise<AnimatedTexture | null>;
  resolve: (value: AnimatedTexture | null) => void;
  reject: (reason?: Error) => void;
}

// Configuration limits
const MAX_FRAMES = 100;
const MAX_DIMENSION = 512; // Max width/height for animated textures
const DEFAULT_FRAME_DURATION = 100; // ms, used when GIF doesn't specify

class AnimatedTextureManager {
  private textures: Map<string, AnimatedTexture | null> = new Map();
  private pending: Map<string, PendingLoad> = new Map();
  private urlsChecked: Set<string> = new Set(); // URLs we've checked for animation
  
  // Track which URLs are definitely not animated (static images)
  private staticUrls: Set<string> = new Set();

  /**
   * Check if the browser supports ImageDecoder API
   */
  private isSupported(): boolean {
    return typeof ImageDecoder !== 'undefined';
  }

  /**
   * Check if a data URL is a GIF by looking at the header
   */
  private isGifDataUrl(url: string): boolean {
    // Check for data:image/gif prefix
    if (url.startsWith('data:image/gif')) return true;
    
    // Check for GIF magic bytes in base64: R0lGOD (GIF87a/GIF89a)
    if (url.startsWith('data:')) {
      const base64Start = url.indexOf(',') + 1;
      const base64Data = url.substring(base64Start, base64Start + 10);
      return base64Data.startsWith('R0lGOD');
    }
    
    // Check file extension for regular URLs
    const urlLower = url.toLowerCase();
    return urlLower.includes('.gif') || urlLower.includes('image/gif');
  }

  /**
   * Convert data URL to ArrayBuffer for ImageDecoder
   */
  private async dataUrlToArrayBuffer(dataUrl: string): Promise<ArrayBuffer> {
    const response = await fetch(dataUrl);
    return response.arrayBuffer();
  }

  /**
   * Load and decode an animated texture
   */
  async loadAnimatedTexture(url: string): Promise<AnimatedTexture | null> {
    // Already loaded
    if (this.textures.has(url)) {
      return this.textures.get(url) || null;
    }

    // Already determined to be static
    if (this.staticUrls.has(url)) {
      return null;
    }

    // Check if already loading
    const pending = this.pending.get(url);
    if (pending) {
      return pending.promise;
    }

    // Quick check: not a GIF
    if (!this.isGifDataUrl(url)) {
      this.staticUrls.add(url);
      return null;
    }

    // Check browser support
    if (!this.isSupported()) {
      console.warn('ImageDecoder API not supported - animated textures will be static');
      this.staticUrls.add(url);
      return null;
    }

    // Create pending promise
    let resolvePromise: (value: AnimatedTexture | null) => void;
    let rejectPromise: (reason?: Error) => void;
    
    const promise = new Promise<AnimatedTexture | null>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    this.pending.set(url, {
      promise,
      resolve: resolvePromise!,
      reject: rejectPromise!,
    });

    try {
      const result = await this.decodeGif(url);
      this.textures.set(url, result);
      this.pending.get(url)?.resolve(result);
      this.pending.delete(url);
      this.urlsChecked.add(url);
      
      if (!result) {
        this.staticUrls.add(url);
      }
      
      return result;
    } catch (error) {
      console.error('Failed to decode animated texture:', error);
      this.textures.set(url, null);
      this.staticUrls.add(url);
      this.pending.get(url)?.resolve(null);
      this.pending.delete(url);
      return null;
    }
  }

  /**
   * Decode a GIF using ImageDecoder API
   */
  private async decodeGif(url: string): Promise<AnimatedTexture | null> {
    try {
      const data = await this.dataUrlToArrayBuffer(url);
      
      const decoder = new ImageDecoder({
        data,
        type: 'image/gif',
      });

      await decoder.decode({ frameIndex: 0 }); // Wait for initial decode
      
      const trackInfo = decoder.tracks.selectedTrack;
      if (!trackInfo || trackInfo.frameCount <= 1) {
        // Single frame = not animated
        decoder.close();
        return null;
      }

      const frameCount = Math.min(trackInfo.frameCount, MAX_FRAMES);
      const frames: ImageBitmap[] = [];
      const frameDurations: number[] = [];
      let totalDuration = 0;

      // Decode all frames
      for (let i = 0; i < frameCount; i++) {
        try {
          const result = await decoder.decode({ frameIndex: i });
          const videoFrame = result.image;
          
          // Convert VideoFrame to ImageBitmap
          // VideoFrame has displayWidth/displayHeight, not width/height
          const frameWidth = videoFrame.displayWidth;
          const frameHeight = videoFrame.displayHeight;
          
          // Get frame duration BEFORE closing the VideoFrame
          // VideoFrame.duration is in microseconds
          const duration = videoFrame.duration 
            ? videoFrame.duration / 1000 
            : DEFAULT_FRAME_DURATION;
          
          // Scale down if too large
          let scaledWidth = frameWidth;
          let scaledHeight = frameHeight;
          
          if (frameWidth > MAX_DIMENSION || frameHeight > MAX_DIMENSION) {
            const scale = Math.min(MAX_DIMENSION / frameWidth, MAX_DIMENSION / frameHeight);
            scaledWidth = Math.floor(frameWidth * scale);
            scaledHeight = Math.floor(frameHeight * scale);
          }
          
          // Create ImageBitmap from VideoFrame
          const bitmap = await createImageBitmap(videoFrame, {
            resizeWidth: scaledWidth,
            resizeHeight: scaledHeight,
            resizeQuality: 'medium',
          });
          
          // Close the VideoFrame to free memory
          videoFrame.close();
          
          frames.push(bitmap);
          frameDurations.push(Math.max(duration, 20)); // Minimum 20ms
          totalDuration += frameDurations[i];
        } catch (frameError) {
          console.warn(`Failed to decode frame ${i}:`, frameError);
          break;
        }
      }

      decoder.close();

      if (frames.length <= 1) {
        // Clean up if we only got one frame
        frames.forEach(f => f.close());
        return null;
      }

      return {
        frames,
        frameDurations,
        totalDuration,
        currentFrameIndex: 0,
        startTime: performance.now(),
      };
    } catch (error) {
      console.error('GIF decode error:', error);
      return null;
    }
  }

  /**
   * Get the current frame for an animated texture based on elapsed time.
   * Returns null if not animated or not loaded yet.
   */
  getCurrentFrame(url: string): ImageBitmap | null {
    const texture = this.textures.get(url);
    if (!texture) {
      // Try to start loading if we haven't checked this URL yet
      if (!this.urlsChecked.has(url) && !this.staticUrls.has(url) && !this.pending.has(url)) {
        this.loadAnimatedTexture(url);
      }
      return null;
    }

    if (texture.frames.length === 0) return null;

    // Calculate which frame to show based on elapsed time
    const elapsed = performance.now() - texture.startTime;
    const loopedTime = elapsed % texture.totalDuration;
    
    let accumulatedTime = 0;
    let frameIndex = 0;
    
    for (let i = 0; i < texture.frameDurations.length; i++) {
      accumulatedTime += texture.frameDurations[i];
      if (loopedTime < accumulatedTime) {
        frameIndex = i;
        break;
      }
    }

    texture.currentFrameIndex = frameIndex;
    return texture.frames[frameIndex];
  }

  /**
   * Check if a URL is an animated texture.
   * Note: Only reliable after the texture has been loaded.
   */
  isAnimated(url: string): boolean {
    // If we've determined it's static, return false
    if (this.staticUrls.has(url)) return false;
    
    // If we've loaded it and it has frames, it's animated
    const texture = this.textures.get(url);
    if (texture && texture.frames.length > 1) return true;
    
    // If pending or not checked yet, we can't be sure
    // But we can do a quick sync check based on URL
    if (!this.urlsChecked.has(url) && this.isGifDataUrl(url)) {
      // It's a GIF, might be animated - start loading to find out
      if (!this.pending.has(url)) {
        this.loadAnimatedTexture(url);
      }
      return true; // Assume animated until proven otherwise
    }
    
    return false;
  }

  /**
   * Check if a URL might be animated (quick sync check without loading)
   */
  mightBeAnimated(url: string): boolean {
    if (this.staticUrls.has(url)) return false;
    return this.isGifDataUrl(url);
  }

  /**
   * Preload an animated texture without blocking
   */
  preload(url: string): void {
    if (!this.textures.has(url) && !this.pending.has(url) && !this.staticUrls.has(url)) {
      this.loadAnimatedTexture(url);
    }
  }

  /**
   * Remove a texture from cache (e.g., when token/region is deleted)
   */
  unload(url: string): void {
    const texture = this.textures.get(url);
    if (texture) {
      texture.frames.forEach(frame => frame.close());
      this.textures.delete(url);
    }
    this.pending.delete(url);
    this.urlsChecked.delete(url);
    this.staticUrls.delete(url);
  }

  /**
   * Clear all cached textures
   */
  clear(): void {
    this.textures.forEach(texture => {
      if (texture) {
        texture.frames.forEach(frame => frame.close());
      }
    });
    this.textures.clear();
    this.pending.clear();
    this.urlsChecked.clear();
    this.staticUrls.clear();
  }

  /**
   * Get statistics for debugging
   */
  getStats(): {
    animatedCount: number;
    staticCount: number;
    pendingCount: number;
    totalFrames: number;
  } {
    let totalFrames = 0;
    this.textures.forEach(texture => {
      if (texture) {
        totalFrames += texture.frames.length;
      }
    });

    return {
      animatedCount: this.textures.size,
      staticCount: this.staticUrls.size,
      pendingCount: this.pending.size,
      totalFrames,
    };
  }
}

// Singleton instance
export const animatedTextureManager = new AnimatedTextureManager();
