/**
 * Hook for managing region edge post-processing with PixiJS
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  initRegionEdgeProcessing,
  cleanupRegionEdgeProcessing,
  updateRegionTexture,
  updateHatchingSettings,
  updateHatchingZoom,
  updateHatchingOffset,
  resizeRegionEdgeProcessing,
  setRegionEdgeVisible,
  renderRegionEdges,
  isRegionEdgeReady,
} from '@/lib/regionEdgePostProcessing';
import { useHatchingStore } from '@/stores/hatchingStore';
import type { CanvasRegion } from '@/stores/regionStore';

interface UseRegionEdgeProcessingProps {
  containerRef: React.RefObject<HTMLElement>;
  enabled: boolean;
  width: number;
  height: number;
}

export function useRegionEdgeProcessing({
  containerRef,
  enabled,
  width,
  height,
}: UseRegionEdgeProcessingProps) {
  const [isReady, setIsReady] = useState(false);
  const initializingRef = useRef(false);

  const { options: hatchingOptions, enabled: hatchingEnabled } = useHatchingStore();

  // Initialize/cleanup based on enabled state
  useEffect(() => {
    const shouldBeActive = enabled && hatchingEnabled && width > 0 && height > 0;

    if (shouldBeActive && containerRef.current && !initializingRef.current && !isRegionEdgeReady()) {
      initializingRef.current = true;

      initRegionEdgeProcessing(containerRef.current, { width, height })
        .then((success) => {
          setIsReady(success);
          if (success) {
            updateHatchingSettings(hatchingOptions);
          }
          initializingRef.current = false;
        })
        .catch(() => {
          initializingRef.current = false;
        });
    } else if (!shouldBeActive && isRegionEdgeReady()) {
      cleanupRegionEdgeProcessing().then(() => {
        setIsReady(false);
      });
    }

    // Update visibility
    if (isRegionEdgeReady()) {
      setRegionEdgeVisible(shouldBeActive);
    }
  }, [enabled, hatchingEnabled, width, height, containerRef, hatchingOptions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRegionEdgeProcessing();
    };
  }, []);

  // Handle resize
  useEffect(() => {
    if (isReady && width > 0 && height > 0) {
      resizeRegionEdgeProcessing(width, height);
    }
  }, [width, height, isReady]);

  // Update hatching settings when they change
  useEffect(() => {
    if (isReady) {
      updateHatchingSettings(hatchingOptions);
    }
  }, [hatchingOptions, isReady]);

  // Apply effects to regions
  const applyEffects = useCallback(
    (regions: CanvasRegion[], transform: { x: number; y: number; zoom: number }) => {
      if (!isReady || !hatchingEnabled) return;

      // Update zoom for proper scaling
      updateHatchingZoom(transform.zoom);
      
      // Update offset for world-space coordinate alignment (fixes pan issues)
      updateHatchingOffset(transform.x, transform.y);

      const updated = updateRegionTexture(regions, transform);
      if (updated) {
        renderRegionEdges();
      }
    },
    [isReady, hatchingEnabled]
  );

  return {
    isReady,
    applyEffects,
  };
}
