import { Emitter, type Listener } from "../../../../networking/client/emitter";
import type { ITransport, TransportEvents, TransportState } from "../../../../networking/client/transport";
import type { JazzSessionRoot, JazzSignalingRoom } from "../../jazz/schema";
import type { ClientToServerMessage, ServerToClientMessage } from "../../../../networking/contract/v1";
import { useMultiplayerStore } from "../../../stores/multiplayerStore";
import { useNetworkDiagnosticsStore } from "@/stores/networkDiagnosticsStore";

const STUN_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

type SignalingData = {
  hostId: string;
  offer?: RTCSessionDescriptionInit | null;
  answer?: RTCSessionDescriptionInit | null;
  candidatesHost?: Record<string, RTCIceCandidateInit>;
  candidatesClient?: Record<string, RTCIceCandidateInit>;
};

export class WebRTCTransport implements ITransport {
  public state: TransportState = "idle";
  private emitter = new Emitter<TransportEvents>();
  
  private sessionRoot: JazzSessionRoot;
  private userId: string;
  private isHost: boolean;
  private sessionCode: string;
  
  // Host mapping for connections
  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  
  // Client's single connection to Host
  private hostConnection?: RTCPeerConnection;
  private hostDataChannel?: RTCDataChannel;
  private lastHostOfferSdp?: string;

  private unsubs: Array<() => void> = [];

  constructor(sessionRoot: JazzSessionRoot, localUserId: string, roles: string[], sessionCode: string = '') {
    this.sessionRoot = sessionRoot;
    this.userId = localUserId;
    this.isHost = roles.includes("dm") || roles.includes("host");
    this.sessionCode = sessionCode;
  }

  connect(url: string): void {
    if (this.state === "connecting" || this.state === "open") return;
    this.state = "connecting";

    if (!this.sessionRoot.signalingRoom) {
      console.warn("[WebRTCTransport] No signalingRoom found on JazzSessionRoot.");
      this.state = "closed";
      this.emitter.emit("error", { message: "signalingRoom missing from CoMap" });
      return;
    }

    // Immediately start listening for signaling changes
    this.wireSignaling();

    // The transport state conceptually goes "open" immediately because it establishes P2P lazily.
    // The actual P2P channels will open asynchronously.
    setTimeout(() => {
      this.state = "open";
      this.emitter.emit("open", undefined);
    }, 0);
  }

  send(text: string): void {
    if (this.state !== "open") return;
    
    // In a Star Topology, if we are Host, we broadcast to all clients.
    // AND we must loopback to ourselves so the local NetManager processes the message.
    if (this.isHost) {
      if (!text.startsWith(`{"t":"rpc"`)) { // Ignore internal RPCs for loopback to prevent infinite loops, if any
          this.emitter.emit("message", { data: text });
      }

      for (const [peerId, channel] of this.dataChannels.entries()) {
        if (channel.readyState === "open") {
          channel.send(text);
        }
      }
    } else {
      if (this.hostDataChannel && this.hostDataChannel.readyState === "open") {
        this.hostDataChannel.send(text);
      }
    }
  }

  close(code?: number, reason?: string): void {
    if (this.state === "closed") return;
    this.state = "closed";

    // Clean up signaling listener
    this.unsubs.forEach(u => u());
    this.unsubs = [];

    // Clean up all RTCPeerConnections
    const store = useMultiplayerStore.getState();
    for (const [peerId, pc] of this.peerConnections.entries()) {
        pc.close();
        store.removeWebRtcConnection(peerId);
    }
    this.peerConnections.clear();
    this.dataChannels.clear();

    if (this.hostConnection) {
        this.hostConnection.close();
        const hostId = (this.sessionRoot.signalingRoom as any)?.hostId || "host";
        store.removeWebRtcConnection(hostId);
        this.hostConnection = undefined;
        this.hostDataChannel = undefined;
    }

    this.emitter.emit("close", { code, reason });
  }

  on<K extends keyof TransportEvents>(event: K, cb: Listener<TransportEvents[K]>): () => void {
    return this.emitter.on(event, cb);
  }

  // --- Private Signaling Methods ---

  private wireSignaling() {
    const signalingRoom = this.sessionRoot.signalingRoom as any;
    if (!signalingRoom || !signalingRoom.$jazz) return;
    
    // 1. Idempotent Signaling: Clear any existing presence in the signaling room for ourselves.
    // This prevents "Zombie" connection states from a previous page reload where we didn't unmount cleanly.
    try {
        if (typeof signalingRoom.$jazz.delete === 'function') {
            signalingRoom.$jazz.delete(this.userId);
        } else {
            signalingRoom.$jazz.set(this.userId, undefined);
        }
    } catch(e) {
        console.warn("[WebRTCTransport] Failed to clear stale signaling record:", e);
    }
    
    // As Host: watch connectedUsers to initiate offers
    if (this.isHost) {
      const connectedUsers = (this.sessionRoot as any).connectedUsers;
      if (connectedUsers && connectedUsers.$jazz) {
        this.unsubs.push(
          connectedUsers.$jazz.subscribe([], (users: any) => {
             if (!users) return;
             const activeClientIds = new Set<string>();
             for (const clientId of Object.keys(users)) {
               if (clientId === this.userId || clientId === "in" || clientId === "$jazz") continue;
               
               let isConnected = false;
               try {
                 const val = JSON.parse(users[clientId] || "{}");
                 isConnected = val.status === "connected";
               } catch (e) {}

               if (isConnected) {
                 activeClientIds.add(clientId);
                 // Ensure we have a peer connection for this active client
                 if (!this.peerConnections.has(clientId)) {
                     useNetworkDiagnosticsStore.getState().updatePeer(clientId, { isHost: false, stage: 'signal_offer' });
                     this.initiateOffer(clientId);
                 }
               }
             }

             // Teardown connections for clients that are no longer connected
             for (const clientId of this.peerConnections.keys()) {
               if (!activeClientIds.has(clientId)) {
                 console.log(`[WebRTCTransport] Client ${clientId} disconnected from Jazz. Tearing down peer connection.`);
                 const pc = this.peerConnections.get(clientId);
                 if (pc) {
                     pc.close();
                     this.peerConnections.delete(clientId);
                     this.dataChannels.delete(clientId);
                     useMultiplayerStore.getState().removeWebRtcConnection(clientId);
                 }
               }
             }
          })
        );
      }
      
      // Also watch signaling room for answers from clients
      this.unsubs.push(
        signalingRoom.$jazz.subscribe([], (room: any) => {
          if (!room) return;
          for (const clientId of Object.keys(room)) {
            if (clientId === this.userId || clientId === "in" || clientId === "$jazz") continue;
            const dataStr = room[clientId];
            
            // If the client explicitly cleared their signaling row (e.g. on page refresh),
            // we should proactively tear down the stale peer connection.
            // If the client explicitly cleared their signaling row (e.g. on page refresh or
            // after the ghost-cleanup timer fires once they connected), check whether our
            // existing peer connection is still alive before re-initiating.
            if (!dataStr && this.peerConnections.has(clientId)) {
              const existingPc = this.peerConnections.get(clientId);
              const existingState = existingPc?.connectionState;
              
              // If the connection is already live (connected) or actively doing the DTLS
              // handshake (connecting), the client just fired its ghost-cleanup timer.
              // Do NOT tear it down — let the handshake complete.
              if (existingState === 'connected' || existingState === 'connecting') {
                console.log(`[WebRTCTransport] Client ${clientId} cleared signaling row but connection is ${existingState} — ignoring ghost cleanup.`);
                continue;
              }
              
              // Connection is genuinely dead — tear it down and re-offer.
              console.log(`[WebRTCTransport] Client ${clientId} cleared signaling room. Connection state: ${existingState}. Tearing down and re-initiating.`);
              const pc = this.peerConnections.get(clientId);
              if (pc) pc.close();
              this.peerConnections.delete(clientId);
              this.dataChannels.delete(clientId);
              useMultiplayerStore.getState().removeWebRtcConnection(clientId);
              
              // Immediately re-initiate offer since they are likely still in connectedUsers
              this.initiateOffer(clientId);
              continue;
            }

            if (dataStr && typeof dataStr === "string") {
              try {
                const sigData = JSON.parse(dataStr) as SignalingData;
                this.handleSignalAsHost(clientId, sigData);
              } catch (e) {}
            }
          }
        })
      );

    } else {
      // As Client: watch our own row in the signaling room for host offers
      this.unsubs.push(
        signalingRoom.$jazz.subscribe([], (room: any) => {
          if (!room) return;
          const dataStr = room[this.userId];
          if (dataStr && typeof dataStr === "string") {
            try {
              const sigData = JSON.parse(dataStr) as SignalingData;
              this.handleSignalAsClient(sigData);
            } catch (e) {}
          }
        })
      );
    }
  }

  // ==== Host Logic ====

  private async initiateOffer(clientId: string) {
    if (this.peerConnections.has(clientId)) return;

    const pc = new RTCPeerConnection(STUN_SERVERS);
    this.peerConnections.set(clientId, pc);

    const updateSignalRoom = (mutator: (current: SignalingData) => void) => {
      try {
        const room = this.sessionRoot.signalingRoom as any;
        if (!room || !room.$jazz) return;
        const currentStr = room[clientId];
        let currentData: SignalingData = currentStr ? JSON.parse(currentStr) : {
          hostId: this.userId,
          candidatesHost: {},
          candidatesClient: {}
        };
        mutator(currentData);
        room.$jazz.set(clientId, JSON.stringify(currentData));
      } catch (e) {
        console.error("Failed to update signaling room:", e);
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        updateSignalRoom((data) => {
          if (!data.candidatesHost) data.candidatesHost = {};
          data.candidatesHost[Date.now().toString() + Math.random().toString()] = e.candidate!.toJSON();
        });
        
        const peer = useNetworkDiagnosticsStore.getState().peers[clientId];
        if (peer?.stage !== 'connected' && peer?.stage !== 'datachannel_open') {
            useNetworkDiagnosticsStore.getState().updatePeer(clientId, { stage: 'ice_gathering' });
        }
        
        // Non-reactive read-modify-write for the counter
        const store = useNetworkDiagnosticsStore.getState();
        const existing = store.peers[clientId]?.iceCandidatesSent || 0;
        store.updatePeer(clientId, { iceCandidatesSent: existing + 1 });
      }
    };

    pc.oniceconnectionstatechange = () => {
        useNetworkDiagnosticsStore.getState().updatePeer(clientId, { iceState: pc.iceConnectionState });
        
        // ICE Restart Fallback: If we get stuck in "checking" for more than 5 seconds, restart ICE.
        if (pc.iceConnectionState === 'checking') {
            const timeoutId = setTimeout(() => {
                if (pc.iceConnectionState === 'checking') {
                    console.warn(`[WebRTCTransport] Host connection to ${clientId} stuck in checking. Restarting ICE!`);
                    pc.restartIce();
                }
            }, 5000);
            (pc as any)._checkingTimeout = timeoutId;
        } else {
            if ((pc as any)._checkingTimeout) {
                clearTimeout((pc as any)._checkingTimeout);
                delete (pc as any)._checkingTimeout;
            }
        }
    };

    pc.onconnectionstatechange = () => {
       const store = useMultiplayerStore.getState();
       store.setWebRtcConnection(clientId, pc.connectionState);
       
       const diagStore = useNetworkDiagnosticsStore.getState();
       if (pc.connectionState === 'connecting') {
           diagStore.updatePeer(clientId, { stage: 'dtls_connecting' });
       } else if (pc.connectionState === 'connected') {
           diagStore.updatePeer(clientId, { stage: 'connected' });
       } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
           diagStore.updatePeer(clientId, { stage: 'failed', error: 'DTLS Failed/Disconnected' });
       }
       
       if (pc.connectionState === "connected") {
          // Fix Signaling Ghost: Remove signaling room row once active
          // Delay this to allow any late-arriving ICE candidates to finish syncing first
          setTimeout(() => {
              try {
                 const room = this.sessionRoot.signalingRoom as any;
                 if (room.$jazz) {
                     if (typeof room.$jazz.delete === 'function') {
                         room.$jazz.delete(clientId);
                     } else {
                         room.$jazz.set(clientId, undefined);
                     }
                 }
              } catch(e) {}
          }, 3000);
       }

       if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          this.peerConnections.delete(clientId);
          this.dataChannels.delete(clientId);
       }
    };

    const channel = pc.createDataChannel("ephemeral", { ordered: false, maxRetransmits: 0 });
    
    channel.onopen = () => {
        useNetworkDiagnosticsStore.getState().updatePeer(clientId, { stage: 'datachannel_open' });
    };

    // Client -> Host messages (Host is router!)
    // Since Host created the channel, we listen directly (pc.ondatachannel won't fire for us)
    channel.onmessage = (event) => {
        // Forward from one client to all other clients to fulfill the Star Topology
        // And emit locally so the Host sees it
        this.emitter.emit("message", { data: event.data });
        this.broadcastToPeers(event.data, clientId);
    };

    this.dataChannels.set(clientId, channel);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    updateSignalRoom((data) => {
      data.offer = { type: offer.type, sdp: offer.sdp };
      data.hostId = this.userId; // ensure set
      delete data.answer; // Ensure we don't accidentally reuse a stale answer from a previous session
      data.candidatesClient = {}; // wipe out stale client candidates too
    });
  }

  private async handleSignalAsHost(clientId: string, sigData: SignalingData) {
     const pc = this.peerConnections.get(clientId);
     if (!pc) return;

     if (sigData.answer && pc.signalingState === "have-local-offer") {
         useNetworkDiagnosticsStore.getState().updatePeer(clientId, { stage: 'signal_answer' });
         await pc.setRemoteDescription(sigData.answer);
         
         const pending = (pc as any)._pendingIceCandidates || [];
         for (const cand of pending) {
             try {
                 const existingKeys = (pc as any)._knownClientIceCandidates || new Set();
                 const candStr = JSON.stringify(cand);
                 if (!existingKeys.has(candStr)) {
                     await pc.addIceCandidate(cand);
                     existingKeys.add(candStr);
                     (pc as any)._knownClientIceCandidates = existingKeys;
                 }
             } catch(e) {}
         }
         (pc as any)._pendingIceCandidates = [];
     }
     // Process incoming ICE candidates independently of the Answer state
     if (sigData.candidatesClient && Object.keys(sigData.candidatesClient).length > 0) {
         const peer = useNetworkDiagnosticsStore.getState().peers[clientId];
         if (peer?.stage !== 'connected' && peer?.stage !== 'datachannel_open') {
             useNetworkDiagnosticsStore.getState().updatePeer(clientId, { stage: 'ice_gathering' });
         }
         for (const cand of Object.values(sigData.candidatesClient)) {
             if (!pc.remoteDescription) {
                 const pending = (pc as any)._pendingIceCandidates || [];
                 pending.push(cand);
                 (pc as any)._pendingIceCandidates = pending;
                 continue; // Waiting for Answer first
             }
             try {
                 const existingKeys = (pc as any)._knownClientIceCandidates || new Set();
                 const candStr = JSON.stringify(cand);
                 if (!existingKeys.has(candStr)) {
                     await pc.addIceCandidate(cand);
                     existingKeys.add(candStr);
                     (pc as any)._knownClientIceCandidates = existingKeys;
                 }
             } catch(e) {
                 console.warn("Failed to add client ICE candidate", e);
             }
         }
     }
  }

  private broadcastToPeers(message: string, excludeClientId: string) {
      for (const [peerId, channel] of this.dataChannels.entries()) {
          if (peerId !== excludeClientId && channel.readyState === "open") {
              channel.send(message);
          }
      }
  }

  // ==== Client Logic ====

  private async handleSignalAsClient(sigData: SignalingData) {
     if (!sigData.offer || sigData.hostId === this.userId) return; // don't answer yourself

     // If we already have a connection but the Host sent a NEW offer,
     // it means the Host probably refreshed their page and recreated the transport.
     // We need to tear down our stale connection and accept the new offer.
     if (this.hostConnection) {
         if (this.lastHostOfferSdp && this.lastHostOfferSdp !== sigData.offer.sdp) {
             console.log("[WebRTCTransport] Detected new Host offer! Host likely refreshed. Tearing down stale connection.");
             this.hostConnection.close();
             this.hostConnection = undefined;
             this.hostDataChannel = undefined;
             this.lastHostOfferSdp = undefined;
         }
     }

     if (!this.hostConnection) {
         this.lastHostOfferSdp = sigData.offer.sdp;
         this.hostConnection = new RTCPeerConnection(STUN_SERVERS);
         
         const updateSignalRoom = (mutator: (current: SignalingData) => void) => {
            try {
              const room = this.sessionRoot.signalingRoom as any;
              if (!room || !room.$jazz) return;
              const currentStr = room[this.userId];
              let currentData: SignalingData = currentStr ? JSON.parse(currentStr) : { ...sigData };
              mutator(currentData);
              room.$jazz.set(this.userId, JSON.stringify(currentData));
            } catch (e) {
              console.error("Failed to update signaling room client side:", e);
            }
         };

         this.hostConnection.onicecandidate = (e) => {
             if (e.candidate) {
                 updateSignalRoom((data) => {
                     if (!data.candidatesClient) data.candidatesClient = {};
                     data.candidatesClient[Date.now().toString() + Math.random().toString()] = e.candidate!.toJSON();
                 });
                 
                 const peer = useNetworkDiagnosticsStore.getState().peers[sigData.hostId];
                 if (peer?.stage !== 'connected' && peer?.stage !== 'datachannel_open') {
                     useNetworkDiagnosticsStore.getState().updatePeer(sigData.hostId, { stage: 'ice_gathering' });
                 }
             }
         };

          this.hostConnection.oniceconnectionstatechange = () => {
              if (this.hostConnection) {
                  useNetworkDiagnosticsStore.getState().updatePeer(sigData.hostId, { iceState: this.hostConnection.iceConnectionState });
                  
                  // ICE Restart Fallback
                  if (this.hostConnection.iceConnectionState === 'checking') {
                      const timeoutId = setTimeout(() => {
                          if (this.hostConnection?.iceConnectionState === 'checking') {
                              console.warn(`[WebRTCTransport] Client connection to host ${sigData.hostId} stuck in checking. Restarting ICE!`);
                              this.hostConnection.restartIce();
                          }
                      }, 5000);
                      (this.hostConnection as any)._checkingTimeout = timeoutId;
                  } else {
                      if ((this.hostConnection as any)._checkingTimeout) {
                          clearTimeout((this.hostConnection as any)._checkingTimeout);
                          delete (this.hostConnection as any)._checkingTimeout;
                      }
                  }
              }
          };

          this.hostConnection.ondatachannel = (e) => {
             this.hostDataChannel = e.channel;
             
             // The channel might already be open by the time this fires
             if (this.hostDataChannel.readyState === 'open') {
                 useNetworkDiagnosticsStore.getState().updatePeer(sigData.hostId, { stage: 'datachannel_open' });
             } else {
                 this.hostDataChannel.onopen = () => {
                     useNetworkDiagnosticsStore.getState().updatePeer(sigData.hostId, { stage: 'datachannel_open' });
                 };
             }
             
             this.hostDataChannel.onmessage = (event) => {
                 // Forward inbound WebRTC messages to NetManager
                 this.emitter.emit("message", { data: event.data });
             };
         };

         this.hostConnection.onconnectionstatechange = () => {
             const store = useMultiplayerStore.getState();
             store.setWebRtcConnection(sigData.hostId, this.hostConnection!.connectionState);
             
             const diagStore = useNetworkDiagnosticsStore.getState();
             if (this.hostConnection?.connectionState === 'connecting') {
                 diagStore.updatePeer(sigData.hostId, { stage: 'dtls_connecting' });
             } else if (this.hostConnection?.connectionState === 'connected') {
                 diagStore.updatePeer(sigData.hostId, { stage: 'connected' });
             } else if (this.hostConnection?.connectionState === 'failed' || this.hostConnection?.connectionState === 'disconnected') {
                 diagStore.updatePeer(sigData.hostId, { stage: 'failed', error: 'DTLS Failed/Disconnected' });
             }
             
             if (this.hostConnection?.connectionState === "connected") {
                 // Fix Signaling Ghost: Remove signaling room row once active
                 // Give buffer time to avoid deleting before Host completes processing
                 setTimeout(() => {
                     try {
                         const room = this.sessionRoot.signalingRoom as any;
                         if (room.$jazz) {
                             if (typeof room.$jazz.delete === 'function') {
                                 room.$jazz.delete(this.userId);
                             } else {
                                 room.$jazz.set(this.userId, undefined);
                             }
                         }
                     } catch(e) {}
                 }, 3000);
             }
             
             if (this.hostConnection?.connectionState === "disconnected" || this.hostConnection?.connectionState === "failed") {
                 this.hostConnection = undefined;
                 this.hostDataChannel = undefined;
             }
         };
         
         await this.hostConnection.setRemoteDescription(sigData.offer);
         const answer = await this.hostConnection.createAnswer();
         await this.hostConnection.setLocalDescription(answer);
         
         updateSignalRoom((data) => {
            data.answer = { type: answer.type, sdp: answer.sdp };
         });
         
         
         useNetworkDiagnosticsStore.getState().updatePeer(sigData.hostId, { isHost: true, stage: 'signal_answer' });
         
         const pending = (this.hostConnection as any)._pendingIceCandidates || [];
         for (const cand of pending) {
             try {
                 const existingKeys = (this.hostConnection as any)._knownHostIceCandidates || new Set();
                 const candStr = JSON.stringify(cand);
                 if (!existingKeys.has(candStr)) {
                     await this.hostConnection.addIceCandidate(cand);
                     existingKeys.add(candStr);
                     (this.hostConnection as any)._knownHostIceCandidates = existingKeys;
                 }
             } catch(e) {}
         }
         (this.hostConnection as any)._pendingIceCandidates = [];
         
         // Process any host candidates that arrived with the offer
         if (sigData.candidatesHost && Object.keys(sigData.candidatesHost).length > 0) {
             for (const cand of Object.values(sigData.candidatesHost)) {
                 if (!this.hostConnection.remoteDescription) continue;
                 try {
                     const existingKeys = (this.hostConnection as any)._knownHostIceCandidates || new Set();
                     const candStr = JSON.stringify(cand);
                     if (!existingKeys.has(candStr)) {
                         await this.hostConnection.addIceCandidate(cand);
                         existingKeys.add(candStr);
                         (this.hostConnection as any)._knownHostIceCandidates = existingKeys;
                     }
                 } catch(e) {
                     console.warn("Failed to add host ICE candidate on init", e);
                 }
             }
         }
     } else {
         // Add host ICE candidates if any
         if (sigData.candidatesHost && Object.keys(sigData.candidatesHost).length > 0) {
             const peer = useNetworkDiagnosticsStore.getState().peers[sigData.hostId];
             if (peer?.stage !== 'connected' && peer?.stage !== 'datachannel_open') {
                 useNetworkDiagnosticsStore.getState().updatePeer(sigData.hostId, { stage: 'ice_gathering' });
             }
             for (const cand of Object.values(sigData.candidatesHost)) {
                 if (!this.hostConnection.remoteDescription) {
                     const pending = (this.hostConnection as any)._pendingIceCandidates || [];
                     pending.push(cand);
                     (this.hostConnection as any)._pendingIceCandidates = pending;
                     continue;
                 }
                 try {
                     const existingKeys = (this.hostConnection as any)._knownHostIceCandidates || new Set();
                     const candStr = JSON.stringify(cand);
                     if (!existingKeys.has(candStr)) {
                         await this.hostConnection.addIceCandidate(cand);
                         existingKeys.add(candStr);
                         (this.hostConnection as any)._knownHostIceCandidates = existingKeys;
                     }
                 } catch(e) {
                     console.warn("Failed to add host ICE candidate", e);
                 }
             }
         }
     }
  }
}
