/**
 * Hook for managing PixiJS post-processing layer
 * Integrates with the fog of war system for GPU-accelerated effects
 */

import { useEffect, useRef, useCallback } from 'react';
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

interface UsePostProcessingOptions {
  containerRef: React.RefObject<HTMLElement>;
  enabled: boolean;
  width: number;
  height: number;
}

export function usePostProcessing({
  containerRef,
  enabled,
  width,
  height,
}: UsePostProcessingOptions) {
  const initRef = useRef(false);
  const { effectSettings } = useFogStore();

  // Initialize PixiJS when enabled
  useEffect(() => {
    if (!enabled || !containerRef.current || !effectSettings.postProcessingEnabled) {
      if (initRef.current) {
        setPostProcessingVisible(false);
      }
      return;
    }

    const init = async () => {
      if (!containerRef.current) return;

      const success = await initPostProcessing(containerRef.current, {
        width,
        height,
        resolution: window.devicePixelRatio || 1,
      });

      if (success) {
        initFogCanvas(width, height);
        initRef.current = true;
        setPostProcessingVisible(true);
      }
    };

    if (!initRef.current) {
      init();
    } else {
      setPostProcessingVisible(true);
    }

    return () => {
      // Don't cleanup on every effect change, just hide
      setPostProcessingVisible(false);
    };
  }, [enabled, effectSettings.postProcessingEnabled, containerRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (initRef.current) {
        cleanupPostProcessing();
        cleanupFogPostProcessing();
        initRef.current = false;
      }
    };
  }, []);

  // Update size when canvas resizes
  useEffect(() => {
    if (initRef.current && isPostProcessingReady()) {
      resizePostProcessing(width, height);
      resizeFogCanvas(width, height);
    }
  }, [width, height]);

  // Update effect settings when they change
  useEffect(() => {
    if (initRef.current && isPostProcessingReady()) {
      updateEffectSettings({
        edgeBlur: effectSettings.edgeBlur,
        bloomIntensity: effectSettings.bloomIntensity,
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
      transform: { x: number; y: number; zoom: number }
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
        transform
      );
    },
    [width, height, effectSettings.postProcessingEnabled]
  );

  return {
    isReady: initRef.current && isPostProcessingReady(),
    applyEffects,
  };
}
