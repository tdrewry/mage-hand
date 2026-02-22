// networking/examples/vtt-integration.example.ts
//
// Minimal example of integrating NetworkSession with your engine.

import { NetworkSession } from "../client";
import type { EngineOp } from "../contract/v1";

interface Engine {
  onLocalOp(cb: (op: EngineOp) => void): () => void;
  applyRemoteOps(ops: Array<{ op: EngineOp; userId: string; ts: string; seq: number }>): void;
  loadSnapshot(snapshotJson: unknown): Promise<void>;
}

export async function connectToSession(
  engine: Engine,
  ui: {
    serverUrl: string;
    sessionCode: string;
    username: string;
    inviteToken?: string;
    password?: string;
    lastSeenSeq?: number;
  }
) {
  const net = new NetworkSession();

  const info = await net.connect({
    serverUrl: ui.serverUrl,
    sessionCode: ui.sessionCode,
    username: ui.username,
    inviteToken: ui.inviteToken,
    password: ui.password,
    lastSeenSeq: ui.lastSeenSeq,
  });

  console.log("Connected:", info);

  if (info.snapshot) {
    console.log("Snapshot pointer:", info.snapshot);
    // const snapJson = await fetchSnapshotFromR2(info.snapshot.snapshotKey);
    // await engine.loadSnapshot(snapJson);
  }

  net.on("opBatch", (batch) => {
    engine.applyRemoteOps(batch.ops);
    // saveLastSeenSeq(ui.sessionCode, batch.toSeq);
  });

  net.on("rejected", (rej) => console.warn("Rejected:", rej));
  net.on("disconnected", (d) => console.warn("Disconnected:", d));
  net.on("error", (e) => console.error("Network error:", e));

  const offLocal = engine.onLocalOp((op) => net.proposeOp(op));

  return () => {
    offLocal();
    net.disconnect(1000, "client_shutdown");
  };
}
