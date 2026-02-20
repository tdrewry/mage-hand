/**
 * Hook for managing PixiJS post-processing layer
 * Integrates with the fog of war system for GPU-accelerated effects
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useFogStore } from '@/stores/fogStore';
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
  width: number;
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
  // Keep a ref in sync so redrawCanvas closures always read the latest value
  const isReadyRef = useRef(false);
  const initRef = useRef(false);
  const initializingRef = useRef(false);
  const { effectSettings } = useFogStore();

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

    const init = async () => {
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

  // Update size when canvas resizes
  useEffect(() => {
    if (initRef.current && isPostProcessingReady() && width > 0 && height > 0) {
      resizePostProcessing(width, height);
      resizeFogCanvas(width, height);
    }
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
    // Expose both the reactive state (for triggering re-renders) and the ref
    // (for use inside canvas draw callbacks that capture stale closures).
    isReady,
    isReadyRef,
    applyEffects,
  };
}
