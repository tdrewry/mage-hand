// src/lib/net/NetworkConstants.ts
import type { ClientId } from "../../../networking/contract/v1";

function randomId(prefix = ""): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}${crypto.randomUUID()}`;
  }
  const rnd = Math.random().toString(16).slice(2);
  const time = Date.now().toString(16);
  return `${prefix}${time}-${rnd}`;
}

/**
 * Get or create a persistent client ID for this user session.
 * Stores in sessionStorage to ensure it persists across page refreshes
 * but is cleared when the tab is closed.
 */
export function getOrCreateClientId(storageKey = "vtt.clientId"): ClientId {
  if (typeof sessionStorage === "undefined") return randomId("c_");
  const existing = sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const created = randomId("c_");
  sessionStorage.setItem(storageKey, created);
  return created;
}
