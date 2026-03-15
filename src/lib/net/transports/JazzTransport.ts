import { Emitter, type Listener } from "../../../../networking/client/emitter";
import type { ITransport, TransportEvents, TransportState } from "../../../../networking/client/transport";
import type { JazzSessionRoot } from "../../jazz/schema";
import type { ClientToServerMessage, ServerToClientMessage } from "../../../../networking/contract/v1";
import { PROTOCOL_VERSION } from "../../../../networking/contract/v1";

export class JazzTransport implements ITransport {
  public state: TransportState = "idle";
  private emitter = new Emitter<TransportEvents>();
  private sessionRoot: JazzSessionRoot;
  private userId: string;
  private username: string;
  private roles: string[];
  private heartbeatInterval?: number;

  // Track Unsubscribers
  private unsubs: Array<() => void> = [];

  constructor(sessionRoot: JazzSessionRoot, localUserId: string, username: string, roles: string[]) {
    this.sessionRoot = sessionRoot;
    this.userId = localUserId;
    this.username = username;
    this.roles = roles;
  }

  connect(url: string): void {
    if (this.state === "connecting" || this.state === "open") {
      // If already open (e.g. re-injected during reconnect), still fire open event for the new NetworkSession
      if (this.state === "open") {
        setTimeout(() => this.emitter.emit("open", undefined), 0);
      }
      return;
    }
    this.state = "connecting";

    if ((this.sessionRoot as any).connectedUsers?.$jazz?.set) {
      const pulseHeartbeat = () => {
        try {
          ((this.sessionRoot as any).connectedUsers as any).$jazz.set(this.userId, JSON.stringify({ 
            status: "connected", timestamp: Date.now(), username: this.username, roles: this.roles 
          }));
        } catch (e) {}
      };
      
      pulseHeartbeat();
      // Send heartbeat every 10 seconds
      this.heartbeatInterval = window.setInterval(pulseHeartbeat, 10000);
    }

    // Jazz connection is intrinsically handled by the Jazz SessionProvider earlier in the boot sequence.
    // By the time we inject this transport into NetManager, the Jazz session is already active.
    // Thus we immediately transition to open.
    setTimeout(() => {
      this.state = "open";
      this.emitter.emit("open", undefined);
    }, 0);
  }

  send(text: string): void {
    if (this.state !== "open") {
      this.emitter.emit("error", { message: "Transport not open" });
      return;
    }

    try {
      const msg = JSON.parse(text) as ClientToServerMessage | any;

      if (msg.t === "hello") {
        // Intercept Hello and immediately reply with a mock Welcome
        // Since Jazz handles auth/roles via its own Provider, we just synthesize an ACK to satisfy NetManager
        
        // Pre-seed known peers from the CRDT before we start our subscription loops
        // This ensures the local client sees anyone already connected the moment they join.
        const initialPeers: any[] = [];
        if ((this.sessionRoot as any).connectedUsers) {
          try {
            const users = (this.sessionRoot as any).connectedUsers;
            for (const uId of Object.keys(users)) {
              if (uId === "in" || uId === "$jazz" || uId === this.userId) continue;
              const val = users[uId];
              if (val && typeof val === "string") {
                const payload = JSON.parse(val);
                if (payload.status === "connected") {
                  initialPeers.push({
                    userId: uId,
                    username: payload.username || "unknown",
                    roles: payload.roles || []
                  });
                  // NOTE: Do NOT set `this.knownUsers[uId] = "connected"` here. 
                  // If we do, the subsequent CRDT subscription will skip emitting the "presence" event 
                  // and NetManager might miss the player.
                }
              }
            }
          } catch (e) {
             console.warn("[JazzTransport] Failed to pre-seed peers", e);
          }
        }

        const welcome: ServerToClientMessage = {
          v: PROTOCOL_VERSION,
          t: "welcome",
          clientId: this.userId, // <<-- CRITICAL: Must use the Jazz ID so Redux state matches CRDT key
          ts: Date.now().toString(),
          p: {
            sessionId: "jazz_session",
            user: {
              userId: this.userId, // <<-- CRITICAL: Match CRDT key
              username: msg.p.username,
              roles: msg.p.roles ?? [],
            },
            permissions: [],
            currentSeq: Number.MAX_SAFE_INTEGER, // Max to prevent 'catchup_requests'
            peers: initialPeers // Set initial peers. wireSubscriptions() will stream further updates.
          }
        };
        this.emitInbound(welcome);

        // Defer subscriptions until AFTER the welcome packet is sent.
        // This ensures NetManager's event listeners are fully ready to receive
        // the initial barrage of CRDT synchronous subscription callbacks (e.g. existing presence).
        if (this.unsubs.length === 0) {
          this.wireSubscriptions();
        }

        return;
      }

      if (msg.t === "ephemeral") {
        // Route Ephemeral payloads specifically to the CoValues
        this.handleOutboundEphemeral(msg);
        return;
      }

      if (msg.t === "propose_ops" || msg.t === "catchup_request") {
        // DROP: Jazz CRDT automatically syncs durable ops. 
        // We do not want NetManager trying to pipe durable EngineOps over this side-channel.
        return;
      }

    } catch (e) {
      console.error("[JazzTransport] Failed to parse outbound msg", e);
    }
  }

  close(code?: number, reason?: string): void {
    if (this.state === "closed") return;
    this.state = "closed";

    if (this.heartbeatInterval) {
      window.clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    if ((this.sessionRoot as any).connectedUsers?.$jazz?.set) {
      try {
        // Best effort explicit leave for instant UI updates, though heartbeat handles failures
        ((this.sessionRoot as any).connectedUsers as any).$jazz.set(this.userId, JSON.stringify({ 
          status: "disconnected", timestamp: Date.now(), username: this.username, roles: this.roles 
        }));
      } catch (e) {}
    }

    this.emitter.emit("close", { code, reason });
    this.unsubs.forEach(u => u());
    this.unsubs = [];
  }

  on<K extends keyof TransportEvents>(event: K, cb: Listener<TransportEvents[K]>): () => void {
    return this.emitter.on(event, cb);
  }

  // -----------------------------------------------------
  // Private Routing
  // -----------------------------------------------------

  private emitInbound(msg: ServerToClientMessage): void {
    this.emitter.emit("message", { data: JSON.stringify(msg) });
  }

  private handleOutboundEphemeral(msg: Extract<ClientToServerMessage, { t: 'ephemeral' }>): void {
    const { kind, data } = msg.p;
    const userId = msg.userId || "unknown";

    if ((kind === "cursor.update" || kind === "cursor.visibility") && this.sessionRoot.cursors) {
      if ((this.sessionRoot.cursors as any).$jazz?.push) {
        const payload = { kind, data, timestamp: Date.now(), userId };
        (this.sessionRoot.cursors as any).$jazz.push(JSON.stringify(payload));
      }
    } 
    else if (kind === "map.ping" && this.sessionRoot.pings) {
      if ((this.sessionRoot.pings as any).$jazz?.push) {
        const payload = { ...data as Record<string,any>, timestamp: Date.now(), userId };
        (this.sessionRoot.pings as any).$jazz.push(JSON.stringify(payload));
      }
    }
    else if (kind === "chat.message" && this.sessionRoot.chat) {
      if ((this.sessionRoot.chat as any).$jazz?.push) {
        (this.sessionRoot.chat as any).$jazz.push(JSON.stringify(data));
      }
    }
    else if ((kind === "token.drag.begin" || kind === "token.drag.update" || kind === "token.drag.end" || kind === "token.position.sync") && (this.sessionRoot as any).tokenStates) {
      if (((this.sessionRoot as any).tokenStates as any).$jazz?.push) {
        const payload = { kind, data, timestamp: Date.now(), userId };
        ((this.sessionRoot as any).tokenStates as any).$jazz.push(JSON.stringify(payload));
      }
    }
  }

  private wireSubscriptions(): void {
    // When remote peers change the Jazz CoValues, we funnel them back into NetManager
    
    // Connected Users / Presence
    if ((this.sessionRoot as any).connectedUsers?.$jazz?.subscribe) {
      this.unsubs.push(
        ((this.sessionRoot as any).connectedUsers as any).$jazz.subscribe([], (users: any) => {
          if (!users) return;
          const activeUsers: any[] = [];
          for (const uId of Object.keys(users)) {
            if (uId === "in" || uId === "$jazz") continue;
            try {
              const val = users[uId];
              if (val && typeof val === "string") {
                const payload = JSON.parse(val);
                if (payload.status === "connected") {
                  activeUsers.push({
                    userId: uId,
                    username: payload.username || "unknown",
                    roles: payload.roles || [],
                    lastPing: payload.timestamp
                  });
                }
              }
            } catch (e) {
              console.warn("[JazzTransport] Failed to parse connectedUser value", e);
            }
          }
          
          console.log("[JazzTransport] Broadcasting active users to NetManager:", activeUsers);
          this.emitInbound({
            v: PROTOCOL_VERSION, 
            t: "presence_sync", 
            p: { users: activeUsers }
          } as unknown as ServerToClientMessage);
        })
      );
    }

    // Cursors
    if ((this.sessionRoot.cursors as any)?.$jazz?.subscribe) {
      const knownTx: Record<string, string> = {};
      this.unsubs.push(
        (this.sessionRoot.cursors as any).$jazz.subscribe([], (feed: any) => {
          if (!feed || !feed.perAccount) return;
          for (const accId of Object.keys(feed.perAccount)) {
            const entry = feed.perAccount[accId];
            if (!entry || !entry.value || typeof entry.value !== "string") continue;
            if (entry.tx !== knownTx[accId]) {
              knownTx[accId] = entry.tx;
              try {
                // Also log unpacked
                const payload = JSON.parse(entry.value);
                this.emitInbound({
                  v: PROTOCOL_VERSION, t: "ephemeral", 
                  p: { kind: payload.kind || "cursor.update", data: payload.data || payload, userId: accId } // Strict mapping to actual Jazz Account ID
                } as unknown as ServerToClientMessage);
              } catch (e) {
                console.warn("[JazzTransport] Cursor parse fail:", e);
              }
            }
          }
        })
      );
    }

    // Pings
    if ((this.sessionRoot.pings as any)?.$jazz?.subscribe) {
      const knownTx: Record<string, string> = {};
      this.unsubs.push(
        (this.sessionRoot.pings as any).$jazz.subscribe([], (feed: any) => {
          if (!feed || !feed.perAccount) return;
          for (const accId of Object.keys(feed.perAccount)) {
            const entry = feed.perAccount[accId];
            if (!entry || !entry.value || typeof entry.value !== "string") continue;
            if (entry.tx !== knownTx[accId]) {
              knownTx[accId] = entry.tx;
              try {
                const data = JSON.parse(entry.value);
                this.emitInbound({
                  v: PROTOCOL_VERSION, t: "ephemeral", 
                  p: { kind: "map.ping", data, userId: accId }
                } as unknown as ServerToClientMessage);
              } catch {}
            }
          }
        })
      );
    }

    // Chat
    if ((this.sessionRoot.chat as any)?.$jazz?.subscribe) {
      let lastProcessedLength = 0;
      this.unsubs.push(
        (this.sessionRoot.chat as any).$jazz.subscribe([], (chatList: any) => {
          if (!chatList) return;
          if (chatList.length > lastProcessedLength) {
            for (let i = lastProcessedLength; i < chatList.length; i++) {
               try {
                  const val = chatList[i];
                  if (typeof val === "string") {
                    const data = JSON.parse(val);
                    this.emitInbound({
                      v: PROTOCOL_VERSION, t: "ephemeral", 
                      p: { kind: "chat.message", data, userId: data.userId || "unknown" }
                    } as unknown as ServerToClientMessage);
                  }
               } catch {}
            }
            lastProcessedLength = chatList.length;
          }
        })
      );
    }

    // Token States (Drags, Syncs)
    if ((this.sessionRoot as any).tokenStates?.$jazz?.subscribe) {
      const knownTx: Record<string, string> = {};
      this.unsubs.push(
        ((this.sessionRoot as any).tokenStates as any).$jazz.subscribe([], (feed: any) => {
          if (!feed || !feed.perAccount) return;
          for (const accId of Object.keys(feed.perAccount)) {
            const entry = feed.perAccount[accId];
            if (!entry || !entry.value || typeof entry.value !== "string") continue;
            if (entry.tx !== knownTx[accId]) {
              knownTx[accId] = entry.tx;
              try {
                const payload = JSON.parse(entry.value);
                this.emitInbound({
                  v: PROTOCOL_VERSION, 
                  t: "ephemeral", 
                  p: { 
                    kind: payload.kind, 
                    data: payload.data, 
                    userId: accId 
                  }
                } as unknown as ServerToClientMessage);
              } catch (e) {
                console.warn("[JazzTransport] Token state parse fail:", e);
              }
            }
          }
        })
      );
    }
  }
}
