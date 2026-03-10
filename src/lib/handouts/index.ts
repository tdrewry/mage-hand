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

export function getHandoutById(id: string): HandoutEntry | undefined {
  return BUILTIN_HANDOUTS.find(h => h.id === id);
}
