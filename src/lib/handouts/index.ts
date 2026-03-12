import { USER_GUIDE_MARKDOWN } from './userGuide';
import { DM_GUIDE_MARKDOWN } from './dmGuide';

export interface HandoutEntry {
  id: string;
  title: string;
  category: 'builtin' | 'custom';
  /** Lucide icon name */
  icon: string;
  markdown: string;
}

export const BUILTIN_HANDOUTS: HandoutEntry[] = [
  {
    id: 'user-guide',
    title: 'Magehand User Guide',
    category: 'builtin',
    icon: 'BookOpen',
    markdown: USER_GUIDE_MARKDOWN,
  },
  {
    id: 'dm-guide',
    title: 'Magehand Host & DM Guide',
    category: 'builtin',
    icon: 'Shield',
    markdown: DM_GUIDE_MARKDOWN,
  },
];

/**
 * Get all handouts (built-in + custom from store).
 * Must be called inside a React component or where Zustand getState is available.
 */
export function getAllHandouts(): HandoutEntry[] {
  // Lazy import to avoid circular dependency
  const { useHandoutStore } = require('@/stores/handoutStore');
  const custom = useHandoutStore.getState().customHandouts;
  return [...BUILTIN_HANDOUTS, ...custom];
}

export function getHandoutById(id: string): HandoutEntry | undefined {
  const builtin = BUILTIN_HANDOUTS.find(h => h.id === id);
  if (builtin) return builtin;
  // Search custom handouts
  const { useHandoutStore } = require('@/stores/handoutStore');
  return useHandoutStore.getState().customHandouts.find((h: HandoutEntry) => h.id === id);
}
