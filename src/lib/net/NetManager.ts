// src/lib/net/NetManager.ts
// Singleton wrapper around NetworkSession for the new WebSocket JSON protocol.

import { NetworkSession, type ConnectParams, type NetworkSessionInfo } from "../../../networking/client";
import type { EngineOp, OpBatchPayload, PresencePayload } from "../../../networking/contract/v1";
import { useMultiplayerStore } from "@/stores/multiplayerStore";
import { opBridge } from "./OpBridge";
import { isEphemeralOp } from "./ephemeral";
import type { EphemeralOpKind } from "./ephemeral";
import { toast } from "sonner";

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

  // Reconnection state
  private _lastConnectParams?: {
    serverUrl: string;
    sessionCode: string;
    username: string;
    inviteToken?: string;
    password?: string;
    roles?: string[];
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

  /** Connect to a session via WebSocket. */
  async connect(params: {
    serverUrl: string;
    sessionCode: string;
    username: string;
    inviteToken?: string;
    password?: string;
    roles?: string[];
  }): Promise<NetworkSessionInfo> {
    const store = useMultiplayerStore.getState();
    store.setConnectionStatus("connecting");
    store.setLastError(null);

    this._sessionCode = params.sessionCode;
    this._lastConnectParams = params;
    this._intentionalDisconnect = false;
    this._reconnectAttempt = 0;
    this.clearReconnectTimer();

    const lastSeenSeq = readLastSeenSeq(params.sessionCode);

    const connectParams: ConnectParams = {
      serverUrl: params.serverUrl,
      sessionCode: params.sessionCode,
      username: params.username,
      inviteToken: params.inviteToken,
      password: params.password,
      roles: params.roles,
      lastSeenSeq: lastSeenSeq > 0 ? lastSeenSeq : undefined,
    };

    try {
      const info = await this.session.connect(connectParams);
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

  /** Disconnect from the current session. */
  disconnect(): void {
    this._intentionalDisconnect = true;
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

  /** Propose a local operation to the server. */
  proposeOp(op: EngineOp, clientOpId?: string): void {
    if (!this.isConnected) {
      console.warn("[NetManager] proposeOp called but not connected — op dropped:", op.kind);
      toast.error("Not connected — operation not sent");
      return;
    }
    this.session.proposeOp(op, clientOpId);
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
      store.setCurrentSession({
        sessionCode: this._sessionCode ?? "",
        sessionId: info.sessionId,
        createdAt: Date.now(),
        hasPassword: false,
      });
      store.setCurrentUserId(info.userId);
      store.setRoles(info.roles);
      store.setPermissions(info.permissions);
      store.setLastError(null);

      // Populate connected users from welcome peers list
      const selfUser = {
        userId: info.userId,
        username: info.username,
        roleIds: info.roles,
        connectedAt: Date.now(),
      };
      const peerUsers = (info.peers ?? []).map((p) => ({
        userId: p.userId,
        username: p.username,
        roleIds: p.roles,
        connectedAt: Date.now(),
      }));
      store.setConnectedUsers([selfUser, ...peerUsers]);

      console.log("✅ [NetManager] Connected:", info.sessionId, "roles:", info.roles, "peers:", peerUsers.length);
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
          // Route ephemeral ops directly to EphemeralBus — lazy import to avoid circular ref
          const { ephemeralBus } = require("./index") as { ephemeralBus: import("./ephemeral").EphemeralBus };
          ephemeralBus.receive(entry.op.kind as EphemeralOpKind, entry.op.data, entry.userId);
        } else {
          durableOps.push(entry);
        }
      }

      // Forward only durable ops to OpBridge
      if (durableOps.length > 0) {
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
          store.addConnectedUser(user);
          // Don't toast for our own join
          if (p.user.userId !== store.currentUserId) {
            toast.info(`${p.user.username} joined the session`, { duration: 3000 });
          }
          console.log(`👤 [NetManager] User joined: ${p.user.username}`);
          break;
        case "leave":
          store.removeConnectedUser(p.user.userId);
          toast.info(`${p.user.username} left the session`, { duration: 3000 });
          console.log(`👤 [NetManager] User left: ${p.user.username}`);
          break;
        case "update":
          store.updateUserRoles(p.user.userId, p.user.roles);
          console.log(`👤 [NetManager] User updated: ${p.user.username}`, p.user.roles);
          break;
      }
    });

    this.cleanups.push(off1, off2, off3, off4, off5, off6);
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

      await this.connect(params);
      console.log("✅ [NetManager] Reconnected successfully");
    } catch (err) {
      console.warn("⚠️ [NetManager] Reconnect attempt failed:", err);
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
