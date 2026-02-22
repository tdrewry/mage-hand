// src/lib/net/NetManager.ts
// Singleton wrapper around NetworkSession for the new WebSocket JSON protocol.

import { NetworkSession, type ConnectParams, type NetworkSessionInfo } from "../../../networking/client";
import type { EngineOp, OpBatchPayload, PresencePayload } from "../../../networking/contract/v1";
import { useMultiplayerStore } from "@/stores/multiplayerStore";
import { opBridge } from "./OpBridge";

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
  }): Promise<NetworkSessionInfo> {
    const store = useMultiplayerStore.getState();
    store.setConnectionStatus("connecting");
    store.setLastError(null);

    this._sessionCode = params.sessionCode;
    const lastSeenSeq = readLastSeenSeq(params.sessionCode);

    const connectParams: ConnectParams = {
      serverUrl: params.serverUrl,
      sessionCode: params.sessionCode,
      username: params.username,
      inviteToken: params.inviteToken,
      password: params.password,
      lastSeenSeq: lastSeenSeq > 0 ? lastSeenSeq : undefined,
    };

    try {
      const info = await this.session.connect(connectParams);
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
    this.session.disconnect(1000, "user_disconnect");
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
      console.log("✅ [NetManager] Connected:", info.sessionId, "roles:", info.roles);
    });

    const off2 = this.session.on("opBatch", (batch: OpBatchPayload) => {
      // Persist last seen seq
      if (this._sessionCode && batch.toSeq > 0) {
        writeLastSeenSeq(this._sessionCode, batch.toSeq);
      }
      // Forward to OpBridge
      opBridge.applyRemoteOps(batch.ops);
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
      store.setConnectionStatus("disconnected");
      store.setCurrentSession(null);
      store.setConnectedUsers([]);
      store.setRoles([]);
      store.setPermissions([]);
      console.log("🔌 [NetManager] Disconnected:", code, reason);
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
          console.log(`👤 [NetManager] User joined: ${p.user.username}`);
          break;
        case "leave":
          store.removeConnectedUser(p.user.userId);
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
}
