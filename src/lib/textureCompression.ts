/**
 * Texture Compression Utility
 * Resizes images based on their usage size to reduce bandwidth and storage
 */

// Maximum dimension for any texture (prevent extremely large uploads)
const MAX_TEXTURE_DIMENSION = 2048;

// Minimum dimension (don't compress below this)
const MIN_TEXTURE_DIMENSION = 64;

// Quality for JPEG compression (0-1)
const JPEG_QUALITY = 0.85;

// Track the maximum size each texture hash has been used at
const textureMaxSizes = new Map<string, { width: number; height: number }>();

export interface CompressionResult {
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  compressionRatio: number;
}

/**
 * Load an image from a data URL or URL
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/**
 * Calculate target dimensions based on usage size
 * Adds some padding to allow for minor scaling without quality loss
 */
function calculateTargetDimensions(
  originalWidth: number,
  originalHeight: number,
  usageWidth: number,
  usageHeight: number
): { width: number; height: number } {
  // Add 50% padding to usage size for flexibility
  const targetWidth = Math.ceil(usageWidth * 1.5);
  const targetHeight = Math.ceil(usageHeight * 1.5);
  
  // Don't upscale - use original size if smaller
  let width = Math.min(originalWidth, targetWidth);
  let height = Math.min(originalHeight, targetHeight);
  
  // Apply max dimension limit
  if (width > MAX_TEXTURE_DIMENSION || height > MAX_TEXTURE_DIMENSION) {
    const scale = MAX_TEXTURE_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  
  // Apply minimum dimension
  width = Math.max(width, MIN_TEXTURE_DIMENSION);
  height = Math.max(height, MIN_TEXTURE_DIMENSION);
  
  // Maintain aspect ratio
  const originalAspect = originalWidth / originalHeight;
  if (width / height > originalAspect) {
    width = Math.round(height * originalAspect);
  } else {
    height = Math.round(width / originalAspect);
  }
  
  return { width, height };
}

/**
 * Compress a texture based on its usage dimensions
 */
export async function compressTexture(
  dataUrl: string,
  usageWidth: number,
  usageHeight: number
): Promise<CompressionResult> {
  const originalSize = dataUrl.length;
  
  try {
    const img = await loadImage(dataUrl);
    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;
    
    // Calculate target dimensions
    const { width, height } = calculateTargetDimensions(
      originalWidth,
      originalHeight,
      usageWidth,
      usageHeight
    );
    
    // Skip compression if already at or below target size
    if (originalWidth <= width && originalHeight <= height) {
      return {
        dataUrl,
        originalSize,
        compressedSize: originalSize,
        width: originalWidth,
        height: originalHeight,
        compressionRatio: 1
      };
    }
    
    // Create canvas for resizing
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    
    // Use high-quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw resized image
    ctx.drawImage(img, 0, 0, width, height);
    
    // Determine output format based on whether image has transparency
    const hasTransparency = detectTransparency(ctx, width, height);
    const outputFormat = hasTransparency ? 'image/png' : 'image/jpeg';
    const quality = hasTransparency ? 1.0 : JPEG_QUALITY;
    
    const compressedDataUrl = canvas.toDataURL(outputFormat, quality);
    const compressedSize = compressedDataUrl.length;
    
    // Only use compressed version if it's actually smaller
    if (compressedSize >= originalSize) {
      return {
        dataUrl,
        originalSize,
        compressedSize: originalSize,
        width: originalWidth,
        height: originalHeight,
        compressionRatio: 1
      };
    }
    
    return {
      dataUrl: compressedDataUrl,
      originalSize,
      compressedSize,
      width,
      height,
      compressionRatio: originalSize / compressedSize
    };
  } catch (error) {
    console.error('Failed to compress texture:', error);
    // Return original on error
    return {
      dataUrl,
      originalSize,
      compressedSize: originalSize,
      width: 0,
      height: 0,
      compressionRatio: 1
    };
  }
}

/**
 * Detect if image has any transparent pixels
 */
function detectTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  // Sample a subset of pixels for performance
  const sampleSize = Math.min(1000, width * height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const step = Math.max(1, Math.floor(data.length / 4 / sampleSize));
  
  for (let i = 3; i < data.length; i += 4 * step) {
    if (data[i] < 255) {
      return true;
    }
  }
  return false;
}

/**
 * Update the maximum size tracking for a texture
 * Returns true if the size increased (may need re-upload)
 */
export function updateTextureMaxSize(
  hash: string,
  usageWidth: number,
  usageHeight: number
): boolean {
  const existing = textureMaxSizes.get(hash);
  
  if (!existing) {
    textureMaxSizes.set(hash, { width: usageWidth, height: usageHeight });
    return false;
  }
  
  const newMaxWidth = Math.max(existing.width, usageWidth);
  const newMaxHeight = Math.max(existing.height, usageHeight);
  
  if (newMaxWidth > existing.width || newMaxHeight > existing.height) {
    textureMaxSizes.set(hash, { width: newMaxWidth, height: newMaxHeight });
    return true;
  }
  
  return false;
}

/**
 * Get the maximum size a texture has been used at
 */
export function getTextureMaxSize(hash: string): { width: number; height: number } | null {
  return textureMaxSizes.get(hash) || null;
}

/**
 * Clear size tracking for a texture
 */
export function clearTextureMaxSize(hash: string): void {
  textureMaxSizes.delete(hash);
}

/**
 * Get compression statistics
 */
export function getCompressionStats(): {
  trackedTextures: number;
  totalMaxWidth: number;
  totalMaxHeight: number;
} {
  let totalMaxWidth = 0;
  let totalMaxHeight = 0;
  
  textureMaxSizes.forEach(size => {
    totalMaxWidth += size.width;
    totalMaxHeight += size.height;
  });
  
  return {
    trackedTextures: textureMaxSizes.size,
    totalMaxWidth,
    totalMaxHeight
  };
}
