import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface VisionProfile {
  id: string;
  name: string;
  visionRange: number; // grid units
  useGradients: boolean;
  
  // Gradient settings (only used if useGradients is true)
  innerFadeStart: number;    // 0-1
  midpointPosition: number;  // 0-1
  midpointOpacity: number;   // 0-1
  outerFadeStart: number;    // 0-1
  
  // Gradient opacity stops for colored vision overlay
  centerOpacity: number;     // 0-1 (default: 0)
  innerOpacity: number;      // 0-1 (default: 0)
  midpointColorOpacity: number; // 0-1 (default: 0.1)
  outerOpacity: number;      // 0-1 (default: 0.25)
  edgeOpacity: number;       // 0-1 (default: 0.4)
  
  // Color for UI display and vision overlay
  color: string;
}

interface VisionProfileState {
  profiles: VisionProfile[];
  
  // Actions
  addProfile: (profile: Omit<VisionProfile, 'id'>) => string;
  updateProfile: (id: string, updates: Partial<VisionProfile>) => void;
  removeProfile: (id: string) => void;
  getProfile: (id: string) => VisionProfile | undefined;
  resetToDefaults: () => void;
}

// Default vision profiles
const DEFAULT_PROFILES: VisionProfile[] = [
  {
    id: 'normal',
    name: 'Normal Vision (30ft)',
    visionRange: 6,
    useGradients: true,
    innerFadeStart: 0.7,
    midpointPosition: 0.85,
    midpointOpacity: 0.2,
    outerFadeStart: 0.95,
    centerOpacity: 0,
    innerOpacity: 0,
    midpointColorOpacity: 0.1,
    outerOpacity: 0.25,
    edgeOpacity: 0.4,
    color: '#FFD700',
  },
  {
    id: 'darkvision',
    name: 'Darkvision (60ft)',
    visionRange: 12,
    useGradients: true,
    innerFadeStart: 0.75,
    midpointPosition: 0.85,
    midpointOpacity: 0.15,
    outerFadeStart: 0.93,
    centerOpacity: 0,
    innerOpacity: 0,
    midpointColorOpacity: 0.15,
    outerOpacity: 0.3,
    edgeOpacity: 0.5,
    color: '#9370DB',
  },
  {
    id: 'superior',
    name: 'Superior Darkvision (120ft)',
    visionRange: 24,
    useGradients: true,
    innerFadeStart: 0.8,
    midpointPosition: 0.9,
    midpointOpacity: 0.1,
    outerFadeStart: 0.95,
    centerOpacity: 0,
    innerOpacity: 0,
    midpointColorOpacity: 0.08,
    outerOpacity: 0.2,
    edgeOpacity: 0.35,
    color: '#4169E1',
  },
  {
    id: 'lowlight',
    name: 'Low-Light Vision (60ft)',
    visionRange: 12,
    useGradients: true,
    innerFadeStart: 0.65,
    midpointPosition: 0.8,
    midpointOpacity: 0.25,
    outerFadeStart: 0.9,
    centerOpacity: 0,
    innerOpacity: 0,
    midpointColorOpacity: 0.12,
    outerOpacity: 0.28,
    edgeOpacity: 0.45,
    color: '#87CEEB',
  },
  {
    id: 'blindsight',
    name: 'Blindsight (30ft)',
    visionRange: 6,
    useGradients: false,
    innerFadeStart: 0.7,
    midpointPosition: 0.85,
    midpointOpacity: 0.2,
    outerFadeStart: 0.95,
    centerOpacity: 0,
    innerOpacity: 0,
    midpointColorOpacity: 0.1,
    outerOpacity: 0.25,
    edgeOpacity: 0.4,
    color: '#00CED1',
  },
  {
    id: 'blind',
    name: 'Blind (No Vision)',
    visionRange: 0,
    useGradients: false,
    innerFadeStart: 0.7,
    midpointPosition: 0.85,
    midpointOpacity: 0.2,
    outerFadeStart: 0.95,
    centerOpacity: 0,
    innerOpacity: 0,
    midpointColorOpacity: 0,
    outerOpacity: 0,
    edgeOpacity: 0,
    color: '#696969',
  },
];

let profileIdCounter = 1000;

export const useVisionProfileStore = create<VisionProfileState>()(
  persist(
    (set, get) => ({
      profiles: [],
      
      addProfile: (profileData) => {
        const id = `custom-${profileIdCounter++}`;
        const newProfile: VisionProfile = {
          ...profileData,
          id,
        };
        
        set((state) => ({
          profiles: [...state.profiles, newProfile],
        }));
        
        return id;
      },
      
      updateProfile: (id, updates) => {
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },
      
      removeProfile: (id) => {
        // Don't allow removing default profiles
        if (DEFAULT_PROFILES.find(p => p.id === id)) {
          console.warn('Cannot remove default vision profile');
          return;
        }
        
        set((state) => ({
          profiles: state.profiles.filter((p) => p.id !== id),
        }));
      },
      
      getProfile: (id) => {
        return get().profiles.find((p) => p.id === id);
      },
      
      resetToDefaults: () => {
        localStorage.removeItem('vision-profile-store');
        set({ profiles: DEFAULT_PROFILES });
      },
    }),
    {
      name: 'vision-profile-store',
      version: 1,
      onRehydrateStorage: () => (state) => {
        // Ensure default profiles are always present after rehydration
        if (!state || !state.profiles || state.profiles.length === 0) {
          state && (state.profiles = DEFAULT_PROFILES);
        }
      },
      migrate: (persistedState: any, version: number) => {
        // Ensure default profiles are always present
        if (version === 0 || !persistedState.profiles || persistedState.profiles.length === 0) {
          return {
            ...persistedState,
            profiles: DEFAULT_PROFILES,
          };
        }
        
        // Merge any missing default profiles
        const existingIds = new Set(persistedState.profiles.map((p: VisionProfile) => p.id));
        const missingDefaults = DEFAULT_PROFILES.filter(dp => !existingIds.has(dp.id));
        
        if (missingDefaults.length > 0) {
          return {
            ...persistedState,
            profiles: [...DEFAULT_PROFILES.filter(dp => existingIds.has(dp.id)), ...persistedState.profiles.filter((p: VisionProfile) => !DEFAULT_PROFILES.find(dp => dp.id === p.id)), ...missingDefaults],
          };
        }
        
        return persistedState;
      },
    }
  )
);
