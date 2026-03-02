/**
 * Hook to compute the set of active map IDs and provide entity filtering helpers.
 * Used by the rendering pipeline to only show entities scoped to currently-active maps.
 *
 * Entities whose `mapId` is undefined (legacy data) are treated as belonging to
 * every active map so they remain visible until explicitly assigned.
 */

import { useMemo } from 'react';
import { useMapStore } from '@/stores/mapStore';

/**
 * Returns a stable Set of active map IDs and a generic filter predicate.
 */
export function useActiveMapFilter() {
  const maps = useMapStore((s) => s.maps);

  const activeMapIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of maps) {
      if (m.active) ids.add(m.id);
    }
    return ids;
  }, [maps]);

  /**
   * Returns `true` when the entity should be rendered.
   * Entities with no `mapId` (legacy) pass through.
   */
  const isEntityVisible = useMemo(() => {
    return (mapId: string | undefined) =>
      mapId === undefined || activeMapIds.has(mapId);
  }, [activeMapIds]);

  return { activeMapIds, isEntityVisible } as const;
}
