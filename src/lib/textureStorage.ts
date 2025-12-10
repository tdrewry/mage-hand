/**
 * IndexedDB-based texture storage with deduplication
 * Stores region background images persistently without localStorage limits
 */

const DB_NAME = 'canvas-textures-db';
const DB_VERSION = 1;
const TEXTURES_STORE = 'textures';
const REGION_MAPPINGS_STORE = 'region-mappings';

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

// In-memory cache for loaded textures
const textureCache = new Map<string, string>();

// Database instance
let dbInstance: IDBDatabase | null = null;

/**
 * Generate a fast hash for image data (for deduplication)
 * Exported so it can be used by textureSync
 */
export async function hashImageData(dataUrl: string): Promise<string> {
  // Use a simple but effective hash for base64 data
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

      // Store for actual texture data (keyed by hash)
      if (!db.objectStoreNames.contains(TEXTURES_STORE)) {
        db.createObjectStore(TEXTURES_STORE, { keyPath: 'hash' });
      }

      // Store for region-to-texture mappings
      if (!db.objectStoreNames.contains(REGION_MAPPINGS_STORE)) {
        db.createObjectStore(REGION_MAPPINGS_STORE, { keyPath: 'regionId' });
      }
    };
  });
}

/**
 * Save a texture for a region (with deduplication)
 */
export async function saveRegionTexture(regionId: string, dataUrl: string): Promise<string> {
  try {
    const db = await openDatabase();
    const hash = await hashImageData(dataUrl);

    // Check if texture already exists
    const existingTexture = await getTextureByHash(db, hash);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE, REGION_MAPPINGS_STORE], 'readwrite');
      const texturesStore = transaction.objectStore(TEXTURES_STORE);
      const mappingsStore = transaction.objectStore(REGION_MAPPINGS_STORE);

      // Get existing mapping to handle refCount
      const getMappingRequest = mappingsStore.get(regionId);
      
      getMappingRequest.onsuccess = () => {
        const oldMapping = getMappingRequest.result as RegionMapping | undefined;

        // If region had a different texture, decrement old refCount
        if (oldMapping && oldMapping.textureHash !== hash) {
          decrementTextureRef(db, oldMapping.textureHash);
        }

        // Save or update texture entry
        if (existingTexture) {
          // Texture exists, increment refCount if this is a new reference
          if (!oldMapping || oldMapping.textureHash !== hash) {
            texturesStore.put({
              ...existingTexture,
              refCount: existingTexture.refCount + 1,
            });
          }
        } else {
          // New texture, store it
          texturesStore.put({
            hash,
            dataUrl,
            refCount: 1,
            createdAt: Date.now(),
          });
        }

        // Save region mapping
        mappingsStore.put({ regionId, textureHash: hash });

        // Update cache
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

/**
 * Load a texture for a region
 */
export async function loadRegionTexture(regionId: string): Promise<string | null> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE, REGION_MAPPINGS_STORE], 'readonly');
      const mappingsStore = transaction.objectStore(REGION_MAPPINGS_STORE);

      const request = mappingsStore.get(regionId);

      request.onsuccess = () => {
        const mapping = request.result as RegionMapping | undefined;
        if (!mapping) {
          resolve(null);
          return;
        }

        // Check cache first
        if (textureCache.has(mapping.textureHash)) {
          resolve(textureCache.get(mapping.textureHash)!);
          return;
        }

        // Load from store
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

/**
 * Load all textures for multiple regions at once (batch load)
 */
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

      // First, get all mappings
      regionIds.forEach(regionId => {
        const request = mappingsStore.get(regionId);
        
        request.onsuccess = () => {
          const mapping = request.result as RegionMapping | undefined;
          if (mapping) {
            regionToHash.set(regionId, mapping.textureHash);
            
            // Check cache
            if (textureCache.has(mapping.textureHash)) {
              results.set(regionId, textureCache.get(mapping.textureHash)!);
            } else {
              hashesToLoad.add(mapping.textureHash);
            }
          }
          
          pendingMappings--;
          if (pendingMappings === 0) {
            loadTexturesByHash();
          }
        };

        request.onerror = () => {
          pendingMappings--;
          if (pendingMappings === 0) {
            loadTexturesByHash();
          }
        };
      });

      function loadTexturesByHash() {
        if (hashesToLoad.size === 0) {
          resolve(results);
          return;
        }

        let pendingTextures = hashesToLoad.size;
        
        hashesToLoad.forEach(hash => {
          const request = texturesStore.get(hash);
          
          request.onsuccess = () => {
            const texture = request.result as TextureEntry | undefined;
            if (texture) {
              textureCache.set(hash, texture.dataUrl);
              
              // Map back to regions
              regionToHash.forEach((h, regionId) => {
                if (h === hash) {
                  results.set(regionId, texture.dataUrl);
                }
              });
            }
            
            pendingTextures--;
            if (pendingTextures === 0) {
              resolve(results);
            }
          };

          request.onerror = () => {
            pendingTextures--;
            if (pendingTextures === 0) {
              resolve(results);
            }
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

/**
 * Remove texture reference for a region
 */
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
          // Decrement ref count
          decrementTextureRef(db, mapping.textureHash);
          // Remove mapping
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

/**
 * Clear all textures (for storage management)
 */
export async function clearAllTextures(): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE, REGION_MAPPINGS_STORE], 'readwrite');
      transaction.objectStore(TEXTURES_STORE).clear();
      transaction.objectStore(REGION_MAPPINGS_STORE).clear();

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

/**
 * Get storage statistics
 */
export async function getTextureStorageStats(): Promise<{
  textureCount: number;
  totalSize: number;
  regionCount: number;
}> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE, REGION_MAPPINGS_STORE], 'readonly');
      const texturesStore = transaction.objectStore(TEXTURES_STORE);
      const mappingsStore = transaction.objectStore(REGION_MAPPINGS_STORE);

      let textureCount = 0;
      let totalSize = 0;
      let regionCount = 0;

      const textureRequest = texturesStore.openCursor();
      textureRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          textureCount++;
          totalSize += (cursor.value as TextureEntry).dataUrl.length;
          cursor.continue();
        }
      };

      const mappingRequest = mappingsStore.count();
      mappingRequest.onsuccess = () => {
        regionCount = mappingRequest.result;
      };

      transaction.oncomplete = () => {
        resolve({ textureCount, totalSize, regionCount });
      };
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to get texture storage stats:', error);
    return { textureCount: 0, totalSize: 0, regionCount: 0 };
  }
}

// Helper functions

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
        // No more references, delete texture
        store.delete(hash);
        textureCache.delete(hash);
      } else {
        // Decrement refCount
        store.put({ ...texture, refCount: texture.refCount - 1 });
      }
    }
  };
}

/**
 * Preload texture into cache (for rendering optimization)
 */
export function getCachedTexture(hash: string): string | undefined {
  return textureCache.get(hash);
}

/**
 * Check if texture is in cache
 */
export function isTextureCached(regionId: string): boolean {
  // This is a quick check - actual regionId to hash mapping requires async lookup
  return false; // For now, always load from IndexedDB on first access
}

/**
 * Load a texture directly by its hash (for multiplayer sync)
 */
export async function loadTextureByHash(hash: string): Promise<string | null> {
  // Check cache first
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

      // Check if already exists
      const getRequest = store.get(hash);
      
      getRequest.onsuccess = () => {
        const existing = getRequest.result as TextureEntry | undefined;
        if (!existing) {
          // New texture - save it
          store.put({
            hash,
            dataUrl,
            refCount: 0, // Not tied to any specific region yet
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
 * Get hash for a region (used to check what texture a region needs)
 */
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

/**
 * Get all textures with details for management UI
 */
export interface TextureDetails {
  hash: string;
  dataUrl: string;
  refCount: number;
  createdAt: number;
  sizeBytes: number;
  type: 'region' | 'token' | 'unknown';
}

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
            type: 'unknown', // Will be determined by caller if needed
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

/**
 * Clear unused textures (refCount === 0)
 */
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
          // Delete all unused textures
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
