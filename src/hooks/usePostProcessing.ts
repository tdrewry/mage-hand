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

interface UsePostProcessingOptions {
  containerRef: React.RefObject<HTMLElement>;
  enabled: boolean;
  width: number;
  height: number;
}

interface TokenVisibilityData {
  position: { x: number; y: number };
  visionRange: number;
  visibilityPath: Path2D;
  isLightSource?: boolean; // Light sources get two-zone gradient rendering
}

export function usePostProcessing({
  containerRef,
  enabled,
  width,
  height,
}: UsePostProcessingOptions) {
  const [isReady, setIsReady] = useState(false);
  const initRef = useRef(false);
  const initializingRef = useRef(false);
  const { effectSettings } = useFogStore();

  // Initialize PixiJS when enabled and dimensions are valid
  useEffect(() => {
    // Skip if dimensions are invalid
    if (width <= 0 || height <= 0) {
      return;
    }

    if (!enabled || !containerRef.current || !effectSettings.postProcessingEnabled) {
      if (initRef.current) {
        setPostProcessingVisible(false);
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
        setIsReady(true);
        setPostProcessingVisible(true);
      }
      
      initializingRef.current = false;
    };

    if (!initRef.current) {
      init();
    } else {
      setPostProcessingVisible(true);
      setIsReady(true);
    }

    return () => {
      // Don't cleanup on every effect change, just hide
      setPostProcessingVisible(false);
    };
  }, [enabled, effectSettings.postProcessingEnabled, containerRef, width, height]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (initRef.current) {
        cleanupPostProcessing();
        cleanupFogPostProcessing();
        initRef.current = false;
        setIsReady(false);
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
      tokenVisibilityData: TokenVisibilityData[] = []
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
        tokenVisibilityData
      );
    },
    [width, height, effectSettings.postProcessingEnabled]
  );

  return {
    isReady,
    applyEffects,
  };
}
