/**
 * Hook to compute the set of active map IDs and provide entity filtering helpers.
 * Used by the rendering pipeline to only show entities scoped to currently-active maps.
 *
 * Entities whose `mapId` is undefined (legacy data) are treated as belonging to
 * every active map so they remain visible until explicitly assigned.
 *
 * When map focus effects are active (blur/opacity), entities from non-focused
 * active maps are excluded entirely — they should not bleed through the focused map.
 */

import { useMemo } from 'react';
import { useMapStore } from '@/stores/mapStore';
import { useMapFocusStore, isFocusEffectActive } from '@/stores/mapFocusStore';

/**
 * Returns a stable Set of active map IDs and a generic filter predicate.
 * When focus effects are active, only entities on the focused (selected) map pass.
 */
export function useActiveMapFilter() {
  const maps = useMapStore((s) => s.maps);
  const selectedMapId = useMapStore((s) => s.selectedMapId);
  const unfocusedOpacity = useMapFocusStore((s) => s.unfocusedOpacity);
  const unfocusedBlur = useMapFocusStore((s) => s.unfocusedBlur);

  const activeMapIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of maps) {
      if (m.active) ids.add(m.id);
    }
    return ids;
  }, [maps]);

  const focusActive = unfocusedOpacity < 1 || unfocusedBlur > 0;

  /**
   * Returns `true` when the entity should be rendered.
   * - Entities with no `mapId` (legacy) pass through only if focus is inactive.
   * - When focus is active, only entities on the selected map are visible.
   */
  const isEntityVisible = useMemo(() => {
    if (focusActive && selectedMapId) {
      // Strict: only entities on the focused map (or unassigned legacy)
      return (mapId: string | undefined) =>
        mapId === undefined || mapId === selectedMapId;
    }
    // Normal: all active maps
    return (mapId: string | undefined) =>
      mapId === undefined || activeMapIds.has(mapId);
  }, [activeMapIds, focusActive, selectedMapId]);

  return { activeMapIds, isEntityVisible } as const;
}
