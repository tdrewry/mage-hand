/**
 * IndexedDB-based token texture storage with deduplication
 * Stores token images persistently without localStorage limits
 */

const DB_NAME = 'canvas-textures-db';
const DB_VERSION = 2; // Upgraded for token textures
const TEXTURES_STORE = 'textures';
const TOKEN_MAPPINGS_STORE = 'token-mappings';

interface TextureEntry {
  hash: string;
  dataUrl: string;
  refCount: number;
  createdAt: number;
}

interface TokenMapping {
  tokenId: string;
  textureHash: string;
}

// In-memory cache for loaded textures
const textureCache = new Map<string, string>();

// Database instance
let dbInstance: IDBDatabase | null = null;

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

      // Store for actual texture data (keyed by hash)
      if (!db.objectStoreNames.contains(TEXTURES_STORE)) {
        db.createObjectStore(TEXTURES_STORE, { keyPath: 'hash' });
      }

      // Store for token-to-texture mappings
      if (!db.objectStoreNames.contains(TOKEN_MAPPINGS_STORE)) {
        db.createObjectStore(TOKEN_MAPPINGS_STORE, { keyPath: 'tokenId' });
      }

      // Store for region-to-texture mappings (ensure it exists for shared DB)
      if (!db.objectStoreNames.contains('region-mappings')) {
        db.createObjectStore('region-mappings', { keyPath: 'regionId' });
      }
    };
  });
}

/**
 * Save a texture for a token (with deduplication)
 */
export async function saveTokenTexture(tokenId: string, dataUrl: string): Promise<string> {
  try {
    const db = await openDatabase();
    const hash = await hashImageData(dataUrl);

    // Check if texture already exists
    const existingTexture = await getTextureByHash(db, hash);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE, TOKEN_MAPPINGS_STORE], 'readwrite');
      const texturesStore = transaction.objectStore(TEXTURES_STORE);
      const mappingsStore = transaction.objectStore(TOKEN_MAPPINGS_STORE);

      // Get existing mapping to handle refCount
      const getMappingRequest = mappingsStore.get(tokenId);
      
      getMappingRequest.onsuccess = () => {
        const oldMapping = getMappingRequest.result as TokenMapping | undefined;

        // If token had a different texture, decrement old refCount
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

        // Save token mapping
        mappingsStore.put({ tokenId, textureHash: hash });

        // Update cache
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

/**
 * Load a texture for a token
 */
export async function loadTokenTexture(tokenId: string): Promise<string | null> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE, TOKEN_MAPPINGS_STORE], 'readonly');
      const mappingsStore = transaction.objectStore(TOKEN_MAPPINGS_STORE);

      const request = mappingsStore.get(tokenId);

      request.onsuccess = () => {
        const mapping = request.result as TokenMapping | undefined;
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
    console.error('Failed to load token texture:', error);
    return null;
  }
}

/**
 * Load a texture directly by its hash
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
 * Save a texture directly by hash (for multiplayer sync)
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
 * Remove texture reference for a token
 */
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
        store.delete(hash);
        textureCache.delete(hash);
      } else {
        store.put({ ...texture, refCount: texture.refCount - 1 });
      }
    }
  };
}

/**
 * Get cached texture
 */
export function getCachedTexture(hash: string): string | undefined {
  return textureCache.get(hash);
}

/**
 * Get all token textures with details for management UI
 */
export interface TokenTextureDetails {
  hash: string;
  dataUrl: string;
  refCount: number;
  createdAt: number;
  sizeBytes: number;
}

export async function getAllTokenTextures(): Promise<TokenTextureDetails[]> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEXTURES_STORE], 'readonly');
      const store = transaction.objectStore(TEXTURES_STORE);
      const textures: TokenTextureDetails[] = [];

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
          });
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve(textures);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to get all token textures:', error);
    return [];
  }
}

/**
 * Clear unused token textures (refCount === 0)
 */
export async function clearUnusedTokenTextures(): Promise<number> {
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
    console.error('Failed to clear unused token textures:', error);
    return 0;
  }
}

/**
 * Get all token-to-texture mappings for export
 */
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

/**
 * Import token textures from project export (restores to IndexedDB)
 */
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

      // Import textures (may already exist from region import)
      for (const [hash, dataUrl] of Object.entries(textures)) {
        const getRequest = texturesStore.get(hash);
        getRequest.onsuccess = () => {
          const existing = getRequest.result as TextureEntry | undefined;
          if (!existing) {
            texturesStore.put({
              hash,
              dataUrl,
              refCount: 0,
              createdAt: Date.now(),
            });
          }
          textureCache.set(hash, dataUrl);
        };
      }

      // Import token mappings and update refCounts
      for (const [tokenId, textureHash] of Object.entries(tokenMappings)) {
        mappingsStore.put({ tokenId, textureHash });
        
        // Increment refCount for this texture
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
