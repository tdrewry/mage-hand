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
}

export interface SessionState {
  sessionId: string;
  tokens: Token[];
  addToken: (token: Token) => void;
  updateTokenPosition: (tokenId: string, x: number, y: number) => void;
  removeToken: (tokenId: string) => void;
  initializeSession: (sessionId?: string) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessionId: '',
      tokens: [],
      
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
              set({ tokens: [], sessionId: state.sessionId });
            }
          }
        }
      },
      
      removeToken: (tokenId) =>
        set((state) => ({
          tokens: state.tokens.filter((token) => token.id !== tokenId),
        })),
      
      initializeSession: (sessionId) => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlSessionId = urlParams.get('session');
        const finalSessionId = sessionId || urlSessionId || generateSessionId();
        
        set({ sessionId: finalSessionId });
        
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