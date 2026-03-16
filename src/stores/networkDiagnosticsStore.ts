import { create } from 'zustand';

export type WebRtcLifecycleStage = 
  | 'disconnected'
  | 'signal_offer'
  | 'signal_answer'
  | 'ice_gathering'
  | 'dtls_connecting'
  | 'datachannel_open'
  | 'connected'
  | 'failed';

export interface PeerDiagnostics {
  clientId: string;
  stage: WebRtcLifecycleStage;
  lastUpdate: number;
  isHost: boolean;
  iceCandidatesSent: number;
  iceCandidatesReceived: number;
  error?: string;
}

interface NetworkDiagnosticsState {
  peers: Record<string, PeerDiagnostics>;
  updatePeer: (clientId: string, update: Partial<Omit<PeerDiagnostics, 'clientId'>>) => void;
  removePeer: (clientId: string) => void;
  clearAll: () => void;
}

export const useNetworkDiagnosticsStore = create<NetworkDiagnosticsState>((set) => ({
  peers: {},
  updatePeer: (clientId, update) =>
    set((state) => {
      const existing = state.peers[clientId] || {
        clientId,
        stage: 'disconnected',
        lastUpdate: Date.now(),
        isHost: false,
        iceCandidatesSent: 0,
        iceCandidatesReceived: 0,
      };
      return {
        peers: {
          ...state.peers,
          [clientId]: {
            ...existing,
            ...update,
            lastUpdate: Date.now(),
          },
        },
      };
    }),
  removePeer: (clientId) =>
    set((state) => {
      const next = { ...state.peers };
      delete next[clientId];
      return { peers: next };
    }),
  clearAll: () => set({ peers: {} }),
}));
