/**
 * CRITICAL DEPENDENCY: zustand
 * This store is the core state management system for the entire application.
 * Removing zustand would require a complete rewrite of state management.
 * See DEPENDENCIES.md for details.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { syncManager } from '@/lib/syncManager';
import type { IlluminationSource } from '@/types/illumination';

export type LabelPosition = 'above' | 'center' | 'below';

export interface Token {
  id: string;
  name: string;
  imageUrl: string;
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

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
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
        
        // Only sync if this is a new local token
        // Remote tokens will already have all fields and shouldn't re-trigger sync
        if (syncManager.isConnected()) {
          syncManager.syncTokenAdd(token);
        }
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
            
            // Sync to multiplayer (throttled)
            if (syncManager.isConnected()) {
              syncManager.syncTokenPositionThrottled(tokenId, x, y);
            }
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
        const existingToken = get().tokens.find(t => t.id === tokenId);
        
        set((state) => ({
          tokens: state.tokens.map((token) =>
            token.id === tokenId ? { ...token, label } : token
          ),
        }));
        
        // Only sync if token exists locally (prevent syncing remote updates)
        if (existingToken && syncManager.isConnected()) {
          syncManager.syncTokenUpdate(tokenId, { label });
        }
      },

      updateTokenName: (tokenId, name) => {
        const existingToken = get().tokens.find(t => t.id === tokenId);
        
        set((state) => ({
          tokens: state.tokens.map((token) =>
            token.id === tokenId ? { ...token, name } : token
          ),
        }));
        
        if (existingToken && syncManager.isConnected()) {
          syncManager.syncTokenUpdate(tokenId, { name });
        }
      },

      updateTokenLabelPosition: (tokenId, labelPosition) => {
        const existingToken = get().tokens.find(t => t.id === tokenId);
        
        set((state) => ({
          tokens: state.tokens.map((token) =>
            token.id === tokenId ? { ...token, labelPosition } : token
          ),
        }));
        
        if (existingToken && syncManager.isConnected()) {
          syncManager.syncTokenUpdate(tokenId, { labelPosition });
        }
      },

      updateTokenColor: (tokenId, color) => {
        const existingToken = get().tokens.find(t => t.id === tokenId);
        
        set((state) => ({
          tokens: state.tokens.map((token) =>
            token.id === tokenId ? { ...token, color } : token
          ),
        }));
        
        // Only sync if token exists locally
        if (existingToken && syncManager.isConnected()) {
          syncManager.syncTokenUpdate(tokenId, { color });
        }
      },

      updateTokenVision: (tokenId, hasVision) => {
        const existingToken = get().tokens.find(t => t.id === tokenId);
        
        set((state) => ({
          tokens: state.tokens.map((token) =>
            token.id === tokenId ? { ...token, hasVision } : token
          ),
        }));
        
        // Only sync if token exists locally
        if (existingToken && syncManager.isConnected()) {
          syncManager.syncTokenUpdate(tokenId, { hasVision });
        }
      },

      updateTokenVisionRange: (tokenId, visionRange) => {
        const existingToken = get().tokens.find(t => t.id === tokenId);
        
        set((state) => ({
          tokens: state.tokens.map((token) =>
            token.id === tokenId ? { ...token, visionRange } : token
          ),
        }));
        
        // Only sync if token exists locally
        if (existingToken && syncManager.isConnected()) {
          syncManager.syncTokenUpdate(tokenId, { visionRange });
        }
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

        // Sync to multiplayer
        if (syncManager.isConnected()) {
          syncManager.syncTokenUpdate(tokenId, { illuminationSources: updatedSources });
        }
      },

      setTokenOwner: (tokenId, ownerId) => {
        const existingToken = get().tokens.find(t => t.id === tokenId);
        
        set((state) => ({
          tokens: state.tokens.map((token) =>
            token.id === tokenId ? { ...token, ownerId } : token
          ),
        }));
        
        // Only sync if token exists locally
        if (existingToken && syncManager.isConnected()) {
          syncManager.syncTokenUpdate(tokenId, { ownerId });
        }
      },
      
      removeToken: (tokenId) => {
        const existingToken = get().tokens.find(t => t.id === tokenId);
        
        console.log('🗑️ removeToken called:', {
          tokenId,
          exists: !!existingToken,
          willSync: !!existingToken && syncManager.isConnected()
        });
        
        set((state) => ({
          tokens: state.tokens.filter((token) => token.id !== tokenId),
          selectedTokenIds: state.selectedTokenIds.filter(id => id !== tokenId),
        }));
        
        // Only sync if token existed locally
        if (existingToken && syncManager.isConnected()) {
          console.log('📤 Syncing token removal:', tokenId);
          syncManager.syncTokenRemove(tokenId);
        } else if (!existingToken) {
          console.warn('⚠️ Token not found in local store, cannot sync removal:', tokenId);
        }
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
    }),
    {
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
    }
  )
);

function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Initialize session on store creation
const { initializeSession } = useSessionStore.getState();
initializeSession();