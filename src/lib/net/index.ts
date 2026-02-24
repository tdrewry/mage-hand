// src/lib/net/index.ts
// Public API surface for the networking module.

import { NetManager } from "./NetManager";
import { opBridge } from "./OpBridge";
import { EphemeralBus } from "./ephemeral";
import type { EngineOp } from "../../../networking/contract/v1";

// Create singletons and wire circular references
export const netManager = new NetManager();
export const ephemeralBus = new EphemeralBus();

opBridge.setProposeOp((op, id) => netManager.proposeOp(op, id));
ephemeralBus.setSendFn((op) => netManager.sendEphemeral(op.kind, op.data));

/** Convenience: emit a local op to the network (echo-safe). */
export function emitLocalOp(op: EngineOp, clientOpId?: string): void {
  opBridge.emitLocalOp(op, clientOpId);
}

export { opBridge } from "./OpBridge";
export { NetManager } from "./NetManager";
export type { NetConnectionStatus } from "./NetManager";
export { EphemeralBus, isEphemeralOp } from "./ephemeral";
export type { EphemeralOpKind, EphemeralPayloadMap } from "./ephemeral";
