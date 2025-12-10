import { useEffect, useRef, useCallback } from 'react';
import { useRegionStore } from '@/stores/regionStore';
import { 
  loadRegionTextures, 
  saveRegionTexture, 
  removeRegionTexture 
} from '@/lib/textureStorage';

/**
 * Hook to manage texture loading from IndexedDB
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
    // Find regions that need textures loaded from IndexedDB
    const regionsNeedingTextures = regions.filter(region => {
      // Skip if already loaded or pending
      if (loadedRegionsRef.current.has(region.id)) return false;
      if (pendingLoadsRef.current.has(region.id)) return false;
      // Skip if region already has a texture in memory (set by user)
      if (region.backgroundImage) {
        loadedRegionsRef.current.add(region.id);
        return false;
      }
      return true;
    });

    if (regionsNeedingTextures.length === 0) {
      initialLoadDoneRef.current = true;
      return;
    }

    const regionIds = regionsNeedingTextures.map(r => r.id);
    regionIds.forEach(id => pendingLoadsRef.current.add(id));

    loadRegionTextures(regionIds).then(textureMap => {
      textureMap.forEach((dataUrl, regionId) => {
        // Update region with loaded texture
        // Use a special internal flag to prevent re-saving to IndexedDB
        updateRegion(regionId, { 
          backgroundImage: dataUrl 
        });
        loadedRegionsRef.current.add(regionId);
      });

      regionIds.forEach(id => {
        pendingLoadsRef.current.delete(id);
        loadedRegionsRef.current.add(id);
      });
      
      initialLoadDoneRef.current = true;
    }).catch(error => {
      console.error('Failed to load textures:', error);
      regionIds.forEach(id => pendingLoadsRef.current.delete(id));
      initialLoadDoneRef.current = true;
    });
  }, [regions, updateRegion]);

  // Save texture to IndexedDB
  const saveTexture = useCallback(async (regionId: string, dataUrl: string) => {
    try {
      await saveRegionTexture(regionId, dataUrl);
      loadedRegionsRef.current.add(regionId);
    } catch (error) {
      console.error('Failed to save texture:', error);
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
