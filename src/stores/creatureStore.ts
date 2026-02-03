import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DndBeyondCharacter, Monster5eTools } from '@/types/creatureTypes';

interface CreatureStore {
  // Characters from D&D Beyond
  characters: DndBeyondCharacter[];
  addCharacter: (char: DndBeyondCharacter) => void;
  updateCharacter: (id: string, updates: Partial<DndBeyondCharacter>) => void;
  removeCharacter: (id: string) => void;
  getCharacterById: (id: string) => DndBeyondCharacter | undefined;
  
  // Monsters from 5e.tools or imports
  monsters: Monster5eTools[];
  addMonster: (monster: Monster5eTools) => void;
  addMonsters: (monsters: Monster5eTools[]) => void;
  updateMonster: (id: string, updates: Partial<Monster5eTools>) => void;
  removeMonster: (id: string) => void;
  clearMonsters: () => void;
  getMonsterById: (id: string) => Monster5eTools | undefined;
  
  // Search functionality
  searchCharacters: (query: string) => DndBeyondCharacter[];
  searchMonsters: (query: string, options?: MonsterSearchOptions) => Monster5eTools[];
  
  // Get any creature by ID
  getCreatureById: (id: string) => DndBeyondCharacter | Monster5eTools | undefined;
  getCreatureType: (id: string) => 'character' | 'monster' | undefined;
  
  // Bestiary loading state
  bestiaryLoaded: boolean;
  bestiaryLoading: boolean;
  setBestiaryLoading: (loading: boolean) => void;
  setBestiaryLoaded: (loaded: boolean) => void;
}

interface MonsterSearchOptions {
  size?: string;
  type?: string;
  crMin?: number;
  crMax?: number;
  source?: string;
  limit?: number;
}

// Parse CR to numeric value for comparison
function parseCR(cr: string | number): number {
  if (typeof cr === 'number') return cr;
  if (cr === '1/8') return 0.125;
  if (cr === '1/4') return 0.25;
  if (cr === '1/2') return 0.5;
  return parseFloat(cr) || 0;
}

export const useCreatureStore = create<CreatureStore>()(
  persist(
    (set, get) => ({
      // Characters
      characters: [],
      
      addCharacter: (char) => {
        set((state) => {
          // Check for duplicate by ID or sourceUrl
          const exists = state.characters.some(
            (c) => c.id === char.id || c.sourceUrl === char.sourceUrl
          );
          if (exists) {
            // Update existing character
            return {
              characters: state.characters.map((c) =>
                c.id === char.id || c.sourceUrl === char.sourceUrl
                  ? { ...c, ...char, lastUpdated: new Date().toISOString() }
                  : c
              ),
            };
          }
          return { characters: [...state.characters, char] };
        });
      },
      
      updateCharacter: (id, updates) => {
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === id ? { ...c, ...updates, lastUpdated: new Date().toISOString() } : c
          ),
        }));
      },
      
      removeCharacter: (id) => {
        set((state) => ({
          characters: state.characters.filter((c) => c.id !== id),
        }));
      },
      
      getCharacterById: (id) => {
        return get().characters.find((c) => c.id === id);
      },
      
      // Monsters
      monsters: [],
      
      addMonster: (monster) => {
        set((state) => {
          const exists = state.monsters.some((m) => m.id === monster.id);
          if (exists) {
            return {
              monsters: state.monsters.map((m) =>
                m.id === monster.id ? { ...m, ...monster } : m
              ),
            };
          }
          return { monsters: [...state.monsters, monster] };
        });
      },
      
      addMonsters: (monsters) => {
        set((state) => {
          const existingIds = new Set(state.monsters.map((m) => m.id));
          const newMonsters = monsters.filter((m) => !existingIds.has(m.id));
          const updatedMonsters = state.monsters.map((existing) => {
            const updated = monsters.find((m) => m.id === existing.id);
            return updated ? { ...existing, ...updated } : existing;
          });
          return { monsters: [...updatedMonsters, ...newMonsters] };
        });
      },
      
      updateMonster: (id, updates) => {
        set((state) => ({
          monsters: state.monsters.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        }));
      },
      
      removeMonster: (id) => {
        set((state) => ({
          monsters: state.monsters.filter((m) => m.id !== id),
        }));
      },
      
      clearMonsters: () => {
        set({ monsters: [], bestiaryLoaded: false });
      },
      
      getMonsterById: (id) => {
        return get().monsters.find((m) => m.id === id);
      },
      
      // Search
      searchCharacters: (query) => {
        const { characters } = get();
        if (!query.trim()) return characters;
        
        const lowerQuery = query.toLowerCase();
        return characters.filter(
          (c) =>
            c.name.toLowerCase().includes(lowerQuery) ||
            c.race.toLowerCase().includes(lowerQuery) ||
            c.classes.some((cls) => cls.name.toLowerCase().includes(lowerQuery))
        );
      },
      
      searchMonsters: (query, options) => {
        const { monsters } = get();
        let results = monsters;
        
        // Text search
        if (query.trim()) {
          const lowerQuery = query.toLowerCase();
          results = results.filter(
            (m) => {
              const monsterType = m.type;
              const typeString = typeof monsterType === 'object' ? monsterType.type : String(monsterType);
              return (
                m.name.toLowerCase().includes(lowerQuery) ||
                typeString.toLowerCase().includes(lowerQuery)
              );
            }
          );
        }
        
        // Filter by size
        if (options?.size) {
          results = results.filter((m) => m.size === options.size);
        }
        
        // Filter by type
        if (options?.type) {
          const lowerType = options.type.toLowerCase();
          results = results.filter((m) => {
            const monsterType = typeof m.type === 'object' ? m.type.type : m.type;
            return monsterType.toLowerCase().includes(lowerType);
          });
        }
        
        // Filter by CR range
        if (options?.crMin !== undefined) {
          results = results.filter((m) => parseCR(m.cr) >= options.crMin!);
        }
        if (options?.crMax !== undefined) {
          results = results.filter((m) => parseCR(m.cr) <= options.crMax!);
        }
        
        // Filter by source
        if (options?.source) {
          results = results.filter((m) => m.source === options.source);
        }
        
        // Apply limit
        if (options?.limit) {
          results = results.slice(0, options.limit);
        }
        
        return results;
      },
      
      // Get any creature
      getCreatureById: (id) => {
        const { characters, monsters } = get();
        return characters.find((c) => c.id === id) || monsters.find((m) => m.id === id);
      },
      
      getCreatureType: (id) => {
        const { characters, monsters } = get();
        if (characters.some((c) => c.id === id)) return 'character';
        if (monsters.some((m) => m.id === id)) return 'monster';
        return undefined;
      },
      
      // Loading state
      bestiaryLoaded: false,
      bestiaryLoading: false,
      
      setBestiaryLoading: (loading) => {
        set({ bestiaryLoading: loading });
      },
      
      setBestiaryLoaded: (loaded) => {
        set({ bestiaryLoaded: loaded, bestiaryLoading: false });
      },
    }),
    {
      name: 'vtt-creatures',
      partialize: (state) => ({
        characters: state.characters,
        monsters: state.monsters,
        bestiaryLoaded: state.bestiaryLoaded,
      }),
    }
  )
);
