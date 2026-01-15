import { useEffect, useRef, useCallback } from 'react';
import { useRegionStore } from '@/stores/regionStore';
import { useSessionStore } from '@/stores/sessionStore';
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
 */
export function useTextureLoader() {
  const regions = useRegionStore(state => state.regions);
  const updateRegion = useRegionStore(state => state.updateRegion);
  const tokens = useSessionStore(state => state.tokens);
  const updateTokenImage = useSessionStore(state => state.updateTokenImage);
  
  const loadedRegionsRef = useRef<Set<string>>(new Set());
  const loadedTokensRef = useRef<Set<string>>(new Set());
  const pendingLoadsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);

  // Load textures for regions on mount and when new regions appear
  useEffect(() => {
    const regionsNeedingLocalTextures: string[] = [];
    const regionsNeedingRemoteTextures: { id: string; hash: string }[] = [];

    regions.forEach(region => {
      if (loadedRegionsRef.current.has(region.id)) return;
      if (pendingLoadsRef.current.has(`region:${region.id}`)) return;
      
      if (region.backgroundImage) {
        loadedRegionsRef.current.add(region.id);
        return;
      }

      if (region.textureHash) {
        regionsNeedingRemoteTextures.push({ id: region.id, hash: region.textureHash });
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

    // Load remote textures (from multiplayer sync)
    if (regionsNeedingRemoteTextures.length > 0) {
      regionsNeedingRemoteTextures.forEach(({ id, hash }) => {
        pendingLoadsRef.current.add(`region:${id}`);
        notifyTextureDownloadStart(hash);
      });

      regionsNeedingRemoteTextures.forEach(async ({ id, hash }) => {
        try {
          let dataUrl = await loadRegionTextureByHash(hash);
          
          if (!dataUrl) {
            dataUrl = await requestTextureFromServer(hash);
            
            if (dataUrl) {
              await saveRegionTextureByHash(hash, dataUrl);
            }
          }

          if (dataUrl) {
            updateRegion(id, { backgroundImage: dataUrl });
            cacheTexture(hash, dataUrl);
            notifyTextureDownloadComplete(hash);
          } else {
            notifyTextureDownloadError(hash);
          }
        } catch (error) {
          console.error(`Failed to load remote texture for region ${id}:`, error);
          notifyTextureDownloadError(hash);
        } finally {
          pendingLoadsRef.current.delete(`region:${id}`);
          loadedRegionsRef.current.add(id);
        }
      });
    }

    if (regionsNeedingLocalTextures.length === 0 && regionsNeedingRemoteTextures.length === 0) {
      initialLoadDoneRef.current = true;
    }
  }, [regions, updateRegion]);

  // Load textures for tokens
  useEffect(() => {
    const tokensNeedingRemoteTextures: { id: string; hash: string }[] = [];

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
        tokensNeedingRemoteTextures.push({ id: token.id, hash: token.imageHash });
      }
    });

    // Load remote token textures
    if (tokensNeedingRemoteTextures.length > 0) {
      tokensNeedingRemoteTextures.forEach(({ id, hash }) => {
        pendingLoadsRef.current.add(`token:${id}`);
        notifyTextureDownloadStart(hash);
      });

      tokensNeedingRemoteTextures.forEach(async ({ id, hash }) => {
        try {
          // Try local cache first
          let dataUrl = await loadTokenTextureByHash(hash);
          
          if (!dataUrl) {
            // Request from server
            dataUrl = await requestTextureFromServer(hash);
            
            if (dataUrl) {
              await saveTokenTextureByHash(hash, dataUrl);
            }
          }

          if (dataUrl) {
            updateTokenImage(id, dataUrl, hash);
            cacheTexture(hash, dataUrl);
            notifyTextureDownloadComplete(hash);
          } else {
            notifyTextureDownloadError(hash);
          }
        } catch (error) {
          console.error(`Failed to load remote texture for token ${id}:`, error);
          notifyTextureDownloadError(hash);
        } finally {
          pendingLoadsRef.current.delete(`token:${id}`);
          loadedTokensRef.current.add(id);
        }
      });
    }
  }, [tokens, updateTokenImage]);

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
