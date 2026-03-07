/**
 * Unified IndexedDB-based texture storage with deduplication
 * 
 * Single service for ALL texture types: tokens, regions, effects, map objects.
 * Binary data is stored once by hash in the 'textures' object store.
 * Entity-specific mapping stores link entityId → hash for refCount management.
 */

const DB_NAME = 'canvas-textures-db';
const DB_VERSION = 2;
const TEXTURES_STORE = 'textures';
const REGION_MAPPINGS_STORE = 'region-mappings';
const TOKEN_MAPPINGS_STORE = 'token-mappings';

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

// In-memory cache for loaded textures
const textureCache = new Map<string, string>();

// Database instance
let dbInstance: IDBDatabase | null = null;

// ══════════════════════════════════════════════════════════════════════════
// CORE: Hashing, DB, Helpers
// ══════════════════════════════════════════════════════════════════════════

/**
 * Generate a fast hash for image data (for deduplication)
 */
export async function hashImageData(dataUrl: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(dataUrl);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/**
 * Open or create the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open texture database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(TEXTURES_STORE)) {
        db.createObjectStore(TEXTURES_STORE, { keyPath: 'hash' });
      }
      if (!db.objectStoreNames.contains(REGION_MAPPINGS_STORE)) {
        db.createObjectStore(REGION_MAPPINGS_STORE, { keyPath: 'regionId' });
      }
      if (!db.objectStoreNames.contains(TOKEN_MAPPINGS_STORE)) {
        db.createObjectStore(TOKEN_MAPPINGS_STORE, { keyPath: 'tokenId' });
      }
    };
  });
}

async function getTextureByHash(db: IDBDatabase, hash: string): Promise<TextureEntry | null> {
  return new Promise((resolve) => {
    const transaction = db.transaction([TEXTURES_STORE], 'readonly');
    const store = transaction.objectStore(TEXTURES_STORE);
    const request = store.get(hash);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

function decrementTextureRef(db: IDBDatabase, hash: string): void {
  const transaction = db.transaction([TEXTURES_STORE], 'readwrite');
  const store = transaction.objectStore(TEXTURES_STORE);
  const request = store.get(hash);

  request.onsuccess = () => {
    const texture = request.result as TextureEntry | undefined;
    if (texture) {
      if (texture.refCount <= 1) {
        store.delete(hash);
        textureCache.delete(hash);
      } else {
        store.put({ ...texture, refCount: texture.refCount - 1 });
      }
    }
  };
}

// ══════════════════════════════════════════════════════════════════════════
// HASH-LEVEL API (shared across all entity types)
// ══════════════════════════════════════════════════════════════════════════

/** Preload texture into cache (for rendering optimization) */
export function getCachedTexture(hash: string): string | undefined {
  return textureCache.get(hash);
}

/** Check if texture is in cache (quick sync check) */
export function isTextureCached(_entityId: string): boolean {
  return false; // Requires async lookup
}

/**
 * Load a texture directly by its hash (for multiplayer sync)
 */
export async function loadTextureByHash(hash: string): Promise<string | null> {
  if (textureCache.has(hash)) {
    return textureCache.get(hash)!;
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const transaction = db.transaction([TEXTURES_STORE], 'readonly');
      const store = transaction.objectStore(TEXTURES_STORE);
      const request = store.get(hash);

      request.onsuccess = () => {
        const texture = request.result as TextureEntry | undefined;
        if (texture) {
          textureCache.set(hash, texture.dataUrl);
          resolve(texture.dataUrl);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch (error) {
    console.error('Failed to load texture by hash:', error);
    return null;
  }
}

/**
 * Save a texture directly by hash (for multiplayer sync - when receiving from server)
 */
export async function saveTextureByHash(hash: string, dataUrl: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE], 'readwrite');
      const store = transaction.objectStore(TEXTURES_STORE);

      const getRequest = store.get(hash);
      getRequest.onsuccess = () => {
        const existing = getRequest.result as TextureEntry | undefined;
        if (!existing) {
          store.put({
            hash,
            dataUrl,
            refCount: 0,
            createdAt: Date.now(),
          });
        }
        textureCache.set(hash, dataUrl);
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to save texture by hash:', error);
  }
}

/**
 * Save a texture for an appearance variant (with proper refCount)
 * Unlike saveTextureByHash, this increments refCount to protect from garbage collection
 */
export async function saveVariantTexture(hash: string, dataUrl: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE], 'readwrite');
      const store = transaction.objectStore(TEXTURES_STORE);

      const getRequest = store.get(hash);
      getRequest.onsuccess = () => {
        const existing = getRequest.result as TextureEntry | undefined;
        if (existing) {
          store.put({ ...existing, refCount: existing.refCount + 1 });
        } else {
          store.put({ hash, dataUrl, refCount: 1, createdAt: Date.now() });
        }
        textureCache.set(hash, dataUrl);
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to save variant texture:', error);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// REGION TEXTURE API
// ══════════════════════════════════════════════════════════════════════════

/** Save a texture for a region (with deduplication) */
export async function saveRegionTexture(regionId: string, dataUrl: string): Promise<string> {
  try {
    const db = await openDatabase();
    const hash = await hashImageData(dataUrl);
    const existingTexture = await getTextureByHash(db, hash);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE, REGION_MAPPINGS_STORE], 'readwrite');
      const texturesStore = transaction.objectStore(TEXTURES_STORE);
      const mappingsStore = transaction.objectStore(REGION_MAPPINGS_STORE);

      const getMappingRequest = mappingsStore.get(regionId);
      getMappingRequest.onsuccess = () => {
        const oldMapping = getMappingRequest.result as RegionMapping | undefined;
        if (oldMapping && oldMapping.textureHash !== hash) {
          decrementTextureRef(db, oldMapping.textureHash);
        }

        if (existingTexture) {
          if (!oldMapping || oldMapping.textureHash !== hash) {
            texturesStore.put({ ...existingTexture, refCount: existingTexture.refCount + 1 });
          }
        } else {
          texturesStore.put({ hash, dataUrl, refCount: 1, createdAt: Date.now() });
        }

        mappingsStore.put({ regionId, textureHash: hash });
        textureCache.set(hash, dataUrl);
      };

      transaction.oncomplete = () => resolve(hash);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to save region texture:', error);
    throw error;
  }
}

/** Load a texture for a region */
export async function loadRegionTexture(regionId: string): Promise<string | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE, REGION_MAPPINGS_STORE], 'readonly');
      const mappingsStore = transaction.objectStore(REGION_MAPPINGS_STORE);
      const request = mappingsStore.get(regionId);

      request.onsuccess = () => {
        const mapping = request.result as RegionMapping | undefined;
        if (!mapping) { resolve(null); return; }

        if (textureCache.has(mapping.textureHash)) {
          resolve(textureCache.get(mapping.textureHash)!);
          return;
        }

        const texturesStore = transaction.objectStore(TEXTURES_STORE);
        const textureRequest = texturesStore.get(mapping.textureHash);
        textureRequest.onsuccess = () => {
          const texture = textureRequest.result as TextureEntry | undefined;
          if (texture) {
            textureCache.set(texture.hash, texture.dataUrl);
            resolve(texture.dataUrl);
          } else {
            resolve(null);
          }
        };
        textureRequest.onerror = () => resolve(null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load region texture:', error);
    return null;
  }
}

/** Load all textures for multiple regions at once (batch load) */
export async function loadRegionTextures(regionIds: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  if (regionIds.length === 0) return results;

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE, REGION_MAPPINGS_STORE], 'readonly');
      const mappingsStore = transaction.objectStore(REGION_MAPPINGS_STORE);
      const texturesStore = transaction.objectStore(TEXTURES_STORE);

      const hashesToLoad = new Set<string>();
      const regionToHash = new Map<string, string>();
      let pendingMappings = regionIds.length;

      regionIds.forEach(regionId => {
        const request = mappingsStore.get(regionId);
        request.onsuccess = () => {
          const mapping = request.result as RegionMapping | undefined;
          if (mapping) {
            regionToHash.set(regionId, mapping.textureHash);
            if (textureCache.has(mapping.textureHash)) {
              results.set(regionId, textureCache.get(mapping.textureHash)!);
            } else {
              hashesToLoad.add(mapping.textureHash);
            }
          }
          pendingMappings--;
          if (pendingMappings === 0) loadTexturesByHashBatch();
        };
        request.onerror = () => {
          pendingMappings--;
          if (pendingMappings === 0) loadTexturesByHashBatch();
        };
      });

      function loadTexturesByHashBatch() {
        if (hashesToLoad.size === 0) { resolve(results); return; }
        let pendingTextures = hashesToLoad.size;
        hashesToLoad.forEach(hash => {
          const request = texturesStore.get(hash);
          request.onsuccess = () => {
            const texture = request.result as TextureEntry | undefined;
            if (texture) {
              textureCache.set(hash, texture.dataUrl);
              regionToHash.forEach((h, regionId) => {
                if (h === hash) results.set(regionId, texture.dataUrl);
              });
            }
            pendingTextures--;
            if (pendingTextures === 0) resolve(results);
          };
          request.onerror = () => {
            pendingTextures--;
            if (pendingTextures === 0) resolve(results);
          };
        });
      }

      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to batch load region textures:', error);
    return results;
  }
}

/** Remove texture reference for a region */
export async function removeRegionTexture(regionId: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE, REGION_MAPPINGS_STORE], 'readwrite');
      const mappingsStore = transaction.objectStore(REGION_MAPPINGS_STORE);
      const request = mappingsStore.get(regionId);
      request.onsuccess = () => {
        const mapping = request.result as RegionMapping | undefined;
        if (mapping) {
          decrementTextureRef(db, mapping.textureHash);
          mappingsStore.delete(regionId);
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to remove region texture:', error);
  }
}

/** Get hash for a region */
export async function getRegionTextureHash(regionId: string): Promise<string | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const transaction = db.transaction([REGION_MAPPINGS_STORE], 'readonly');
      const store = transaction.objectStore(REGION_MAPPINGS_STORE);
      const request = store.get(regionId);
      request.onsuccess = () => {
        const mapping = request.result as RegionMapping | undefined;
        resolve(mapping?.textureHash || null);
      };
      request.onerror = () => resolve(null);
    });
  } catch (error) {
    console.error('Failed to get region texture hash:', error);
    return null;
  }
}

/** Get all region-to-texture mappings for export */
export async function getAllRegionMappings(): Promise<Map<string, string>> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([REGION_MAPPINGS_STORE], 'readonly');
      const store = transaction.objectStore(REGION_MAPPINGS_STORE);
      const mappings = new Map<string, string>();
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const mapping = cursor.value as RegionMapping;
          mappings.set(mapping.regionId, mapping.textureHash);
          cursor.continue();
        }
      };
      transaction.oncomplete = () => resolve(mappings);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to get region mappings:', error);
    return new Map();
  }
}

/** Import textures from project export (restores to IndexedDB) */
export async function importTextures(
  textures: Record<string, string>,
  regionMappings: Record<string, string>
): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE, REGION_MAPPINGS_STORE], 'readwrite');
      const texturesStore = transaction.objectStore(TEXTURES_STORE);
      const mappingsStore = transaction.objectStore(REGION_MAPPINGS_STORE);

      for (const [hash, dataUrl] of Object.entries(textures)) {
        const getRequest = texturesStore.get(hash);
        getRequest.onsuccess = () => {
          if (!getRequest.result) {
            texturesStore.put({ hash, dataUrl, refCount: 0, createdAt: Date.now() });
          }
          textureCache.set(hash, dataUrl);
        };
      }

      for (const [regionId, textureHash] of Object.entries(regionMappings)) {
        mappingsStore.put({ regionId, textureHash });
        const getRequest = texturesStore.get(textureHash);
        getRequest.onsuccess = () => {
          const texture = getRequest.result as TextureEntry | undefined;
          if (texture) {
            texturesStore.put({ ...texture, refCount: texture.refCount + 1 });
          }
        };
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to import textures:', error);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// TOKEN TEXTURE API
// ══════════════════════════════════════════════════════════════════════════

/** Save a texture for a token (with deduplication) */
export async function saveTokenTexture(tokenId: string, dataUrl: string): Promise<string> {
  try {
    const db = await openDatabase();
    const hash = await hashImageData(dataUrl);
    const existingTexture = await getTextureByHash(db, hash);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE, TOKEN_MAPPINGS_STORE], 'readwrite');
      const texturesStore = transaction.objectStore(TEXTURES_STORE);
      const mappingsStore = transaction.objectStore(TOKEN_MAPPINGS_STORE);

      const getMappingRequest = mappingsStore.get(tokenId);
      getMappingRequest.onsuccess = () => {
        const oldMapping = getMappingRequest.result as TokenMapping | undefined;
        if (oldMapping && oldMapping.textureHash !== hash) {
          decrementTextureRef(db, oldMapping.textureHash);
        }

        if (existingTexture) {
          if (!oldMapping || oldMapping.textureHash !== hash) {
            texturesStore.put({ ...existingTexture, refCount: existingTexture.refCount + 1 });
          }
        } else {
          texturesStore.put({ hash, dataUrl, refCount: 1, createdAt: Date.now() });
        }

        mappingsStore.put({ tokenId, textureHash: hash });
        textureCache.set(hash, dataUrl);
      };

      transaction.oncomplete = () => resolve(hash);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to save token texture:', error);
    throw error;
  }
}

/** Load a texture for a token */
export async function loadTokenTexture(tokenId: string): Promise<string | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE, TOKEN_MAPPINGS_STORE], 'readonly');
      const mappingsStore = transaction.objectStore(TOKEN_MAPPINGS_STORE);
      const request = mappingsStore.get(tokenId);

      request.onsuccess = () => {
        const mapping = request.result as TokenMapping | undefined;
        if (!mapping) { resolve(null); return; }

        if (textureCache.has(mapping.textureHash)) {
          resolve(textureCache.get(mapping.textureHash)!);
          return;
        }

        const texturesStore = transaction.objectStore(TEXTURES_STORE);
        const textureRequest = texturesStore.get(mapping.textureHash);
        textureRequest.onsuccess = () => {
          const texture = textureRequest.result as TextureEntry | undefined;
          if (texture) {
            textureCache.set(texture.hash, texture.dataUrl);
            resolve(texture.dataUrl);
          } else {
            resolve(null);
          }
        };
        textureRequest.onerror = () => resolve(null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load token texture:', error);
    return null;
  }
}

/** Remove texture reference for a token */
export async function removeTokenTexture(tokenId: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE, TOKEN_MAPPINGS_STORE], 'readwrite');
      const mappingsStore = transaction.objectStore(TOKEN_MAPPINGS_STORE);
      const request = mappingsStore.get(tokenId);
      request.onsuccess = () => {
        const mapping = request.result as TokenMapping | undefined;
        if (mapping) {
          decrementTextureRef(db, mapping.textureHash);
          mappingsStore.delete(tokenId);
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to remove token texture:', error);
  }
}

/** Get all token-to-texture mappings for export */
export async function getAllTokenMappings(): Promise<Map<string, string>> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TOKEN_MAPPINGS_STORE], 'readonly');
      const store = transaction.objectStore(TOKEN_MAPPINGS_STORE);
      const mappings = new Map<string, string>();
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const mapping = cursor.value as TokenMapping;
          mappings.set(mapping.tokenId, mapping.textureHash);
          cursor.continue();
        }
      };
      transaction.oncomplete = () => resolve(mappings);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to get token mappings:', error);
    return new Map();
  }
}

/** Import token textures from project export (restores to IndexedDB) */
export async function importTokenTextures(
  textures: Record<string, string>,
  tokenMappings: Record<string, string>
): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE, TOKEN_MAPPINGS_STORE], 'readwrite');
      const texturesStore = transaction.objectStore(TEXTURES_STORE);
      const mappingsStore = transaction.objectStore(TOKEN_MAPPINGS_STORE);

      for (const [hash, dataUrl] of Object.entries(textures)) {
        const getRequest = texturesStore.get(hash);
        getRequest.onsuccess = () => {
          if (!getRequest.result) {
            texturesStore.put({ hash, dataUrl, refCount: 0, createdAt: Date.now() });
          }
          textureCache.set(hash, dataUrl);
        };
      }

      for (const [tokenId, textureHash] of Object.entries(tokenMappings)) {
        mappingsStore.put({ tokenId, textureHash });
        const getRequest = texturesStore.get(textureHash);
        getRequest.onsuccess = () => {
          const texture = getRequest.result as TextureEntry | undefined;
          if (texture) {
            texturesStore.put({ ...texture, refCount: texture.refCount + 1 });
          }
        };
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to import token textures:', error);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// MANAGEMENT & STATS (unified across all entity types)
// ══════════════════════════════════════════════════════════════════════════

/** Clear all textures and mappings (for storage management) */
export async function clearAllTextures(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [TEXTURES_STORE, REGION_MAPPINGS_STORE, TOKEN_MAPPINGS_STORE],
        'readwrite'
      );
      transaction.objectStore(TEXTURES_STORE).clear();
      transaction.objectStore(REGION_MAPPINGS_STORE).clear();
      transaction.objectStore(TOKEN_MAPPINGS_STORE).clear();

      transaction.oncomplete = () => {
        textureCache.clear();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to clear textures:', error);
  }
}

/** Get storage statistics */
export async function getTextureStorageStats(): Promise<{
  textureCount: number;
  totalSize: number;
  regionCount: number;
  tokenCount: number;
}> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [TEXTURES_STORE, REGION_MAPPINGS_STORE, TOKEN_MAPPINGS_STORE],
        'readonly'
      );
      const texturesStore = transaction.objectStore(TEXTURES_STORE);
      const regionMappingsStore = transaction.objectStore(REGION_MAPPINGS_STORE);
      const tokenMappingsStore = transaction.objectStore(TOKEN_MAPPINGS_STORE);

      let textureCount = 0;
      let totalSize = 0;
      let regionCount = 0;
      let tokenCount = 0;

      const textureRequest = texturesStore.openCursor();
      textureRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          textureCount++;
          totalSize += (cursor.value as TextureEntry).dataUrl.length;
          cursor.continue();
        }
      };

      const regionRequest = regionMappingsStore.count();
      regionRequest.onsuccess = () => { regionCount = regionRequest.result; };

      const tokenRequest = tokenMappingsStore.count();
      tokenRequest.onsuccess = () => { tokenCount = tokenRequest.result; };

      transaction.oncomplete = () => {
        resolve({ textureCount, totalSize, regionCount, tokenCount });
      };
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to get texture storage stats:', error);
    return { textureCount: 0, totalSize: 0, regionCount: 0, tokenCount: 0 };
  }
}

/** Texture details for management UI */
export interface TextureDetails {
  hash: string;
  dataUrl: string;
  refCount: number;
  createdAt: number;
  sizeBytes: number;
  type: 'region' | 'token' | 'unknown';
}

// Re-export for backward compat
export type TokenTextureDetails = TextureDetails;

/** Get all textures with details for management UI */
export async function getAllTextures(): Promise<TextureDetails[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE], 'readonly');
      const store = transaction.objectStore(TEXTURES_STORE);
      const textures: TextureDetails[] = [];

      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const entry = cursor.value as TextureEntry;
          textures.push({
            hash: entry.hash,
            dataUrl: entry.dataUrl,
            refCount: entry.refCount,
            createdAt: entry.createdAt,
            sizeBytes: new Blob([entry.dataUrl]).size,
            type: 'unknown',
          });
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve(textures);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to get all textures:', error);
    return [];
  }
}

// Backward compat alias
export const getAllTokenTextures = getAllTextures;

/** Clear unused textures (refCount === 0) */
export async function clearUnusedTextures(): Promise<number> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE], 'readwrite');
      const store = transaction.objectStore(TEXTURES_STORE);
      let deletedCount = 0;
      const hashesToDelete: string[] = [];

      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const entry = cursor.value as TextureEntry;
          if (entry.refCount <= 0) {
            hashesToDelete.push(entry.hash);
          }
          cursor.continue();
        } else {
          hashesToDelete.forEach(hash => {
            store.delete(hash);
            textureCache.delete(hash);
            deletedCount++;
          });
        }
      };

      transaction.oncomplete = () => resolve(deletedCount);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to clear unused textures:', error);
    return 0;
  }
}

// Backward compat alias
export const clearUnusedTokenTextures = clearUnusedTextures;
