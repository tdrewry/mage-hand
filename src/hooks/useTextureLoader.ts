import { useEffect, useRef, useCallback } from 'react';
import { useRegionStore } from '@/stores/regionStore';
import { 
  loadRegionTextures, 
  saveRegionTexture, 
  removeRegionTexture,
  loadTextureByHash,
  saveTextureByHash
} from '@/lib/textureStorage';
import { 
  requestTexture as requestTextureFromServer,
  uploadTexture,
  cacheTexture,
  hasLocalTexture
} from '@/lib/textureSync';

/**
 * Hook to manage texture loading from IndexedDB and multiplayer sync
 * Handles initial load and syncing textures when regions change
 */
export function useTextureLoader() {
  const regions = useRegionStore(state => state.regions);
  const updateRegion = useRegionStore(state => state.updateRegion);
  const loadedRegionsRef = useRef<Set<string>>(new Set());
  const pendingLoadsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);

  // Load textures for regions on mount and when new regions appear
  useEffect(() => {
    // Find regions that need textures loaded
    const regionsNeedingLocalTextures: string[] = [];
    const regionsNeedingRemoteTextures: { id: string; hash: string }[] = [];

    regions.forEach(region => {
      // Skip if already loaded or pending
      if (loadedRegionsRef.current.has(region.id)) return;
      if (pendingLoadsRef.current.has(region.id)) return;
      
      // Skip if region already has a texture in memory
      if (region.backgroundImage) {
        loadedRegionsRef.current.add(region.id);
        return;
      }

      // Check if region has a textureHash (from sync) but no backgroundImage
      if (region.textureHash) {
        // This region received a texture hash from multiplayer sync
        regionsNeedingRemoteTextures.push({ id: region.id, hash: region.textureHash });
      } else {
        // Try to load from local IndexedDB
        regionsNeedingLocalTextures.push(region.id);
      }
    });

    // Load local textures from IndexedDB
    if (regionsNeedingLocalTextures.length > 0) {
      regionsNeedingLocalTextures.forEach(id => pendingLoadsRef.current.add(id));

      loadRegionTextures(regionsNeedingLocalTextures).then(textureMap => {
        textureMap.forEach((dataUrl, regionId) => {
          updateRegion(regionId, { backgroundImage: dataUrl });
          loadedRegionsRef.current.add(regionId);
        });

        regionsNeedingLocalTextures.forEach(id => {
          pendingLoadsRef.current.delete(id);
          loadedRegionsRef.current.add(id);
        });
        
        initialLoadDoneRef.current = true;
      }).catch(error => {
        console.error('Failed to load textures:', error);
        regionsNeedingLocalTextures.forEach(id => pendingLoadsRef.current.delete(id));
        initialLoadDoneRef.current = true;
      });
    }

    // Load remote textures (from multiplayer sync)
    if (regionsNeedingRemoteTextures.length > 0) {
      regionsNeedingRemoteTextures.forEach(({ id }) => pendingLoadsRef.current.add(id));

      // Process each region that needs a remote texture
      regionsNeedingRemoteTextures.forEach(async ({ id, hash }) => {
        try {
          // First try local IndexedDB (might have been cached from previous session)
          let dataUrl = await loadTextureByHash(hash);
          
          // If not found locally, request from server
          if (!dataUrl) {
            dataUrl = await requestTextureFromServer(hash);
            
            // Save to local IndexedDB for future use
            if (dataUrl) {
              await saveTextureByHash(hash, dataUrl);
            }
          }

          if (dataUrl) {
            // Update region with the loaded texture
            updateRegion(id, { backgroundImage: dataUrl });
            cacheTexture(hash, dataUrl);
          }
        } catch (error) {
          console.error(`Failed to load remote texture for region ${id}:`, error);
        } finally {
          pendingLoadsRef.current.delete(id);
          loadedRegionsRef.current.add(id);
        }
      });
    }

    if (regionsNeedingLocalTextures.length === 0 && regionsNeedingRemoteTextures.length === 0) {
      initialLoadDoneRef.current = true;
    }
  }, [regions, updateRegion]);

  // Save texture to IndexedDB and upload to server for sync
  const saveTexture = useCallback(async (regionId: string, dataUrl: string): Promise<string> => {
    try {
      // Save locally and get the hash
      const hash = await saveRegionTexture(regionId, dataUrl);
      loadedRegionsRef.current.add(regionId);
      
      // Upload to server for multiplayer sync
      await uploadTexture(hash, dataUrl);
      
      return hash;
    } catch (error) {
      console.error('Failed to save texture:', error);
      throw error;
    }
  }, []);

  // Remove texture from IndexedDB
  const removeTexture = useCallback(async (regionId: string) => {
    try {
      await removeRegionTexture(regionId);
      loadedRegionsRef.current.delete(regionId);
    } catch (error) {
      console.error('Failed to remove texture:', error);
    }
  }, []);

  return { saveTexture, removeTexture };
}
