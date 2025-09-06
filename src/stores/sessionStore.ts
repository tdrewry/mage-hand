import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Token {
  id: string;
  name: string;
  imageUrl: string;
  x: number;
  y: number;
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
      
      updateTokenPosition: (tokenId, x, y) =>
        set((state) => ({
          tokens: state.tokens.map((token) =>
            token.id === tokenId ? { ...token, x, y } : token
          ),
        })),
      
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