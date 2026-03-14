// networking/client/NetworkSession.ts

import type {
  AckPayload,
  ClientId,
  ClientSeq,
  ClientToServerMessage,
  EphemeralPayload,
  EngineOp,
  HelloPayload,
  Iso8601,
  Msg,
  OpBatchPayload,
  OpSeq,
  PresencePayload,
  RejectPayload,
  ServerToClientMessage,
  SessionCode,
  SessionId,
  SnapshotPointer,
  UserId,
  WelcomePayload,
} from "../contract/v1";
import { PROTOCOL_VERSION } from "../contract/v1";
import { Emitter } from "./emitter";
import type { Listener } from "./emitter";
import type { ITransport } from "./transport";
import { WsTransport } from "./transport";
import { normalizeWsUrl } from "./url";

function nowIso(): Iso8601 {
  return new Date().toISOString();
}

function safeJsonParse<T>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

function randomId(prefix = ""): string {
  const rnd = Math.random().toString(16).slice(2);
  const time = Date.now().toString(16);
  return `${prefix}${time}-${rnd}`;
}

export function getOrCreateClientId(storageKey = "vtt.clientId"): ClientId {
  if (typeof localStorage === "undefined") return randomId("c_");
  const existing = localStorage.getItem(storageKey);
  if (existing) return existing;
  const created = randomId("c_");
  localStorage.setItem(storageKey, created);
  return created;
}

export interface ConnectParams {
  serverUrl: string;
  sessionCode: SessionCode;
  username: string;
  inviteToken?: string;
  password?: string;
  /** Client's locally-selected role IDs (e.g. ["dm"] or ["player"]). */
  roles?: string[];
  /** If reconnecting, last op seq applied locally (for catchup). */
  lastSeenSeq?: OpSeq;
}

export interface NetworkSessionInfo {
  sessionId: SessionId;
  userId: string;
  username: string;
  roles: string[];
  permissions: string[];
  currentSeq: OpSeq;
  snapshot?: SnapshotPointer;
  peers?: Array<{ userId: string; username: string; roles: string[] }>;
}

export interface NetworkSessionEvents {
  connected: NetworkSessionInfo;
  disconnected: { code?: number; reason?: string };
  rejected: RejectPayload;
  ack: AckPayload;
  opBatch: OpBatchPayload;
  presence: PresencePayload;
  ephemeral: { kind: string; data: unknown; userId: string };
  snapshotPointer: SnapshotPointer;
  rawMessage: ServerToClientMessage;
  error: { message: string; cause?: unknown };
}

export class NetworkSession {
  private transport: ITransport;
  private emitter = new Emitter<NetworkSessionEvents>();
  private clientId: ClientId;

  private serverUrl?: string;
  private sessionCode?: SessionCode;

  private clientSeq: ClientSeq = 0;
  private lastAppliedSeq: OpSeq = 0;
  private connectedInfo?: NetworkSessionInfo;

  /** Cleanup function for the pending "open" handler from a previous connect() call */
  private _pendingOpenCleanup?: () => void;

  // Outgoing op batching
  private batchQueue: Array<{ clientOpId?: string; op: EngineOp }> = [];
  private batchTimer?: number;
  private readonly batchWindowMs: number;
  private readonly maxBatchSize: number;

  constructor(opts?: {
    transport?: ITransport;
    clientId?: ClientId;
    batchWindowMs?: number;
    maxBatchSize?: number;
  }) {
    this.transport = opts?.transport ?? new WsTransport();
    this.clientId = opts?.clientId ?? getOrCreateClientId();
    this.batchWindowMs = opts?.batchWindowMs ?? 75;
    this.maxBatchSize = opts?.maxBatchSize ?? 25;

    this.wireTransport();
  }

  on<K extends keyof NetworkSessionEvents>(event: K, cb: Listener<NetworkSessionEvents[K]>): () => void {
    return this.emitter.on(event, cb);
  }

  get info(): NetworkSessionInfo | undefined {
    return this.connectedInfo;
  }

  get isConnected(): boolean {
    return this.transport.state === "open" && !!this.connectedInfo;
  }

  connect(params: ConnectParams, transportOverride?: ITransport): Promise<NetworkSessionInfo> {
    if (transportOverride) {
      if (this.transport) {
        // Unbind previous listeners if we are swapping
        this.transport.close();
      }
      this.transport = transportOverride;
      this.wireTransport();
    }

    this.serverUrl = normalizeWsUrl(params.serverUrl);
    this.sessionCode = params.sessionCode;
    this.lastAppliedSeq = params.lastSeenSeq ?? 0;

    // Clean up any stale "open" handler from a previous connect() call
    // to prevent sending duplicate hellos
    if (this._pendingOpenCleanup) {
      this._pendingOpenCleanup();
      this._pendingOpenCleanup = undefined;
    }

    return new Promise((resolve, reject) => {
      let settled = false;

      const offConnected = this.on("connected", (info) => {
        settled = true
        resolve(info);
        offConnected(); offRejected(); offError();
      });

      const offRejected = this.on("rejected", (rej) => {
        // Suppress benign "Unhandled: hello" rejections — server received
        // a duplicate hello on an already-authenticated connection
        const msg = rej.message ?? rej.code ?? "";
        if (msg.includes("Unhandled") && msg.includes("hello")) {
          console.log("[NetworkSession] Suppressed benign duplicate-hello rejection");
          return;
        }
        if (settled) return;
        settled = true;
        offConnected(); offRejected(); offError();
        reject(new Error(rej.message ?? rej.code));
      });

      const offError = this.on("error", (e) => {
        if (settled) return;
        settled = true;
        offConnected(); offRejected(); offError();
        reject(new Error(e.message));
      });

      this.transport.connect(this.serverUrl!);

      const offOpen = this.transport.on("open", () => {
        offOpen();
        this._pendingOpenCleanup = undefined;
        const hello: Msg<"hello", HelloPayload> = {
          v: PROTOCOL_VERSION,
          t: "hello",
          clientId: this.clientId,
          sessionCode: params.sessionCode,
          ts: nowIso(),
          p: {
            protocol: PROTOCOL_VERSION,
            username: params.username,
            inviteToken: params.inviteToken,
            password: params.password,
            roles: params.roles,
            lastSeenSeq: this.lastAppliedSeq,
            wantsPresence: true,
            codec: "json",
          },
        };
        this.sendMsg(hello);
      });
      this._pendingOpenCleanup = offOpen;
    });
  }

  disconnect(code?: number, reason?: string): void {
    this.transport.close(code, reason);
  }

  proposeOp(op: EngineOp, clientOpId?: string): void {
    this.batchQueue.push({ clientOpId, op });

    if (this.batchQueue.length >= this.maxBatchSize) {
      this.flushOps();
      return;
    }

    if (this.batchTimer) return;
    this.batchTimer = window.setTimeout(() => {
      this.batchTimer = undefined;
      this.flushOps();
    }, this.batchWindowMs);
  }

  /** Send an ephemeral message immediately — no batching, no sequencing. */
  sendEphemeral(kind: string, data: unknown): void {
    const msg: ClientToServerMessage = {
      v: PROTOCOL_VERSION,
      t: "ephemeral",
      clientId: this.clientId,
      sessionCode: this.sessionCode,
      sessionId: this.connectedInfo?.sessionId,
      userId: this.connectedInfo?.userId,
      ts: nowIso(),
      p: { kind, data },
    };
    this.sendMsg(msg);
  }

  flushOps(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }
    if (this.batchQueue.length === 0) return;

    const ops = this.batchQueue.splice(0, this.batchQueue.length);

    const msg: ClientToServerMessage = {
      v: PROTOCOL_VERSION,
      t: "propose_ops",
      clientId: this.clientId,
      sessionCode: this.sessionCode,
      sessionId: this.connectedInfo?.sessionId,
      userId: this.connectedInfo?.userId,
      clientSeq: this.nextClientSeq(),
      ts: nowIso(),
      p: {
        ops: ops.map((x) => ({ clientOpId: x.clientOpId, op: x.op })),
      },
    };

    this.sendMsg(msg);
  }

  requestCatchup(fromSeq: OpSeq, limit?: number): void {
    const msg: ClientToServerMessage = {
      v: PROTOCOL_VERSION,
      t: "catchup_request",
      clientId: this.clientId,
      sessionCode: this.sessionCode,
      sessionId: this.connectedInfo?.sessionId,
      userId: this.connectedInfo?.userId,
      clientSeq: this.nextClientSeq(),
      ts: nowIso(),
      p: { fromSeq, limit },
    };
    this.sendMsg(msg);
  }

  private nextClientSeq(): ClientSeq {
    this.clientSeq = (this.clientSeq + 1) as ClientSeq;
    return this.clientSeq;
  }

  private sendMsg(msg: ClientToServerMessage | Msg<any, any>): void {
    this.transport.send(JSON.stringify(msg));
  }

  private wireTransport(): void {
    this.transport.on("message", ({ data }) => {
      const parsed = safeJsonParse<ServerToClientMessage>(data);
      if (!parsed) {
        this.emitter.emit("error", { message: "Failed to parse server message" });
        return;
      }
      this.handleServerMessage(parsed);
    });

    this.transport.on("close", ({ code, reason }) => {
      this.connectedInfo = undefined;
      this.emitter.emit("disconnected", { code, reason });
    });

    this.transport.on("error", (e) => {
      this.emitter.emit("error", e);
    });
  }

  private handleServerMessage(msg: ServerToClientMessage): void {
    this.emitter.emit("rawMessage", msg);

    switch (msg.t) {
      case "welcome": {
        const p: WelcomePayload = msg.p;
        this.connectedInfo = {
          sessionId: p.sessionId,
          userId: p.user.userId,
          username: p.user.username,
          roles: p.user.roles,
          permissions: p.permissions,
          currentSeq: p.currentSeq,
          snapshot: p.snapshot,
          peers: p.peers,
        };
        this.emitter.emit("connected", this.connectedInfo);

        if (this.lastAppliedSeq > 0 && this.lastAppliedSeq < p.currentSeq) {
          this.requestCatchup(this.lastAppliedSeq);
        }
        return;
      }

      case "ack":
        this.emitter.emit("ack", msg.p as AckPayload);
        return;

      case "reject":
        this.emitter.emit("rejected", msg.p as RejectPayload);
        return;

      case "need_snapshot":
        this.emitter.emit("snapshotPointer", (msg.p as any).snapshot);
        this.emitter.emit("error", { message: `Need snapshot: ${(msg.p as any).reason}` });
        return;

      case "snapshot_pointer":
        this.emitter.emit("snapshotPointer", (msg.p as any).snapshot);
        return;

      case "op_batch": {
        const p = msg.p as OpBatchPayload;
        if (p.toSeq > this.lastAppliedSeq) this.lastAppliedSeq = p.toSeq;
        this.emitter.emit("opBatch", p);
        return;
      }

      case "presence":
        this.emitter.emit("presence", msg.p as PresencePayload);
        return;

      case "ephemeral": {
        const ep = msg.p as EphemeralPayload & { userId: string };
        this.emitter.emit("ephemeral", { kind: ep.kind, data: ep.data, userId: ep.userId });
        return;
      }

      default:
        return;
    }
  }
}
