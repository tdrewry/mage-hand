// networking/client/transport.ts

import { Emitter, type Listener } from "./emitter";

export type TransportState = "idle" | "connecting" | "open" | "closed";

export interface TransportEvents {
  open: void;
  close: { code?: number; reason?: string; wasClean?: boolean };
  error: { message: string; cause?: unknown };
  message: { data: string };
}

export interface ITransport {
  readonly state: TransportState;
  connect(url: string): void;
  send(text: string): void;
  close(code?: number, reason?: string): void;
  on<K extends keyof TransportEvents>(event: K, cb: Listener<TransportEvents[K]>): () => void;
}

/** Browser WebSocket transport. */
export class WsTransport implements ITransport {
  private ws?: WebSocket;
  private emitter = new Emitter<TransportEvents>();
  public state: TransportState = "idle";

  connect(url: string): void {
    if (this.state === "connecting" || this.state === "open") return;

    // Clean up any previous socket before creating a new one
    this.cleanup();

    this.state = "connecting";
    try {
      this.ws = new WebSocket(url);
    } catch (cause) {
      this.state = "closed";
      this.emitter.emit("error", { message: "Failed to create WebSocket", cause });
      return;
    }

    this.ws.onopen = () => {
      this.state = "open";
      this.emitter.emit("open", undefined);
    };

    this.ws.onmessage = (ev) => {
      const data = typeof ev.data === "string" ? ev.data : "";
      this.emitter.emit("message", { data });
    };

    this.ws.onerror = (ev) => {
      this.emitter.emit("error", { message: "WebSocket error", cause: ev });
    };

    this.ws.onclose = (ev) => {
      this.state = "closed";
      this.ws = undefined;
      this.emitter.emit("close", { code: ev.code, reason: ev.reason, wasClean: ev.wasClean });
    };
  }

  send(text: string): void {
    if (!this.ws || this.state !== "open") {
      this.emitter.emit("error", { message: "Transport not open" });
      return;
    }
    this.ws.send(text);
  }

  close(code?: number, reason?: string): void {
    if (!this.ws) return;
    this.ws.close(code, reason);
    // Note: ws reference is cleared in the onclose handler
  }

  /** Strip event handlers from the old socket so it can't fire stale events. */
  private cleanup(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws = undefined;
    }
  }

  on<K extends keyof TransportEvents>(event: K, cb: Listener<TransportEvents[K]>): () => void {
    return this.emitter.on(event, cb);
  }
}
