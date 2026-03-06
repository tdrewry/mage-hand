/**
 * Jazz ↔ Zustand Bridge
 *
 * Bidirectional sync between Jazz CoValues and the existing Zustand stores.
 * Uses the DurableObjectRegistry's extractor/hydrator contract so we don't
 * duplicate serialization logic.
 *
 * Flow:
 *   Zustand store action → extractor() → CoValue mutation
 *   CoValue subscription  → hydrator(state) → Zustand store update
 *
 * Echo prevention: a `_fromJazz` flag is set during hydration so that
 * store subscriptions don't re-push the same change back to Jazz.
 */

import { DurableObjectRegistry } from "../durableObjects";
import type { JazzSessionRoot, JazzDOBlob } from "./schema";

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
 * Uses the blob approach for all stores — fine-grained token/map sync comes in Phase 2.
 */
export function pushAllToJazz(sessionRoot: JazzSessionRoot): void {
  const registrations = DurableObjectRegistry.getAll();
  const blobs = sessionRoot.blobs;
  if (!blobs) {
    console.warn("[jazz-bridge] No blobs list on session root — skipping push");
    return;
  }

  for (const reg of registrations) {
    const state = reg.extractor();
    const existing = findBlob(blobs, reg.kind);

    if (existing) {
      existing.state = JSON.stringify(state);
      existing.version = reg.version;
      existing.updatedAt = new Date().toISOString();
    } else {
      console.log(`[jazz-bridge] Would create blob for "${reg.kind}" — skipping until Phase 2 wiring`);
    }
  }
}

/**
 * Pull all Jazz CoValue state into Zustand stores (late-join / reconnection).
 * Wraps hydration in runFromJazz() to prevent echo loops.
 */
export function pullAllFromJazz(sessionRoot: JazzSessionRoot): void {
  const blobs = sessionRoot.blobs;
  if (!blobs) {
    console.warn("[jazz-bridge] No blobs list on session root — skipping pull");
    return;
  }

  runFromJazz(() => {
    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      if (!blob) continue;
      const reg = DurableObjectRegistry.get(blob.kind);
      if (!reg) {
        console.warn(`[jazz-bridge] No registration for kind "${blob.kind}" — skipping`);
        continue;
      }
      try {
        const parsed = typeof blob.state === 'string' ? JSON.parse(blob.state) : blob.state;
        reg.hydrator(parsed);
      } catch (e) {
        console.error(`[jazz-bridge] Failed to hydrate "${blob.kind}":`, e);
      }
    }
  });
}

/**
 * Subscribe to Zustand store changes and mirror them to Jazz.
 * Call this after joining/creating a session.
 *
 * NOTE: Phase 1 is structural only — actual store subscriptions are wired in Phase 2
 * once we have a live JazzSessionRoot instance from the auth/session flow.
 */
export function startBridge(_sessionRoot: JazzSessionRoot): void {
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

// ── Helpers ────────────────────────────────────────────────────────────────

function findBlob(blobs: JazzDOBlob[], kind: string): JazzDOBlob | undefined {
  for (const blob of blobs) {
    if (blob && blob.kind === kind) return blob;
  }
  return undefined;
}
