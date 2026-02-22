// networking/server-local/roomServer.ts
// Minimal local (LAN) room server using Node + ws.
// Implements the v1 contract: hello/welcome, propose_ops -> ack + op_batch, catchup_request.
// Intended for LAN hosting (ws://<host-ip>:3001) and fast iteration before Durable Objects.

import { WebSocketServer, WebSocket } from "ws";
import Protocol, {
  type AckPayload,
  type ClientToServerMessage,
  type EngineOp,
  type OpBatchPayload,
  type OpSeq,
  type RejectPayload,
  type ServerToClientMessage,
  type SessionCode,
  type SessionId,
  type SnapshotPointer,
  type UserSummary,
  type WelcomePayload,
  type PermissionKey,
} from "../contract/v1";

const { PROTOCOL_VERSION } = Protocol;

function nowIso(): string {
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

function send(ws: WebSocket, msg: ServerToClientMessage): void {
  ws.send(JSON.stringify(msg));
}

const FULL_PERMS: PermissionKey[] = [
  "control_own_tokens",
  "control_other_tokens",
  "see_all_no_fog",
  "see_friendly_vision",
  "see_hostile_vision",
  "see_own_tokens",
  "see_other_tokens",
  "see_hidden_tokens",
  "create_tokens",
  "delete_own_tokens",
  "delete_other_tokens",
  "manage_roles",
  "assign_player_roles",
  "assign_token_roles",
  "edit_map",
  "manage_initiative",
  "manage_hostility",
  "manage_fog",
];

const PLAYER_PERMS: PermissionKey[] = [
  "control_own_tokens",
  "see_friendly_vision",
  "see_own_tokens",
  "see_other_tokens",
];

export interface LocalAuthConfig {
  dmPassword?: string;
}

interface ClientCtx {
  ws: WebSocket;
  clientId: string;
  userId: string;
  username: string;
  roles: string[];
  permissions: PermissionKey[];
}

interface OpRecord {
  seq: OpSeq;
  userId: string;
  ts: string;
  op: EngineOp;
}

interface SessionState {
  sessionId: SessionId;
  sessionCode: SessionCode;
  seq: OpSeq;
  clients: Set<ClientCtx>;
  opLog: OpRecord[];
  snapshot?: SnapshotPointer; // optional for local dev
}

export class LocalRoomServer {
  private wss: WebSocketServer;
  private sessions = new Map<SessionCode, SessionState>();
  private auth: LocalAuthConfig;

  constructor(opts: { port: number; auth?: LocalAuthConfig }) {
    this.auth = opts.auth ?? {};
    this.wss = new WebSocketServer({ port: opts.port });

    this.wss.on("connection", (ws) => this.onConnection(ws));

    // eslint-disable-next-line no-console
    console.log(`[LocalRoomServer] listening on ws://localhost:${opts.port}`);
  }

  close(): void {
    this.wss.close();
  }

  private onConnection(ws: WebSocket): void {
    let ctx: ClientCtx | undefined;
    let session: SessionState | undefined;

    ws.on("message", (buf) => {
      const text = typeof buf === "string" ? buf : buf.toString("utf8");
      const msg = safeJsonParse<ClientToServerMessage>(text);
      if (!msg) return send(ws, this.reject({ code: "bad_request", message: "Invalid JSON" }));
      if (msg.v !== PROTOCOL_VERSION) {
        return send(
          ws,
          this.reject({
            code: "bad_request",
            message: `Protocol mismatch: server=${PROTOCOL_VERSION} client=${msg.v}`,
          })
        );
      }

      // Must hello first.
      if (!ctx || !session) {
        if (msg.t !== "hello") return send(ws, this.reject({ code: "unauthorized", message: "Send hello first" }));
        const sc = msg.sessionCode;
        if (!sc) return send(ws, this.reject({ code: "bad_request", message: "Missing sessionCode" }));

        session = this.getOrCreateSession(sc);
        ctx = this.buildClientCtx(ws, msg.clientId, msg.p.username, msg.p.password);
        session.clients.add(ctx);

        // Build peers list (existing clients, excluding the new one)
        const peers: UserSummary[] = [];
        for (const c of session.clients) {
          if (c !== ctx) {
            peers.push({ userId: c.userId, username: c.username, roles: c.roles });
          }
        }

        const welcome: ServerToClientMessage = {
          v: PROTOCOL_VERSION,
          t: "welcome",
          clientId: msg.clientId,
          sessionId: session.sessionId,
          sessionCode: sc,
          userId: ctx.userId,
          ts: nowIso(),
          p: {
            sessionId: session.sessionId,
            user: { userId: ctx.userId, username: ctx.username, roles: ctx.roles },
            permissions: ctx.permissions,
            currentSeq: session.seq,
            snapshot: session.snapshot,
            peers,
            features: { opBatching: true, maxBatchSize: 25, maxMessageBytes: 256_000 },
          } satisfies WelcomePayload,
        };
        send(ws, welcome);

        this.broadcastPresence(session, { kind: "join", user: welcome.p.user });

        const lastSeen = msg.p.lastSeenSeq ?? 0;
        if (lastSeen < session.seq) this.sendCatchup(session, ctx, lastSeen);

        return;
      }

      switch (msg.t) {
        case "propose_ops": {
          if (!msg.clientSeq) return send(ws, this.reject({ code: "bad_request", message: "Missing clientSeq" }));

          const startSeq = session.seq + 1;
          const created: OpRecord[] = [];

          for (const item of msg.p.ops) {
            const nextSeq = (session.seq + 1) as OpSeq;
            session.seq = nextSeq;
            created.push({ seq: nextSeq, userId: ctx.userId, ts: nowIso(), op: item.op });
          }

          session.opLog.push(...created);
          const endSeq = session.seq;

          const ack: ServerToClientMessage = {
            v: PROTOCOL_VERSION,
            t: "ack",
            clientId: ctx.clientId,
            sessionId: session.sessionId,
            sessionCode: session.sessionCode,
            userId: ctx.userId,
            ts: nowIso(),
            p: {
              clientSeq: msg.clientSeq,
              assigned: { fromSeq: startSeq as OpSeq, toSeq: endSeq as OpSeq },
              opMap: msg.p.ops.map((o, i) => ({ clientOpId: o.clientOpId, seq: (startSeq + i) as OpSeq })),
            } satisfies AckPayload,
          };
          send(ws, ack);

          const batch: ServerToClientMessage = {
            v: PROTOCOL_VERSION,
            t: "op_batch",
            clientId: "server",
            sessionId: session.sessionId,
            sessionCode: session.sessionCode,
            ts: nowIso(),
            p: { fromSeq: startSeq as OpSeq, toSeq: endSeq as OpSeq, ops: created } satisfies OpBatchPayload,
          };

          for (const c of session.clients) send(c.ws, batch);
          return;
        }

        case "catchup_request":
          this.sendCatchup(session, ctx, msg.p.fromSeq, msg.p.limit ?? 500);
          return;

        case "chat_post": {
          const op: EngineOp = { kind: "chat.post", data: { text: msg.p.text, msgId: msg.p.msgId } };
          this.handleSingleOp(session, ctx, ws, msg.clientSeq ?? 1, op);
          return;
        }

        case "asset_registered": {
          const op: EngineOp = { kind: "asset.registered", data: msg.p };
          this.handleSingleOp(session, ctx, ws, msg.clientSeq ?? 1, op);
          return;
        }

        default:
          return send(ws, this.reject({ code: "bad_request", message: `Unhandled: ${msg.t}` }));
      }
    });

    ws.on("close", () => {
      if (!ctx || !session) return;
      session.clients.delete(ctx);
      this.broadcastPresence(session, { kind: "leave", user: { userId: ctx.userId, username: ctx.username, roles: ctx.roles } });

      if (session.clients.size === 0) this.sessions.delete(session.sessionCode);
    });
  }

  private handleSingleOp(session: SessionState, ctx: ClientCtx, ws: WebSocket, clientSeq: number, op: EngineOp): void {
    const nextSeq = (session.seq + 1) as OpSeq;
    session.seq = nextSeq;

    const created: OpRecord[] = [{ seq: nextSeq, userId: ctx.userId, ts: nowIso(), op }];
    session.opLog.push(...created);

    const ack: ServerToClientMessage = {
      v: PROTOCOL_VERSION,
      t: "ack",
      clientId: ctx.clientId,
      sessionId: session.sessionId,
      sessionCode: session.sessionCode,
      userId: ctx.userId,
      ts: nowIso(),
      p: { clientSeq, assigned: { fromSeq: nextSeq, toSeq: nextSeq } } satisfies AckPayload,
    };
    send(ws, ack);

    const batch: ServerToClientMessage = {
      v: PROTOCOL_VERSION,
      t: "op_batch",
      clientId: "server",
      sessionId: session.sessionId,
      sessionCode: session.sessionCode,
      ts: nowIso(),
      p: { fromSeq: nextSeq, toSeq: nextSeq, ops: created } satisfies OpBatchPayload,
    };
    for (const c of session.clients) send(c.ws, batch);
  }

  private sendCatchup(session: SessionState, ctx: ClientCtx, fromSeq: OpSeq, limit = 500): void {
    const ops = session.opLog.filter((o) => o.seq > fromSeq).slice(0, limit);
    if (ops.length === 0) return;

    const batch: ServerToClientMessage = {
      v: PROTOCOL_VERSION,
      t: "op_batch",
      clientId: "server",
      sessionId: session.sessionId,
      sessionCode: session.sessionCode,
      ts: nowIso(),
      p: { fromSeq: ops[0].seq, toSeq: ops[ops.length - 1].seq, ops } satisfies OpBatchPayload,
    };
    send(ctx.ws, batch);
  }

  private getOrCreateSession(sessionCode: SessionCode): SessionState {
    const existing = this.sessions.get(sessionCode);
    if (existing) return existing;

    const created: SessionState = {
      sessionId: randomId("s_") as SessionId,
      sessionCode,
      seq: 0,
      clients: new Set(),
      opLog: [],
    };
    this.sessions.set(sessionCode, created);
    return created;
  }

  private buildClientCtx(ws: WebSocket, clientId: string, username: string, password?: string): ClientCtx {
    const isDm = !!this.auth.dmPassword && password === this.auth.dmPassword;
    const roles = isDm ? ["dm"] : ["player"];
    const permissions = isDm ? FULL_PERMS : PLAYER_PERMS;

    return { ws, clientId, userId: randomId("u_"), username, roles, permissions };
  }

  private broadcastPresence(session: SessionState, payload: { kind: "join" | "leave" | "update"; user: UserSummary }): void {
    const msg: ServerToClientMessage = {
      v: PROTOCOL_VERSION,
      t: "presence",
      clientId: "server",
      sessionId: session.sessionId,
      sessionCode: session.sessionCode,
      ts: nowIso(),
      p: payload,
    } as any;

    for (const c of session.clients) send(c.ws, msg);
  }

  private reject(p: Omit<RejectPayload, "clientSeq"> & { clientSeq?: number }): ServerToClientMessage {
    return { v: PROTOCOL_VERSION, t: "reject", clientId: "server", ts: nowIso(), p } as any;
  }
}
