// src/lib/net/NetManager.ts
// Singleton wrapper around NetworkSession for the new WebSocket JSON protocol.

import { NetworkSession, type ConnectParams, type NetworkSessionInfo } from "../../../networking/client";
import type { ITransport } from "../../../networking/client/transport";
import type { EngineOp, OpBatchPayload, PresencePayload, PresenceSyncPayload } from "../../../networking/contract/v1";
import { useMultiplayerStore } from "@/stores/multiplayerStore";
import { opBridge } from "./OpBridge";
import { isEphemeralOp } from "./ephemeral";
import type { EphemeralOpKind } from "./ephemeral";
import { startPositionSync, stopPositionSync } from "./tokenPositionSync";
import { toast } from "sonner";
import { triggerSound } from "@/lib/soundEngine";

// Lazy reference to ephemeralBus to break circular dependency with ./index
let _ephemeralBus: import("./ephemeral").EphemeralBus | null = null;

/** Called by index.ts after singleton creation to wire the circular ref */
export function setEphemeralBusRef(bus: import("./ephemeral").EphemeralBus): void {
  _ephemeralBus = bus;
}

// Throttle for auto-push on player join — prevents cascading state sync when
// multiple players join in rapid succession (which can cause hung clients).
let _lastAutoPushTs = 0;
const AUTO_PUSH_THROTTLE_MS = 2000;

export type NetConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

function seqStorageKey(sessionCode: string): string {
  return `vtt.lastSeenSeq.${sessionCode}`;
}

function readLastSeenSeq(sessionCode: string): number {
  try {
    const raw = localStorage.getItem(seqStorageKey(sessionCode));
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function writeLastSeenSeq(sessionCode: string, seq: number): void {
  try {
    localStorage.setItem(seqStorageKey(sessionCode), String(seq));
  } catch {
    // localStorage may be unavailable
  }
}

export class NetManager {
  private session: NetworkSession;
  private cleanups: Array<() => void> = [];
  private _sessionCode?: string;

  /** When true, inbound durable ops are ignored (Jazz handles them). */
  private _ephemeralOnly = false;

  /** Transport for ephemeral messages (e.g. WebRTC) running parallel to the primary session transport */
  private _ephemeralTransport?: ITransport;

  // Reconnection state
  private _lastConnectParams?: {
    roles?: string[];
    transport?: ITransport;
    ephemeralTransport?: ITransport;
  };
  private _reconnectTimer?: number;
  private _reconnectAttempt = 0;
  private _maxReconnectAttempts = 20;
  private _baseDelayMs = 1000;
  private _maxDelayMs = 30000;
  private _autoReconnect = true;
  private _intentionalDisconnect = false;

  constructor() {
    this.session = new NetworkSession();
    this.wireEvents();
  }


  /**
   * Connect using a custom injected transport (e.g. JazzTransport).
   * In this mode, we mark it as ephemeralOnly internally if it's meant to
   * run tandem to another data source, but the transport manages all the events.
   */
  async connectWithTransport(params: {
    transport: ITransport;
    ephemeralTransport?: ITransport;
    serverUrl?: string; // Optional since custom transports may not use it
    sessionCode: string;
    username: string;
    roles?: string[];
  }): Promise<NetworkSessionInfo> {
    this._ephemeralOnly = true;

    const store = useMultiplayerStore.getState();
    store.setConnectionStatus("connecting");
    store.setLastError(null);

    this._sessionCode = params.sessionCode;
    this._lastConnectParams = params as any;
    this._intentionalDisconnect = false;
    this._reconnectAttempt = 0;
    this.clearReconnectTimer();

    const connectParams: ConnectParams = {
      serverUrl: params.serverUrl || "custom://transport",
      sessionCode: params.sessionCode,
      username: params.username,
      roles: params.roles,
    };

    try {
      if (params.ephemeralTransport) {
        this._ephemeralTransport = params.ephemeralTransport;
        
        // Wire up inbound ephemeral messages
        const offEph = this._ephemeralTransport.on("message", ({ data }) => {
           try {
              const msg = JSON.parse(data);
              if (msg.t === "ephemeral" && _ephemeralBus) {
                 _ephemeralBus.receive(msg.p.kind, msg.p.data, msg.userId || "unknown");
              }
           } catch(e) {
              console.error("[NetManager] Error processing inbound ephemeral data:", e, data);
           }
        });
        this.cleanups.push(offEph);
        
        // connect WebRTC sidecar
        this._ephemeralTransport.connect("webrtc://tandem");
      }

      const info = await this.session.connect(connectParams, params.transport);
      this._reconnectAttempt = 0;
      return info;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const s = useMultiplayerStore.getState();
      s.setConnectionStatus("error");
      s.setLastError(msg);
      throw err;
    }
  }

  /** Whether this connection is in ephemeral-only mode (tandem with Jazz). */
  get ephemeralOnly(): boolean {
    return this._ephemeralOnly;
  }

  /** Disconnect from the current session. */
  disconnect(): void {
    this._intentionalDisconnect = true;
    this._ephemeralOnly = false;
    
    if (this._ephemeralTransport) {
       this._ephemeralTransport.close();
       this._ephemeralTransport = undefined;
    }

    this.clearReconnectTimer();
    this.session.disconnect(1000, "user_disconnect");
  }

  /** Enable or disable auto-reconnect. */
  set autoReconnect(enabled: boolean) {
    this._autoReconnect = enabled;
    if (!enabled) this.clearReconnectTimer();
  }

  get autoReconnect(): boolean {
    return this._autoReconnect;
  }

  /** Whether the session is currently connected. */
  get isConnected(): boolean {
    return this.session.isConnected;
  }

  /** Current session info (available after connect). */
  get info(): NetworkSessionInfo | undefined {
    return this.session.info;
  }

  /** Propose a local operation to the server (durable path). */
  proposeOp(op: EngineOp, clientOpId?: string): void {
    if (!this.isConnected) {
      console.warn("[NetManager] proposeOp called but not connected — op dropped:", op.kind);
      triggerSound('ui.error');
      toast.error("Not connected — operation not sent");
      return;
    }
    this.session.proposeOp(op, clientOpId);
  }

  /** Send an ephemeral message — no batching, no sequencing, no persistence. */
  sendEphemeral(kind: string, data: unknown): void {
    if (!this.isConnected) return;
    
    if (this._ephemeralTransport && this._ephemeralTransport.state === "open") {
       const store = useMultiplayerStore.getState();
       const msg = {
          v: "1",
          t: "ephemeral",
          userId: store.currentUserId,
          ts: new Date().toISOString(),
          p: { kind, data }
       };
       this._ephemeralTransport.send(JSON.stringify(msg));
    } else {
       // Fallback to primary transport if ephemeral is not present or closed
       this.session.sendEphemeral(kind, data);
    }
  }

  /** Flush any batched outgoing ops immediately. */
  flushOps(): void {
    this.session.flushOps();
  }

  // ── Event Wiring ──────────────────────────────────────────

  private wireEvents(): void {
    const off1 = this.session.on("connected", (info) => {
      const store = useMultiplayerStore.getState();
      store.setConnectionStatus("connected");

      // OpBridge sessions don't go through Jazz sync — mark sync as ready immediately
      if (!this._ephemeralOnly) {
        store.setSyncReady(true);
      }

      // In ephemeral-only mode (Jazz tandem), don't overwrite session/roles
      // that were already set by the Jazz session manager.
      if (!this._ephemeralOnly) {
        store.setCurrentSession({
          sessionCode: this._sessionCode ?? "",
          sessionId: info.sessionId,
          createdAt: Date.now(),
          hasPassword: false,
        });
        store.setRoles(info.roles);
        store.setPermissions(info.permissions);
      }

      store.setCurrentUserId(info.userId);
      store.setLastError(null);

      // Populate connected users from welcome peers list
      const selfUser = {
        userId: info.userId,
        username: info.username,
        roleIds: this._ephemeralOnly ? (store.roles.length > 0 ? store.roles : info.roles) : info.roles,
        connectedAt: Date.now(),
      };
      const peerUsers = (info.peers ?? []).map((p) => ({
        userId: p.userId,
        username: p.username,
        roleIds: p.roles,
        connectedAt: Date.now(),
      }));
      store.setConnectedUsers([selfUser, ...peerUsers]);

      console.log("✅ [NetManager] Connected:", info.sessionId, "roles:", store.roles, "ephemeralOnly:", this._ephemeralOnly, "peers:", peerUsers.length);

      // Start 10Hz token position sync loop
      startPositionSync();
    });

    const off2 = this.session.on("opBatch", (batch: OpBatchPayload) => {
      // Persist last seen seq (only for durable ops)
      if (this._sessionCode && batch.toSeq > 0) {
        writeLastSeenSeq(this._sessionCode, batch.toSeq);
      }

      // Split ops into ephemeral vs durable
      const durableOps = [];
      for (const entry of batch.ops) {
        if (isEphemeralOp(entry.op.kind)) {
          // Route ephemeral ops directly to EphemeralBus
          _ephemeralBus?.receive(entry.op.kind as EphemeralOpKind, entry.op.data, entry.userId);
        } else {
          durableOps.push(entry);
        }
      }

      // Forward durable ops to OpBridge ONLY if not in ephemeral-only mode
      // (in tandem mode Jazz handles durable state)
      if (durableOps.length > 0 && !this._ephemeralOnly) {
        opBridge.applyRemoteOps(durableOps);
      }
    });

    const off3 = this.session.on("rejected", (rej) => {
      const store = useMultiplayerStore.getState();
      store.setLastError(rej.message ?? rej.code);
      console.warn("⚠️ [NetManager] Rejected:", rej.code, rej.message);
    });

    const off4 = this.session.on("error", (e) => {
      const store = useMultiplayerStore.getState();
      store.setLastError(e.message);
      console.error("❌ [NetManager] Error:", e.message);
    });

    const off5 = this.session.on("disconnected", ({ code, reason }) => {
      const store = useMultiplayerStore.getState();
      store.setConnectedUsers([]);
      console.log("🔌 [NetManager] Disconnected:", code, reason);

      // Stop 10Hz token position sync loop
      stopPositionSync();

      if (!this._intentionalDisconnect && this._autoReconnect && this._lastConnectParams) {
        store.setConnectionStatus("reconnecting");
        console.log("🔄 [NetManager] Will attempt auto-reconnect...");
        this.scheduleReconnect();
      } else {
        store.setConnectionStatus("disconnected");
        store.setCurrentSession(null);
        store.setRoles([]);
        store.setPermissions([]);
      }
    });

    const off6 = this.session.on("presence", (p: PresencePayload) => {
      const store = useMultiplayerStore.getState();
      const user = {
        userId: p.user.userId,
        username: p.user.username,
        roleIds: p.user.roles,
        connectedAt: Date.now(),
      };

      switch (p.kind) {
        case "join":
          // Prevent duplicate local user entry if transport uses a different internal ID
          if (p.user.username === store.currentUsername) {
            break;
          }
          
          store.addConnectedUser(user);
          // Don't toast for our own join
          if (p.user.userId !== store.currentUserId) {
            triggerSound('ui.notification');
            toast.info(`${p.user.username} joined the session`, { duration: 3000 });
            
            // Auto-push durable state when a player joins in Jazz tandem mode
            // Throttled to prevent cascading state sync when multiple players join rapidly
            const now = Date.now();
            if (this._ephemeralOnly && store.roles.includes('dm') && (now - _lastAutoPushTs) >= AUTO_PUSH_THROTTLE_MS) {
              _lastAutoPushTs = now;
              // Defer the push to allow the connection to stabilize
              setTimeout(() => {
                import('@/lib/jazz/bridge').then(({ getBridgedSessionRoot, pushAllToJazz }) => {
                  const root = getBridgedSessionRoot();
                  if (root) {
                    console.log(`[NetManager] Auto-pushing durable state for new player: ${p.user.username}`);
                    pushAllToJazz(root);
                    // Trigger fog refresh on DM side to recover from any store churn
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('fog:force-refresh'));
                    }, 100);
                  }
                }).catch(() => {});
              }, 500);
            }
          }
          console.log(`👤 [NetManager] User joined: ${p.user.username}`);
          break;
        case "leave":
          store.removeConnectedUser(p.user.userId);
          triggerSound('ui.notification');
          toast.info(`${p.user.username} left the session`, { duration: 3000 });
          console.log(`👤 [NetManager] User left: ${p.user.username}`);
          break;
        case "update":
          store.updateUserRoles(p.user.userId, p.user.roles);
          console.log(`👤 [NetManager] User updated: ${p.user.username}`, p.user.roles);
          break;
      }
    });

    const off7 = this.session.on("ephemeral", ({ kind, data, userId }) => {
      // Route inbound ephemeral messages directly to EphemeralBus
      if (isEphemeralOp(kind) && _ephemeralBus) {
        _ephemeralBus.receive(kind as EphemeralOpKind, data, userId);
      }
    });

    const off8 = this.session.on("presence_sync", (p: PresenceSyncPayload) => {
      const store = useMultiplayerStore.getState();
      const mapped = p.users.map(u => ({
        userId: u.userId,
        username: u.username,
        roleIds: u.roles,
        connectedAt: u.lastPing,
        lastPing: u.lastPing
      }));
      store.syncPresenceHeartbeats(mapped);
    });

    this.cleanups.push(off1, off2, off3, off4, off5, off6, off7, off8);
  }

  // ── Reconnection ──────────────────────────────────────────

  private scheduleReconnect(): void {
    if (this._reconnectAttempt >= this._maxReconnectAttempts) {
      console.warn("⛔ [NetManager] Max reconnect attempts reached, giving up.");
      const store = useMultiplayerStore.getState();
      store.setConnectionStatus("error");
      store.setLastError("Reconnection failed after multiple attempts");
      return;
    }

    const delay = Math.min(
      this._baseDelayMs * Math.pow(2, this._reconnectAttempt) + Math.random() * 500,
      this._maxDelayMs,
    );
    this._reconnectAttempt++;
    console.log(`🔄 [NetManager] Reconnect attempt ${this._reconnectAttempt} in ${Math.round(delay)}ms`);

    this._reconnectTimer = window.setTimeout(() => {
      this._reconnectTimer = undefined;
      this.attemptReconnect();
    }, delay);
  }

  private async attemptReconnect(): Promise<void> {
    const params = this._lastConnectParams;
    if (!params) return;

    const store = useMultiplayerStore.getState();
    store.setConnectionStatus("reconnecting");

    try {
      // Create a fresh session for the reconnect attempt
      this.session = new NetworkSession();
      this.cleanups.forEach((fn) => fn());
      this.cleanups = [];
      this.wireEvents();

      if (params.transport) {
        await this.connectWithTransport(params as any);
      }
      
      console.log("✅ [NetManager] Reconnected successfully");
    } catch (err: any) {
      console.warn('⚠️ [AutoReconnect] Failed to reconnect:', err);
      useMultiplayerStore.getState().reset();
      if (!this._intentionalDisconnect && this._autoReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  private clearReconnectTimer(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = undefined;
    }
    this._reconnectAttempt = 0;
  }
}
