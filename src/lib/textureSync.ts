/**
 * Texture Synchronization Service
 * 
 * NOTE: The old Socket.IO-based texture sync has been removed.
 * Network texture sync will be re-implemented via the WebSocket JSON protocol.
 * This module retains the local caching API so existing consumers still compile.
 */

import { compressTexture, updateTextureMaxSize, type CompressionResult } from './textureCompression';
import { hashImageData } from './textureStorage';

// Local texture lookup (hash -> dataUrl) - populated from IndexedDB
const localTextureCache = new Map<string, string>();

/**
 * Upload a texture (currently local-only; network sync TODO via new protocol)
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
 * Request a texture – returns from local cache or null
 */
export async function requestTexture(hash: string): Promise<string | null> {
  return localTextureCache.get(hash) ?? null;
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
