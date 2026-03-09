/**
 * Hook for managing PixiJS post-processing layer
 * Integrates with the fog of war system for GPU-accelerated effects
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useFogStore } from '@/stores/fogStore';
import { useMapStore } from '@/stores/mapStore';
import {
  initPostProcessing,
  cleanupPostProcessing,
  resizePostProcessing,
  repositionPostProcessing,
  setPostProcessingVisible,
  updateEffectSettings,
  isPostProcessingReady,
} from '@/lib/postProcessingLayer';
import {
  initFogCanvas,
  resizeFogCanvas,
  applyFogPostProcessing,
  cleanupFogPostProcessing,
} from '@/lib/fogPostProcessing';
import type { IlluminationSource } from '@/types/illumination';

interface UsePostProcessingOptions {
  containerRef: React.RefObject<HTMLElement>;
  enabled: boolean;
  /** Content bbox width in CSS px (may be larger than viewport for large maps). */
  width: number;
  /** Content bbox height in CSS px (may be larger than viewport for large maps). */
  height: number;
  /** CSS px distance from container origin to content bbox top-left (X axis). Default 0. */
  originX?: number;
  /** CSS px distance from container origin to content bbox top-left (Y axis). Default 0. */
  originY?: number;
}

export interface IlluminationData {
  sources: IlluminationSource[];
  gridSize: number;
  transform: { x: number; y: number; zoom: number };
}

export function usePostProcessing({
  containerRef,
  enabled,
  width,
  height,
  originX = 0,
  originY = 0,
}: UsePostProcessingOptions) {
  const [isReady, setIsReady] = useState(false);
  // Keep a ref in sync so redrawCanvas closures always read the latest value
  const isReadyRef = useRef(false);
  const initRef = useRef(false);
  const initializingRef = useRef(false);
  const selectedMapId = useMapStore(s => s.selectedMapId);
  const effectSettings = useFogStore(s => s.getMapFogSettings(selectedMapId || 'default-map').effectSettings);

  const setReady = (val: boolean) => {
    isReadyRef.current = val;
    setIsReady(val);
  };

  // Initialize PixiJS when enabled and dimensions are valid
  useEffect(() => {
    // Skip if dimensions are invalid
    if (width <= 0 || height <= 0) {
      return;
    }

    if (!enabled || !containerRef.current || !effectSettings.postProcessingEnabled) {
      // Only hide — don't destroy — so re-enabling is instant
      if (initRef.current) {
        setPostProcessingVisible(false);
        setReady(false);
      }
      return;
    }

    const init = async (retryCount = 0) => {
      if (!containerRef.current || initializingRef.current) return;
      
      initializingRef.current = true;

      const success = await initPostProcessing(containerRef.current, {
        width,
        height,
        originX,
        originY,
        resolution: window.devicePixelRatio || 1,
      });

      if (success) {
        initFogCanvas(width, height, undefined, originX, originY);
        initRef.current = true;
        setPostProcessingVisible(true);
        setReady(true);
      } else if (retryCount < 2) {
        // GPU context may have been lost after idle — retry after a short delay
        console.warn(`Post-processing init failed, retrying (${retryCount + 1}/2)…`);
        initializingRef.current = false;
        setTimeout(() => init(retryCount + 1), 1000);
        return;
      }
      
      initializingRef.current = false;
    };

    if (!initRef.current) {
      init();
    } else {
      // Already initialised — just make sure it's visible and mark ready
      setPostProcessingVisible(true);
      setReady(true);
    }

    // No cleanup here — we don't want to hide the layer on every dep change.
    // Hiding is handled explicitly in the `!enabled` branch above.
  }, [enabled, effectSettings.postProcessingEnabled, containerRef, width, height, originX, originY]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (initRef.current) {
        cleanupPostProcessing();
        cleanupFogPostProcessing();
        initRef.current = false;
        setReady(false);
      }
    };
  }, []);

  // Update size/origin when content bounds change.
  // Expensive GPU resize only when dimensions change significantly (>10%).
  // Origin-only changes use cheap CSS repositioning.
  const lastResizeDims = useRef({ width: 0, height: 0, originX: 0, originY: 0 });
  useEffect(() => {
    if (!initRef.current || !isPostProcessingReady() || width <= 0 || height <= 0) return;

    const prev = lastResizeDims.current;
    const wRatio = prev.width > 0 ? Math.abs(width - prev.width) / prev.width : 1;
    const hRatio = prev.height > 0 ? Math.abs(height - prev.height) / prev.height : 1;
    const dimsChanged = wRatio > 0.1 || hRatio > 0.1 || prev.width === 0;

    if (dimsChanged) {
      // Full GPU resize (expensive — clears WebGL canvas)
      lastResizeDims.current = { width, height, originX, originY };
      resizePostProcessing(width, height, originX, originY);
      resizeFogCanvas(width, height, undefined, originX, originY);
    } else if (originX !== prev.originX || originY !== prev.originY) {
      // Origin shifted but canvas is big enough — cheap CSS reposition only
      lastResizeDims.current = { ...prev, originX, originY };
      repositionPostProcessing(originX, originY);
    }
  }, [width, height, originX, originY]);

  // Update effect settings when they change
  useEffect(() => {
    if (initRef.current && isPostProcessingReady()) {
      updateEffectSettings({
        edgeBlur: effectSettings.edgeBlur,
        lightFalloff: effectSettings.lightFalloff,
        volumetricEnabled: effectSettings.volumetricEnabled,
        effectQuality: effectSettings.effectQuality,
      });
    }
  }, [effectSettings]);

  // Method to apply fog effects
  const applyEffects = useCallback(
    (
      sourceCtx: CanvasRenderingContext2D,
      fogMasks: { unexploredMask: Path2D; exploredOnlyMask: Path2D } | null,
      fogOpacity: number,
      exploredOpacity: number,
      transform: { x: number; y: number; zoom: number },
      illuminationData?: IlluminationData
    ) => {
      if (!initRef.current || !isPostProcessingReady() || !effectSettings.postProcessingEnabled) {
        return;
      }

      applyFogPostProcessing(
        sourceCtx,
        fogMasks,
        fogOpacity,
        exploredOpacity,
        width,
        height,
        transform,
        illuminationData,
        originX,
        originY
      );
    },
    [width, height, originX, originY, effectSettings.postProcessingEnabled]
  );

  return {
    // Expose both the reactive state (for triggering re-renders) and the ref
    // (for use inside canvas draw callbacks that capture stale closures).
    isReady,
    isReadyRef,
    applyEffects,
  };
}
