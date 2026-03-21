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
  iceState?: RTCIceConnectionState | 'new' | 'unknown';
  error?: string;
}

export interface WebRtcHistoryEntry {
  timestamp: number | string;
  inKb: string;
  outKb: string;
}

export const activePeerConnections = new Map<string, RTCPeerConnection>();

export const registerPeerConnection = (id: string, pc: RTCPeerConnection) => {
  activePeerConnections.set(id, pc);
};

export const unregisterPeerConnection = (id: string) => {
  activePeerConnections.delete(id);
};

const previousBytesRef = new Map<string, { sent: number, received: number }>();

interface NetworkDiagnosticsState {
  peers: Record<string, PeerDiagnostics>;
  history: WebRtcHistoryEntry[];
  updatePeer: (clientId: string, update: Partial<Omit<PeerDiagnostics, 'clientId'>>) => void;
  removePeer: (clientId: string) => void;
  clearAll: () => void;
  flushWebRTCStats: (timestamp: number | string) => Promise<void>;
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
}

export const useNetworkDiagnosticsStore = create<NetworkDiagnosticsState>((set) => ({
  peers: {},
  history: [],
  isRecording: true,
  setIsRecording: (recording) => set({ isRecording: recording }),
  updatePeer: (clientId, update) =>
    set((state) => {
      const existing = state.peers[clientId] || {
        clientId,
        stage: 'disconnected',
        lastUpdate: Date.now(),
        isHost: false,
        iceCandidatesSent: 0,
        iceCandidatesReceived: 0,
        iceState: 'unknown',
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
  clearAll: () => set({ peers: {}, history: [] }),
  flushWebRTCStats: async (timestamp) => {
    let globalDeltaSent = 0;
    let globalDeltaReceived = 0;

    for (const [id, pc] of activePeerConnections.entries()) {
      try {
        const stats = await pc.getStats();
        let currentSent = 0;
        let currentReceived = 0;
        let fallbackSent = 0;
        let fallbackReceived = 0;

        stats.forEach(report => {
          if (report.type === 'data-channel') {
            currentSent += (report.bytesSent || 0);
            currentReceived += (report.bytesReceived || 0);
          } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            fallbackSent += (report.bytesSent || 0);
            fallbackReceived += (report.bytesReceived || 0);
          }
        });

        if (currentSent === 0 && currentReceived === 0) {
          currentSent = fallbackSent;
          currentReceived = fallbackReceived;
        }

        const previous = previousBytesRef.get(id);
        if (previous) {
          globalDeltaSent += Math.max(0, currentSent - previous.sent);
          globalDeltaReceived += Math.max(0, currentReceived - previous.received);
        }

        previousBytesRef.set(id, { sent: currentSent, received: currentReceived });
      } catch (e) {
        // Ignore stats errors for closed connections
      }
    }

    // Cleanup previousBytesRef for disconnected peers
    for (const id of previousBytesRef.keys()) {
      if (!activePeerConnections.has(id)) {
        previousBytesRef.delete(id);
      }
    }

    const outKb = (globalDeltaSent / 1024).toFixed(2);
    const inKb = (globalDeltaReceived / 1024).toFixed(2);

    set((state) => {
      if (!state.isRecording) return state;
      
      const newHistory = [...state.history, { timestamp, outKb, inKb }];
      if (newHistory.length > 6) {
        newHistory.shift();
      }
      return { history: newHistory };
    });
  },
}));
