// src/lib/net/index.ts
// Public API surface for the networking module.

import { NetManager, setEphemeralBusRef } from "./NetManager";
import { opBridge } from "./OpBridge";
import { EphemeralBus } from "./ephemeral";
import { useMultiplayerStore } from "@/stores/multiplayerStore";
import type { EngineOp } from "../../../networking/contract/v1";

// Durable op kinds that Jazz handles via store-subscription sync.
// When Jazz is the active transport these are redundant through OpBridge.
const JAZZ_SYNCED_OPS = new Set([
  'token.move', 'token.sync', 'token.add', 'token.remove',
]);

// Create singletons and wire circular references
export const netManager = new NetManager();
export const ephemeralBus = new EphemeralBus();

// Wire ephemeralBus into NetManager (breaks circular import)
setEphemeralBusRef(ephemeralBus);

opBridge.setProposeOp((op, id) => netManager.proposeOp(op, id));
ephemeralBus.setSendFn((op) => netManager.sendEphemeral(op.kind, op.data));

/** Convenience: emit a local op to the network (echo-safe).
 *  Skips durable ops that Jazz already syncs via store subscriptions. */
export function emitLocalOp(op: EngineOp, clientOpId?: string): void {
  const transport = useMultiplayerStore.getState().activeTransport;
  if (transport === 'jazz' && JAZZ_SYNCED_OPS.has(op.kind)) return;
  opBridge.emitLocalOp(op, clientOpId);
}

export { opBridge } from "./OpBridge";
export { NetManager } from "./NetManager";
export type { NetConnectionStatus } from "./NetManager";
export { EphemeralBus, isEphemeralOp } from "./ephemeral";
export type { EphemeralOpKind, EphemeralPayloadMap } from "./ephemeral";
