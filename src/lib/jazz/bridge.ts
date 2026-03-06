/**
 * Jazz ↔ Zustand Bridge
 *
 * Bidirectional sync between Jazz CoValues and the existing Zustand stores.
 * Uses the DurableObjectRegistry's extractor/hydrator contract.
 *
 * Echo prevention: a `_fromJazz` flag is set during hydration so that
 * store subscriptions don't re-push the same change back to Jazz.
 *
 * IMPORTANT: This module does NOT import from src/lib/net/ — it's a standalone
 * transport that feeds into the same Zustand stores.
 */

import { useSessionStore, type Token } from "@/stores/sessionStore";
import type { JazzSessionRoot, JazzToken, JazzTokenList } from "./schema";
import { JazzToken as JazzTokenSchema, JazzTokenList as JazzTokenListSchema } from "./schema";

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

/** The current Jazz session root being bridged */
let _sessionRoot: JazzSessionRoot | null = null;

/**
 * Get the currently bridged session root (if any).
 */
export function getBridgedSessionRoot(): JazzSessionRoot | null {
  return _sessionRoot;
}

// ── Token bridge helpers ───────────────────────────────────────────────────

/** Convert a Zustand Token to a JazzToken-compatible init object */
function tokenToJazzInit(t: Token): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  // Capture fields not in JazzToken schema for forward-compat
  if (t.imageHash) extras.imageHash = t.imageHash;
  if (t.roleId) extras.roleId = t.roleId;
  if (t.isHidden) extras.isHidden = t.isHidden;
  if (t.labelPosition) extras.labelPosition = t.labelPosition;
  if (t.labelColor) extras.labelColor = t.labelColor;
  if (t.labelBackgroundColor) extras.labelBackgroundColor = t.labelBackgroundColor;
  if (t.notes) extras.notes = t.notes;
  if (t.initiative != null) extras.initiative = t.initiative;
  if (t.inCombat) extras.inCombat = t.inCombat;
  if (t.pathStyle) extras.pathStyle = t.pathStyle;

  return {
    tokenId: t.id,
    x: t.x,
    y: t.y,
    color: t.color || "#666",
    label: t.label || "",
    name: t.name || "",
    gridWidth: t.gridWidth,
    gridHeight: t.gridHeight,
    hp: (t as any).hp,
    maxHp: (t as any).maxHp,
    ac: (t as any).ac,
    hostility: (t as any).hostility,
    mapId: t.mapId,
    extras: Object.keys(extras).length > 0 ? JSON.stringify(extras) : undefined,
  };
}

/** Convert a JazzToken CoValue to a Zustand Token */
function jazzToZustandToken(jt: JazzToken): Token {
  let extras: Record<string, any> = {};
  try {
    if (jt.extras) extras = JSON.parse(jt.extras);
  } catch { /* invalid JSON */ }

  return {
    id: jt.tokenId,
    name: jt.name || "",
    imageUrl: "", // Image data is never synced via Jazz
    imageHash: extras.imageHash,
    x: jt.x,
    y: jt.y,
    gridWidth: jt.gridWidth,
    gridHeight: jt.gridHeight,
    label: jt.label || "",
    labelPosition: extras.labelPosition || "below",
    labelColor: extras.labelColor,
    labelBackgroundColor: extras.labelBackgroundColor,
    roleId: extras.roleId || "",
    isHidden: extras.isHidden || false,
    color: jt.color,
    mapId: jt.mapId,
    initiative: extras.initiative,
    inCombat: extras.inCombat,
    pathStyle: extras.pathStyle,
    notes: extras.notes,
  };
}

// ── Push: Zustand → Jazz ───────────────────────────────────────────────────

/**
 * Push all current tokens from Zustand into the Jazz session root.
 * Called on session create to populate the initial state.
 */
export function pushTokensToJazz(sessionRoot: JazzSessionRoot): void {
  const tokens = useSessionStore.getState().tokens;
  const jazzTokens = sessionRoot.tokens;
  if (!jazzTokens) {
    console.warn("[jazz-bridge] No tokens list on session root");
    return;
  }

  console.log(`[jazz-bridge] Pushing ${tokens.length} tokens to Jazz`);

  // Get the group from the session root for ownership
  const group = sessionRoot.$jazz.group;

  for (const t of tokens) {
    const init = tokenToJazzInit(t);
    const jt = JazzTokenSchema.create(init as any, group);
    jazzTokens.push(jt);
  }
}

/**
 * Push all current Zustand state into Jazz CoValues (initial sync on session create).
 */
export function pushAllToJazz(sessionRoot: JazzSessionRoot): void {
  pushTokensToJazz(sessionRoot);
  // Future: pushMapsToJazz, pushEffectsToJazz, etc.
}

// ── Pull: Jazz → Zustand ──────────────────────────────────────────────────

/**
 * Pull all tokens from Jazz into Zustand (late-join / reconnection).
 */
export function pullTokensFromJazz(sessionRoot: JazzSessionRoot): void {
  const jazzTokens = sessionRoot.tokens;
  if (!jazzTokens) {
    console.warn("[jazz-bridge] No tokens list on session root");
    return;
  }

  console.log(`[jazz-bridge] Pulling ${jazzTokens.length} tokens from Jazz`);

  runFromJazz(() => {
    const store = useSessionStore.getState();
    // Clear existing tokens
    store.tokens.forEach((t) => store.removeToken(t.id));
    // Add from Jazz
    for (const jt of jazzTokens) {
      if (jt) {
        store.addToken(jazzToZustandToken(jt));
      }
    }
  });
}

/**
 * Pull all Jazz CoValue state into Zustand stores (late-join / reconnection).
 */
export function pullAllFromJazz(sessionRoot: JazzSessionRoot): void {
  pullTokensFromJazz(sessionRoot);
  // Future: pullMapsFromJazz, etc.
}

// ── Live bridge: subscribe to both directions ─────────────────────────────

/**
 * Start the bidirectional bridge for tokens.
 * - Subscribes to Zustand token changes → mirrors to Jazz
 * - Subscribes to Jazz token changes → mirrors to Zustand
 */
export function startBridge(sessionRoot: JazzSessionRoot): void {
  _sessionRoot = sessionRoot;
  console.log("[jazz-bridge] Starting bridge");

  // ── Direction 1: Zustand → Jazz ──
  const unsubZustand = useSessionStore.subscribe(
    (state) => state.tokens,
    (tokens, prevTokens) => {
      // Skip if this change came from Jazz (echo prevention)
      if (_fromJazz) return;
      if (!_sessionRoot?.tokens) return;

      const jazzTokens = _sessionRoot.tokens;
      const group = _sessionRoot.$jazz.group;

      // Detect added tokens
      const prevIds = new Set(prevTokens.map((t) => t.id));
      for (const t of tokens) {
        if (!prevIds.has(t.id)) {
          // New token — create JazzToken and add to list
          const init = tokenToJazzInit(t);
          const jt = JazzTokenSchema.create(init as any, group);
          jazzTokens.push(jt);
          console.log(`[jazz-bridge] → Jazz: added token ${t.id}`);
        }
      }

      // Detect moved/updated tokens
      for (const t of tokens) {
        if (prevIds.has(t.id)) {
          const prev = prevTokens.find((pt) => pt.id === t.id);
          if (!prev) continue;
          // Only sync if position changed (most frequent update)
          if (prev.x !== t.x || prev.y !== t.y || prev.label !== t.label || prev.color !== t.color) {
            // Find matching JazzToken in the list
            for (let i = 0; i < jazzTokens.length; i++) {
              const jt = jazzTokens[i];
              if (jt && jt.tokenId === t.id) {
                jt.$jazz.set("x", t.x);
                jt.$jazz.set("y", t.y);
                if (t.label !== prev.label) jt.$jazz.set("label", t.label || "");
                if (t.color !== prev.color) jt.$jazz.set("color", t.color || "#666");
                break;
              }
            }
          }
        }
      }

      // Detect removed tokens
      const currentIds = new Set(tokens.map((t) => t.id));
      for (const prev of prevTokens) {
        if (!currentIds.has(prev.id)) {
          // Find and remove from Jazz list
          for (let i = 0; i < jazzTokens.length; i++) {
            const jt = jazzTokens[i];
            if (jt && jt.tokenId === prev.id) {
              // CoList doesn't have a remove method — we splice
              jazzTokens.splice(i, 1);
              console.log(`[jazz-bridge] → Jazz: removed token ${prev.id}`);
              break;
            }
          }
        }
      }
    },
  );
  activeSubscriptions.push(unsubZustand);

  // ── Direction 2: Jazz → Zustand ──
  // Subscribe to Jazz token list changes via $jazz.subscribe
  if (sessionRoot.tokens) {
    const unsubJazz = sessionRoot.tokens.$jazz.subscribe(
      { resolve: { $each: true } },
      (tokens) => {
        if (!tokens) return;
        
        runFromJazz(() => {
          const store = useSessionStore.getState();
          const currentIds = new Set(store.tokens.map((t) => t.id));
          const jazzIds = new Set<string>();

          for (const jt of tokens) {
            if (!jt) continue;
            jazzIds.add(jt.tokenId);

            if (currentIds.has(jt.tokenId)) {
              // Update existing token
              const existing = store.tokens.find((t) => t.id === jt.tokenId);
              if (existing && (existing.x !== jt.x || existing.y !== jt.y)) {
                store.updateTokenPosition(jt.tokenId, jt.x, jt.y);
              }
            } else {
              // New token from remote
              store.addToken(jazzToZustandToken(jt));
              console.log(`[jazz-bridge] ← Jazz: added token ${jt.tokenId}`);
            }
          }

          // Remove tokens that no longer exist in Jazz
          for (const t of store.tokens) {
            if (!jazzIds.has(t.id)) {
              store.removeToken(t.id);
              console.log(`[jazz-bridge] ← Jazz: removed token ${t.id}`);
            }
          }
        });
      },
    );
    activeSubscriptions.push(unsubJazz);
  }

  console.log("[jazz-bridge] Bridge started with token sync");
}

/**
 * Tear down all active bridge subscriptions.
 */
export function stopBridge(): void {
  for (const unsub of activeSubscriptions) {
    unsub();
  }
  activeSubscriptions.length = 0;
  _sessionRoot = null;
  console.log("[jazz-bridge] Bridge stopped");
}
