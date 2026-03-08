/**
 * Texture Synchronization Service
 * 
 * Local caching API + Jazz FileStream fallback for network texture retrieval.
 */

import { compressTexture, updateTextureMaxSize, type CompressionResult } from './textureCompression';
import { hashImageData } from './textureStorage';

// Local texture lookup (hash -> dataUrl) - populated from IndexedDB
const localTextureCache = new Map<string, string>();

/**
 * Upload a texture (currently local-only; Jazz FileStream handles network sync)
 */
export async function uploadTexture(
  hash: string, 
  dataUrl: string,
  _usageWidth?: number,
  _usageHeight?: number
): Promise<void> {
  localTextureCache.set(hash, dataUrl);
}

/**
 * Request a texture – returns from local cache, or falls back to Jazz FileStream download
 */
export async function requestTexture(hash: string): Promise<string | null> {
  const cached = localTextureCache.get(hash);
  if (cached) return cached;
  
  // Fallback: try Jazz FileStream download
  try {
    const { requestTextureViaJazz } = await import('./jazz/textureSync');
    const dataUrl = await requestTextureViaJazz(hash);
    if (dataUrl) {
      localTextureCache.set(hash, dataUrl);
      return dataUrl;
    }
  } catch {
    // Jazz not available — return null
  }
  
  return null;
}

/** Check if a texture exists locally (in cache) */
export function hasLocalTexture(hash: string): boolean {
  return localTextureCache.has(hash);
}

/** Add a texture to the local cache (when loaded from IndexedDB) */
export function cacheTexture(hash: string, dataUrl: string): void {
  localTextureCache.set(hash, dataUrl);
}

/** Get a texture from local cache */
export function getCachedTexture(hash: string): string | undefined {
  return localTextureCache.get(hash);
}

/** Remove a texture from local cache */
export function removeCachedTexture(hash: string): void {
  localTextureCache.delete(hash);
}

/** Clear all cached textures */
export function clearTextureCache(): void {
  localTextureCache.clear();
}

/** No-op – will be re-implemented with new protocol */
export function initializeTextureSyncListeners(): void {}

/** No-op – will be re-implemented with new protocol */
export function cleanupTextureSyncListeners(): void {}
