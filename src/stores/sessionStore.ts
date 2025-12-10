/**
 * CRITICAL DEPENDENCY: zustand
 * This store is the core state management system for the entire application.
 * Removing zustand would require a complete rewrite of state management.
 * See DEPENDENCIES.md for details.
 */
import { create, StateCreator } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { syncPatch } from '@/lib/sync';
import type { IlluminationSource } from '@/types/illumination';

export type LabelPosition = 'above' | 'center' | 'below';

export interface Token {
  id: string;
  name: string;
  imageUrl: string; // In-memory image data (excluded from sync)
  imageHash?: string; // Hash for texture sync - this is what gets synced to other clients
  x: number;
  y: number;
  gridWidth: number;  // Width in grid units
  gridHeight: number; // Height in grid units
  label: string;      // Editable label displayed on/near token
  labelPosition: LabelPosition; // Where to draw the label (default: below)
  roleId: string;     // Role this token belongs to
  isHidden: boolean;  // Whether token is hidden (only visible to privileged roles)
  color?: string;     // Token color (for default tokens)
  initiative?: number; // Initiative value
  inCombat?: boolean;  // Whether token is in combat
  
  // Unified illumination system - array of attached light/vision sources
  illuminationSources?: IlluminationSource[];

  // @deprecated Legacy fields - kept for migration, will be removed in future
  hasVision?: boolean;
  visionRange?: number;
  visionProfileId?: string;
  useGradients?: boolean;
  
  // @deprecated Use roleId instead
  ownerId?: string;
}

export interface Player {
  id: string;
  name: string;
  roleIds: string[]; // Array of role IDs this player is assigned to
  isConnected: boolean;
  // @deprecated Use roleIds instead
  role?: 'dm' | 'player'; // Deprecated, for backward compatibility
}

export type TokenVisibility = 'all' | 'owned' | 'dm-only';
export type LabelVisibility = 'show' | 'hide' | 'selected';

export interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}

export interface SessionState {
  sessionId: string;
  tokens: Token[];
  players: Player[];
  currentPlayerId: string;
  selectedTokenIds: string[];
  tokenVisibility: TokenVisibility;
  labelVisibility: LabelVisibility;
  movementLocked: boolean;
  // Per-map viewport transforms (mapId -> transform)
  viewportTransforms: Record<string, ViewportTransform>;
  addToken: (token: Token) => void;
  setTokens: (tokens: Token[]) => void;
  updateTokenPosition: (tokenId: string, x: number, y: number) => void;
  updateTokenLabel: (tokenId: string, label: string) => void;
  updateTokenName: (tokenId: string, name: string) => void;
  updateTokenLabelPosition: (tokenId: string, labelPosition: LabelPosition) => void;
  updateTokenColor: (tokenId: string, color: string) => void;
  updateTokenImage: (tokenId: string, imageUrl: string) => void;
  updateTokenVision: (tokenId: string, hasVision: boolean) => void;
  updateTokenVisionRange: (tokenId: string, visionRange: number | undefined) => void;
  updateTokenIllumination: (tokenId: string, illumination: Partial<IlluminationSource>) => void;
  setTokenOwner: (tokenId: string, ownerId: string) => void;
  removeToken: (tokenId: string) => void;
  clearAllTokens: () => void;
  setSelectedTokens: (tokenIds: string[]) => void;
  setTokenVisibility: (visibility: TokenVisibility) => void;
  setLabelVisibility: (visibility: LabelVisibility) => void;
  setMovementLocked: (locked: boolean) => void;
  addPlayer: (player: Player) => void;
  setCurrentPlayer: (playerId: string, role: 'dm' | 'player') => void;
  initializeSession: (sessionId?: string) => void;
  // Viewport transform methods
  setViewportTransform: (mapId: string, transform: ViewportTransform) => void;
  getViewportTransform: (mapId: string) => ViewportTransform;
}

// Define the store creator separately for better type inference
const sessionStoreCreator: StateCreator<SessionState> = (set, get) => ({
  sessionId: '',
  tokens: [],
  players: [],
  currentPlayerId: '',
  selectedTokenIds: [],
  tokenVisibility: 'all',
  labelVisibility: 'show',
  movementLocked: false,
  viewportTransforms: {},
  
  addToken: (token) => {
    set((state) => ({
      tokens: [...state.tokens, token],
    }));
    // Sync happens automatically via syncPatch middleware
  },
  
  setTokens: (tokens) => {
    set({ tokens });
  },
  
  updateTokenPosition: (tokenId, x, y) => {
    // Check if movement is locked (but allow movement in Edit mode)
    const state = get();
    if (state.movementLocked) {
      // Import dungeonStore to check rendering mode
      const { useDungeonStore } = require('@/stores/dungeonStore');
      const renderingMode = useDungeonStore.getState().renderingMode;
      
      // Only block movement in Play mode
      if (renderingMode === 'play') {
        console.warn('Token movement is locked during import/export');
        return;
      }
    }
    
    // Throttle position updates to prevent localStorage overflow
    const existingToken = state.tokens.find(t => t.id === tokenId);
    
    // Only update if position actually changed significantly (avoid micro-movements)
    if (!existingToken || 
        Math.abs(existingToken.x - x) > 2 || 
        Math.abs(existingToken.y - y) > 2) {
      try {
        set((state) => ({
          tokens: state.tokens.map((token) =>
            token.id === tokenId ? { ...token, x, y } : token
          ),
        }));
        // Sync happens automatically via syncPatch middleware (throttled)
      } catch (error) {
        console.warn('Failed to update token position:', error);
        // Clear old data if storage is full
        if (error instanceof Error && error.message.includes('quota')) {
          localStorage.clear();
          set({ 
            tokens: [], 
            sessionId: state.sessionId, 
            players: [], 
            currentPlayerId: '', 
            selectedTokenIds: [], 
            tokenVisibility: 'all',
            labelVisibility: 'show' 
          });
        }
      }
    }
  },

  updateTokenLabel: (tokenId, label) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, label } : token
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },

  updateTokenName: (tokenId, name) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, name } : token
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },

  updateTokenLabelPosition: (tokenId, labelPosition) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, labelPosition } : token
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },

  updateTokenColor: (tokenId, color) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, color } : token
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },

  updateTokenImage: (tokenId, imageUrl) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, imageUrl } : token
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },

  updateTokenVision: (tokenId, hasVision) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, hasVision } : token
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },

  updateTokenVisionRange: (tokenId, visionRange) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, visionRange } : token
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },

  updateTokenIllumination: (tokenId, illumination) => {
    const existingToken = get().tokens.find(t => t.id === tokenId);
    if (!existingToken) return;

    // Merge illumination into the first source, or create one if none exists
    const existingSources = existingToken.illuminationSources || [];
    let updatedSources: IlluminationSource[];

    if (existingSources.length > 0) {
      // Update the first source with the new settings
      updatedSources = existingSources.map((source, index) =>
        index === 0
          ? { ...source, ...illumination }
          : source
      );
    } else {
      // Create a new illumination source
      updatedSources = [{
        id: `illum-${tokenId}-${Date.now()}`,
        name: 'Vision',
        enabled: true,
        position: { x: existingToken.x, y: existingToken.y },
        range: illumination.range ?? 6,
        brightZone: illumination.brightZone ?? 0.5,
        brightIntensity: illumination.brightIntensity ?? 1.0,
        dimIntensity: illumination.dimIntensity ?? 0.0,
        color: illumination.color ?? '#FFFFFF',
        colorEnabled: illumination.colorEnabled ?? false,
        colorIntensity: illumination.colorIntensity ?? 0.5,
        softEdge: illumination.softEdge ?? true,
        softEdgeRadius: illumination.softEdgeRadius ?? 8,
        animation: illumination.animation ?? 'none',
        animationSpeed: illumination.animationSpeed ?? 1.0,
        animationIntensity: illumination.animationIntensity ?? 0.3,
      }];
    }

    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId
          ? { ...token, illuminationSources: updatedSources }
          : token
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },

  setTokenOwner: (tokenId, ownerId) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, ownerId } : token
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },
  
  removeToken: (tokenId) => {
    set((state) => ({
      tokens: state.tokens.filter((token) => token.id !== tokenId),
      selectedTokenIds: state.selectedTokenIds.filter(id => id !== tokenId),
    }));
    // Sync happens automatically via syncPatch middleware
  },

  clearAllTokens: () =>
    set({ 
      tokens: [], 
      selectedTokenIds: [] 
    }),

  setSelectedTokens: (tokenIds) =>
    set({ selectedTokenIds: tokenIds }),

  setTokenVisibility: (visibility) =>
    set({ tokenVisibility: visibility }),

  setLabelVisibility: (visibility) =>
    set({ labelVisibility: visibility }),

  setMovementLocked: (locked) =>
    set({ movementLocked: locked }),

  addPlayer: (player) =>
    set((state) => ({
      players: [...state.players.filter(p => p.id !== player.id), player],
    })),

  setCurrentPlayer: (playerId, role) => {
    set((state) => {
      const existingPlayer = state.players.find(p => p.id === playerId);
      // Convert old role to roleIds array
      const roleIds = role === 'dm' ? ['dm'] : ['player'];
      const updatedPlayers = existingPlayer 
        ? state.players.map(p => p.id === playerId ? { ...p, roleIds, role, isConnected: true } : p)
        : [...state.players, { id: playerId, name: `${role === 'dm' ? 'DM' : 'Player'} ${playerId.slice(-4)}`, roleIds, role, isConnected: true }];
      
      return {
        currentPlayerId: playerId,
        players: updatedPlayers,
      };
    });
  },
  
  initializeSession: (sessionId) => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlSessionId = urlParams.get('session');
    const finalSessionId = sessionId || urlSessionId || generateSessionId();
    
    // Generate or get current player ID
    let currentPlayerId = localStorage.getItem('vtt-player-id');
    if (!currentPlayerId) {
      currentPlayerId = generateSessionId();
      localStorage.setItem('vtt-player-id', currentPlayerId);
    }
    
    set({ 
      sessionId: finalSessionId,
      currentPlayerId,
    });
    
    // Don't auto-assign role here - let RoleSelectionModal handle it
    
    // Update URL if needed
    if (!urlSessionId || urlSessionId !== finalSessionId) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('session', finalSessionId);
      window.history.replaceState({}, '', newUrl.toString());
    }
  },

  setViewportTransform: (mapId, transform) => {
    set((state) => ({
      viewportTransforms: {
        ...state.viewportTransforms,
        [mapId]: transform,
      },
    }));
  },

  getViewportTransform: (mapId) => {
    const transforms = get().viewportTransforms;
    return transforms[mapId] || { x: 0, y: 0, zoom: 1 };
  },
});

// Wrap with syncPatch middleware, then persist
const withSyncPatch = syncPatch<SessionState>({ 
  channel: 'tokens',
  throttleMs: 50, // Throttle for position updates
  excludePaths: ['selectedTokenIds', 'viewportTransforms', 'currentPlayerId', 'tokens.*.imageUrl'], // Local-only state + large image data
  debug: false,
})(sessionStoreCreator);

// Persist options
const persistOptions: PersistOptions<SessionState, Partial<SessionState>> = {
  name: 'vtt-session-storage',
  partialize: (state) => ({
    tokens: state.tokens,
    sessionId: state.sessionId,
    players: state.players,
    currentPlayerId: state.currentPlayerId,
    tokenVisibility: state.tokenVisibility,
    labelVisibility: state.labelVisibility,
    viewportTransforms: state.viewportTransforms,
  }),
};

export const useSessionStore = create<SessionState>()(
  persist(withSyncPatch as StateCreator<SessionState, [], []>, persistOptions)
);

function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Initialize session on store creation
const { initializeSession } = useSessionStore.getState();
initializeSession();
