/**
 * Unified Dexie-based texture storage with deduplication
 * 
 * Single service for ALL texture types: tokens, regions, effects, map objects.
 * Binary data is stored once by hash in the 'textures' object store.
 * Entity-specific mapping stores link entityId → hash for refCount management.
 */
import Dexie, { type Table } from 'dexie';

interface TextureEntry {
  hash: string;
  dataUrl: string;
  refCount: number;
  createdAt: number;
}

interface RegionMapping {
  regionId: string;
  textureHash: string;
}

interface TokenMapping {
  tokenId: string;
  textureHash: string;
}

export class TextureDatabase extends Dexie {
  textures!: Table<TextureEntry, string>;
  regionMappings!: Table<RegionMapping, string>;
  tokenMappings!: Table<TokenMapping, string>;

  constructor() {
    super('canvas-textures-db');
    this.version(2).stores({
      textures: 'hash',
      regionMappings: 'regionId',
      tokenMappings: 'tokenId'
    });
  }
}

export const db = new TextureDatabase();

// In-memory cache for loaded textures
const textureCache = new Map<string, string>();

// ══════════════════════════════════════════════════════════════════════════
// CORE: Hashing, DB, Helpers
// ══════════════════════════════════════════════════════════════════════════

/** Generate a fast hash for image data (for deduplication) */
export async function hashImageData(dataUrl: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(dataUrl);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

async function decrementTextureRef(hash: string): Promise<void> {
  await db.transaction('rw', db.textures, async () => {
    const texture = await db.textures.get(hash);
    if (texture) {
      if (texture.refCount <= 1) {
        await db.textures.delete(hash);
        textureCache.delete(hash);
      } else {
        await db.textures.update(hash, { refCount: texture.refCount - 1 });
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════
// HASH-LEVEL API (shared across all entity types)
// ══════════════════════════════════════════════════════════════════════════

/** Preload texture into cache (for rendering optimization) */
export function getCachedTexture(hash: string): string | undefined {
  return textureCache.get(hash);
}

export function isTextureCached(_entityId: string): boolean {
  return false;
}

/** Load a texture directly by its hash */
export async function loadTextureByHash(hash: string): Promise<string | null> {
  if (textureCache.has(hash)) {
    return textureCache.get(hash)!;
  }
  
  try {
    const texture = await db.textures.get(hash);
    if (texture) {
      textureCache.set(hash, texture.dataUrl);
      return texture.dataUrl;
    }
    return null;
  } catch (error) {
    console.error('Failed to load texture by hash:', error);
    return null;
  }
}

/** Save a texture directly by hash */
export async function saveTextureByHash(hash: string, dataUrl: string): Promise<void> {
  try {
    await db.transaction('rw', db.textures, async () => {
      const existing = await db.textures.get(hash);
      if (!existing) {
        await db.textures.put({
          hash,
          dataUrl,
          refCount: 0,
          createdAt: Date.now(),
        });
      }
      textureCache.set(hash, dataUrl);
    });
  } catch (error) {
    console.error('Failed to save texture by hash:', error);
  }
}

export async function saveVariantTexture(hash: string, dataUrl: string): Promise<void> {
  try {
    await db.transaction('rw', db.textures, async () => {
      const existing = await db.textures.get(hash);
      if (existing) {
        await db.textures.update(hash, { refCount: existing.refCount + 1 });
      } else {
        await db.textures.put({ hash, dataUrl, refCount: 1, createdAt: Date.now() });
      }
      textureCache.set(hash, dataUrl);
    });
  } catch (error) {
    console.error('Failed to save variant texture:', error);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// REGION TEXTURE API
// ══════════════════════════════════════════════════════════════════════════

export async function saveRegionTexture(regionId: string, dataUrl: string): Promise<string> {
  try {
    const hash = await hashImageData(dataUrl);
    await db.transaction('rw', db.textures, db.regionMappings, async () => {
      const existingTexture = await db.textures.get(hash);
      const oldMapping = await db.regionMappings.get(regionId);
      
      if (oldMapping && oldMapping.textureHash !== hash) {
        await decrementTextureRef(oldMapping.textureHash);
      }

      if (existingTexture) {
        if (!oldMapping || oldMapping.textureHash !== hash) {
          await db.textures.update(hash, { refCount: existingTexture.refCount + 1 });
        }
      } else {
        await db.textures.put({ hash, dataUrl, refCount: 1, createdAt: Date.now() });
      }

      await db.regionMappings.put({ regionId, textureHash: hash });
      textureCache.set(hash, dataUrl);
    });
    
    return hash;
  } catch (error) {
    console.error('Failed to save region texture:', error);
    throw error;
  }
}

export async function loadRegionTexture(regionId: string): Promise<string | null> {
  try {
    return await db.transaction('r', db.textures, db.regionMappings, async () => {
      const mapping = await db.regionMappings.get(regionId);
      if (!mapping) return null;
      if (textureCache.has(mapping.textureHash)) return textureCache.get(mapping.textureHash)!;
      
      const texture = await db.textures.get(mapping.textureHash);
      if (texture) {
        textureCache.set(texture.hash, texture.dataUrl);
        return texture.dataUrl;
      }
      return null;
    });
  } catch (error) {
    console.error('Failed to load region texture:', error);
    return null;
  }
}

export async function loadRegionTextures(regionIds: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  if (regionIds.length === 0) return results;

  try {
    await db.transaction('r', db.textures, db.regionMappings, async () => {
      const mappings = await db.regionMappings.where('regionId').anyOf(regionIds).toArray();
      const hashesToLoad = new Set<string>();
      
      mappings.forEach(mapping => {
        if (textureCache.has(mapping.textureHash)) {
          results.set(mapping.regionId, textureCache.get(mapping.textureHash)!);
        } else {
          hashesToLoad.add(mapping.textureHash);
        }
      });
      
      if (hashesToLoad.size > 0) {
        const textures = await db.textures.where('hash').anyOf(Array.from(hashesToLoad)).toArray();
        textures.forEach(texture => {
          textureCache.set(texture.hash, texture.dataUrl);
          
          mappings.filter(m => m.textureHash === texture.hash).forEach(mapping => {
            results.set(mapping.regionId, texture.dataUrl);
          });
        });
      }
    });
    return results;
  } catch (error) {
    console.error('Failed to batch load region textures:', error);
    return results;
  }
}

export async function removeRegionTexture(regionId: string): Promise<void> {
  try {
    await db.transaction('rw', db.textures, db.regionMappings, async () => {
      const mapping = await db.regionMappings.get(regionId);
      if (mapping) {
        await decrementTextureRef(mapping.textureHash);
        await db.regionMappings.delete(regionId);
      }
    });
  } catch (error) {
    console.error('Failed to remove region texture:', error);
  }
}

export async function getRegionTextureHash(regionId: string): Promise<string | null> {
  try {
    const mapping = await db.regionMappings.get(regionId);
    return mapping?.textureHash || null;
  } catch (error) {
    console.error('Failed to get region texture hash:', error);
    return null;
  }
}

export async function getAllRegionMappings(): Promise<Map<string, string>> {
  try {
    const mappings = await db.regionMappings.toArray();
    return new Map(mappings.map(m => [m.regionId, m.textureHash]));
  } catch (error) {
    console.error('Failed to get region mappings:', error);
    return new Map();
  }
}

export async function importTextures(
  textures: Record<string, string>,
  regionMappings: Record<string, string>
): Promise<void> {
  try {
    await db.transaction('rw', db.textures, db.regionMappings, async () => {
      for (const [hash, dataUrl] of Object.entries(textures)) {
        const existing = await db.textures.get(hash);
        if (!existing) {
          await db.textures.put({ hash, dataUrl, refCount: 0, createdAt: Date.now() });
        }
        textureCache.set(hash, dataUrl);
      }

      for (const [regionId, textureHash] of Object.entries(regionMappings)) {
        await db.regionMappings.put({ regionId, textureHash });
        const texture = await db.textures.get(textureHash);
        if (texture) {
          await db.textures.update(textureHash, { refCount: texture.refCount + 1 });
        }
      }
    });
  } catch (error) {
    console.error('Failed to import textures:', error);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// TOKEN TEXTURE API
// ══════════════════════════════════════════════════════════════════════════

export async function saveTokenTexture(tokenId: string, dataUrl: string): Promise<string> {
  try {
    const hash = await hashImageData(dataUrl);
    await db.transaction('rw', db.textures, db.tokenMappings, async () => {
      const existingTexture = await db.textures.get(hash);
      const oldMapping = await db.tokenMappings.get(tokenId);
      
      if (oldMapping && oldMapping.textureHash !== hash) {
        await decrementTextureRef(oldMapping.textureHash);
      }

      if (existingTexture) {
        if (!oldMapping || oldMapping.textureHash !== hash) {
          await db.textures.update(hash, { refCount: existingTexture.refCount + 1 });
        }
      } else {
        await db.textures.put({ hash, dataUrl, refCount: 1, createdAt: Date.now() });
      }

      await db.tokenMappings.put({ tokenId, textureHash: hash });
      textureCache.set(hash, dataUrl);
    });
    
    return hash;
  } catch (error) {
    console.error('Failed to save token texture:', error);
    throw error;
  }
}

export async function loadTokenTexture(tokenId: string): Promise<string | null> {
  try {
    return await db.transaction('r', db.textures, db.tokenMappings, async () => {
      const mapping = await db.tokenMappings.get(tokenId);
      if (!mapping) return null;
      if (textureCache.has(mapping.textureHash)) return textureCache.get(mapping.textureHash)!;
      
      const texture = await db.textures.get(mapping.textureHash);
      if (texture) {
        textureCache.set(texture.hash, texture.dataUrl);
        return texture.dataUrl;
      }
      return null;
    });
  } catch (error) {
    console.error('Failed to load token texture:', error);
    return null;
  }
}

export async function removeTokenTexture(tokenId: string): Promise<void> {
  try {
    await db.transaction('rw', db.textures, db.tokenMappings, async () => {
      const mapping = await db.tokenMappings.get(tokenId);
      if (mapping) {
        await decrementTextureRef(mapping.textureHash);
        await db.tokenMappings.delete(tokenId);
      }
    });
  } catch (error) {
    console.error('Failed to remove token texture:', error);
  }
}

export async function getAllTokenMappings(): Promise<Map<string, string>> {
  try {
    const mappings = await db.tokenMappings.toArray();
    return new Map(mappings.map(m => [m.tokenId, m.textureHash]));
  } catch (error) {
    console.error('Failed to get token mappings:', error);
    return new Map();
  }
}

export async function importTokenTextures(
  textures: Record<string, string>,
  tokenMappings: Record<string, string>
): Promise<void> {
  try {
    await db.transaction('rw', db.textures, db.tokenMappings, async () => {
      for (const [hash, dataUrl] of Object.entries(textures)) {
        const existing = await db.textures.get(hash);
        if (!existing) {
          await db.textures.put({ hash, dataUrl, refCount: 0, createdAt: Date.now() });
        }
        textureCache.set(hash, dataUrl);
      }

      for (const [tokenId, textureHash] of Object.entries(tokenMappings)) {
        await db.tokenMappings.put({ tokenId, textureHash });
        const texture = await db.textures.get(textureHash);
        if (texture) {
          await db.textures.update(textureHash, { refCount: texture.refCount + 1 });
        }
      }
    });
  } catch (error) {
    console.error('Failed to import token textures:', error);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// MANAGEMENT & STATS (unified across all entity types)
// ══════════════════════════════════════════════════════════════════════════

export async function clearAllTextures(): Promise<void> {
  try {
    await Promise.all([
      db.textures.clear(),
      db.regionMappings.clear(),
      db.tokenMappings.clear()
    ]);
    textureCache.clear();
  } catch (error) {
    console.error('Failed to clear textures:', error);
  }
}

export async function getTextureStorageStats(): Promise<{
  textureCount: number;
  totalSize: number;
  regionCount: number;
  tokenCount: number;
}> {
  try {
    return await db.transaction('r', db.textures, db.regionMappings, db.tokenMappings, async () => {
      let totalSize = 0;
      await db.textures.each(entry => {
        totalSize += entry.dataUrl.length;
      });
      
      const textureCount = await db.textures.count();
      const regionCount = await db.regionMappings.count();
      const tokenCount = await db.tokenMappings.count();

      return { textureCount, totalSize, regionCount, tokenCount };
    });
  } catch (error) {
    console.error('Failed to get texture storage stats:', error);
    return { textureCount: 0, totalSize: 0, regionCount: 0, tokenCount: 0 };
  }
}

export interface TextureDetails {
  hash: string;
  dataUrl: string;
  refCount: number;
  createdAt: number;
  sizeBytes: number;
  type: 'region' | 'token' | 'unknown';
}

export type TokenTextureDetails = TextureDetails;

export async function getAllTextures(): Promise<TextureDetails[]> {
  try {
    const textures = await db.textures.toArray();
    return textures.map(entry => ({
      hash: entry.hash,
      dataUrl: entry.dataUrl,
      refCount: entry.refCount,
      createdAt: entry.createdAt,
      sizeBytes: new Blob([entry.dataUrl]).size,
      type: 'unknown',
    }));
  } catch (error) {
    console.error('Failed to get all textures:', error);
    return [];
  }
}

export const getAllTokenTextures = getAllTextures;

export async function clearUnusedTextures(): Promise<number> {
  try {
    return await db.transaction('rw', db.textures, async () => {
      const unused = await db.textures.filter(t => t.refCount <= 0).toArray();
      const deletedCount = unused.length;
      
      for (const entry of unused) {
        await db.textures.delete(entry.hash);
        textureCache.delete(entry.hash);
      }
      
      return deletedCount;
    });
  } catch (error) {
    console.error('Failed to clear unused textures:', error);
    return 0;
  }
}

export const clearUnusedTokenTextures = clearUnusedTextures;

