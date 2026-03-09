/**
 * Hook for managing PixiJS post-processing layer
 * Integrates with the fog of war system for GPU-accelerated effects
 *
 * The PixiJS canvas is viewport-sized — it never resizes on zoom or pan,
 * only when the browser window resizes.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useFogStore } from '@/stores/fogStore';
import { useMapStore } from '@/stores/mapStore';
import {
  initPostProcessing,
  cleanupPostProcessing,
  resizePostProcessing,
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
  /** Viewport width in CSS px. */
  width: number;
  /** Viewport height in CSS px. */
  height: number;
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
}: UsePostProcessingOptions) {
  const [isReady, setIsReady] = useState(false);
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
    if (width <= 0 || height <= 0) return;

    if (!enabled || !containerRef.current || !effectSettings.postProcessingEnabled) {
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
        resolution: window.devicePixelRatio || 1,
      });

      if (success) {
        initFogCanvas(width, height);
        initRef.current = true;
        setPostProcessingVisible(true);
        setReady(true);
      } else if (retryCount < 2) {
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
      setPostProcessingVisible(true);
      setReady(true);
    }
  }, [enabled, effectSettings.postProcessingEnabled, containerRef, width, height]);

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

  // Resize only when viewport dimensions change (window resize)
  useEffect(() => {
    if (!initRef.current || !isPostProcessingReady() || width <= 0 || height <= 0) return;

    resizePostProcessing(width, height);
    resizeFogCanvas(width, height);
  }, [width, height]);

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
        illuminationData
      );
    },
    [width, height, effectSettings.postProcessingEnabled]
  );

  return {
    isReady,
    isReadyRef,
    applyEffects,
  };
}
