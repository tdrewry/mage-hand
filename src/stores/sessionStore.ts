/**
 * CRITICAL DEPENDENCY: zustand
 * This store is the core state management system for the entire application.
 * Removing zustand would require a complete rewrite of state management.
 * See DEPENDENCIES.md for details.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Token {
  id: string;
  name: string;
  imageUrl: string;
  x: number;
  y: number;
  gridWidth: number;  // Width in grid units
  gridHeight: number; // Height in grid units
  label: string;      // Editable label/name
  roleId: string;     // Role this token belongs to
  isHidden: boolean;  // Whether token is hidden (only visible to privileged roles)
  color?: string;     // Token color (for default tokens)
  initiative?: number; // Initiative value
  inCombat?: boolean;  // Whether token is in combat
  hasVision?: boolean; // Whether token can see through fog of war (default: true)
  visionRange?: number; // Vision range in grid units (uses global default if not set)
  visionProfileId?: string; // Reference to a vision profile from visionProfileStore
  useGradients?: boolean; // Whether to use gradient edges (can override profile setting)
  // @deprecated Use roleId instead
  ownerId?: string;   // Player who owns this token (deprecated, for backward compatibility)
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

export interface SessionState {
  sessionId: string;
  tokens: Token[];
  players: Player[];
  currentPlayerId: string;
  selectedTokenIds: string[];
  tokenVisibility: TokenVisibility;
  labelVisibility: LabelVisibility;
  addToken: (token: Token) => void;
  updateTokenPosition: (tokenId: string, x: number, y: number) => void;
  updateTokenLabel: (tokenId: string, label: string) => void;
  updateTokenColor: (tokenId: string, color: string) => void;
  updateTokenVision: (tokenId: string, hasVision: boolean) => void;
  updateTokenVisionRange: (tokenId: string, visionRange: number | undefined) => void;
  setTokenOwner: (tokenId: string, ownerId: string) => void;
  removeToken: (tokenId: string) => void;
  clearAllTokens: () => void;
  setSelectedTokens: (tokenIds: string[]) => void;
  setTokenVisibility: (visibility: TokenVisibility) => void;
  setLabelVisibility: (visibility: LabelVisibility) => void;
  addPlayer: (player: Player) => void;
  setCurrentPlayer: (playerId: string, role: 'dm' | 'player') => void;
  initializeSession: (sessionId?: string) => void;
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
      
      addToken: (token) =>
        set((state) => ({
          tokens: [...state.tokens, token],
        })),
      
      updateTokenPosition: (tokenId, x, y) => {
        // Throttle position updates to prevent localStorage overflow
        const state = get();
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

      updateTokenLabel: (tokenId, label) =>
        set((state) => ({
          tokens: state.tokens.map((token) =>
            token.id === tokenId ? { ...token, label } : token
          ),
        })),

      updateTokenColor: (tokenId, color) =>
        set((state) => ({
          tokens: state.tokens.map((token) =>
            token.id === tokenId ? { ...token, color } : token
          ),
        })),

      updateTokenVision: (tokenId, hasVision) =>
        set((state) => ({
          tokens: state.tokens.map((token) =>
            token.id === tokenId ? { ...token, hasVision } : token
          ),
        })),

      updateTokenVisionRange: (tokenId, visionRange) =>
        set((state) => ({
          tokens: state.tokens.map((token) =>
            token.id === tokenId ? { ...token, visionRange } : token
          ),
        })),

      setTokenOwner: (tokenId, ownerId) =>
        set((state) => ({
          tokens: state.tokens.map((token) =>
            token.id === tokenId ? { ...token, ownerId } : token
          ),
        })),
      
      removeToken: (tokenId) =>
        set((state) => ({
          tokens: state.tokens.filter((token) => token.id !== tokenId),
          selectedTokenIds: state.selectedTokenIds.filter(id => id !== tokenId),
        })),

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
        
        // Set default role as DM for now (can be changed later)
        get().setCurrentPlayer(currentPlayerId, 'dm');
        
        // Update URL if needed
        if (!urlSessionId || urlSessionId !== finalSessionId) {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('session', finalSessionId);
          window.history.replaceState({}, '', newUrl.toString());
        }
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