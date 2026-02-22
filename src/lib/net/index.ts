// src/lib/net/index.ts
// Public API surface for the networking module.

import { NetManager } from "./NetManager";
import { opBridge } from "./OpBridge";
import type { EngineOp } from "../../../networking/contract/v1";

// Create singleton and wire the circular reference
export const netManager = new NetManager();
opBridge.setProposeOp((op, id) => netManager.proposeOp(op, id));

/** Convenience: emit a local op to the network (echo-safe). */
export function emitLocalOp(op: EngineOp, clientOpId?: string): void {
  opBridge.emitLocalOp(op, clientOpId);
}

export { opBridge } from "./OpBridge";
export { NetManager } from "./NetManager";
export type { NetConnectionStatus } from "./NetManager";
