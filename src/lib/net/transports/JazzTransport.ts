import { Emitter, type Listener } from "../../../../networking/client/emitter";
import type { ITransport, TransportEvents, TransportState } from "../../../../networking/client/transport";
import type { JazzSessionRoot } from "../../jazz/schema";
import type { ClientToServerMessage, ServerToClientMessage } from "../../../../networking/contract/v1";
import { PROTOCOL_VERSION } from "../../../../networking/contract/v1";

export class JazzTransport implements ITransport {
  public state: TransportState = "idle";
  private emitter = new Emitter<TransportEvents>();
  private sessionRoot: JazzSessionRoot;

  // Track Unsubscribers
  private unsubs: Array<() => void> = [];

  constructor(sessionRoot: JazzSessionRoot) {
    this.sessionRoot = sessionRoot;
    this.wireSubscriptions();
  }

  connect(url: string): void {
    if (this.state === "connecting" || this.state === "open") return;
    this.state = "connecting";

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
        const welcome: ServerToClientMessage = {
          v: PROTOCOL_VERSION,
          t: "welcome",
          clientId: msg.p.username,
          ts: Date.now().toString(),
          p: {
            sessionId: "jazz_session",
            user: {
              userId: msg.p.username, // Using username as ID for simplicity locally if not logged in
              username: msg.p.username,
              roles: msg.p.roles ?? [],
            },
            permissions: [],
            currentSeq: Number.MAX_SAFE_INTEGER, // Max to prevent 'catchup_requests'
            peers: [] // Presence is handled natively by Jazz workers if we query them, but typically we rely on Ephemeral pings/cursors
          }
        };
        this.emitInbound(welcome);
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
    this.state = "closed";
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

    if (kind === "cursor.move" && this.sessionRoot.cursors) {
      if ((this.sessionRoot.cursors as any).set) {
        (this.sessionRoot.cursors as any).set(userId, JSON.stringify(data));
      }
    } 
    else if (kind === "room.ping" && this.sessionRoot.pings) {
      if ((this.sessionRoot.pings as any).set) {
        const payload = { ...data as Record<string,any>, timestamp: Date.now() };
        (this.sessionRoot.pings as any).set(userId, JSON.stringify(payload));
      }
    }
    else if (kind === "chat.message" && this.sessionRoot.chat) {
      if ((this.sessionRoot.chat as any).push) {
        (this.sessionRoot.chat as any).push(JSON.stringify(data));
      }
    }
  }

  private wireSubscriptions(): void {
    // When remote peers change the Jazz CoValues, we funnel them back into NetManager
    
    // Cursors
    if ((this.sessionRoot.cursors as any)?.subscribe) {
      this.unsubs.push(
        (this.sessionRoot.cursors as any).subscribe([], (cursors: any) => {
          if (!cursors) return;
          for (const userId of Object.keys(cursors)) {
            // Check if this was written by a remote worker (optional optimization if we inject local userId)
            // For now, NetManager's EphemeralBus ignores self-echoes if the ID matches its own.
            try {
              const val = cursors[userId];
              if (val) {
                const data = JSON.parse(val as string);
                this.emitInbound({
                  v: PROTOCOL_VERSION, t: "ephemeral", 
                  p: { kind: "cursor.move", data, userId: userId as any }
                } as ServerToClientMessage);
              }
            } catch {}
          }
        })
      );
    }

    // Pings
    if ((this.sessionRoot.pings as any)?.subscribe) {
      this.unsubs.push(
        (this.sessionRoot.pings as any).subscribe([], (pings: any) => {
          if (!pings) return;
          for (const userId of Object.keys(pings)) {
            try {
              const val = pings[userId];
              if (val) {
                const data = JSON.parse(val as string);
                this.emitInbound({
                  v: PROTOCOL_VERSION, t: "ephemeral", 
                  p: { kind: "room.ping", data, userId: userId as any }
                } as ServerToClientMessage);
              }
            } catch {}
          }
        })
      );
    }

    // Chat
    if ((this.sessionRoot.chat as any)?.subscribe) {
      let lastProcessedLength = 0;
      this.unsubs.push(
        (this.sessionRoot.chat as any).subscribe([], (chatList: any) => {
          if (!chatList) return;
          if (chatList.length > lastProcessedLength) {
            for (let i = lastProcessedLength; i < chatList.length; i++) {
               try {
                  const val = chatList[i];
                  if (val) {
                    const data = JSON.parse(val as string);
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
  }
}
