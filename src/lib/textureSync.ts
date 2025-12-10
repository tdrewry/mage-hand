/**
 * Texture Synchronization Service
 * Handles uploading and requesting textures over Socket.io for multiplayer sync
 */

import { patchTransport } from '@/lib/sync';
import { compressTexture, updateTextureMaxSize, type CompressionResult } from './textureCompression';
import { hashImageData } from './textureStorage';

// Pending texture requests to avoid duplicates
const pendingRequests = new Map<string, Promise<string | null>>();

// Local texture lookup (hash -> dataUrl) - populated from IndexedDB
const localTextureCache = new Map<string, string>();

// Track which hashes have been uploaded with their compression info
const uploadedTextures = new Map<string, { width: number; height: number; size: number }>();

/**
 * Upload a texture to the server for other clients to access
 * @param hash - The texture hash (before compression - identifies the original image)
 * @param dataUrl - The original image data URL
 * @param usageWidth - Width the texture will be displayed at
 * @param usageHeight - Height the texture will be displayed at
 */
export async function uploadTexture(
  hash: string, 
  dataUrl: string,
  usageWidth?: number,
  usageHeight?: number
): Promise<void> {
  const socket = patchTransport.getSocket();
  if (!socket) {
    console.warn('[TextureSync] No socket connection, skipping upload');
    return;
  }

  // Default usage size if not provided
  const width = usageWidth || 512;
  const height = usageHeight || 512;

  // Check if we need to re-upload at higher resolution
  const existingUpload = uploadedTextures.get(hash);
  const sizeIncreased = updateTextureMaxSize(hash, width, height);
  
  if (existingUpload && !sizeIncreased) {
    // Already uploaded at sufficient resolution
    console.log(`[TextureSync] Texture ${hash} already uploaded at sufficient resolution`);
    return;
  }

  // Compress based on usage size
  let uploadData = dataUrl;
  let compressionResult: CompressionResult | null = null;
  
  try {
    compressionResult = await compressTexture(dataUrl, width, height);
    uploadData = compressionResult.dataUrl;
    
    if (compressionResult.compressionRatio > 1) {
      console.log(
        `[TextureSync] Compressed texture: ${(compressionResult.originalSize / 1024).toFixed(1)}KB → ${(compressionResult.compressedSize / 1024).toFixed(1)}KB ` +
        `(${compressionResult.compressionRatio.toFixed(1)}x, ${compressionResult.width}x${compressionResult.height})`
      );
    }
  } catch (error) {
    console.warn('[TextureSync] Compression failed, using original:', error);
  }

  // Cache locally (original for local rendering)
  localTextureCache.set(hash, dataUrl);

  // Send compressed version to server
  socket.emit('texture:upload', {
    hash,
    dataUrl: uploadData,
    size: uploadData.length,
    timestamp: Date.now(),
    dimensions: compressionResult ? { width: compressionResult.width, height: compressionResult.height } : undefined
  });

  // Track upload
  uploadedTextures.set(hash, {
    width: compressionResult?.width || width,
    height: compressionResult?.height || height,
    size: uploadData.length
  });

  console.log(`[TextureSync] Uploaded texture: ${hash} (${(uploadData.length / 1024).toFixed(1)}KB)`);
}

/**
 * Request a texture from the server by its hash
 * Returns the dataUrl if found, null otherwise
 */
export async function requestTexture(hash: string): Promise<string | null> {
  // Check local cache first
  if (localTextureCache.has(hash)) {
    return localTextureCache.get(hash)!;
  }

  // Check if already requesting
  if (pendingRequests.has(hash)) {
    return pendingRequests.get(hash)!;
  }

  const socket = patchTransport.getSocket();
  if (!socket) {
    console.warn('[TextureSync] No socket connection, cannot request texture');
    return null;
  }

  // Create promise for this request
  const requestPromise = new Promise<string | null>((resolve) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(hash);
      resolve(null);
    }, 10000); // 10 second timeout

    // Listen for response
    const handleData = (data: { hash: string; dataUrl: string }) => {
      if (data.hash === hash) {
        clearTimeout(timeout);
        socket.off('texture:data', handleData);
        socket.off('texture:not_found', handleNotFound);
        pendingRequests.delete(hash);
        localTextureCache.set(hash, data.dataUrl);
        resolve(data.dataUrl);
      }
    };

    const handleNotFound = (data: { hash: string }) => {
      if (data.hash === hash) {
        clearTimeout(timeout);
        socket.off('texture:data', handleData);
        socket.off('texture:not_found', handleNotFound);
        pendingRequests.delete(hash);
        resolve(null);
      }
    };

    socket.on('texture:data', handleData);
    socket.on('texture:not_found', handleNotFound);

    // Send request
    socket.emit('texture:request', { hash });
  });

  pendingRequests.set(hash, requestPromise);
  console.log(`[TextureSync] Requesting texture: ${hash}`);
  return requestPromise;
}

/**
 * Check if a texture exists locally (in cache)
 */
export function hasLocalTexture(hash: string): boolean {
  return localTextureCache.has(hash);
}

/**
 * Add a texture to the local cache (when loaded from IndexedDB)
 */
export function cacheTexture(hash: string, dataUrl: string): void {
  localTextureCache.set(hash, dataUrl);
}

/**
 * Get a texture from local cache
 */
export function getCachedTexture(hash: string): string | undefined {
  return localTextureCache.get(hash);
}

/**
 * Remove a texture from local cache
 */
export function removeCachedTexture(hash: string): void {
  localTextureCache.delete(hash);
}

/**
 * Clear all cached textures
 */
export function clearTextureCache(): void {
  localTextureCache.clear();
}

/**
 * Initialize texture sync event listeners
 * Call this when socket connection is established
 */
export function initializeTextureSyncListeners(): void {
  const socket = patchTransport.getSocket();
  if (!socket) return;

  // Handle texture availability notifications (when another client uploads)
  socket.on('texture:available', (data: { hash: string; size: number; uploadedBy: string }) => {
    console.log(`[TextureSync] Texture available: ${data.hash} (${(data.size / 1024).toFixed(1)}KB) from ${data.uploadedBy}`);
    // We don't automatically download - textures are fetched on-demand when needed
  });
}

/**
 * Cleanup texture sync event listeners
 * Call this when socket disconnects
 */
export function cleanupTextureSyncListeners(): void {
  const socket = patchTransport.getSocket();
  if (!socket) return;

  socket.off('texture:available');
  socket.off('texture:data');
  socket.off('texture:not_found');
}
