import type { Monster5eTools, MonsterType } from '@/types/creatureTypes';

/**
 * Monster Data Loader
 * Handles loading and processing of 5e.tools format monster data
 */

// IndexedDB database name for monster cache
const DB_NAME = 'vtt-bestiary';
const DB_VERSION = 1;
const STORE_NAME = 'monsters';

/**
 * Initialize IndexedDB for monster storage
 */
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('source', 'source', { unique: false });
        store.createIndex('cr', 'cr', { unique: false });
      }
    };
  });
}

/**
 * Save monsters to IndexedDB cache
 */
export async function cacheMonsters(monsters: Monster5eTools[]): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  
  for (const monster of monsters) {
    store.put(monster);
  }
  
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Load monsters from IndexedDB cache
 */
export async function loadCachedMonsters(): Promise<Monster5eTools[]> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear monster cache
 */
export async function clearMonsterCache(): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Parse raw 5e.tools JSON data into our Monster format
 */
export function parse5eToolsMonsters(data: unknown): Monster5eTools[] {
  if (!data || typeof data !== 'object') {
    console.warn('Invalid monster data format');
    return [];
  }
  
  // 5e.tools format: { monster: [...] } or direct array
  const rawMonsters = Array.isArray(data) 
    ? data 
    : (data as Record<string, unknown>).monster as unknown[] | undefined;
  
  if (!Array.isArray(rawMonsters)) {
    console.warn('No monster array found in data');
    return [];
  }
  
  return rawMonsters
    .filter((m): m is Record<string, unknown> => m !== null && typeof m === 'object')
    .map((raw) => transformMonster(raw))
    .filter((m): m is Monster5eTools => m !== null);
}

/**
 * Transform a single raw monster entry to our format
 */
function transformMonster(raw: Record<string, unknown>): Monster5eTools | null {
  try {
    const name = raw.name as string;
    const source = (raw.source as string) || 'Unknown';
    
    if (!name) return null;
    
    // Generate unique ID
    const id = `${source.toLowerCase()}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    
    // Parse type
    const type = parseMonsterType(raw.type);
    
    // Parse AC
    const ac = parseAC(raw.ac);
    
    // Parse HP
    const hp = parseHP(raw.hp);
    
    // Parse speed
    const speed = parseSpeed(raw.speed);
    
    // Parse alignment
    const alignment = parseAlignment(raw.alignment);
    
    // Build monster object
    const monster: Monster5eTools = {
      id,
      name,
      source,
      page: raw.page as number | undefined,
      size: (raw.size as string)?.[0]?.toUpperCase() as Monster5eTools['size'] || 'M',
      type,
      alignment,
      ac,
      hp,
      speed,
      str: (raw.str as number) || 10,
      dex: (raw.dex as number) || 10,
      con: (raw.con as number) || 10,
      int: (raw.int as number) || 10,
      wis: (raw.wis as number) || 10,
      cha: (raw.cha as number) || 10,
      cr: raw.cr as string | number || '0',
      save: raw.save as Record<string, string> | undefined,
      skill: raw.skill as Record<string, string> | undefined,
      senses: raw.senses as string[] | undefined,
      passive: (raw.passive as number) || 10,
      languages: raw.languages as string[] | undefined,
      immune: raw.immune as string[] | undefined,
      resist: raw.resist as string[] | undefined,
      vulnerable: raw.vulnerable as string[] | undefined,
      conditionImmune: raw.conditionImmune as string[] | undefined,
      trait: raw.trait as Monster5eTools['trait'],
      action: raw.action as Monster5eTools['action'],
      legendary: raw.legendary as Monster5eTools['legendary'],
      legendaryActions: raw.legendaryActions as number | undefined,
      reaction: raw.reaction as Monster5eTools['reaction'],
      bonus: raw.bonus as Monster5eTools['bonus'],
      spellcasting: raw.spellcasting as Monster5eTools['spellcasting'],
      environment: raw.environment as string[] | undefined,
    };
    
    // Try to extract image URLs
    if (raw.tokenUrl) {
      monster.tokenUrl = raw.tokenUrl as string;
    }
    
    if (raw.fluff) {
      const fluff = raw.fluff as Record<string, unknown>;
      if (Array.isArray(fluff.images)) {
        monster.fluffImages = fluff.images.map((img: unknown) => ({
          url: typeof img === 'string' ? img : (img as Record<string, unknown>).href as string,
          type: (img as Record<string, unknown>)?.type as string | undefined,
        }));
      }
    }
    
    return monster;
  } catch (error) {
    console.warn('Failed to parse monster:', error);
    return null;
  }
}

/**
 * Parse monster type from various formats
 */
function parseMonsterType(raw: unknown): MonsterType {
  if (typeof raw === 'string') {
    return { type: raw };
  }
  
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return {
      type: (obj.type as string) || 'unknown',
      tags: obj.tags as string[] | undefined,
      swarmSize: obj.swarmSize as MonsterType['swarmSize'],
    };
  }
  
  return { type: 'unknown' };
}

/**
 * Parse AC from various formats
 */
function parseAC(raw: unknown): Monster5eTools['ac'] {
  if (typeof raw === 'number') {
    return [{ ac: raw }];
  }
  
  if (Array.isArray(raw)) {
    return raw.map((entry) => {
      if (typeof entry === 'number') {
        return { ac: entry };
      }
      if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        return {
          ac: (obj.ac as number) || 10,
          from: obj.from as string[] | undefined,
          condition: obj.condition as string | undefined,
        };
      }
      return { ac: 10 };
    });
  }
  
  return [{ ac: 10 }];
}

/**
 * Parse HP from various formats
 */
function parseHP(raw: unknown): Monster5eTools['hp'] {
  if (typeof raw === 'number') {
    return { average: raw, formula: `${raw}` };
  }
  
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return {
      average: (obj.average as number) || 1,
      formula: (obj.formula as string) || `${obj.average || 1}`,
    };
  }
  
  return { average: 1, formula: '1' };
}

/**
 * Parse speed from various formats
 */
function parseSpeed(raw: unknown): Monster5eTools['speed'] {
  if (!raw || typeof raw !== 'object') {
    return { walk: 30 };
  }
  
  const obj = raw as Record<string, unknown>;
  const speed: Monster5eTools['speed'] = {};
  
  const parseSpeedValue = (val: unknown) => {
    if (typeof val === 'number') return val;
    if (val && typeof val === 'object') {
      const v = val as Record<string, unknown>;
      return { number: v.number as number || 0, condition: v.condition as string || '' };
    }
    return undefined;
  };
  
  if (obj.walk !== undefined) speed.walk = parseSpeedValue(obj.walk);
  if (obj.fly !== undefined) speed.fly = parseSpeedValue(obj.fly);
  if (obj.swim !== undefined) speed.swim = parseSpeedValue(obj.swim);
  if (obj.climb !== undefined) speed.climb = parseSpeedValue(obj.climb);
  if (obj.burrow !== undefined) speed.burrow = parseSpeedValue(obj.burrow);
  if (obj.hover) speed.hover = true;
  if (obj.canHover) speed.canHover = true;
  
  return speed;
}

/**
 * Parse alignment from various formats
 */
function parseAlignment(raw: unknown): string[] | undefined {
  if (!raw) return undefined;
  
  if (typeof raw === 'string') {
    return [raw];
  }
  
  if (Array.isArray(raw)) {
    return raw.map((a) => {
      if (typeof a === 'string') return a;
      if (a && typeof a === 'object') {
        const obj = a as Record<string, unknown>;
        return obj.alignment as string || 'unaligned';
      }
      return 'unaligned';
    });
  }
  
  return undefined;
}

/**
 * Load bundled SRD bestiary data
 */
export async function loadBundledBestiary(): Promise<Monster5eTools[]> {
  try {
    const response = await fetch('/data/srd-bestiary.json');
    if (!response.ok) {
      console.warn('Bundled bestiary not found, returning empty array');
      return [];
    }
    const data = await response.json();
    return parse5eToolsMonsters(data);
  } catch (error) {
    console.warn('Failed to load bundled bestiary:', error);
    return [];
  }
}

/**
 * Load monsters from a JSON string (user paste/import)
 */
export function parseMonsterJson(jsonString: string): { monsters: Monster5eTools[]; error?: string } {
  try {
    const data = JSON.parse(jsonString);
    const monsters = parse5eToolsMonsters(data);
    
    if (monsters.length === 0) {
      return { monsters: [], error: 'No valid monsters found in JSON data' };
    }
    
    return { monsters };
  } catch (error) {
    return { 
      monsters: [], 
      error: error instanceof Error ? error.message : 'Failed to parse JSON' 
    };
  }
}

/**
 * Get unique sources from monster list
 */
export function getUniqueSources(monsters: Monster5eTools[]): string[] {
  const sources = new Set<string>();
  monsters.forEach((m) => sources.add(m.source));
  return Array.from(sources).sort();
}

/**
 * Get unique creature types from monster list
 */
export function getUniqueTypes(monsters: Monster5eTools[]): string[] {
  const types = new Set<string>();
  monsters.forEach((m) => {
    const type = typeof m.type === 'object' ? m.type.type : m.type;
    types.add(type);
  });
  return Array.from(types).sort();
}

/**
 * Format CR for display
 */
export function formatCR(cr: string | number): string {
  if (typeof cr === 'number') return String(cr);
  return cr;
}

/**
 * Get CR numeric value for sorting
 */
export function getCRNumeric(cr: string | number): number {
  if (typeof cr === 'number') return cr;
  if (cr === '1/8') return 0.125;
  if (cr === '1/4') return 0.25;
  if (cr === '1/2') return 0.5;
  return parseFloat(cr) || 0;
}

/**
 * Sort monsters by CR
 */
export function sortMonstersByCR(monsters: Monster5eTools[]): Monster5eTools[] {
  return [...monsters].sort((a, b) => getCRNumeric(a.cr) - getCRNumeric(b.cr));
}

/**
 * Sort monsters alphabetically
 */
export function sortMonstersAlphabetically(monsters: Monster5eTools[]): Monster5eTools[] {
  return [...monsters].sort((a, b) => a.name.localeCompare(b.name));
}
