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

// ECS-ready entity reference structure
export interface EntityRef {
  type: 'none' | 'local' | 'remote';
  entityId?: string;         // Pointer to entity in ECS store
  source?: string;           // URL or storage key
  projectionType?: string;   // 'stat-block' | 'character' | 'creature' | etc.
}

// Appearance variant for saved image + size configurations (Wild Shape, Mounted, etc.)
export interface AppearanceVariant {
  id: string;              // Unique identifier
  name: string;            // User-friendly name (e.g., "Bear Form", "Mounted")
  imageHash?: string;      // Hash reference to stored texture (imageUrl loaded from IndexedDB)
  gridWidth: number;       // Footprint width in grid units
  gridHeight: number;      // Footprint height in grid units
  isDefault?: boolean;     // Mark one variant as the default/original
}

// Path styling types
export type PathStyle = 'dashed' | 'solid' | 'footprint' | 'none';
export type FootprintType = 'barefoot' | 'boot' | 'paw' | 'hoof' | 'claw';

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
  labelColor?: string;          // Label text color (default: white)
  labelBackgroundColor?: string; // Label background color (default: semi-transparent dark gray)
  roleId: string;     // Role this token belongs to
  isHidden: boolean;  // Whether token is hidden (only visible to privileged roles)
  color?: string;     // Token color (for default tokens)
  
  // Movement path styling
  pathStyle?: PathStyle;        // How to render movement path (default: 'dashed')
  pathColor?: string;           // Path color (defaults to token.color or white)
  pathWeight?: number;          // Path line thickness or footprint size (1-5, default: 3)
  pathOpacity?: number;         // Path opacity (0.3-1.0, default: 0.7)
  pathGaitWidth?: number;       // Side-to-side offset for footprints (0.2-1.0, default: 0.6)
  footprintType?: FootprintType; // Type of footprint when pathStyle is 'footprint' (default: 'barefoot')
  initiative?: number; // Initiative value
  inCombat?: boolean;  // Whether token is in combat
  
  // Unified illumination system - array of attached light/vision sources
  illuminationSources?: IlluminationSource[];

  // ECS-ready entity reference (Phase 1: mostly unused, prepared for future)
  entityRef?: EntityRef;
  
  // Token-instance data (separate from linked entity)
  notes?: string;              // GM notes for this token instance
  quickReferenceUrl?: string;  // Bridge field for external links
  statBlockJson?: string;      // Raw 5e.tools-compatible JSON for the stat block editor

  // Appearance variants - saved configurations of image + size (e.g., Wild Shape, Mounted)
  appearanceVariants?: AppearanceVariant[];
  activeVariantId?: string;  // Which variant is currently active

  // Multi-map scoping — which map this token belongs to
  mapId?: string;

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
  viewportTransforms: Record<string, ViewportTransform>;

  addToken: (token: Token) => void;
  setTokens: (tokens: Token[]) => void;
  updateTokenPosition: (tokenId: string, x: number, y: number) => void;
  updateTokenLabel: (tokenId: string, label: string) => void;
  updateTokenName: (tokenId: string, name: string) => void;
  updateTokenLabelPosition: (tokenId: string, labelPosition: LabelPosition) => void;
  updateTokenLabelStyle: (tokenId: string, labelColor?: string, labelBackgroundColor?: string) => void;
  updateTokenColor: (tokenId: string, color: string) => void;
  updateTokenImage: (tokenId: string, imageUrl: string, imageHash?: string) => void;
  updateTokenVision: (tokenId: string, hasVision: boolean) => void;
  updateTokenVisionRange: (tokenId: string, visionRange: number | undefined) => void;
  updateTokenIllumination: (tokenId: string, illumination: Partial<IlluminationSource>) => void;
  setTokenOwner: (tokenId: string, ownerId: string) => void;
  updateTokenSize: (tokenId: string, gridWidth: number, gridHeight: number) => void;
  updateTokenDetails: (tokenId: string, notes?: string, quickReferenceUrl?: string, statBlockJson?: string) => void;
  updateTokenStatBlockJson: (tokenId: string, json: string) => void;
  updateTokenEntityRef: (tokenId: string, entityRef: EntityRef | undefined) => void;
  addAppearanceVariant: (tokenId: string, variant: AppearanceVariant) => void;
  removeAppearanceVariant: (tokenId: string, variantId: string) => void;
  updateAppearanceVariant: (tokenId: string, variantId: string, updates: Partial<AppearanceVariant>) => void;
  setActiveVariant: (tokenId: string, variantId: string) => void;
  removeToken: (tokenId: string) => void;
  clearAllTokens: () => void;
  setSelectedTokens: (tokenIds: string[]) => void;
  setTokenVisibility: (visibility: TokenVisibility) => void;
  setLabelVisibility: (visibility: LabelVisibility) => void;
  addPlayer: (player: Player) => void;
  setCurrentPlayer: (playerId: string, role: 'dm' | 'player') => void;
  initializeSession: (sessionId?: string) => void;
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
  viewportTransforms: {},
  
  addToken: (token) => {
    set((state) => {
      // Dedup guard: if a token with this ID already exists, skip
      if (state.tokens.some(t => t.id === token.id)) {
        console.warn(`[sessionStore] ⚠️ addToken skipped — token ${token.id} already exists`);
        return state;
      }
      return { tokens: [...state.tokens, token] };
    });
  },
  
  setTokens: (tokens) => set({ tokens }),
  
  updateTokenPosition: (tokenId, x, y) => {
    const state = get();
    const existing = state.tokens.find(t => t.id === tokenId);
    // Skip if position is exactly the same (no-op)
    if (existing && existing.x === x && existing.y === y) return;
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, x, y } : token
      ),
    }));
  },

  updateTokenLabel: (tokenId, label) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, label } : token
      ),
    }));
  },

  updateTokenName: (tokenId, name) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, name } : token
      ),
    }));
  },

  updateTokenLabelPosition: (tokenId, labelPosition) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, labelPosition } : token
      ),
    }));
  },

  updateTokenLabelStyle: (tokenId, labelColor, labelBackgroundColor) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, labelColor, labelBackgroundColor } : token
      ),
    }));
  },

  updateTokenColor: (tokenId, color) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, color } : token
      ),
    }));
  },

  updateTokenImage: (tokenId, imageUrl, imageHash) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, imageUrl, imageHash } : token
      ),
    }));
  },

  updateTokenVision: (tokenId, hasVision) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, hasVision } : token
      ),
    }));
  },

  updateTokenVisionRange: (tokenId, visionRange) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, visionRange } : token
      ),
    }));
  },

  updateTokenIllumination: (tokenId, illumination) => {
    const existingToken = get().tokens.find(t => t.id === tokenId);
    if (!existingToken) return;

    const existingSources = existingToken.illuminationSources || [];
    let updatedSources: IlluminationSource[];

    if (existingSources.length > 0) {
      updatedSources = existingSources.map((source, index) =>
        index === 0 ? { ...source, ...illumination } : source
      );
    } else {
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
  },

  setTokenOwner: (tokenId, ownerId) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, ownerId } : token
      ),
    }));
  },

  updateTokenSize: (tokenId, gridWidth, gridHeight) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, gridWidth, gridHeight } : token
      ),
    }));
  },

  updateTokenDetails: (tokenId, notes, quickReferenceUrl, statBlockJson) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, notes, quickReferenceUrl, statBlockJson } : token
      ),
    }));
  },

  updateTokenStatBlockJson: (tokenId, json) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, statBlockJson: json } : token
      ),
    }));
  },

  updateTokenEntityRef: (tokenId, entityRef) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, entityRef } : token
      ),
    }));
  },

  addAppearanceVariant: (tokenId, variant) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId 
          ? { 
              ...token, 
              appearanceVariants: [...(token.appearanceVariants || []), variant],
              activeVariantId: token.appearanceVariants?.length ? token.activeVariantId : variant.id,
            } 
          : token
      ),
    }));
  },

  removeAppearanceVariant: (tokenId, variantId) => {
    set((state) => ({
      tokens: state.tokens.map((token) => {
        if (token.id !== tokenId) return token;
        const updatedVariants = (token.appearanceVariants || []).filter(v => v.id !== variantId);
        const newActiveId = token.activeVariantId === variantId ? undefined : token.activeVariantId;
        return { ...token, appearanceVariants: updatedVariants, activeVariantId: newActiveId };
      }),
    }));
  },

  updateAppearanceVariant: (tokenId, variantId, updates) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId
          ? {
              ...token,
              appearanceVariants: (token.appearanceVariants || []).map(v =>
                v.id === variantId ? { ...v, ...updates } : v
              ),
            }
          : token
      ),
    }));
  },

  setActiveVariant: (tokenId, variantId) => {
    const token = get().tokens.find(t => t.id === tokenId);
    if (!token) return;

    const variant = token.appearanceVariants?.find(v => v.id === variantId);
    if (!variant) return;

    set((state) => ({
      tokens: state.tokens.map((t) =>
        t.id === tokenId
          ? {
              ...t,
              activeVariantId: variantId,
              gridWidth: variant.gridWidth,
              gridHeight: variant.gridHeight,
              imageHash: variant.imageHash,
            }
          : t
      ),
    }));
  },
  
  removeToken: (tokenId) => {
    set((state) => ({
      tokens: state.tokens.filter((token) => token.id !== tokenId),
      selectedTokenIds: state.selectedTokenIds.filter(id => id !== tokenId),
    }));
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
  debug: true, // Enable debug logging to diagnose sync issues
})(sessionStoreCreator);

// Persist options
const persistOptions: PersistOptions<SessionState, Partial<SessionState>> = {
  name: 'vtt-session-storage',
  partialize: (state) => ({
    // Exclude imageUrl from persistence to avoid localStorage quota issues
    // The imageHash is still persisted, allowing textures to reload from IndexedDB
    tokens: state.tokens.map(token => ({
      ...token,
      imageUrl: '', // Large base64 data excluded - will be reloaded via imageHash
    })),
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
