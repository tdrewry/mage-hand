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

  // Appearance variants - saved configurations of image + size (e.g., Wild Shape, Mounted)
  appearanceVariants?: AppearanceVariant[];
  activeVariantId?: string;  // Which variant is currently active

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
  // Per-map viewport transforms (mapId -> transform)
  viewportTransforms: Record<string, ViewportTransform>;
  /**
   * Adds a new token to the session.
   * @param token The token to add.
   */
  addToken: (token: Token) => void;

  /**
   * Replaces the entire tokens array.
   * @param tokens The new array of tokens.
   */
  setTokens: (tokens: Token[]) => void;

  /**
   * Updates the position of a specific token.
   * @param tokenId The ID of the token.
   * @param x The new x-coordinate.
   * @param y The new y-coordinate.
   */
  updateTokenPosition: (tokenId: string, x: number, y: number) => void;

  /**
   * Updates the label text of a specific token.
   * @param tokenId The ID of the token.
   * @param label The new label text.
   */
  updateTokenLabel: (tokenId: string, label: string) => void;

  /**
   * Updates the name of a specific token.
   * @param tokenId The ID of the token.
   * @param name The new name.
   */
  updateTokenName: (tokenId: string, name: string) => void;

  /**
   * Updates the label position for a specific token.
   * @param tokenId The ID of the token.
   * @param labelPosition The new label position ('above', 'center', or 'below').
   */
  updateTokenLabelPosition: (tokenId: string, labelPosition: LabelPosition) => void;

  /**
   * Updates the label style for a specific token.
   * @param tokenId The ID of the token.
   * @param labelColor The new text color.
   * @param labelBackgroundColor The new background color.
   */
  updateTokenLabelStyle: (tokenId: string, labelColor?: string, labelBackgroundColor?: string) => void;

  /**
   * Updates the color of a specific token.
   * @param tokenId The ID of the token.
   * @param color The new color string.
   */
  updateTokenColor: (tokenId: string, color: string) => void;

  /**
   * Updates the image and/or image hash for a specific token.
   * @param tokenId The ID of the token.
   * @param imageUrl The new image URL.
   * @param imageHash The new image hash for synchronization.
   */
  updateTokenImage: (tokenId: string, imageUrl: string, imageHash?: string) => void;

  /**
   * Updates whether a token has vision.
   * @param tokenId The ID of the token.
   * @param hasVision True if it has vision, false otherwise.
   */
  updateTokenVision: (tokenId: string, hasVision: boolean) => void;

  /**
   * Updates the vision range of a specific token.
   * @param tokenId The ID of the token.
   * @param visionRange The new vision range in grid units.
   */
  updateTokenVisionRange: (tokenId: string, visionRange: number | undefined) => void;

  /**
   * Updates the illumination source settings for a specific token.
   * @param tokenId The ID of the token.
   * @param illumination Partial illumination source settings to apply.
   */
  updateTokenIllumination: (tokenId: string, illumination: Partial<IlluminationSource>) => void;

  /**
   * Sets the owner (role) of a specific token.
   * @param tokenId The ID of the token.
   * @param ownerId The ID of the role that owns the token.
   */
  setTokenOwner: (tokenId: string, ownerId: string) => void;

  /**
   * Updates the size of a specific token.
   * @param tokenId The ID of the token.
   * @param gridWidth The new width in grid units.
   * @param gridHeight The new height in grid units.
   */
  updateTokenSize: (tokenId: string, gridWidth: number, gridHeight: number) => void;

  /**
   * Updates the details (notes, quickReferenceUrl) of a specific token.
   * @param tokenId The ID of the token.
   * @param notes The GM notes for this token instance.
   * @param quickReferenceUrl The external reference URL.
   */
  updateTokenDetails: (tokenId: string, notes?: string, quickReferenceUrl?: string) => void;

  /**
   * Updates the entity reference for a specific token.
   * @param tokenId The ID of the token.
   * @param entityRef The entity reference object.
   */
  updateTokenEntityRef: (tokenId: string, entityRef: EntityRef | undefined) => void;

  /**
   * Adds an appearance variant to a token.
   * @param tokenId The ID of the token.
   * @param variant The appearance variant to add.
   */
  addAppearanceVariant: (tokenId: string, variant: AppearanceVariant) => void;

  /**
   * Removes an appearance variant from a token.
   * @param tokenId The ID of the token.
   * @param variantId The ID of the variant to remove.
   */
  removeAppearanceVariant: (tokenId: string, variantId: string) => void;

  /**
   * Updates an existing appearance variant.
   * @param tokenId The ID of the token.
   * @param variantId The ID of the variant to update.
   * @param updates Partial updates to apply.
   */
  updateAppearanceVariant: (tokenId: string, variantId: string, updates: Partial<AppearanceVariant>) => void;

  /**
   * Sets the active appearance variant (applies its image/size to the token).
   * @param tokenId The ID of the token.
   * @param variantId The ID of the variant to activate.
   */
  setActiveVariant: (tokenId: string, variantId: string) => void;

  /**
   * Removes a token from the session.
   * @param tokenId The ID of the token to remove.
   */
  removeToken: (tokenId: string) => void;

  /**
   * Clears all tokens from the current session.
   */
  clearAllTokens: () => void;

  /**
   * Sets the list of currently selected tokens.
   * @param tokenIds Array of token IDs to select.
   */
  setSelectedTokens: (tokenIds: string[]) => void;

  /**
   * Sets the global token visibility rule.
   * @param visibility The visibility setting ('all', 'owned', or 'dm-only').
   */
  setTokenVisibility: (visibility: TokenVisibility) => void;

  /**
   * Sets the global label visibility rule.
   * @param visibility The visibility setting ('show', 'hide', or 'selected').
   */
  setLabelVisibility: (visibility: LabelVisibility) => void;

  /**
   * Adds a new player to the session.
   * @param player The player to add.
   */
  addPlayer: (player: Player) => void;

  /**
   * Sets the current player and their role.
   * @param playerId The ID of the current player.
   * @param role The role of the player ('dm' or 'player').
   */
  setCurrentPlayer: (playerId: string, role: 'dm' | 'player') => void;

  /**
   * Initializes the session with the given ID.
   * @param sessionId The session ID.
   */
  initializeSession: (sessionId?: string) => void;

  /**
   * Sets the viewport transform (pan and zoom) for a specific map.
   * @param mapId The ID of the map.
   * @param transform The new viewport transform.
   */
  setViewportTransform: (mapId: string, transform: ViewportTransform) => void;

  /**
   * Gets the viewport transform for a specific map.
   * @param mapId The ID of the map.
   * @returns The viewport transform for that map.
   */
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
    set((state) => ({
      tokens: [...state.tokens, token],
    }));
    // Sync happens automatically via syncPatch middleware
  },
  
  setTokens: (tokens) => {
    set({ tokens });
  },
  
  updateTokenPosition: (tokenId, x, y) => {
    // Movement lock is now handled by initiativeStore.restrictMovement
    // The actual blocking happens in the UI layer (SimpleTabletop/useTokenInteraction)
    const state = get();
    
    // Throttle position updates to prevent localStorage overflow
    const existingToken = state.tokens.find(t => t.id === tokenId);
    
    // Only update if position actually changed significantly (avoid micro-movements)
    if (!existingToken || 
        Math.abs(existingToken.x - x) > 2 || 
        Math.abs(existingToken.y - y) > 2) {
      set((state) => ({
        tokens: state.tokens.map((token) =>
          token.id === tokenId ? { ...token, x, y } : token
        ),
      }));
      // Sync happens automatically via syncPatch middleware (throttled)
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

  updateTokenLabelStyle: (tokenId, labelColor, labelBackgroundColor) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, labelColor, labelBackgroundColor } : token
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

  updateTokenImage: (tokenId, imageUrl, imageHash) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, imageUrl, imageHash } : token
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

  updateTokenSize: (tokenId, gridWidth, gridHeight) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, gridWidth, gridHeight } : token
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },

  updateTokenDetails: (tokenId, notes, quickReferenceUrl) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, notes, quickReferenceUrl } : token
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },

  updateTokenEntityRef: (tokenId, entityRef) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId ? { ...token, entityRef } : token
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },

  addAppearanceVariant: (tokenId, variant) => {
    set((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId 
          ? { 
              ...token, 
              appearanceVariants: [...(token.appearanceVariants || []), variant],
              // If this is the first variant, also set it as active
              activeVariantId: token.appearanceVariants?.length ? token.activeVariantId : variant.id,
            } 
          : token
      ),
    }));
    // Sync happens automatically via syncPatch middleware
  },

  removeAppearanceVariant: (tokenId, variantId) => {
    set((state) => ({
      tokens: state.tokens.map((token) => {
        if (token.id !== tokenId) return token;
        
        const updatedVariants = (token.appearanceVariants || []).filter(v => v.id !== variantId);
        // If we removed the active variant, clear the activeVariantId
        const newActiveId = token.activeVariantId === variantId ? undefined : token.activeVariantId;
        
        return {
          ...token,
          appearanceVariants: updatedVariants,
          activeVariantId: newActiveId,
        };
      }),
    }));
    // Sync happens automatically via syncPatch middleware
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
    // Sync happens automatically via syncPatch middleware
  },

  setActiveVariant: (tokenId, variantId) => {
    const token = get().tokens.find(t => t.id === tokenId);
    if (!token) return;

    const variant = token.appearanceVariants?.find(v => v.id === variantId);
    if (!variant) return;

    // Apply the variant's settings to the token
    set((state) => ({
      tokens: state.tokens.map((t) =>
        t.id === tokenId
          ? {
              ...t,
              activeVariantId: variantId,
              gridWidth: variant.gridWidth,
              gridHeight: variant.gridHeight,
              // Note: imageUrl is not stored in variant - caller must load from IndexedDB and call updateTokenImage
              imageHash: variant.imageHash,
            }
          : t
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
