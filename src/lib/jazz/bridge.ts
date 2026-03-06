/**
 * Jazz ↔ Zustand Bridge
 *
 * Bidirectional sync between Jazz CoValues and the existing Zustand stores.
 * Uses the DurableObjectRegistry's extractor/hydrator contract.
 *
 * Echo prevention: a `_fromJazz` flag is set during hydration so that
 * store subscriptions don't re-push the same change back to Jazz.
 *
 * Phase 1: Structural scaffolding only. Actual CoValue mutations are wired in Phase 2
 * once the auth/session flow provides live CoValue instances.
 */

import { DurableObjectRegistry } from "../durableObjects";

// ── Echo prevention ────────────────────────────────────────────────────────

let _fromJazz = false;

/** Returns true when the current store mutation originated from Jazz (inbound sync). */
export function isFromJazz(): boolean {
  return _fromJazz;
}

/**
 * Run a callback with the _fromJazz flag set.
 * Use this when hydrating stores from Jazz CoValue changes.
 */
export function runFromJazz(fn: () => void): void {
  const prev = _fromJazz;
  _fromJazz = true;
  try {
    fn();
  } finally {
    _fromJazz = prev;
  }
}

// ── Bridge lifecycle ───────────────────────────────────────────────────────

type Unsubscribe = () => void;

/** Active store subscriptions for the current session */
const activeSubscriptions: Unsubscribe[] = [];

/**
 * Push all current Zustand state into Jazz CoValues (initial sync on session create/join).
 *
 * Phase 1: Logs intent only. Actual CoValue mutations require live instances from Phase 2.
 */
export function pushAllToJazz(sessionRoot: unknown): void {
  const registrations = DurableObjectRegistry.getAll();
  console.log(`[jazz-bridge] pushAllToJazz: ${registrations.length} DO kinds to sync`);

  for (const reg of registrations) {
    const state = reg.extractor();
    const stateJson = JSON.stringify(state);
    console.log(`[jazz-bridge]   → "${reg.kind}" (${stateJson.length} bytes)`);
  }

  // Phase 2: iterate blobs on sessionRoot, create/update JazzDOBlob CoValues
}

/**
 * Pull all Jazz CoValue state into Zustand stores (late-join / reconnection).
 * Wraps hydration in runFromJazz() to prevent echo loops.
 *
 * Phase 1: Logs intent only. Actual CoValue reads require live instances from Phase 2.
 */
export function pullAllFromJazz(sessionRoot: unknown): void {
  console.log("[jazz-bridge] pullAllFromJazz: would hydrate stores from Jazz CoValues");
  // Phase 2: iterate blobs on sessionRoot, JSON.parse each, call reg.hydrator()
}

/**
 * Subscribe to Zustand store changes and mirror them to Jazz.
 *
 * Phase 1: Structural only — actual store subscriptions are wired in Phase 2.
 */
export function startBridge(_sessionRoot: unknown): void {
  console.log("[jazz-bridge] Bridge started (Phase 1 — structural only)");
}

/**
 * Tear down all active bridge subscriptions.
 */
export function stopBridge(): void {
  for (const unsub of activeSubscriptions) {
    unsub();
  }
  activeSubscriptions.length = 0;
  console.log("[jazz-bridge] Bridge stopped");
}
