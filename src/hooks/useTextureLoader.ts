import { useEffect, useRef, useCallback } from 'react';
import { useRegionStore } from '@/stores/regionStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import { 
  loadRegionTextures, 
  saveRegionTexture, 
  removeRegionTexture,
  loadTextureByHash as loadRegionTextureByHash,
  saveTextureByHash as saveRegionTextureByHash
} from '@/lib/textureStorage';
import {
  saveTokenTexture,
  loadTextureByHash as loadTokenTextureByHash,
  saveTextureByHash as saveTokenTextureByHash
} from '@/lib/tokenTextureStorage';
import { 
  requestTexture as requestTextureFromServer,
  uploadTexture,
  cacheTexture,
} from '@/lib/textureSync';
import {
  notifyTextureDownloadStart,
  notifyTextureDownloadComplete,
  notifyTextureDownloadError
} from '@/components/TextureDownloadProgress';

/**
 * Hook to manage texture loading from IndexedDB and multiplayer sync
 * Handles initial load and syncing textures when regions/tokens change
 * 
 * OPTIMIZATION: Downloads are deduplicated by hash - if multiple regions
 * share the same texture, we only download once and apply to all.
 */
export function useTextureLoader() {
  const regions = useRegionStore(state => state.regions);
  const updateRegion = useRegionStore(state => state.updateRegion);
  const tokens = useSessionStore(state => state.tokens);
  const updateTokenImage = useSessionStore(state => state.updateTokenImage);
  const connectedUsers = useMultiplayerStore(state => state.connectedUsers);
  const isConnected = useMultiplayerStore(state => state.isConnected);
  
  const loadedRegionsRef = useRef<Set<string>>(new Set());
  const loadedTokensRef = useRef<Set<string>>(new Set());
  const pendingLoadsRef = useRef<Set<string>>(new Set());
  const pendingHashDownloadsRef = useRef<Set<string>>(new Set()); // Track unique hash downloads
  const initialLoadDoneRef = useRef(false);

  // Load textures for regions on mount and when new regions appear
  useEffect(() => {
    const regionsNeedingLocalTextures: string[] = [];
    // Map of hash -> array of region IDs that need this texture
    const hashToRegionIds = new Map<string, string[]>();

    regions.forEach(region => {
      if (loadedRegionsRef.current.has(region.id)) return;
      if (pendingLoadsRef.current.has(`region:${region.id}`)) return;
      
      if (region.backgroundImage) {
        loadedRegionsRef.current.add(region.id);
        return;
      }

      if (region.textureHash) {
        // Group regions by their texture hash for deduplication
        const existing = hashToRegionIds.get(region.textureHash) || [];
        existing.push(region.id);
        hashToRegionIds.set(region.textureHash, existing);
      } else {
        regionsNeedingLocalTextures.push(region.id);
      }
    });

    // Load local textures from IndexedDB
    if (regionsNeedingLocalTextures.length > 0) {
      regionsNeedingLocalTextures.forEach(id => pendingLoadsRef.current.add(`region:${id}`));

      loadRegionTextures(regionsNeedingLocalTextures).then(textureMap => {
        textureMap.forEach((dataUrl, regionId) => {
          updateRegion(regionId, { backgroundImage: dataUrl });
          loadedRegionsRef.current.add(regionId);
        });

        regionsNeedingLocalTextures.forEach(id => {
          pendingLoadsRef.current.delete(`region:${id}`);
          loadedRegionsRef.current.add(id);
        });
        
        initialLoadDoneRef.current = true;
      }).catch(error => {
        console.error('Failed to load region textures:', error);
        regionsNeedingLocalTextures.forEach(id => pendingLoadsRef.current.delete(`region:${id}`));
        initialLoadDoneRef.current = true;
      });
    }

    // Load remote textures (from multiplayer sync) - DEDUPLICATED BY HASH
    if (hashToRegionIds.size > 0) {
      // Mark all regions as pending
      hashToRegionIds.forEach((regionIds, hash) => {
        regionIds.forEach(id => pendingLoadsRef.current.add(`region:${id}`));
      });

      // Process each unique hash only once
      hashToRegionIds.forEach(async (regionIds, hash) => {
        // Skip if we're already downloading this hash
        if (pendingHashDownloadsRef.current.has(hash)) {
          return;
        }
        
        pendingHashDownloadsRef.current.add(hash);
        notifyTextureDownloadStart(hash);

        try {
          // Try local cache first (IndexedDB)
          let dataUrl = await loadRegionTextureByHash(hash);
          
          // Only request from server if we're connected to multiplayer
          if (!dataUrl && isConnected) {
            dataUrl = await requestTextureFromServer(hash);
            
            if (dataUrl) {
              await saveRegionTextureByHash(hash, dataUrl);
            }
          }

          if (dataUrl) {
            // Apply the same texture to ALL regions that need it
            regionIds.forEach(id => {
              updateRegion(id, { backgroundImage: dataUrl });
            });
            cacheTexture(hash, dataUrl);
            notifyTextureDownloadComplete(hash);
          } else {
            notifyTextureDownloadError(hash);
          }
        } catch (error) {
          console.error(`Failed to load remote texture ${hash} for ${regionIds.length} regions:`, error);
          notifyTextureDownloadError(hash);
        } finally {
          pendingHashDownloadsRef.current.delete(hash);
          regionIds.forEach(id => {
            pendingLoadsRef.current.delete(`region:${id}`);
            loadedRegionsRef.current.add(id);
          });
        }
      });
    }

    if (regionsNeedingLocalTextures.length === 0 && hashToRegionIds.size === 0) {
      initialLoadDoneRef.current = true;
    }
  }, [regions, updateRegion, isConnected]);

  // Load textures for tokens - DEDUPLICATED BY HASH
  useEffect(() => {
    // Map of hash -> array of token IDs that need this texture
    const hashToTokenIds = new Map<string, string[]>();

    tokens.forEach(token => {
      if (loadedTokensRef.current.has(token.id)) return;
      if (pendingLoadsRef.current.has(`token:${token.id}`)) return;
      
      // Token already has image data in memory
      if (token.imageUrl && token.imageUrl.length > 0) {
        loadedTokensRef.current.add(token.id);
        return;
      }

      // Token has a hash from sync but no imageUrl
      if (token.imageHash) {
        const existing = hashToTokenIds.get(token.imageHash) || [];
        existing.push(token.id);
        hashToTokenIds.set(token.imageHash, existing);
      }
    });

    // Load remote token textures - one download per unique hash
    if (hashToTokenIds.size > 0) {
      // Mark all tokens as pending
      hashToTokenIds.forEach((tokenIds, hash) => {
        tokenIds.forEach(id => pendingLoadsRef.current.add(`token:${id}`));
      });

      // Process each unique hash only once
      hashToTokenIds.forEach(async (tokenIds, hash) => {
        // Skip if we're already downloading this hash
        if (pendingHashDownloadsRef.current.has(hash)) {
          return;
        }
        
        pendingHashDownloadsRef.current.add(hash);
        notifyTextureDownloadStart(hash);

        try {
          // Try local cache first
          let dataUrl = await loadTokenTextureByHash(hash);
          
          // Only request from server if we're connected to multiplayer
          if (!dataUrl && isConnected) {
            dataUrl = await requestTextureFromServer(hash);
            
            if (dataUrl) {
              await saveTokenTextureByHash(hash, dataUrl);
            }
          }

          if (dataUrl) {
            // Apply the same texture to ALL tokens that need it
            tokenIds.forEach(id => {
              updateTokenImage(id, dataUrl!, hash);
            });
            cacheTexture(hash, dataUrl);
            notifyTextureDownloadComplete(hash);
          } else {
            notifyTextureDownloadError(hash);
          }
        } catch (error) {
          console.error(`Failed to load remote texture ${hash} for ${tokenIds.length} tokens:`, error);
          notifyTextureDownloadError(hash);
        } finally {
          pendingHashDownloadsRef.current.delete(hash);
          tokenIds.forEach(id => {
            pendingLoadsRef.current.delete(`token:${id}`);
            loadedTokensRef.current.add(id);
          });
        }
      });
    }
  }, [tokens, updateTokenImage, isConnected]);

  // Save region texture to IndexedDB and upload to server for sync
  const saveRegionTextureAndSync = useCallback(async (regionId: string, dataUrl: string): Promise<string> => {
    try {
      const hash = await saveRegionTexture(regionId, dataUrl);
      loadedRegionsRef.current.add(regionId);
      await uploadTexture(hash, dataUrl);
      return hash;
    } catch (error) {
      console.error('Failed to save region texture:', error);
      throw error;
    }
  }, []);

  // Save token texture to IndexedDB and upload to server for sync
  const saveTokenTextureAndSync = useCallback(async (tokenId: string, dataUrl: string): Promise<string> => {
    try {
      const hash = await saveTokenTexture(tokenId, dataUrl);
      loadedTokensRef.current.add(tokenId);
      await uploadTexture(hash, dataUrl);
      return hash;
    } catch (error) {
      console.error('Failed to save token texture:', error);
      throw error;
    }
  }, []);

  // Remove region texture from IndexedDB
  const removeRegionTextureFromStorage = useCallback(async (regionId: string) => {
    try {
      await removeRegionTexture(regionId);
      loadedRegionsRef.current.delete(regionId);
    } catch (error) {
      console.error('Failed to remove region texture:', error);
    }
  }, []);

  return { 
    saveTexture: saveRegionTextureAndSync, 
    saveTokenTexture: saveTokenTextureAndSync,
    removeTexture: removeRegionTextureFromStorage 
  };
}
